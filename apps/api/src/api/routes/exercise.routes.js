import express from "express";
import { 
    getAllExercise,
    getExerciseExample,
    getExerciseById,
    createExercise,
    updateExercise,
    deleteExercise,
    streamExerciseVideo } from "../controllers/exercise.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { adminMiddleware } from "../middlewares/admin.middleware.js";

const router=express.Router();

router.get('/stream', streamExerciseVideo);

router.get('/',authMiddleware,getAllExercise);

router.get('/example',authMiddleware,getExerciseExample);

router.get('/:id',authMiddleware,getExerciseById);


router.post('/',authMiddleware,adminMiddleware,createExercise);

router.put('/:id',authMiddleware,adminMiddleware,updateExercise);

router.delete('/:id',authMiddleware,adminMiddleware,deleteExercise);

export default router;