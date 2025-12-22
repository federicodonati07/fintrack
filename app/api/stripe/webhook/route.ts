import { NextResponse } from "next/server";
import Stripe from "stripe";
import { updateUserPlan } from "@/lib/firestore";

// Stripe signing secret for the webhook endpoint
const webhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET || process.env.NEXT_PUBLIC_STRIPE_WEBHOOK_SECRET;

const stripeSecret =
  process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;

if (!stripeSecret) {
  throw new Error(
    "Stripe secret key is missing. Set STRIPE_SECRET_KEY in your environment."
  );
}

if (!webhookSecret) {
  throw new Error(
    "Stripe webhook secret is missing. Set STRIPE_WEBHOOK_SECRET in your environment."
  );
}

const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan as "free" | "pro" | "ultra" | undefined;
        const interval = session.metadata?.interval as "monthly" | "yearly" | undefined;
        const subscriptionId = session.subscription as string | undefined;
        const customerId = session.customer as string | undefined;

        if (userId && plan && interval) {
          await updateUserPlan({
            userId,
            plan,
            planInterval: interval,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const price = subscription.items.data[0]?.price;
        const interval = (price?.recurring?.interval as "month" | "year" | undefined) === "year"
          ? "yearly"
          : "monthly";
        // Attempt to infer plan from price nickname/id if metadata not present
        const plan =
          (subscription.metadata?.plan as "free" | "pro" | "ultra" | undefined) ||
          (price?.nickname?.toLowerCase().includes("ultra")
            ? "ultra"
            : price?.nickname?.toLowerCase().includes("pro")
            ? "pro"
            : "pro");

        if (userId) {
          await updateUserPlan({
            userId,
            plan,
            planInterval: interval,
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          await updateUserPlan({
            userId,
            plan: "free",
            planInterval: "monthly",
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: "",
          });
        }
        break;
      }
      default:
        // Ignore other events
        break;
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}




