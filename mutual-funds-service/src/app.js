import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mutualFundRoutes from "./routes/mutualFund.routes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/mutual-funds", mutualFundRoutes);

export default app;