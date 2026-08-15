import express from "express";
import { getTutorials } from "../controllers/tutorial.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router=express.Router();

router.get('/',getTutorials);

export default router;