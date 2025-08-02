import { Router } from 'express';
import { changePassword, forgotPassword, getMe, sendOtp, signup, verifyOtp } from '../controllers/auth.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/signup', signup);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);

// Protected routes
router.use(protect); 

router.post('/change-password', changePassword); 
router.get('/me', getMe); 

export default router;