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
    const { userId, subscriptionId } = (await req.json()) as {
      userId: string;
      subscriptionId: string;
    };

    if (!userId || !subscriptionId) {
      return NextResponse.json(
        { error: "Missing userId or subscriptionId" },
        { status: 400 }
      );
    }

    // Cancel the subscription at period end (user keeps access until billing cycle ends)
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    console.log(`🔄 Subscription ${subscriptionId} will be cancelled at period end for user ${userId}`);

    // Optionally: Downgrade immediately to free plan
    // Uncomment the following if you want immediate downgrade:
    /*
    await updateUserPlan({
      userId,
      plan: "free",
      planInterval: "monthly",
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: "",
    });
    */

    return NextResponse.json({
      success: true,
      message: "Subscription will be cancelled at period end",
      cancelAt: subscription.cancel_at,
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return NextResponse.json(
      { error: "Unable to cancel subscription" },
      { status: 500 }
    );
  }
}






