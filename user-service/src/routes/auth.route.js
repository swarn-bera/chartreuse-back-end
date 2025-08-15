import express from 'express';
import { signupUser, loginUser, getMyProfile } from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", signupUser);
router.post("/login", loginUser);
router.get("/me", verifyJWT, getMyProfile);

export default router;
