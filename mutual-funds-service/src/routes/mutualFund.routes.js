import { Router } from "express";
import { getMutualFunds } from "../controllers/mutualFund.controller.js";

const router = Router();

router.get("/", getMutualFunds);

export default router;
