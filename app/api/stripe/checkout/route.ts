import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserDocument } from "@/lib/firestore";

const stripeSecret =
  process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;

if (!stripeSecret) {
  throw new Error(
    "Stripe secret key is missing. Set STRIPE_SECRET_KEY in your environment."
  );
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const prices = {
  pro: {
    monthly:
      process.env.STRIPE_PRICE_PRO_MONTHLY ||
      process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
    yearly:
      process.env.STRIPE_PRICE_PRO_YEARLY ||
      process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY,
  },
  ultra: {
    monthly:
      process.env.STRIPE_PRICE_ULTRA_MONTHLY ||
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ULTRA_MONTHLY,
    yearly:
      process.env.STRIPE_PRICE_ULTRA_YEARLY ||
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ULTRA_YEARLY,
  },
} as const;

type Plan = "free" | "pro" | "ultra";
type Interval = "monthly" | "yearly";

export async function POST(req: Request) {
  try {
    const { plan, interval, userId, email } = (await req.json()) as {
      plan: Plan;
      interval: Interval;
      userId: string;
      email?: string;
    };

    if (!plan || !interval || !userId) {
      return NextResponse.json(
        { error: "Missing plan, interval, or userId" },
        { status: 400 }
      );
    }

    if (plan === "free") {
      return NextResponse.json(
        { error: "Free plan does not require checkout" },
        { status: 400 }
      );
    }

    const priceId = prices[plan]?.[interval];

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID not configured for this plan/interval" },
        { status: 500 }
      );
    }

    // Get user's current subscription info
    const userDoc = await getUserDocument(userId);
    const currentSubscriptionId = userDoc?.stripeSubscriptionId;
    const currentCustomerId = userDoc?.stripeCustomerId;

    // If user has an existing subscription, cancel it first
    if (currentSubscriptionId) {
      try {
        console.log(`🔄 Cancelling existing subscription ${currentSubscriptionId} for user ${userId}`);
        await stripe.subscriptions.cancel(currentSubscriptionId);
        console.log(`✅ Successfully cancelled subscription ${currentSubscriptionId}`);
      } catch (error) {
        console.error("Error cancelling existing subscription:", error);
        // Continue with checkout even if cancellation fails
      }
    }

    // Create new checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/dashboard/plan?checkout=cancel`,
      customer_email: email,
      metadata: {
        userId,
        plan,
        interval,
      },
    };

    // If user has an existing customer ID, reuse it
    if (currentCustomerId) {
      sessionParams.customer = currentCustomerId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Unable to create checkout session" },
      { status: 500 }
    );
  }
}

