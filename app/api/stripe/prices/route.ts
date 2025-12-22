import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecret =
  process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;

if (!stripeSecret) {
  throw new Error("Stripe secret key is missing");
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20",
});

const priceIds = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  ultra: {
    monthly: process.env.STRIPE_PRICE_ULTRA_MONTHLY,
    yearly: process.env.STRIPE_PRICE_ULTRA_YEARLY,
  },
};

export async function GET() {
  try {
    const prices = {
      free: {
        monthly: { amount: 0, currency: "eur", formatted: "€0" },
        yearly: { amount: 0, currency: "eur", formatted: "€0" },
      },
      pro: {
        monthly: { amount: 0, currency: "eur", formatted: "€9.99" },
        yearly: { amount: 0, currency: "eur", formatted: "€99.99" },
      },
      ultra: {
        monthly: { amount: 0, currency: "eur", formatted: "€19.99" },
        yearly: { amount: 0, currency: "eur", formatted: "€209.99" },
      },
    };

    // Fetch Pro prices
    if (priceIds.pro.monthly) {
      try {
        const proMonthly = await stripe.prices.retrieve(priceIds.pro.monthly);
        prices.pro.monthly = {
          amount: proMonthly.unit_amount || 0,
          currency: proMonthly.currency,
          formatted: formatPrice(proMonthly.unit_amount || 0, proMonthly.currency),
        };
      } catch (error) {
        console.error("Error fetching Pro monthly price:", error);
      }
    }

    if (priceIds.pro.yearly) {
      try {
        const proYearly = await stripe.prices.retrieve(priceIds.pro.yearly);
        prices.pro.yearly = {
          amount: proYearly.unit_amount || 0,
          currency: proYearly.currency,
          formatted: formatPrice(proYearly.unit_amount || 0, proYearly.currency),
        };
      } catch (error) {
        console.error("Error fetching Pro yearly price:", error);
      }
    }

    // Fetch Ultra prices
    if (priceIds.ultra.monthly) {
      try {
        const ultraMonthly = await stripe.prices.retrieve(priceIds.ultra.monthly);
        prices.ultra.monthly = {
          amount: ultraMonthly.unit_amount || 0,
          currency: ultraMonthly.currency,
          formatted: formatPrice(ultraMonthly.unit_amount || 0, ultraMonthly.currency),
        };
      } catch (error) {
        console.error("Error fetching Ultra monthly price:", error);
      }
    }

    if (priceIds.ultra.yearly) {
      try {
        const ultraYearly = await stripe.prices.retrieve(priceIds.ultra.yearly);
        prices.ultra.yearly = {
          amount: ultraYearly.unit_amount || 0,
          currency: ultraYearly.currency,
          formatted: formatPrice(ultraYearly.unit_amount || 0, ultraYearly.currency),
        };
      } catch (error) {
        console.error("Error fetching Ultra yearly price:", error);
      }
    }

    return NextResponse.json(prices);
  } catch (error) {
    console.error("Error fetching prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}

function formatPrice(amount: number, currency: string): string {
  const value = amount / 100;
  const currencySymbol = currency.toLowerCase() === "eur" ? "€" : "$";
  return `${currencySymbol}${value.toFixed(2)}`;
}

