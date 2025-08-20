import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mutualFundRoutes from "./routes/mutualFund.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { startNavCron } from "./jobs/navCron.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/v1/mutual-funds", mutualFundRoutes);
// api/v1/mutual-funds?persist=1 
// this endpoint is used to populate the database with initial mutual fund data

if(process.env.ENABLE_NAV_CRON === '1') {
  startNavCron(app);
}

app.use(errorHandler);
export default app;