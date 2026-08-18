import express from "express";
import { startWorkout,
    endWorkout,
    getAllWorkouts,
    getWorkoutById,
    deleteWorkout
 } from "../controllers/workout.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router=express.Router();

router.post('/start',authMiddleware,startWorkout);

router.post('/:id/end',authMiddleware,endWorkout);

router.get('/',authMiddleware,getAllWorkouts);

router.get('/:id',authMiddleware,getWorkoutById);

router.delete('/:id',authMiddleware,deleteWorkout);

export default router;