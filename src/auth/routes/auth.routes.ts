import { Router } from 'express';
import { changePassword, forgotPassword, getMe, sendOtp, signup, verifyOtp } from '../controllers/auth.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = Router();

router.route('/signup').post(signup);
router.route('/send-otp').post(sendOtp);
router.route('/verify-otp').post(verifyOtp);
router.route('/forgot-password').post(forgotPassword);

// Protected routes
router.use(protect); 

router.route('/change-password').post(changePassword);
router.route('/me').get(getMe);

export default router;