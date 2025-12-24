import { Router } from "express";
import {
  getMe,
  logout,
  refreshToken,
  reSendOtp,
  signup,
  verifyOtp,
} from "../controllers/auth.js";
import { protect } from "../../middleware/auth.js";

const router = Router();

router.route("/signup").post(signup);
router.route("/resend-otp").post(reSendOtp);
router.route("/verify-otp").post(verifyOtp);
router.route("/refresh").post(refreshToken);

// Protected routes
router.use(protect);

router.route("/logout").post(logout);
router.route("/me").get(getMe);

export default router;
