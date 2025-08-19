import { Router } from "express";
import { getMutualFunds, getFundMetricsAndRating, getFundRisk } from "../controllers/mutualFund.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", getMutualFunds);
router.get('/mutual-funds/:schemeCode/metrics-and-rating', verifyJWT, getFundMetricsAndRating);
router.get('/mutual-funds/:schemeCode/risk', verifyJWT, getFundRisk);

export default router;
