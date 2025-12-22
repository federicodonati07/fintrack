import { NextResponse } from "next/server";
import Stripe from "stripe";
import { updateUserPlan } from "@/lib/firestore";

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

type Plan = "pro" | "ultra";
type Interval = "monthly" | "yearly";

export async function POST(req: Request) {
  try {
    const { userId, subscriptionId, newPlan, newInterval } = (await req.json()) as {
      userId: string;
      subscriptionId: string;
      newPlan: Plan;
      newInterval: Interval;
    };

    if (!userId || !subscriptionId || !newPlan || !newInterval) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const newPriceId = prices[newPlan]?.[newInterval];

    if (!newPriceId) {
      return NextResponse.json(
        { error: "Price ID not configured for this plan/interval" },
        { status: 500 }
      );
    }

    // Retrieve current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Update subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: "always_invoice", // Charge/refund prorated amount immediately
      metadata: {
        userId,
        plan: newPlan,
        interval: newInterval,
      },
    });

    // Update Firestore
    await updateUserPlan({
      userId,
      plan: newPlan,
      planInterval: newInterval,
      stripeCustomerId: updatedSubscription.customer as string,
      stripeSubscriptionId: updatedSubscription.id,
    });

    console.log(`✅ Successfully updated subscription for user ${userId} to ${newPlan} (${newInterval})`);

    return NextResponse.json({
      success: true,
      plan: newPlan,
      interval: newInterval,
      message: "Subscription updated successfully",
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Unable to update subscription" },
      { status: 500 }
    );
  }
}




