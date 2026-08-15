import express from "express";
import { getTutorials } from "../controllers/tutorial.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router=express.Router();

router.get('/',getTutorials);

export default router;