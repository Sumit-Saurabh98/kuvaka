import Stripe from "stripe";
import { stripe } from "../../utils/stripe.js";
import {
  localPrismaClient,
  SubscriptionStatus,
  SubscriptionTier,
} from "../../utils/prisma.js";
import { AppError } from "../../utils/errorHandler.js";

const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID!;
const CLIENT_URL = process.env.CLIENT_URL!;

// --- Subscription Service ---
export class SubscriptionService {
  /** 
   * Creates or reuses a Stripe customer and returns a Checkout Session URL
   * that upgrades the user from BASIC → PRO.
   */
  async createProSubscriptionCheckoutSession(
    userId: string,
    userMobileNumber: string
  ): Promise<string> {
    // 1. Fetch user and include existing subscriptions
    const user = await localPrismaClient.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) {
      throw new AppError("User not found.", 404);
    }

    // 2. Reuse Stripe Customer ID if already exists
    let stripeCustomerId: string | undefined;

    const existing = user.subscription;
    if (existing?.stripeCustomerId) {
      stripeCustomerId = existing.stripeCustomerId;
    }

    // 3. Otherwise — create new Stripe Customer, track in the earliest subscription
    if (!stripeCustomerId) {
      const cust = await stripe.customers.create({
        email: `${userMobileNumber}@example.com`,
        metadata: { userId: user.id, mobileNumber: user.mobileNumber },
      });
      stripeCustomerId = cust.id;

      // track in the earliest subscription
      const firstSub = await localPrismaClient.subscription.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
      if (firstSub) {
        await localPrismaClient.subscription.update({
          where: { id: firstSub.id },
          data: { stripeCustomerId },
        });
      } else {
        await localPrismaClient.subscription.create({
          data: {
            userId: user.id,
            tier: SubscriptionTier.BASIC,
            status: SubscriptionStatus.ACTIVE,
            stripeCustomerId,
          },
        });
      }
    }

