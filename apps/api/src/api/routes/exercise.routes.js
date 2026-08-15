import express from "express";
import { 
    getAllExercise,
    getExerciseExample,
    getExerciseById,
    createExercise,
    updateExercise,
    deleteExercise } from "../controllers/exercise.controller";

import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/admin.middleware";

const router=express.Router();

router.get('/',authMiddleware,getAllExercise);

router.get('/example',authMiddleware,getAllExercise);

router.get('/:id',authMiddleware,getExerciseById);

router.post('/',authMiddleware,adminMiddleware,createExercise);

router.put('/:id',authMiddleware,adminMiddleware,updateExercise);

router.delete('/:id',authMiddleware,adminMiddleware,deleteExercise);

export default router;