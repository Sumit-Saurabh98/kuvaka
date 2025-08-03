// src/subscriptions/routes/subscription.routes.ts
import express from "express";
import { subscribeToPro, handleStripeWebhook, getSubscriptionStatus } from "../controllers/subscription.controller.js";
import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();

// ⚠️ WEBHOOK must use RAW body parsing from app.ts — do **not** add express.raw() here again
router.post("/webhook/stripe", handleStripeWebhook);

// All below require JWT via protect()
router.use(protect);

router.post("/subscribe/pro", subscribeToPro);
router.get("/subscription/status", getSubscriptionStatus);

export default router;
