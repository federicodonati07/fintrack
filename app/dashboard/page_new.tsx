"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Card, CardBody, Button } from "@heroui/react";
import {
  getUserDocument,
  getAccounts,
  getUserCategories,
  getTransactions,
  getSubAccounts,
} from "@/lib/firestore";
import {
  WalletIcon,
  ChartBarIcon,
  CreditCardIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  SparklesIcon,
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";

type Plan = "free" | "pro" | "ultra" | "admin";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<Plan>("free");
  const [userInterval, setUserInterval] = useState<"monthly" | "yearly">("monthly");
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
        const plan = userDoc?.plan || "free";
        setUserPlan(plan);
        setUserInterval(userDoc?.planInterval || "monthly");
        setIsAdmin(userDoc?.role === "admin");

        if (userDoc?.stripeSubscriptionId) {
          const subResponse = await fetch(`/api/stripe/subscription?subscriptionId=${userDoc.stripeSubscriptionId}`);
          if (subResponse.ok) {
            const subData = await subResponse.json();
            if (subData.currentPeriodEnd) {
              setRenewalDate(new Date(subData.currentPeriodEnd * 1000));
            }
          }
        }

        const planLimits =
          plan === "ultra"
            ? { accounts: Infinity, categories: Infinity }
            : plan === "pro"
            ? { accounts: 10, categories: 50 }
            : { accounts: 1, categories: 10 };

        setLimits(planLimits);

        const userCategories = await getUserCategories(currentUser.uid);
        setCategoriesCount(userCategories.length);

        const userAccounts = await getAccounts(currentUser.uid);
        setAccountsCount(userAccounts.length);

        let total = 0;
        for (const account of userAccounts) {
          total += account.currentBalance || 0;
          const subAccounts = await getSubAccounts(currentUser.uid, account.id);
          for (const subAccount of subAccounts) {
            total += subAccount.balance || 0;
          }
        }
        setTotalBalance(total);

        const transactions = await getTransactions(currentUser.uid);
        setRecentTransactions(transactions.slice(0, 5));

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
        console.error("Error fetching user data:", error);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const formatRenewalDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const getPlanColor = (plan: Plan) => {
    switch (plan) {
      case "ultra":
        return "bg-[#1E293B]";
      case "pro":
        return "bg-[#22C55E]";
      default:
        return "bg-gray-400";
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
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A] mb-1">Dashboard</h1>
            <p className="text-sm text-gray-500">
              Welcome back, {user?.displayName || user?.email?.split("@")[0] || "User"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin ? (
              <Button
                onClick={() => router.push("/dashboard/admin")}
                className="bg-[#1E293B] text-white rounded-lg hover:bg-[#0F172A] transition-colors px-6 font-medium"
                startContent={<ShieldCheckIcon className="w-5 h-5" />}
              >
                Admin Dashboard
              </Button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => router.push("/dashboard/plan")}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group cursor-pointer border border-gray-200"
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
                </button>
                {userPlan !== "free" && renewalDate && (
                  <span className="text-xs text-gray-500">
                    Renews: {formatRenewalDate(renewalDate)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-8 py-8 space-y-6 bg-gray-50 min-h-screen">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#0F172A] mb-1">
                Welcome back, {user?.displayName?.split(" ")[0] || "User"}
              </h2>
              <p className="text-sm text-gray-500">
                Here&apos;s your financial overview for today
              </p>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                {new Date().toLocaleDateString("en-US", { weekday: "long" })}
              </p>
              <p className="text-sm font-medium text-[#0F172A]">
                {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Balance */}
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 bg-white rounded-lg">
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-gray-100 rounded-lg">
                  <WalletIcon className="w-5 h-5 text-[#0F172A]" />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                Total Balance
              </p>
              <p className="text-3xl font-semibold text-[#0F172A]">€{totalBalance.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">All accounts</p>
            </CardBody>
          </Card>

          {/* Income */}
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 bg-white rounded-lg cursor-pointer" onClick={() => router.push("/dashboard/transactions")}>
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-[#22C55E]/10 rounded-lg">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-[#22C55E]" />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                Income
              </p>
              <p className="text-3xl font-semibold text-[#0F172A]">€{monthlyIncome.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">This month</p>
            </CardBody>
          </Card>

          {/* Expenses */}
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 bg-white rounded-lg cursor-pointer" onClick={() => router.push("/dashboard/transactions")}>
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-gray-100 rounded-lg">
                  <BanknotesIcon className="w-5 h-5 text-[#0F172A]" />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                Expenses
              </p>
              <p className="text-3xl font-semibold text-[#0F172A]">€{monthlyExpenses.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">This month</p>
            </CardBody>
          </Card>

          {/* Accounts */}
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 bg-white rounded-lg cursor-pointer" onClick={() => router.push("/dashboard/accounts")}>
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-gray-100 rounded-lg">
                  <BuildingLibraryIcon className="w-5 h-5 text-[#0F172A]" />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                Accounts
              </p>
              <p className="text-3xl font-semibold text-[#0F172A]">
                {accountsCount}<span className="text-xl text-gray-400">/{limits.accounts === Infinity ? '∞' : limits.accounts}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">Active accounts</p>
            </CardBody>
          </Card>
        </div>

        {/* Plan Usage & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Plan Usage */}
          <Card className="lg:col-span-2 border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-[#0F172A]">Plan Usage</h2>
                <Button
                  size="sm"
                  onClick={() => router.push("/dashboard/plan")}
                  className="bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] transition-colors font-medium"
                >
                  Upgrade Plan
                </Button>
              </div>

              <div className="space-y-5">
                {/* Accounts Progress */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Accounts / Funds</span>
                    <span className="text-sm font-semibold text-[#0F172A]">
                      {accountsCount} / {limits.accounts === Infinity ? '∞' : limits.accounts}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-[#0F172A] h-2 rounded-full transition-all"
                      style={{
                        width: `${limits.accounts === Infinity ? 100 : Math.min((accountsCount / limits.accounts) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Categories Progress */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Categories</span>
                    <span className="text-sm font-semibold text-[#0F172A]">
                      {categoriesCount} / {limits.categories === Infinity ? '∞' : limits.categories}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-[#0F172A] h-2 rounded-full transition-all"
                      style={{
                        width: `${limits.categories === Infinity ? 100 : Math.min((categoriesCount / limits.categories) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Quick Actions */}
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-6">
              <h2 className="text-lg font-semibold text-[#0F172A] mb-5">Quick Actions</h2>
              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/dashboard/transactions")}
                  className="w-full justify-start bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg transition-colors h-12"
                  startContent={<BanknotesIcon className="w-5 h-5" />}
                >
                  Add Transaction
                </Button>
                <Button
                  onClick={() => router.push("/dashboard/accounts")}
                  className="w-full justify-start bg-white hover:bg-gray-50 text-[#0F172A] border border-gray-200 rounded-lg transition-colors h-12"
                  startContent={<WalletIcon className="w-5 h-5" />}
                >
                  Manage Accounts
                </Button>
                <Button
                  className="w-full justify-start bg-white hover:bg-gray-50 text-[#0F172A] border border-gray-200 rounded-lg transition-colors h-12"
                  onClick={() => router.push("/dashboard/analytics")}
                  startContent={<ChartBarIcon className="w-5 h-5" />}
                >
                  View Analytics
                </Button>
                <Button
                  className="w-full justify-start bg-white hover:bg-gray-50 text-[#0F172A] border border-gray-200 rounded-lg transition-colors h-12"
                  onClick={() => router.push("/dashboard/plan")}
                  startContent={<CreditCardIcon className="w-5 h-5" />}
                >
                  Manage Plan
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#0F172A]">Recent Transactions</h2>
              <button
                onClick={() => router.push("/dashboard/transactions/all")}
                className="text-sm font-medium text-[#0F172A] hover:text-[#22C55E] transition-colors flex items-center gap-1"
              >
                View All
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="text-center py-12">
                <BanknotesIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium mb-1">No transactions yet</p>
                <p className="text-xs text-gray-400">Start by adding your first transaction</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => {
                  const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
                  const TypeIcon = transaction.type === "income" ? ArrowUpIcon : 
                                  transaction.type === "expense" ? ArrowDownIcon :
                                  ArrowsRightLeftIcon;
                  const iconBg = transaction.type === "income" ? "bg-[#22C55E]/10" : 
                                   transaction.type === "expense" ? "bg-gray-100" : 
                                   "bg-gray-100";
                  const iconColor = transaction.type === "income" ? "text-[#22C55E]" :
                                    "text-[#0F172A]";
                  const amountColor = transaction.type === "income" ? "text-[#22C55E]" :
                                      transaction.type === "expense" ? "text-[#0F172A]" :
                                      "text-[#0F172A]";

                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer"
                      onClick={() => router.push("/dashboard/transactions/all")}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-lg ${iconBg}`}>
                          <TypeIcon className={`w-5 h-5 ${iconColor}`} />
                        </div>
                        <div>
                          <p className="font-medium text-[#0F172A] text-sm mb-0.5">{transaction.description}</p>
                          <p className="text-xs text-gray-500">
                            {transactionDate.toLocaleDateString("en-US", { 
                              month: "short", 
                              day: "numeric"
                            })}
                          </p>
                        </div>
                      </div>
                      <p className={`text-base font-semibold ${amountColor}`}>
                        {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}€{transaction.amount.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </main>
    </>
  );
}



