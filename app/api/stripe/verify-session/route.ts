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
    const { sessionId } = (await req.json()) as {
      sessionId: string;
    };

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed", status: session.payment_status },
        { status: 400 }
      );
    }

    // Extract metadata
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan as "free" | "pro" | "ultra" | undefined;
    const interval = session.metadata?.interval as "monthly" | "yearly" | undefined;
    const subscriptionId = typeof session.subscription === "string" 
      ? session.subscription 
      : session.subscription?.id;
    const customerId = session.customer as string | undefined;

    if (!userId || !plan || !interval) {
      return NextResponse.json(
        { error: "Missing required metadata" },
        { status: 400 }
      );
    }

    // Update Firestore
    await updateUserPlan({
      userId,
      plan,
      planInterval: interval,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });

    console.log(`✅ Successfully updated plan for user ${userId} to ${plan} (${interval})`);

    return NextResponse.json({
      success: true,
      plan,
      interval,
      message: "Plan updated successfully",
    });
  } catch (error) {
    console.error("Error verifying session:", error);
    return NextResponse.json(
      { error: "Unable to verify session" },
      { status: 500 }
    );
  }
}






