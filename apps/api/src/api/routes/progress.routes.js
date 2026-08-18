import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getProgressAnalytics } from "../controllers/progress.controller.js";

const router=express.Router();

router.get('/',authMiddleware,getProgressAnalytics);

export default router;