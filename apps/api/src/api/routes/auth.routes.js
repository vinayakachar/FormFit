import express from 'express';
import { validateRegistration, validateLogin } from '../middlewares/validators.js';
import { registerUser,
    loginUser,
    logoutUser,
    forgotPassword,
    resetPassword } from '../controllers/auth.controller.js';
import {authMiddleware} from '../middlewares/auth.middleware.js';

const router=express.Router();

router.post('/register',validateRegistration,registerUser);
router.post('/login',validateLogin,loginUser);

router.post('/forgot-password',forgotPassword);
router.put('/reset-password/:token',resetPassword);

router.post('/logout',authMiddleware,logoutUser);

export default router;