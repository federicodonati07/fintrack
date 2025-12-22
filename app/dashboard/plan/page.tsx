"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserDocument } from "@/lib/firestore";
import { RadioGroup } from "@headlessui/react";
import {
  ArrowLeftIcon,
  CheckIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";

type Plan = "free" | "pro" | "ultra";
type Interval = "monthly" | "yearly";

interface PriceData {
  amount: number;
  currency: string;
  formatted: string;
}

interface StripePrices {
  free: { monthly: PriceData; yearly: PriceData };
  pro: { monthly: PriceData; yearly: PriceData };
  ultra: { monthly: PriceData; yearly: PriceData };
}

export default function PlanPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<Plan>("free");
  const [userInterval, setUserInterval] = useState<Interval>("monthly");
  const [renewalDate, setRenewalDate] = useState<Date | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<Interval>("monthly");
  const [prices, setPrices] = useState<StripePrices | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast, hideToast } = useToast();

  // Check for cancelled checkout
  useEffect(() => {
    if (searchParams.get("checkout") === "cancel") {
      showToast("Payment cancelled.", "info");
      // Remove query params
      window.history.replaceState({}, "", "/dashboard/plan");
    }
  }, [searchParams, showToast]);

  // Fetch prices from Stripe
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch("/api/stripe/prices");
        const data = await response.json();
        setPrices(data);
      } catch (error) {
        console.error("Error fetching prices:", error);
      } finally {
        setPricesLoading(false);
      }
    };

    fetchPrices();
  }, []);

  const plans = useMemo(
    () => [
      {
        id: "free" as Plan,
        name: "Free",
        monthlyPrice: prices?.free.monthly.formatted || "€0",
        yearlyPrice: prices?.free.yearly.formatted || "€0",
        description: "Perfect for getting started",
        features: [
          "1 Account",
          "5 Expense Categories",
          "Monthly Charts",
          "Basic Analytics",
          "Manual Data Entry",
        ],
        recommended: false,
      },
      {
        id: "pro" as Plan,
        name: "Pro",
        monthlyPrice: prices?.pro.monthly.formatted || "€9.99",
        yearlyPrice: prices?.pro.yearly.formatted || "€99.99",
        description: "For serious financial tracking",
        features: [
          "3 Accounts",
          "15 Expense Categories",
          "Quarterly Charts",
          "Advanced Analytics",
          "Export Reports",
          "Priority Support",
        ],
        recommended: true,
      },
      {
        id: "ultra" as Plan,
        name: "Ultra",
        monthlyPrice: prices?.ultra.monthly.formatted || "€19.99",
        yearlyPrice: prices?.ultra.yearly.formatted || "€209.99",
        description: "Maximum features and flexibility",
        features: [
          "10 Accounts",
          "50 Expense Categories",
          "Full-time Charts",
          "Advanced Analytics",
          "Export Reports",
          "Priority Support",
          "Custom Categories",
          "API Access",
        ],
        recommended: false,
      },
    ],
    [prices]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/auth");
        return;
      }
      setUser(currentUser);

      try {
        const userDoc = await getUserDocument(currentUser.uid);
        if (userDoc) {
          setUserPlan((userDoc.plan as Plan) || "free");
          setUserInterval((userDoc.planInterval as Interval) || "monthly");
          
          // Fetch subscription renewal date if user has a paid plan
          if (userDoc.plan !== "free" && userDoc.stripeSubscriptionId) {
            fetchRenewalDate(userDoc.stripeSubscriptionId);
          }
        }
      } catch (error) {
        console.error("Error fetching user document:", error);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch subscription renewal date from Stripe
  const fetchRenewalDate = async (subscriptionId: string) => {
    try {
      const response = await fetch("/api/stripe/subscription-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.currentPeriodEnd) {
        setRenewalDate(new Date(data.currentPeriodEnd * 1000));
      }
    } catch (error) {
      console.error("Error fetching renewal date:", error);
    }
  };

  const formatRenewalDate = (date: Date) => {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const handleCheckout = async (plan: Plan, interval: Interval) => {
    if (!user) return;

    setCheckoutLoading(`${plan}-${interval}`);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, plan, interval }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      window.location.href = data.url as string;
    } catch (error) {
      console.error("Checkout error:", error);
      showToast("Impossibile avviare il pagamento. Riprova.", "error");
    } finally {
      setCheckoutLoading(null);
    }
  };


  if (loading || pricesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#1E293B]">Loading...</p>
        </div>
      </div>
    );
  }

  const getPlanGradient = (plan: Plan) => {
    switch (plan) {
      case "ultra":
        return "from-purple-500 to-pink-500";
      case "pro":
        return "from-[#22C55E] to-[#16A34A]";
      default:
        return "from-gray-400 to-gray-500";
    }
  };

  return (
    <>
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
      {/* Header Section */}
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <div>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] transition-colors mb-6 group cursor-pointer"
          >
            <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold text-[#0F172A] mb-2 tracking-tight">
                Choose your plan
              </h1>
              <p className="text-gray-500">
                You're currently on the{" "}
                <span className="font-semibold text-[#0F172A]">
                  {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                </span>{" "}
                {userPlan !== "free" && `plan (${userInterval === "yearly" ? "billed yearly" : "billed monthly"})`}
              </p>
            </div>

            {/* Interval Toggle - Premium Style */}
            <RadioGroup value={selectedInterval} onChange={setSelectedInterval}>
              <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-1">
                <RadioGroup.Option value="monthly">
                  {({ checked }) => (
                    <button
                      className={`relative px-5 py-2 rounded-full text-sm font-medium transition-all ${
                        checked
                          ? "bg-white text-[#0F172A] shadow-sm"
                          : "text-gray-500 hover:text-[#0F172A]"
                      }`}
                    >
                      Monthly
                    </button>
                  )}
                </RadioGroup.Option>
                <RadioGroup.Option value="yearly">
                  {({ checked }) => (
                    <button
                      className={`relative px-5 py-2 rounded-full text-sm font-medium transition-all ${
                        checked
                          ? "bg-white text-[#0F172A] shadow-sm"
                          : "text-gray-500 hover:text-[#0F172A]"
                      }`}
                    >
                      Yearly
                      <span className="ml-1.5 text-xs font-semibold text-[#22C55E]">
                        Save 17%
                      </span>
                    </button>
                  )}
                </RadioGroup.Option>
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>

      <main className="px-8 py-12 bg-gray-50">

        {/* Plans Grid - Premium Minimal Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === userPlan && selectedInterval === userInterval;
            const isUpgrade =
              (plan.id === "pro" && userPlan === "free") ||
              (plan.id === "ultra" && (userPlan === "free" || userPlan === "pro"));
            const isDowngrade =
              (plan.id === "free" && userPlan !== "free") ||
              (plan.id === "pro" && userPlan === "ultra");
            const price = selectedInterval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative group ${plan.recommended ? "md:scale-105" : ""}`}
              >
                {/* Premium Badge */}
                {plan.recommended && (
                  <div className="absolute -top-3 left-6 z-10">
                    <div className="inline-flex items-center gap-1.5 bg-[#22C55E] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                      <SparklesIcon className="w-3.5 h-3.5" />
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Card */}
                <div
                  className={`relative h-full bg-white rounded-3xl p-8 transition-all duration-300 ${
                    plan.recommended
                      ? "border-2 border-[#22C55E] shadow-xl shadow-[#22C55E]/10"
                      : isCurrent
                      ? "border-2 border-[#0F172A]/20 shadow-lg"
                      : "border border-gray-200 hover:border-gray-300 hover:shadow-lg"
                  }`}
                >
                  {/* Current Plan Badge with Renewal */}
                  {isCurrent && (
                    <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
                      <div className="bg-[#0F172A]/5 text-[#0F172A] text-xs font-medium px-3 py-1 rounded-full">
                        Current
                      </div>
                      {userPlan !== "free" && renewalDate && (
                        <div className="bg-[#22C55E]/10 text-[#0F172A] text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                          <svg className="w-3.5 h-3.5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Rinnovo {formatRenewalDate(renewalDate)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Plan Name & Description */}
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-[#0F172A] mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-gray-500">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-semibold text-[#0F172A] tracking-tight">
                        {price}
                      </span>
                      {plan.id !== "free" && (
                        <span className="text-gray-400 text-sm">
                          /{selectedInterval === "yearly" ? "year" : "mo"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features List - Minimal */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3 text-sm">
                        <CheckIcon className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button - Minimal Premium */}
                  <button
                    onClick={() => handleCheckout(plan.id, selectedInterval)}
                    disabled={isCurrent || checkoutLoading === `${plan.id}-${selectedInterval}`}
                    className={`w-full py-3.5 rounded-full font-medium text-sm transition-all duration-200 cursor-pointer ${
                      plan.recommended
                        ? "bg-[#22C55E] text-white hover:bg-[#16A34A] active:scale-95 shadow-sm hover:shadow-md"
                        : isCurrent
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : isUpgrade
                        ? "bg-[#0F172A] text-white hover:bg-[#1E293B] active:scale-95"
                        : isDowngrade
                        ? "bg-white text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                        : "bg-white text-[#0F172A] border border-gray-200 hover:border-[#22C55E] hover:text-[#22C55E]"
                    }`}
                  >
                    {checkoutLoading === `${plan.id}-${selectedInterval}` ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        Caricamento...
                      </div>
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : isUpgrade ? (
                      `Upgrade to ${plan.name}`
                    ) : isDowngrade ? (
                      `Passa a ${plan.name}`
                    ) : (
                      `Scegli ${plan.name}`
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Info - Minimal */}
        <div className="mt-16 pt-12 border-t border-gray-100">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-[#0F172A] mb-3">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-500">
              Upgrade, downgrade, or cancel anytime. No hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-4">
                <CheckIcon className="w-6 h-6 text-[#22C55E]" />
              </div>
              <h3 className="font-medium text-[#0F172A] mb-2">Instant access</h3>
              <p className="text-sm text-gray-500">
                All features available immediately after upgrade
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-4">
                <ShieldCheckIcon className="w-6 h-6 text-[#22C55E]" />
              </div>
              <h3 className="font-medium text-[#0F172A] mb-2">Secure payments</h3>
              <p className="text-sm text-gray-500">
                Your data is protected by Stripe's bank-level security
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-4">
                <ArrowLeftIcon className="w-6 h-6 text-[#22C55E]" />
              </div>
              <h3 className="font-medium text-[#0F172A] mb-2">Flexible plans</h3>
              <p className="text-sm text-gray-500">
                Change or cancel your plan anytime with no penalties
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
