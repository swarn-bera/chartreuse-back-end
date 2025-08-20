// Simple historical data fetcher for on-demand metrics calculation
import fetch from 'node-fetch';

export async function fetchHistoricalNAV(schemeCode, days = 365) {
  try {
    const url = `https://api.mfapi.in/mf/${schemeCode}`;
    console.log(`Fetching historical data for ${schemeCode}...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Failed to fetch historical data for ${schemeCode}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    // mfapi returns: { meta: {...}, data: [{ date: "01-04-2023", nav: "245.67" }, ...] }
    if (!data.data || !Array.isArray(data.data)) {
      console.error(`Invalid data format for ${schemeCode}`);
      return [];
    }
    
    // Take last N days and convert to our format
    return data.data
      .slice(0, days) // Take first N records (most recent)
      .map(item => {
        // Convert dd-mm-yyyy to Date object properly
        const [day, month, year] = item.date.split('-');
        const date = new Date(year, month - 1, day); // month is 0-indexed in JS
        const nav = parseFloat(item.nav);
        
        return { date, nav };
      })
      .filter(item => !isNaN(item.nav)) // Remove invalid NAVs
      .sort((a, b) => b.date - a.date); // Sort newest first for calculations
      
  } catch (error) {
    console.error(`Error fetching historical data for ${schemeCode}:`, error);
    return [];
  }
}