import { NextResponse } from "next/server";
import Stripe from "stripe";

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
    const { subscriptionId } = (await req.json()) as {
      subscriptionId: string;
    };

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Missing subscriptionId" },
        { status: 400 }
      );
    }

    // Retrieve subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return NextResponse.json({
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at,
    });
  } catch (error) {
    console.error("Error fetching subscription info:", error);
    return NextResponse.json(
      { error: "Unable to fetch subscription info" },
      { status: 500 }
    );
  }
}