    // 4. Create Checkout Session with `client_reference_id` and `subscription_data.metadata`
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: user.id,
      subscription_data: {
        metadata: { userId: user.id },
      },
      line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: `${CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/cancel`,
    });

    if (!session.url) {
      throw new AppError("Failed to create Stripe Checkout session URL.", 500);
    }
    return session.url;
  }

  /**
   * Main Stripe webhook handler. Dispatches based on event type.
   */
  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    try {
      if (event.type === "checkout.session.completed") {
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
      } else if (event.type === "customer.subscription.created") {
        await this.handleSubscriptionCreated(
          event.data.object as Stripe.Subscription
        );
      } else if (event.type === "invoice.payment_succeeded") {
        await this.handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
      } else if (event.type === "invoice.payment_failed") {
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice
        );
      } else if (event.type === "customer.subscription.deleted") {
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
      } else {
        console.log(`Unhandled Stripe event: ${event.type}`);
      }
    } catch (err) {
      console.error(
        `❌ Error in handleStripeWebhook for event ${event.type}:`,
        err
      );
    }
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session
  ): Promise<void> {
    const stripeSubscriptionId = session.subscription as string | undefined;
    const userId: string | undefined =
      session.metadata?.userId ??
      (session.client_reference_id as string | undefined);
    if (!stripeSubscriptionId || !userId) {
      console.error("Missing userId or subscriptionId in session:", session.id);
      return;
    }
    await this.upgradeBasicToPro(userId, stripeSubscriptionId);
    console.log(
      `✅ [session.completed] Upgraded user=${userId} to PRO sub=${stripeSubscriptionId}`
    );
  }

  private async handleSubscriptionCreated(
    sub: Stripe.Subscription
  ): Promise<void> {
    const userId = sub.metadata?.userId as string | undefined;
    if (!userId) {
      console.warn("Subscription created without userId metadata:", sub.id);
      return;
    }
    await this.upgradeBasicToPro(userId, sub.id, sub);
    console.log(
      `✅ [subscription.created] Upgraded user=${userId} to PRO sub=${sub.id}`
    );
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice
  ): Promise<void> {
    // ⚠️ In Basil API, `invoice.subscription` is removed.
    // Use `invoice.parent.subscription_details.subscription`
    const subId =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (invoice as any)?.parent?.subscription_details?.subscription as
        | string
        | undefined;

    if (subId) {
      await this.upgradeProPeriodFor(subId);
      console.log(
        `✅ [invoice.payment_succeeded] Updated billing period for sub=${subId}`
      );
    } else {
      console.warn(
        "invoice.payment_succeeded without parent.subscription_details",
        invoice.id
      );
    }
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice
  ): Promise<void> {
    const subId = (invoice as any)?.parent?.subscription_details
      ?.subscription as string | undefined;
    if (subId) {
      await localPrismaClient.subscription.updateMany({
        where: { stripeSubscriptionId: subId },
        data: { status: SubscriptionStatus.INACTIVE },
      });
      console.warn(`⚠️ [invoice.payment_failed] Set INACTIVE for sub=${subId}`);
    }
  }

  private async handleSubscriptionDeleted(
    sub: Stripe.Subscription
  ): Promise<void> {
    await localPrismaClient.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { status: SubscriptionStatus.INACTIVE },
    });
    console.log(`⚠️ [subscription.deleted] Marked INACTIVE sub=${sub.id}`);
  }

  /**
   * Upgrade the user's BASIC plan to PRO — in-place (no new row).
   */
  private async upgradeBasicToPro(
    userId: string,
    stripeSubscriptionId: string,
    stripeSub?: Stripe.Subscription
  ): Promise<void> {
    const sub =
      stripeSub ||
      (await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ["items.data"],
      }));

    const firstItem = sub.items?.data?.[0];
    if (!firstItem) {
      console.error(`🔍 subscription has no items:`, sub.id);
      return;
    }

    // In Stripe Basil API, billing period info is now on the subscription item
    // (not on the Subscription object) :contentReference[oaicite:6]{index=6}
    const start = firstItem.current_period_start;
    const end = firstItem.current_period_end;
    if (typeof start !== "number" || typeof end !== "number") {
      console.error(`Unexpected billing timestamps on sub=${sub.id}`);
      return;
    }

    await localPrismaClient.subscription.updateMany({
      where: {
        userId,
        tier: SubscriptionTier.BASIC,
        status: SubscriptionStatus.ACTIVE,
      },
      data: {
        tier: SubscriptionTier.PRO,
        stripeSubscriptionId: stripeSubscriptionId,
        currentPeriodStart: new Date(start * 1000),
        currentPeriodEnd: new Date(end * 1000),
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }

  /**
   * Refresh the billing window if invoice succeeds (subscription stays PRO).
   */
  private async upgradeProPeriodFor(
    stripeSubscriptionId: string
  ): Promise<void> {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["items.data"],
    });
    const firstItem = sub.items?.data?.[0];
    if (!firstItem) return;

    const start = firstItem.current_period_start;
    const end = firstItem.current_period_end;
    if (typeof start !== "number" || typeof end !== "number") return;

    await localPrismaClient.subscription.updateMany({
      where: { stripeSubscriptionId, status: SubscriptionStatus.ACTIVE },
      data: {
        currentPeriodStart: new Date(start * 1000),
        currentPeriodEnd: new Date(end * 1000),
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }

  /**
   * Fetch the user's current subscription tier (BASIC or PRO)
   */
  async getUserSubscriptionStatus(userId: string): Promise<SubscriptionTier> {
    const user = await localPrismaClient.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const sub = user.subscription;
    if (
      sub &&
      sub.status === SubscriptionStatus.ACTIVE &&
      sub.tier === SubscriptionTier.PRO &&
      sub.currentPeriodEnd &&
      sub.currentPeriodEnd > new Date()
    ) {
      return SubscriptionTier.PRO;
    }

    if (
      sub &&
      sub.status === SubscriptionStatus.ACTIVE &&
      sub.tier === SubscriptionTier.BASIC
    ) {
      return SubscriptionTier.BASIC;
    }

    return SubscriptionTier.BASIC;
  }
}
