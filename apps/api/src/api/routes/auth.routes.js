import express from 'express';
import { validateRegistration, validateLogin } from '../middlewares/validators';
import { registerUser,
    loginUser,
    logoutUser,
    forgotPassword,
    resetPassword } from '../controllers/auth.controller';
import {authMiddleware} from '../middlewares/auth.middleware';
const router=express.Router();

router.post('/register',validateRegistration,registerUser);
router.post('/login',validateLogin,loginUser);

router.post('/forgot-password',forgotPassword);
router.put('/reset-password/:token',resetPassword);

router.post('/logout',authMiddleware,logoutUser);

export default router;