import { PrismaClient } from '@prisma/client';
import { fetchAMFIData } from "../utils/amfiFetcher.js";
import { AMC_WHITELIST, normalizeAMC, detectCategory } from "../config/constants.js";
import { cagrFromDates, dailyReturns, stddevSample, annualizedVolatilityFromSeries, riskLabelFromVol } from "../utils/metrics.js";
import { fetchHistoricalNAV } from '../utils/historicalDataFetcher.js';

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

    // Add persist flag check
    const persist = _req.query.persist === '1';

    // Persist to DB when requested (for initial setup and daily cron)
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
            where: { schemeCode_date: { schemeCode: f.schemeCode, date: navDate } },
            update: { nav: f.nav },
            create: { schemeCode: f.schemeCode, date: navDate, nav: f.nav },
          });
          persisted++;
        }
      }
    }

    res.json({ 
      count: result.length, 
      persisted, 
      funds: result 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch mutual fund data" });
  }
}


// GET /api/v1/mutual-funds/:schemeCode/metrics-and-rating
export async function getFundMetricsAndRating(req, res) {
  const { schemeCode } = req.params;

  try {
    // Find fund & category
    const fund = await prisma.mutualFund.findUnique({
      where: { schemeCode },
      select: { category: true },
    });
    if (!fund) return res.status(404).json({ error: 'Unknown schemeCode' });

    // Get latest NAV from our database
    const latest = await prisma.nAVHistory.findFirst({
      where: { schemeCode },
      orderBy: { date: 'desc' },
    });
    if (!latest) return res.status(404).json({ error: 'No NAV history' });

    // Fetch historical data from mfapi.in for calculations
    console.log(`Fetching historical data for ${schemeCode}...`);
    const historicalData = await fetchHistoricalNAV(schemeCode, 1095); // ~3 years
    
    if (!historicalData || historicalData.length < 30) {
      return res.status(400).json({ error: 'Insufficient historical data for calculations' });
    }

    // Calculate CAGR
    const computeCAGR = (years) => {
      const targetDate = new Date();
      targetDate.setFullYear(targetDate.getFullYear() - years);
      
      // Find closest date to target
      const startPoint = historicalData.find(item => 
        new Date(item.date) <= targetDate
      ) || historicalData[historicalData.length - 1]; // fallback to oldest
      
      const endPoint = historicalData[0]; // most recent
      const actualYears = (new Date(endPoint.date) - new Date(startPoint.date)) / (365 * 24 * 60 * 60 * 1000);
      
      if (actualYears < 0.5) return null; // not enough data
      
      return cagrFromDates(startPoint.nav, endPoint.nav, actualYears);
    };

    const cagr1y = computeCAGR(1);
    const cagr3y = computeCAGR(3);

    // Calculate rating (simplified - you can enhance this later)
    let stars = null;
    if (cagr3y !== null) {
      // Simple rating based on CAGR thresholds
      if (cagr3y >= 0.15) stars = 5;      // >15% CAGR
      else if (cagr3y >= 0.12) stars = 4;  // 12-15% CAGR
      else if (cagr3y >= 0.10) stars = 3;  // 10-12% CAGR
      else if (cagr3y >= 0.08) stars = 2;  // 8-10% CAGR
      else stars = 1;                      // <8% CAGR
    }

    return res.json({
      schemeCode,
      category: fund.category,
      asOfDate: latest.date,
      cagr: { 
        y1: cagr1y ? Math.round(cagr1y * 10000) / 100 : null, // percentage with 2 decimals
        y3: cagr3y ? Math.round(cagr3y * 10000) / 100 : null 
      },
      rating: { stars },
      dataPoints: historicalData.length
    });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return res.status(500).json({ error: 'Failed to calculate metrics' });
  }
}

export async function getFundRisk(req, res) {
  const { schemeCode } = req.params;

  try {
    // Get latest NAV from our database for reference
    const latest = await prisma.nAVHistory.findFirst({
      where: { schemeCode },
      orderBy: { date: 'desc' },
    });

    if (!latest) return res.status(404).json({ error: 'No NAV history for scheme' });

    // Fetch 1 year of historical data from mfapi.in for volatility calculation
    console.log(`Fetching historical data for risk calculation: ${schemeCode}...`);
    const historicalData = await fetchHistoricalNAV(schemeCode, 365); // 1 year
    
    if (!historicalData || historicalData.length < 30) {
      return res.json({
        schemeCode,
        asOfDate: latest.date,
        volAnnual: null,
        riskLabel: 'Unknown',
        dataPoints: historicalData?.length || 0,
      });
    }

    // Convert to format expected by metrics function
    const series = historicalData.map(item => ({
      date: new Date(item.date),
      nav: item.nav
    })).reverse(); // reverse to get chronological order (oldest first)

    // Calculate annualized volatility and risk label
    const volAnnual = annualizedVolatilityFromSeries(series);   
    const riskLabel = riskLabelFromVol(volAnnual);

    return res.json({
      schemeCode,
      asOfDate: latest.date,
      volAnnual: volAnnual ? Math.round(volAnnual * 10000) / 100 : null, // percentage with 2 decimals
      riskLabel,
      dataPoints: series.length,
    });
  } catch (error) {
    console.error('Error calculating risk:', error);
    return res.status(500).json({ error: 'Failed to calculate risk metrics' });
  }
}