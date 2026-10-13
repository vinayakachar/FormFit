import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getDashboardStats, getProgressAnalytics } from "../controllers/progress.controller.js";

const router=express.Router();

router.get('/',authMiddleware,getProgressAnalytics);
router.get('/dashboard',authMiddleware,getDashboardStats);

export default router;