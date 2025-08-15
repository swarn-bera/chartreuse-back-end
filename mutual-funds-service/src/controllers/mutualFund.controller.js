import { fetchAMFIData } from "../utils/amfiFetcher.js";

export async function getMutualFunds(req, res) {
  try {
    const rawData = await fetchAMFIData();
    const lines = rawData
      .split("\r")                   // split by carriage return
      .map(line => line.trim())      // remove extra spaces
      .filter(Boolean);              // remove empty lines

    const result = [];
    let currentFundHouse = null;

    // We'll pick first 100 fund entries only
    let fundCount = 0;
    const maxFunds = 100;

    for (const line of lines) {
      if (fundCount >= maxFunds) break;

      // Skip headers
      if (line.includes("Scheme Code") || line.startsWith("Open Ended Schemes")) continue;

      // Fund house line (no semicolon)
      if (!line.includes(";")) {
        currentFundHouse = line;
        continue;
      }
      
      // Fund entry line
      const [schemeCode, isinDivPayout, isinGrowth, schemeName, nav, date] = line.split(";");

      result.push({
        fundHouse: currentFundHouse,
        schemeCode: schemeCode?.trim(),
        isinDivPayout: isinDivPayout?.trim() || null,
        isinGrowth: isinGrowth?.trim() || null,
        schemeName: schemeName?.trim(),
        nav: parseFloat(nav),
        date: date?.trim(),
      });

      fundCount++;
    }

    res.json({ funds: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch mutual fund data" });
  }
}
