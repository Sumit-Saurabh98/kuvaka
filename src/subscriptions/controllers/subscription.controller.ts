import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/subscription.service.js";
import { catchAsync, AppError } from "../../utils/errorHandler.js";
import Stripe from "stripe";
import { stripe } from "../../utils/stripe.js";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const subscriptionService = new SubscriptionService();

/**
 * POST /api/v1/subscribe/pro
 * Authenticated — starts Stripe Checkout session
 */
export const subscribeToPro = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  const userMobileNumber = req.user?.mobileNumber;
  if (!userId || !userMobileNumber) {
    return next(new AppError("User not authenticated.", 401));
  }
  const url = await subscriptionService.createProSubscriptionCheckoutSession(userId, userMobileNumber);
  res.status(200).json({
    status: "success",
    message: "Stripe Checkout session created.",
    data: { checkoutUrl: url },
  });
});

/**
 * POST /api/v1/webhook/stripe
 * Public — raw body
 */
export const handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    if (!sig) throw new Error("Stripe-Signature header missing.");
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("🔒 Stripe webhook verification failed:", message);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  await subscriptionService.handleStripeWebhook(event);
  res.status(200).json({ received: true });
});

/**
 * GET /api/v1/subscription/status
 * Authenticated — returns BASIC or PRO
 */
export const getSubscriptionStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) {
    return next(new AppError("User not authenticated.", 401));
  }
  const tier = await subscriptionService.getUserSubscriptionStatus(userId);
  res.status(200).json({
    status: "success",
    data: { tier },
  });
});
