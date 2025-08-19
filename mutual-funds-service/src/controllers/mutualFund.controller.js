import { PrismaClient } from '@prisma/client';
import { fetchAMFIData } from "../utils/amfiFetcher.js";
import { AMC_WHITELIST, normalizeAMC, detectCategory } from "../config/constants.js";
import { cagrFromDates, dailyReturns, stddevSample, annualizedVolatilityFromSeries, riskLabelFromVol } from "../utils/metrics.js";

const prisma = new PrismaClient();

// filtering and processing AMFI data
export async function getMutualFunds(_req, res) {
  try {
    const rawData = await fetchAMFIData();

    // AMFI uses newline; be robust for both \n and \r\n
    const lines = rawData
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const result = [];
    let currentAMC = null;
    let amcAllowed = false;

    for (const line of lines) {
      // Skip header rows in every section
      if (line.includes("Scheme Code") || line.startsWith("Open Ended Schemes")) continue;

      // AMC header
      if (!line.includes(";")) {
        currentAMC = line;  // "ICICI PRUDENTIAL MUTUAL FUND"
        amcAllowed = AMC_WHITELIST.has(normalizeAMC(currentAMC));
        continue;
      }

      if (!amcAllowed) continue;

      // Scheme line
      // Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
      const [schemeCode, isinPayoutOrGrowth, isinReinvestment, schemeName, nav, date] = line.split(";");
      const category = detectCategory(schemeName || "");

      // Keep only desired categories
      if (!category) continue;

      // Keep only Direct Growth variants (exclude Dividend/IDCW/Reinvestment)
      const nameUpper = (schemeName || "").toUpperCase();
      const isDirect = nameUpper.includes("DIRECT");
      const isGrowth = nameUpper.includes("GROWTH");
      const isDividendLike = /\b(DIVIDEND|IDCW|PAYOUT|REINVESTMENT)\b/i.test(nameUpper);
      if (!isDirect || !isGrowth || isDividendLike) continue;

      result.push({
        fundHouse: currentAMC,
        schemeCode: schemeCode?.trim(),
        isinPayoutOrGrowth: (isinPayoutOrGrowth || null)?.trim() || null,
        isinReinvestment: (isinReinvestment || null)?.trim() || null,
        schemeName: schemeName?.trim(),
        category, // detected category
        nav: nav ? parseFloat(nav) : null,
        date: date?.trim() || null,
      });
    }

    // Persist to DB when requested
    let persisted = 0;
    if (persist) {
      for (const f of result) {
        await prisma.mutualFund.upsert({
          where: { schemeCode: f.schemeCode },
          update: {
            fundHouse: f.fundHouse,
            schemeName: f.schemeName,
            category: f.category,
          },
          create: {
            schemeCode: f.schemeCode,
            fundHouse: f.fundHouse,
            schemeName: f.schemeName,
            category: f.category,
          },
        });

        if (f.nav != null && f.date) {
          // AMFI date is dd-MMM-yyyy; Date(...) handles this format
          const navDate = new Date(f.date);
          await prisma.nAVHistory.upsert({
            where: { schemeCode_date: { schemeCode: f.schemeCode, date: navDate } }, // requires @@id([schemeCode,date]) or @@unique named schemeCode_date
            update: { nav: f.nav },
            create: { schemeCode: f.schemeCode, date: navDate, nav: f.nav },
          });
          persisted++;
        }
      }
    }

    res.json({ count: result.length, persisted, funds: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch mutual fund data" });
  }
}


// GET /api/v1/mutual-funds/:schemeCode/metrics-and-rating
export async function getFundMetricsAndRating(req, res) {
  const { schemeCode } = req.params;

  // find fund & category
  const fund = await prisma.mutualFund.findUnique({
    where: { schemeCode },
    select: { category: true },
  });
  if (!fund) return res.status(404).json({ error: 'Unknown schemeCode' });

  // latest NAV
  const latest = await prisma.nAVHistory.findFirst({
    where: { schemeCode },
    orderBy: { date: 'desc' },
  });
  if (!latest) return res.status(404).json({ error: 'No NAV history' });

  const computeCAGR = async (years) => {
    const tgt = new Date(latest.date);
    tgt.setFullYear(tgt.getFullYear() - years);

    let start = await prisma.nAVHistory.findFirst({
      where: { schemeCode, date: { gte: tgt } },
      orderBy: { date: 'asc' },
    }) || await prisma.nAVHistory.findFirst({
      where: { schemeCode },
      orderBy: { date: 'asc' },
    });
    if (!start) return null;

    const yearsExact = (latest.date - start.date) / (365 * 24 * 60 * 60 * 1000);
    return cagrFromDates(start.nav, latest.nav, yearsExact);
  };

  const [cagr1y, cagr3y] = await Promise.all([computeCAGR(1), computeCAGR(3)]);

  // rating by category using 3Y CAGR
  let stars = null;
  if (cagr3y != null) {
    const peers = await prisma.mutualFund.findMany({
      where: { category: fund.category },
      select: { schemeCode: true },
    });

    const peerCagrs = [];
    for (const p of peers) {
      const pLatest = await prisma.nAVHistory.findFirst({
        where: { schemeCode: p.schemeCode },
        orderBy: { date: 'desc' },
      });
      if (!pLatest) continue;

      const tgt = new Date(pLatest.date);
      tgt.setFullYear(tgt.getFullYear() - 3);

      let pStart = await prisma.nAVHistory.findFirst({
        where: { schemeCode: p.schemeCode, date: { gte: tgt } },
        orderBy: { date: 'asc' },
      }) || await prisma.nAVHistory.findFirst({
        where: { schemeCode: p.schemeCode },
        orderBy: { date: 'asc' },
      });
      if (!pStart) continue;

      const yrsExact = (pLatest.date - pStart.date) / (365 * 24 * 60 * 60 * 1000);
      const pCagr = cagrFromDates(pStart.nav, pLatest.nav, yrsExact);
      if (pCagr != null) peerCagrs.push(pCagr);
    }

    if (peerCagrs.length) {
      const sorted = peerCagrs.sort((a, b) => a - b);
      const p = percentileRank(cagr3y, sorted);
      stars = starsFromPercentile(p);
    }
  }

  return res.json({
    schemeCode,
    category: fund.category,
    asOfDate: latest.date,
    cagr: { y1: cagr1y, y3: cagr3y },
    rating: { stars }, // null if not enough data
  });
}

export async function getFundRisk(req, res) {
  const { schemeCode } = req.params;

  const latest = await prisma.nAVHistory.findFirst({
    where: { schemeCode },
    orderBy: { date: 'desc' },
  });

  if (!latest) return res.status(404).json({ error: 'No NAV history for scheme' });

  const from = new Date(latest.date);
  from.setDate(from.getDate() - 400); // ~1 year window with cushion

  const series = await prisma.nAVHistory.findMany({
    where: { schemeCode, date: { gte: from, lte: latest.date } },
    orderBy: { date: 'asc' },
    select: { date: true, nav: true },
  });

  if (series.length < 30) {
    return res.json({
      schemeCode,
      asOfDate: latest.date,
      volAnnual: null,
      riskLabel: 'Unknown',
      days: series.length,
    });
  }

  // using the daily NAV series for computing the annualized volatility which is used to determine the risk label
  const volAnnual = annualizedVolatilityFromSeries(series);   
  const riskLabel = riskLabelFromVol(volAnnual);

  return res.json({
    schemeCode,
    asOfDate: latest.date,
    volAnnual, // 0.17 for 17%
    riskLabel,
    days: series.length,
  });
}