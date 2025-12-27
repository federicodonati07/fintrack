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

export async function POST(req: Request) {
  try {
    const { userId, subscriptionId, immediate = false } = (await req.json()) as {
      userId: string;
      subscriptionId: string;
      immediate?: boolean;
    };

    if (!userId || !subscriptionId) {
      return NextResponse.json(
        { error: "Missing userId or subscriptionId" },
        { status: 400 }
      );
    }

    let subscription;
    
    if (immediate) {
      // Cancel immediately (for account deletion)
      subscription = await stripe.subscriptions.cancel(subscriptionId);
      console.log(`🔄 Subscription ${subscriptionId} cancelled immediately for user ${userId}`);
      
      // Downgrade to free plan immediately
      await updateUserPlan({
        userId,
        plan: "free",
        planInterval: "monthly",
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: "",
      });
    } else {
      // Cancel at period end (user keeps access until billing cycle ends)
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      console.log(`🔄 Subscription ${subscriptionId} will be cancelled at period end for user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      message: immediate 
        ? "Subscription cancelled immediately" 
        : "Subscription will be cancelled at period end",
      cancelAt: subscription.cancel_at || subscription.canceled_at,
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return NextResponse.json(
      { error: "Unable to cancel subscription" },
      { status: 500 }
    );
  }
}






