import { getWorkoutHistory,getWorkoutById,deleteWorkout } from "../controllers/history.controller.js"; 
import { authMiddleware } from "../middlewares/auth.middleware.js";
import express from "express";

const router=express.Router();

router.use(authMiddleware);

router.get('/', getWorkoutHistory);

router.route('/:workoutId')
    .get(getWorkoutById)
    .delete(deleteWorkout);

export default router;