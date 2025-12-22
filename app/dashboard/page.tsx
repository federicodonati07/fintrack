"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserDocument } from "@/lib/firestore";
import { Button, Card, CardBody, Chip, Progress } from "@heroui/react";
import {
  UserIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
  WalletIcon,
  BanknotesIcon,
  ChartBarIcon,
  ArrowRightIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  SparklesIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";

type Plan = "free" | "pro" | "ultra";
type Interval = "monthly" | "yearly";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<Plan>("free");
  const [userInterval, setUserInterval] = useState<Interval>("monthly");
  const [renewalDate, setRenewalDate] = useState<Date | null>(null);
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();

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

  // Check for successful checkout and verify session
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const checkoutStatus = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    
    if (checkoutStatus === "success" && sessionId && user) {
      // Verify and update plan via API
      const verifyAndUpdate = async () => {
        try {
          setLoading(true);
          
          const response = await fetch("/api/stripe/verify-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          
          const data = await response.json();
          
          if (response.ok && data.success) {
            // Refresh user data from Firestore
            const userDoc = await getUserDocument(user.uid);
            if (userDoc) {
              setUserPlan(userDoc.plan as Plan);
              setUserInterval(userDoc.planInterval as Interval);
              
              // Fetch renewal date for paid plans
              if (userDoc.plan !== "free" && userDoc.stripeSubscriptionId) {
                fetchRenewalDate(userDoc.stripeSubscriptionId);
              }
            }
            
            // Show success toast
            const intervalText = data.interval === "monthly" ? "Mensile" : "Annuale";
            showToast(
              `Piano aggiornato con successo a ${data.plan.toUpperCase()} (${intervalText})!`,
              "success"
            );
          } else {
            console.error("Error verifying session:", data.error);
            showToast(
              "Pagamento completato, ma aggiornamento del piano in sospeso. Ricarica la pagina.",
              "error"
            );
          }
        } catch (error) {
          console.error("Error verifying session:", error);
          showToast(
            "Pagamento completato, ma aggiornamento del piano in sospeso. Ricarica la pagina.",
            "error"
          );
        } finally {
          setLoading(false);
          // Remove query params from URL
          window.history.replaceState({}, "", "/dashboard");
        }
      };
      
      verifyAndUpdate();
    } else if (checkoutStatus === "cancel") {
      // User cancelled checkout
      showToast("Pagamento annullato.", "info");
      // Remove query params
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [user, showToast]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#1E293B]">Loading...</p>
        </div>
      </div>
    );
  }

  const formatRenewalDate = (date: Date) => {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const getPlanColor = (plan: Plan) => {
    switch (plan) {
      case "ultra":
        return "bg-gradient-to-r from-purple-500 to-pink-500";
      case "pro":
        return "bg-gradient-to-r from-[#22C55E] to-[#16A34A]";
      default:
        return "bg-gradient-to-r from-gray-400 to-gray-500";
    }
  };

  const getPlanLimits = (plan: Plan) => {
    switch (plan) {
      case "ultra":
        return { accounts: 10, categories: 50 };
      case "pro":
        return { accounts: 3, categories: 15 };
      default:
        return { accounts: 1, categories: 5 };
    }
  };

  const limits = getPlanLimits(userPlan);

  return (
    <>
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A] mb-1">Dashboard</h1>
            <p className="text-sm text-gray-500">
              Welcome back, {user?.displayName || user?.email?.split("@")[0] || "User"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* User Name Display */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <span className="text-sm font-medium text-[#0F172A]">
                {user?.displayName || user?.email?.split("@")[0] || "User"}
              </span>
            </div>

            {/* Plan Badge with Renewal Date */}
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => router.push("/dashboard/plan")}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors group cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full ${getPlanColor(userPlan)}`}></div>
                <span className="text-sm font-medium text-[#0F172A] capitalize">
                  {userPlan} Plan
                </span>
                {userPlan !== "free" && (
                  <span className="text-xs text-gray-500">
                    ({userInterval === "yearly" ? "Yearly" : "Monthly"})
                  </span>
                )}
                <SparklesIcon className="w-4 h-4 text-[#22C55E] group-hover:scale-110 transition-transform" />
              </button>
              {userPlan !== "free" && renewalDate && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-[#22C55E]/10 rounded-full">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span className="text-xs font-medium text-[#0F172A]">
                    Rinnovo: {formatRenewalDate(renewalDate)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-8 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#22C55E]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#A7F3D0]/10 rounded-full blur-3xl"></div>
          
          <div className="relative">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Welcome back, {user?.displayName?.split(" ")[0] || "User"}! 👋
            </h1>
            <p className="text-gray-300 text-lg">
              Here&apos;s your financial overview
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-gray-50">
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <WalletIcon className="w-6 h-6 text-blue-600" />
                </div>
                <Chip size="sm" className="bg-blue-100 text-blue-700">
                  +12.5%
                </Chip>
              </div>
              <p className="text-sm text-gray-600 mb-1">Total Balance</p>
              <p className="text-2xl font-bold text-[#0F172A]">€5,420.00</p>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-gray-50">
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />
                </div>
                <Chip size="sm" className="bg-green-100 text-green-700">
                  +8.2%
                </Chip>
              </div>
              <p className="text-sm text-gray-600 mb-1">Income</p>
              <p className="text-2xl font-bold text-[#0F172A]">€3,200.00</p>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-gray-50">
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <BanknotesIcon className="w-6 h-6 text-orange-600" />
                </div>
                <Chip size="sm" className="bg-orange-100 text-orange-700">
                  -3.1%
                </Chip>
              </div>
              <p className="text-sm text-gray-600 mb-1">Expenses</p>
              <p className="text-2xl font-bold text-[#0F172A]">€1,840.00</p>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-gray-50">
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <ChartBarIcon className="w-6 h-6 text-purple-600" />
                </div>
                <Chip size="sm" className="bg-purple-100 text-purple-700">
                  Active
                </Chip>
              </div>
              <p className="text-sm text-gray-600 mb-1">Accounts</p>
              <p className="text-2xl font-bold text-[#0F172A]">
                1<span className="text-base text-gray-500">/{limits.accounts}</span>
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Plan Usage & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plan Usage */}
          <Card className="lg:col-span-2 border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#0F172A]">Plan Usage</h2>
                <Button
                  size="sm"
                  className="bg-[#22C55E] text-white rounded-full hover:bg-[#16A34A] transition-colors"
                  onClick={() => router.push("/dashboard/plan")}
                  endContent={<ArrowRightIcon className="w-4 h-4" />}
                >
                  Upgrade
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Accounts</span>
                    <span className="text-sm text-gray-600">1 / {limits.accounts}</span>
                  </div>
                  <Progress
                    value={(1 / limits.accounts) * 100}
                    className="h-2"
                    classNames={{
                      indicator: "bg-gradient-to-r from-[#22C55E] to-[#16A34A]",
                    }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Categories</span>
                    <span className="text-sm text-gray-600">3 / {limits.categories}</span>
                  </div>
                  <Progress
                    value={(3 / limits.categories) * 100}
                    className="h-2"
                    classNames={{
                      indicator: "bg-gradient-to-r from-blue-500 to-blue-600",
                    }}
                  />
                </div>

                {userPlan === "free" && (
                  <div className="bg-[#A7F3D0]/20 border border-[#22C55E]/30 rounded-xl p-4 mt-4">
                    <p className="text-sm text-[#0F172A] mb-2 font-medium">
                      ✨ Upgrade to unlock more features
                    </p>
                    <p className="text-xs text-gray-600">
                      Get access to more accounts, categories, and advanced analytics
                    </p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
            <CardBody className="p-6">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Quick Actions</h2>
              <div className="space-y-3">
                <Button
                  className="w-full justify-start bg-white hover:bg-gray-50 text-[#0F172A] border border-gray-200 rounded-xl shadow-sm"
                  startContent={<WalletIcon className="w-5 h-5 text-[#22C55E]" />}
                >
                  Add Transaction
                </Button>
                <Button
                  className="w-full justify-start bg-white hover:bg-gray-50 text-[#0F172A] border border-gray-200 rounded-xl shadow-sm"
                  startContent={<ChartBarIcon className="w-5 h-5 text-blue-600" />}
                >
                  View Analytics
                </Button>
                <Button
                  className="w-full justify-start bg-white hover:bg-gray-50 text-[#0F172A] border border-gray-200 rounded-xl shadow-sm"
                  startContent={<CreditCardIcon className="w-5 h-5 text-purple-600" />}
                  onClick={() => router.push("/dashboard/plan")}
                >
                  Manage Plan
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Getting Started */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-[#22C55E]/5 to-[#A7F3D0]/5">
          <CardBody className="p-6">
            <h2 className="text-xl font-bold text-[#0F172A] mb-4">Get Started with FinTrack</h2>
            <p className="text-gray-600 mb-6">
              Your account has been successfully created. Start managing your finances by adding your first account and tracking transactions.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-[#22C55E] text-white rounded-full hover:bg-[#16A34A] transition-colors shadow-lg shadow-[#22C55E]/30"
                startContent={<WalletIcon className="w-5 h-5" />}
              >
                Add Your First Account
              </Button>
              <Button
                variant="bordered"
                className="border-2 border-[#22C55E] text-[#22C55E] rounded-full hover:bg-[#22C55E]/10 transition-colors"
              >
                Watch Tutorial
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    </>
  );
}
