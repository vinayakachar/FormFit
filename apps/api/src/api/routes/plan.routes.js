import { generatePlan,savePlan,getLatestPlan } from "../controllers/plan.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import express from "express";

const router=express.Router();

router.post('/generate',authMiddleware,generatePlan);
router.post('/save',authMiddleware,savePlan);
router.get('/latest',authMiddleware,getLatestPlan);

export default router;