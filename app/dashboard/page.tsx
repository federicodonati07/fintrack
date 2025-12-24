"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserDocument, getUserCategories, getUserFunds, getPlanLimits, getAccounts, getSubAccounts, getTransactions } from "@/lib/firestore";
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
  ShieldCheckIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";

type Plan = "free" | "pro" | "ultra" | "admin";
type Interval = "monthly" | "yearly";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<Plan>("free");
  const [userInterval, setUserInterval] = useState<Interval>("monthly");
  const [renewalDate, setRenewalDate] = useState<Date | null>(null);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [accountsCount, setAccountsCount] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [limits, setLimits] = useState({ accounts: 1, categories: 10 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
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
          const plan = (userDoc.plan as Plan) || "free";
          setUserPlan(plan);
          setUserInterval((userDoc.planInterval as Interval) || "monthly");
          
          // Check if user is admin
          if (userDoc.role === "admin" || userDoc.plan === "admin") {
            setIsAdmin(true);
          }
          
          // Fetch dynamic plan limits
          const planLimits = await getPlanLimits(plan);
          setLimits(planLimits);
          
          // Fetch subscription renewal date if user has a paid plan
          if (userDoc.plan !== "free" && userDoc.plan !== "admin" && userDoc.stripeSubscriptionId) {
            fetchRenewalDate(userDoc.stripeSubscriptionId);
          }
        }

        // Fetch categories count
        const categories = await getUserCategories(currentUser.uid);
        setCategoriesCount(categories.filter((c) => !c.archived).length);

        // Fetch accounts count and total balance (including partitions)
        const accounts = await getAccounts(currentUser.uid);
        const activeAccounts = accounts.filter((a) => !a.archived);
        setAccountsCount(activeAccounts.length);
        
        // Calculate total balance including all partitions
        let total = 0;
        for (const account of activeAccounts) {
          total += account.currentBalance;
          if (account.hasSubAccounts) {
            const subs = await getSubAccounts(currentUser.uid, account.id);
            total += subs.reduce((sum, sub) => sum + (sub.balance || 0), 0);
          }
        }
        setTotalBalance(total);

        // Fetch recent transactions (last 5)
        const transactions = await getTransactions(currentUser.uid);
        setRecentTransactions(transactions.slice(0, 5));

        // Calculate monthly income and expenses
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        let income = 0;
        let expenses = 0;
        
        transactions.forEach((transaction) => {
          const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
          if (transactionDate >= firstDayOfMonth && transactionDate <= lastDayOfMonth) {
            if (transaction.type === "income") {
              income += transaction.amount;
            } else if (transaction.type === "expense") {
              expenses += transaction.amount;
            }
          }
        });
        
        setMonthlyIncome(income);
        setMonthlyExpenses(expenses);
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

            {/* Admin Button or Plan Badge */}
            {isAdmin ? (
              <Button
                onClick={() => router.push("/dashboard/admin")}
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-2xl hover:shadow-xl hover:shadow-purple-500/30 transition-all px-6 font-semibold"
                startContent={<ShieldCheckIcon className="w-5 h-5" />}
              >
                Admin Dashboard
              </Button>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-8 py-8 space-y-6 bg-gradient-to-br from-gray-50 to-white min-h-screen">
        {/* Welcome Section */}
        <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-3xl p-10 text-white shadow-xl relative overflow-hidden border border-white/10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#22C55E]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#A7F3D0]/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl"></div>
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center shadow-lg">
                <span className="text-2xl">👋</span>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  Welcome back, {user?.displayName?.split(" ")[0] || "User"}!
                </h1>
              </div>
            </div>
            <p className="text-gray-300 text-lg ml-15">
              Here&apos;s your financial overview for today
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Balance Card */}
          <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-white to-blue-50/30 hover:scale-[1.02] rounded-2xl">
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/30">
                  <WalletIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Total Balance
              </p>
              <p className="text-3xl font-bold text-[#0F172A] mb-1">
                €{totalBalance.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">All accounts combined</p>
            </CardBody>
          </Card>

          {/* Income Card */}
          <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-white to-green-50/30 hover:scale-[1.02] rounded-2xl cursor-pointer" onClick={() => router.push("/dashboard/transactions")}>
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg shadow-green-500/30">
                  <ArrowTrendingUpIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Income
              </p>
              <p className="text-3xl font-bold text-green-600 mb-1">€{monthlyIncome.toFixed(2)}</p>
              <p className="text-xs text-gray-400">This month</p>
            </CardBody>
          </Card>

          {/* Expenses Card */}
          <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-white to-orange-50/30 hover:scale-[1.02] rounded-2xl cursor-pointer" onClick={() => router.push("/dashboard/transactions")}>
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg shadow-orange-500/30">
                  <BanknotesIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Expenses
              </p>
              <p className="text-3xl font-bold text-orange-600 mb-1">€{monthlyExpenses.toFixed(2)}</p>
              <p className="text-xs text-gray-400">This month</p>
            </CardBody>
          </Card>

          {/* Accounts Card */}
          <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-white to-purple-50/30 hover:scale-[1.02] rounded-2xl">
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg shadow-purple-500/30">
                  <ChartBarIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Accounts
              </p>
              <p className="text-3xl font-bold text-[#0F172A] mb-1">
                {accountsCount}<span className="text-xl text-gray-400">/{limits.accounts}</span>
              </p>
              <p className="text-xs text-gray-400">Active accounts</p>
            </CardBody>
          </Card>
        </div>

        {/* Plan Usage & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Plan Usage */}
          <Card className="lg:col-span-2 border-0 shadow-md hover:shadow-lg transition-shadow bg-white rounded-2xl">
            <CardBody className="p-7">
              <div className="flex items-center justify-between mb-7">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A] mb-1">Plan Usage</h2>
                  <p className="text-sm text-gray-500">Track your subscription limits</p>
                </div>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-full hover:shadow-lg hover:shadow-[#22C55E]/30 transition-all px-5"
                  onClick={() => router.push("/dashboard/plan")}
                  endContent={<SparklesIcon className="w-4 h-4" />}
                >
                  Upgrade
                </Button>
              </div>

              <div className="space-y-6">
                {/* Accounts Progress - Clickable */}
                <div
                  onClick={() => router.push("/dashboard/accounts")}
                  className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-2xl border border-gray-100 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-xl group-hover:scale-110 transition-transform">
                        <WalletIcon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">Accounts</span>
                    </div>
                    <span className="text-sm font-bold text-[#0F172A] bg-gray-100 px-3 py-1 rounded-full">
                      {accountsCount} / {limits.accounts}
                    </span>
                  </div>
                  <Progress
                    value={(accountsCount / limits.accounts) * 100}
                    className="h-2.5"
                    classNames={{
                      indicator: "bg-gradient-to-r from-[#22C55E] to-[#16A34A]",
                      track: "bg-gray-200",
                    }}
                  />
                </div>

                {/* Categories Progress - Clickable */}
                <div
                  onClick={() => router.push("/dashboard/categories")}
                  className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-100 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                        <ChartBarIcon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">Categories</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0F172A] bg-blue-100 px-3 py-1 rounded-full">
                        {categoriesCount} / {limits.categories}
                      </span>
                      <ArrowRightIcon className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                  <Progress
                    value={(categoriesCount / limits.categories) * 100}
                    className="h-2.5"
                    classNames={{
                      indicator: "bg-gradient-to-r from-blue-500 to-blue-600",
                      track: "bg-blue-100",
                    }}
                  />
                </div>

                {/* Upgrade Banner */}
                {userPlan === "free" && (
                  <div className="bg-gradient-to-br from-[#22C55E]/10 via-[#A7F3D0]/20 to-white border-2 border-[#22C55E]/30 rounded-2xl p-5 mt-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#22C55E]/10 rounded-full blur-2xl"></div>
                    <div className="relative">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="p-2 bg-[#22C55E] rounded-xl">
                          <SparklesIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm text-[#0F172A] font-bold mb-1">
                            Unlock Premium Features
                          </p>
                          <p className="text-xs text-gray-600">
                            Upgrade to PRO for more accounts, categories, and advanced analytics
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white rounded-2xl">
            <CardBody className="p-7">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#0F172A] mb-1">Quick Actions</h2>
                <p className="text-sm text-gray-500">Shortcuts to common tasks</p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/dashboard/transactions")}
                  className="w-full justify-start bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 hover:from-green-100 hover:to-emerald-100 text-[#0F172A] border-2 border-green-200 hover:border-green-400 rounded-2xl shadow-md hover:shadow-lg transition-all group"
                  startContent={
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl group-hover:scale-110 transition-transform shadow-lg">
                      <BanknotesIcon className="w-4 h-4 text-white" />
                    </div>
                  }
                  endContent={
                    <ArrowRightIcon className="w-4 h-4 text-green-600 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  <span className="font-bold">Add Transaction</span>
                </Button>
                <Button
                  onClick={() => router.push("/dashboard/accounts")}
                  className="w-full justify-start bg-gradient-to-br from-gray-50 to-white hover:from-[#22C55E]/10 hover:to-[#22C55E]/5 text-[#0F172A] border border-gray-200 hover:border-[#22C55E]/50 rounded-2xl shadow-sm hover:shadow-md transition-all group"
                  startContent={
                    <div className="p-2 bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-xl group-hover:scale-110 transition-transform">
                      <WalletIcon className="w-4 h-4 text-white" />
                    </div>
                  }
                  endContent={
                    <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  Manage Accounts
                </Button>
                <Button
                  className="w-full justify-start bg-gradient-to-br from-gray-50 to-white hover:from-blue-50 hover:to-blue-50/50 text-[#0F172A] border border-gray-200 hover:border-blue-500/50 rounded-2xl shadow-sm hover:shadow-md transition-all group"
                  startContent={
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                      <ChartBarIcon className="w-4 h-4 text-white" />
                    </div>
                  }
                  endContent={
                    <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  View Analytics
                </Button>
                <Button
                  className="w-full justify-start bg-gradient-to-br from-gray-50 to-white hover:from-purple-50 hover:to-purple-50/50 text-[#0F172A] border border-gray-200 hover:border-purple-500/50 rounded-2xl shadow-sm hover:shadow-md transition-all group"
                  onClick={() => router.push("/dashboard/plan")}
                  startContent={
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                      <CreditCardIcon className="w-4 h-4 text-white" />
                    </div>
                  }
                  endContent={
                    <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  Manage Plan
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white rounded-2xl">
          <CardBody className="p-7">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#0F172A] mb-1">Recent Transactions</h2>
                <p className="text-sm text-gray-500">Your latest financial activity</p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:shadow-lg hover:shadow-blue-500/30 transition-all px-5"
                onClick={() => router.push("/dashboard/transactions/all")}
                endContent={<ArrowRightIcon className="w-4 h-4" />}
              >
                View All
              </Button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BanknotesIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium mb-2">No transactions yet</p>
                <p className="text-sm text-gray-400 mb-4">Start by adding your first transaction</p>
                <Button
                  className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-full hover:shadow-lg transition-all"
                  onClick={() => router.push("/dashboard/transactions")}
                  startContent={<BanknotesIcon className="w-5 h-5" />}
                >
                  Add Transaction
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => {
                  const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
                  const typeIcon = transaction.type === "income" ? ArrowUpIcon : 
                                  transaction.type === "expense" ? ArrowDownIcon :
                                  transaction.type.startsWith("partition") ? "📊" :
                                  ArrowsRightLeftIcon;
                  const iconBg = transaction.type === "income" ? "from-green-500 to-emerald-600" : 
                                   transaction.type === "expense" ? "from-red-500 to-rose-600" : 
                                   transaction.type.startsWith("partition") ? "from-purple-500 to-pink-600" :
                                   "from-blue-500 to-cyan-600";
                  const TypeIcon = typeof typeIcon === "string" ? null : typeIcon;

                  return (
                    <div
                      key={transaction.id}
                      className="group flex items-center justify-between p-5 bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 border-gray-100 hover:border-gray-200 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer"
                      onClick={() => router.push("/dashboard/transactions/all")}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${iconBg} shadow-lg group-hover:scale-110 transition-transform`}>
                          {TypeIcon ? (
                            <TypeIcon className="w-6 h-6 text-white" />
                          ) : (
                            <span className="text-2xl">{typeIcon}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F172A] mb-1 text-base">{transaction.description}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                              {transactionDate.toLocaleDateString("en-US", { 
                                month: "short", 
                                day: "numeric", 
                                year: "numeric" 
                              })}
                            </span>
                            {transaction.category && (
                              <span className="text-xs text-gray-700 bg-gray-200 px-2.5 py-1 rounded-full font-semibold capitalize">
                                {transaction.category}
                              </span>
                            )}
                            {transaction.incomeCategory && (
                              <span className="text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-full font-semibold capitalize">
                                {transaction.incomeCategory}
                              </span>
                            )}
                            {transaction.isRecurring && (
                              <span className="text-xs text-purple-700 bg-gradient-to-r from-purple-100 to-pink-100 px-2.5 py-1 rounded-full font-bold">
                                🔄 Recurring
                              </span>
                            )}
                            {transaction.type.startsWith("partition") && (
                              <span className="text-xs text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full font-bold">
                                📊 Partition
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-black ${
                          transaction.type === "income" ? "text-green-600" : 
                          transaction.type === "expense" ? "text-red-600" : 
                          transaction.type.startsWith("partition") ? "text-purple-600" :
                          "text-blue-600"
                        }`}>
                          {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}€{transaction.amount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Getting Started */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-[#22C55E]/5 via-[#A7F3D0]/10 to-white rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#22C55E]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl"></div>
          <CardBody className="p-8 relative">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-2xl shadow-lg">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Get Started with FinTrack</h2>
                <p className="text-gray-600">
                  Your account has been successfully created. Start managing your finances by adding your first account and tracking transactions.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-full hover:shadow-xl hover:shadow-[#22C55E]/40 transition-all px-6"
                startContent={<WalletIcon className="w-5 h-5" />}
              >
                Add Your First Account
              </Button>
              <Button
                className="border-2 border-[#22C55E] bg-white text-[#22C55E] rounded-full hover:bg-[#22C55E]/10 hover:shadow-md transition-all px-6"
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
