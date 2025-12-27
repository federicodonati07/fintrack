"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Card, CardBody, Button } from "@heroui/react";
import {
  getUserDocument,
  getAccounts,
  getTransactions,
} from "@/lib/firestore";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  ChartBarIcon,
  BanknotesIcon,
  LightBulbIcon,
  CurrencyEuroIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type Plan = "free" | "pro" | "ultra" | "admin";

export default function ScheduledAnalyticsPage() {
  const { formatAmount, currency } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>([]);
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

        const userAccounts = await getAccounts(currentUser.uid);
        setAccounts(userAccounts);

        const userTransactions = await getTransactions(currentUser.uid);
        setTransactions(userTransactions);

        // Filter recurring transactions
        const recurring = userTransactions.filter((t) => t.isRecurring);
        setRecurringTransactions(recurring);

        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Calculate recurring impact (next 12 months)
  const recurringImpact = useMemo(() => {
    if (!recurringTransactions.length) return null;

    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    });

    const monthlyImpact = Array(12).fill(0);

    recurringTransactions.forEach((transaction) => {
      const multiplier = transaction.type === "income" ? 1 : transaction.type === "expense" ? -1 : 0;
      const amount = transaction.amount * multiplier;

      switch (transaction.recurringInterval) {
        case "daily":
          for (let i = 0; i < 12; i++) monthlyImpact[i] += amount * 30;
          break;
        case "weekly":
          for (let i = 0; i < 12; i++) monthlyImpact[i] += amount * 4;
          break;
        case "monthly":
          for (let i = 0; i < 12; i++) monthlyImpact[i] += amount;
          break;
        case "yearly":
          monthlyImpact[0] += amount;
          break;
      }
    });

    return { labels: months, data: monthlyImpact };
  }, [recurringTransactions]);

  // Calendar data for next 30 days
  const calendarData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return {
        date: date,
        day: date.getDate(),
        month: date.toLocaleDateString("en-US", { month: "short" }),
        transactions: 0,
        amount: 0,
      };
    });

    recurringTransactions.forEach((transaction) => {
      days.forEach((day) => {
        let shouldInclude = false;

        switch (transaction.recurringInterval) {
          case "daily":
            shouldInclude = true;
            break;
          case "weekly":
            shouldInclude = day.date.getDay() === new Date().getDay();
            break;
          case "monthly":
            shouldInclude = day.day === new Date().getDate();
            break;
          case "yearly":
            shouldInclude = day.day === new Date().getDate() && day.date.getMonth() === new Date().getMonth();
            break;
        }

        if (shouldInclude) {
          day.transactions += 1;
          day.amount += transaction.type === "income" ? transaction.amount : -transaction.amount;
        }
      });
    });

    return days;
  }, [recurringTransactions]);

  const canAccessTool = (requiredPlan: "pro" | "ultra"): boolean => {
    if (userPlan === "admin" || userPlan === "ultra") return true;
    if (userPlan === "pro" && requiredPlan === "pro") return true;
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading scheduled analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={hideToast} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] transition-colors mb-4 group font-medium"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A] mb-1">Scheduled Analytics</h1>
          <p className="text-sm text-gray-500">Manage and analyze recurring transactions</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-8 py-8 bg-gray-50 min-h-screen space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-[#22C55E]/10 rounded-lg">
                  <ClockIcon className="w-5 h-5 text-[#22C55E]" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase">Active Recurring</span>
              </div>
              <p className="text-2xl font-semibold text-[#0F172A]">{recurringTransactions.length}</p>
              <p className="text-xs text-gray-500 mt-1">Scheduled transactions</p>
            </CardBody>
          </Card>

          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-[#22C55E]/10 rounded-lg">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-[#22C55E]" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase">Monthly Income</span>
              </div>
              <p className="text-2xl font-semibold text-[#0F172A]">
                {currency.symbol}
                {recurringTransactions
                  .filter((t) => t.type === "income")
                  .reduce((sum, t) => {
                    const multiplier = t.recurringInterval === "monthly" ? 1 : t.recurringInterval === "weekly" ? 4 : t.recurringInterval === "daily" ? 30 : 0.083;
                    return sum + t.amount * multiplier;
                  }, 0)
                  .toFixed(2)}
              </p>
            </CardBody>
          </Card>

          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <ArrowTrendingDownIcon className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase">Monthly Expenses</span>
              </div>
              <p className="text-2xl font-semibold text-[#0F172A]">
                {currency.symbol}
                {recurringTransactions
                  .filter((t) => t.type === "expense")
                  .reduce((sum, t) => {
                    const multiplier = t.recurringInterval === "monthly" ? 1 : t.recurringInterval === "weekly" ? 4 : t.recurringInterval === "daily" ? 30 : 0.083;
                    return sum + t.amount * multiplier;
                  }, 0)
                  .toFixed(2)}
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Scheduled Transactions Planner - PRO */}
        <Card className={`border-2 shadow-sm bg-white rounded-lg ${!canAccessTool("pro") ? "border-gray-200 opacity-60" : "border-gray-200"}`}>
          <CardBody className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <CalendarIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">
                    Scheduled Transactions Planner
                    {!canAccessTool("pro") && <span className="ml-2 text-xs text-gray-500">🔒 Pro</span>}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Plan and manage recurring income and expenses</p>
                </div>
              </div>
            </div>

            {canAccessTool("pro") ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {recurringTransactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No recurring transactions yet. Create one from the Transactions page.
                  </div>
                ) : (
                  recurringTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${transaction.type === "income" ? "bg-[#22C55E]/10" : "bg-red-500/10"}`}>
                          {transaction.type === "income" ? (
                            <ArrowTrendingUpIcon className="w-4 h-4 text-[#22C55E]" />
                          ) : (
                            <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#0F172A]">{transaction.description}</p>
                          <p className="text-xs text-gray-500 capitalize">{transaction.recurringInterval}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ${transaction.type === "income" ? "text-[#22C55E]" : "text-red-600"}`}>
                        {transaction.type === "expense" ? "-" : "+"}{currency.symbol}{transaction.amount.toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Button
                  onClick={() => router.push("/dashboard/plan")}
                  className="bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg font-medium"
                >
                  Upgrade to Pro
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Cash Calendar - PRO */}
        <Card className={`border-2 shadow-sm bg-white rounded-lg ${!canAccessTool("pro") ? "border-gray-200 opacity-60" : "border-gray-200"}`}>
          <CardBody className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <CalendarIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">
                    Cash Calendar
                    {!canAccessTool("pro") && <span className="ml-2 text-xs text-gray-500">🔒 Pro</span>}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">View scheduled transactions on calendar</p>
                </div>
              </div>
            </div>

            {canAccessTool("pro") ? (
              <div className="grid grid-cols-7 gap-2">
                {calendarData.slice(0, 28).map((day, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-lg border text-center ${
                      day.transactions > 0
                        ? day.amount >= 0
                          ? "border-[#22C55E] bg-[#22C55E]/5"
                          : "border-red-500 bg-red-50"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-500">{day.day}</p>
                    {day.transactions > 0 && (
                      <>
                        <p className="text-[10px] text-gray-400">{day.transactions} tx</p>
                        <p className={`text-xs font-semibold ${day.amount >= 0 ? "text-[#22C55E]" : "text-red-600"}`}>
                          {day.amount >= 0 ? "+" : ""}{currency.symbol}{Math.abs(day.amount).toFixed(0)}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Button
                  onClick={() => router.push("/dashboard/plan")}
                  className="bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg font-medium"
                >
                  Upgrade to Pro
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recurring Impact Preview - PRO */}
        {recurringImpact && (
          <Card className={`border-2 shadow-sm bg-white rounded-lg ${!canAccessTool("pro") ? "border-gray-200 opacity-60" : "border-gray-200"}`}>
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#0F172A] rounded-lg">
                    <ChartBarIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#0F172A]">
                      Recurring Impact Preview
                      {!canAccessTool("pro") && <span className="ml-2 text-xs text-gray-500">🔒 Pro</span>}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Projected impact over next 12 months</p>
                  </div>
                </div>
              </div>

              {canAccessTool("pro") ? (
                <div className="h-64">
                  <Bar
                    data={{
                      labels: recurringImpact.labels,
                      datasets: [
                        {
                          label: "Net Impact",
                          data: recurringImpact.data,
                          backgroundColor: recurringImpact.data.map((v) => (v >= 0 ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)")),
                          borderColor: recurringImpact.data.map((v) => (v >= 0 ? "#22C55E" : "#EF4444")),
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false } },
                        y: {
                          grid: { color: "#F3F4F6" },
                          ticks: { callback: (value) => `{currency.symbol}${value}` },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <Button
                    onClick={() => router.push("/dashboard/plan")}
                    className="bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg font-medium"
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* What-If Simulator - ULTRA - REMOVED */}
        {/* Recurring Optimization Insights - ULTRA - REMOVED */}
      </main>
    </>
  );
}
