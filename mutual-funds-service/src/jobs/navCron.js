import cron from "node-cron";
import { getMutualFunds } from "../controllers/./mutualFund.controller.js";

export const startNavCron = (app) => {
  // run every day at 10:30 PM IST (Asia/Kolkata) after the AMFI NAV updates
  cron.schedule("30 22 * * *", async () => {
    try {
      const req = {  query: { persist: '1'}}
      const res = {
        json: (x) => console.log('[NAV CRON] persisted', x.count),
        status: (c) => ({ json: (x) => console.error('[NAV CRON]', c, x) }),
      };
      await getMutualFunds(req, res);
    } 
    catch (error) {
      console.error("Error during NAV update:", error);
    }
  }, { timezone: 'Asia/Kolkata' });
}