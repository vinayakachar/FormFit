import { getDailyDiet,saveDailyDiet,getDietHistory } from "../controllers/diet.controller.js";
import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
const router=express.Router();

router.get('/:date',authMiddleware,getDailyDiet);
router.post('/:date',authMiddleware,saveDailyDiet);


router.get('/',authMiddleware,getDietHistory);

export default router;