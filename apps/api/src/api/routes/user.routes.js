import { getUserProfile,updateUserProfile } from "../controllers/user.controller.js";
import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router=express.Router();

router.route('/me')
    .get(authMiddleware,getUserProfile)
    .put(authMiddleware,updateUserProfile);

export default router;