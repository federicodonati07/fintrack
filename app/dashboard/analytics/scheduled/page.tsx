"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Card, CardBody, Button } from "@heroui/react";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Checkbox } from "@headlessui/react";
import {
  getUserDocument,
  getAccounts,
  getTransactions,
  getScheduledTransactions,
  executeScheduledTransaction,
  getAllTransactionsIncludingShared,
} from "@/lib/firestore";
import { getSharedAccountsByMember } from "@/lib/sharedAccounts";
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
  const [sharedAccounts, setSharedAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sharedTransactions, setSharedTransactions] = useState<any[]>([]);
  const [scheduledTransactions, setScheduledTransactions] = useState<any[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>([]);
  const [includeSharedAccounts, setIncludeSharedAccounts] = useState(false);
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

        // Load shared accounts
        const userSharedAccounts = await getSharedAccountsByMember(currentUser.uid);
        setSharedAccounts(userSharedAccounts);
        console.log('[Scheduled Analytics] Shared accounts:', userSharedAccounts.length);

        // Load ALL transactions (personal + shared)
        const allTransactions = await getAllTransactionsIncludingShared(currentUser.uid);
        console.log('[Scheduled Analytics] All transactions:', allTransactions.length);
        
        // Separate personal and shared transactions
        const personalTransactions = allTransactions.filter(tx => !tx.accountId?.startsWith("shared-") && !tx.isSharedAccountTransaction);
        const sharedAccountTransactions = allTransactions.filter(tx => {
          if (tx.accountId?.startsWith("shared-")) {
            // Find the shared account to get its name and color
            const accountIdWithoutPrefix = tx.accountId.replace("shared-", "");
            const sharedAcc = userSharedAccounts.find(sa => sa.id === accountIdWithoutPrefix);
            if (sharedAcc) {
              tx.isSharedAccountTransaction = true;
              tx.sharedAccountName = sharedAcc.name;
              tx.sharedAccountColor = sharedAcc.color;
            }
            return true;
          }
          return tx.isSharedAccountTransaction === true;
        });

        console.log('[Scheduled Analytics] Personal transactions:', personalTransactions.length);
        console.log('[Scheduled Analytics] Shared account transactions:', sharedAccountTransactions.length);
        console.log('[Scheduled Analytics] Shared recurring:', sharedAccountTransactions.filter(t => t.isRecurring).length);
        console.log('[Scheduled Analytics] Shared scheduled:', sharedAccountTransactions.filter(t => t.status === "scheduled").length);

        setTransactions(personalTransactions);
        setSharedTransactions(sharedAccountTransactions);

        // Get scheduled transactions (only personal for now)
        const scheduled = await getScheduledTransactions(currentUser.uid);
        setScheduledTransactions(scheduled);

        // Filter recurring transactions
        const recurring = personalTransactions.filter((t) => t.isRecurring);
        setRecurringTransactions(recurring);

        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Combined transactions based on toggle
  const combinedRecurringTransactions = useMemo(() => {
    const personalRecurring = recurringTransactions;
    const sharedRecurring = sharedTransactions.filter((t) => t.isRecurring);
    return includeSharedAccounts ? [...personalRecurring, ...sharedRecurring] : personalRecurring;
  }, [recurringTransactions, sharedTransactions, includeSharedAccounts]);

  const combinedScheduledTransactions = useMemo(() => {
    const personalScheduled = scheduledTransactions;
    const sharedScheduled = sharedTransactions.filter((t) => t.status === "scheduled");
    return includeSharedAccounts ? [...personalScheduled, ...sharedScheduled] : personalScheduled;
  }, [scheduledTransactions, sharedTransactions, includeSharedAccounts]);

  // Calculate recurring impact (next 12 months)
  const recurringImpact = useMemo(() => {
    if (!combinedRecurringTransactions.length) return null;

    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    });

    const monthlyImpact = Array(12).fill(0);

    combinedRecurringTransactions.forEach((transaction) => {
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

    combinedRecurringTransactions.forEach((transaction) => {
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
  }, [combinedRecurringTransactions]);

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
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-[#0F172A] mb-1">Scheduled Analytics</h1>
          <p className="text-sm text-gray-500">Manage and analyze recurring transactions</p>
        </div>
        
        {/* Include Shared Accounts Toggle */}
        {sharedAccounts.length > 0 && (
          <Checkbox
            checked={includeSharedAccounts}
            onChange={setIncludeSharedAccounts}
            className="group flex items-center gap-2 cursor-pointer"
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              includeSharedAccounts ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
            }`}>
              {includeSharedAccounts && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-xs font-medium text-gray-600">Include Shared</span>
          </Checkbox>
        )}
      </div>

      {/* Main Content */}
      <main className="px-8 py-8 bg-gray-50 min-h-screen space-y-8">
        {/* Overview Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] mb-1">Overview</h2>
            <p className="text-sm text-gray-500">Summary of your recurring and scheduled transactions</p>
          </div>

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
                <p className="text-2xl font-semibold text-[#0F172A]">
                  <AnimatedCounter
                    value={combinedRecurringTransactions.length}
                    duration={1.25}
                    formatFn={(val) => Math.floor(val).toString()}
                  />
                </p>
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
                  <AnimatedCounter
                    value={combinedRecurringTransactions
                      .filter((t) => t.type === "income")
                      .reduce((sum, t) => {
                        const multiplier = t.recurringInterval === "monthly" ? 1 : t.recurringInterval === "weekly" ? 4 : t.recurringInterval === "daily" ? 30 : 0.083;
                        return sum + t.amount * multiplier;
                      }, 0)}
                    duration={1.25}
                    formatFn={(val) => formatAmount(val)}
                  />
                </p>
                <p className="text-xs text-gray-500 mt-1">From recurring income</p>
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
                  <AnimatedCounter
                    value={combinedRecurringTransactions
                      .filter((t) => t.type === "expense")
                      .reduce((sum, t) => {
                        const multiplier = t.recurringInterval === "monthly" ? 1 : t.recurringInterval === "weekly" ? 4 : t.recurringInterval === "daily" ? 30 : 0.083;
                        return sum + t.amount * multiplier;
                      }, 0)}
                    duration={1.25}
                    formatFn={(val) => formatAmount(val)}
                  />
                </p>
                <p className="text-xs text-gray-500 mt-1">From recurring expenses</p>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Upcoming Transactions Section */}
        {(combinedScheduledTransactions.length > 0 || combinedRecurringTransactions.length > 0) && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] mb-1">Upcoming Transactions</h2>
              <p className="text-sm text-gray-500">Next 3 scheduled or recurring transactions</p>
            </div>

            <Card className="border-2 border-blue-200 shadow-sm bg-gradient-to-br from-blue-50 to-white rounded-lg">
              <CardBody className="p-6">
                <div className="space-y-3">
                  {(() => {
                    // Combine scheduled and recurring transactions, calculate next occurrence dates
                    const upcomingList = [
                      ...combinedScheduledTransactions.map(tx => ({
                        ...tx,
                        nextDate: tx.date?.toDate ? tx.date.toDate() : new Date(tx.date),
                        isScheduled: true,
                      })),
                      ...combinedRecurringTransactions.map(tx => {
                        const now = new Date();
                        let nextDate = new Date(now);
                        
                        // Calculate next occurrence based on interval
                        switch (tx.recurringInterval) {
                          case "daily":
                            nextDate.setDate(now.getDate() + 1);
                            break;
                          case "weekly":
                            nextDate.setDate(now.getDate() + 7);
                            break;
                          case "monthly":
                            nextDate.setMonth(now.getMonth() + 1);
                            break;
                          case "yearly":
                            nextDate.setFullYear(now.getFullYear() + 1);
                            break;
                        }
                        
                        return {
                          ...tx,
                          nextDate,
                          isScheduled: false,
                        };
                      }),
                    ]
                    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
                    .slice(0, 3);

                    if (upcomingList.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          No upcoming transactions. Create a scheduled or recurring transaction to see it here.
                        </div>
                      );
                    }

                    return upcomingList.map((transaction, index) => {
                      // Find account (personal or shared)
                      let account = accounts.find((a) => a.id === transaction.accountId);
                      let accountName = account?.name;
                      let accountColor = account?.color;
                      
                      // Check if it's a shared account transaction
                      if (transaction.isSharedAccountTransaction) {
                        accountName = transaction.sharedAccountName;
                        accountColor = transaction.sharedAccountColor;
                      }
                      
                      const isOverdue = transaction.nextDate < new Date();

                      return (
                        <div
                          key={`${transaction.id}-${index}`}
                          className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-blue-100 hover:border-blue-200 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            {/* Icon */}
                            <div
                              className={`p-2.5 rounded-lg ${
                                transaction.type === "income"
                                  ? "bg-green-500/10"
                                  : transaction.type === "expense"
                                  ? "bg-red-500/10"
                                  : "bg-blue-500/10"
                              }`}
                            >
                              {transaction.type === "income" ? (
                                <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
                              ) : transaction.type === "expense" ? (
                                <ArrowTrendingDownIcon className="w-5 h-5 text-red-500" />
                              ) : (
                                <BanknotesIcon className="w-5 h-5 text-blue-500" />
                              )}
                            </div>

                            {/* Details */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-[#0F172A]">{transaction.description}</p>
                                {transaction.isRecurring && !transaction.isScheduled && (
                                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 text-xs font-medium rounded-full">
                                    Recurring
                                  </span>
                                )}
                                {transaction.isScheduled && (
                                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 text-xs font-medium rounded-full">
                                    Scheduled
                                  </span>
                                )}
                                {isOverdue && (
                                  <span className="px-2 py-0.5 bg-red-500/10 text-red-600 text-xs font-medium rounded-full">
                                    Overdue
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-gray-500 font-medium">
                                  📅 {transaction.nextDate.toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                                {accountName && (
                                  <span
                                    className="px-2 py-0.5 text-xs font-medium rounded-full"
                                    style={{
                                      backgroundColor: `${accountColor}20`,
                                      color: accountColor || "#6B7280",
                                    }}
                                  >
                                    {accountName}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="text-right">
                              <p
                                className={`text-lg font-bold ${
                                  transaction.type === "income"
                                    ? "text-green-600"
                                    : transaction.type === "expense"
                                    ? "text-red-600"
                                    : "text-blue-600"
                                }`}
                              >
                                {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}
                                {formatAmount(transaction.amount)}
                              </p>
                            </div>

                            {/* Execute Button for overdue scheduled transactions */}
                            {isOverdue && transaction.isScheduled && (
                              <Button
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await executeScheduledTransaction(user.uid, transaction.id);
                                    showToast("✅ Transaction executed successfully", "success");
                                    
                                    const scheduled = await getScheduledTransactions(user.uid);
                                    setScheduledTransactions(scheduled);
                                    
                                    const userAccounts = await getAccounts(user.uid);
                                    setAccounts(userAccounts);
                                  } catch (error) {
                                    console.error("Error executing transaction:", error);
                                    showToast("❌ Failed to execute transaction", "error");
                                  }
                                }}
                                className="bg-[#22C55E] text-white font-medium hover:bg-[#16A34A] transition-colors rounded-lg"
                              >
                                Execute
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Scheduled Transactions Full List */}
        {combinedScheduledTransactions.length > 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] mb-1">All Scheduled Transactions</h2>
              <p className="text-sm text-gray-500">View and manage all pending scheduled transactions</p>
            </div>

            <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
              <CardBody className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <CalendarIcon className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#0F172A]">Pending Transactions</h3>
                      <p className="text-xs text-gray-500">Awaiting execution</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-600 text-xs font-semibold rounded-full">
                    {combinedScheduledTransactions.length} Total
                  </span>
                </div>

                <div className="space-y-3">
                  {combinedScheduledTransactions.slice(0, 10).map((transaction) => {
                    const account = accounts.find((a) => a.id === transaction.accountId);
                    const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
                    const isOverdue = transactionDate < new Date();

                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {/* Icon */}
                          <div
                            className={`p-2 rounded-lg ${
                              transaction.type === "income"
                                ? "bg-green-500/10"
                                : transaction.type === "expense"
                                ? "bg-red-500/10"
                                : "bg-blue-500/10"
                            }`}
                          >
                            {transaction.type === "income" ? (
                              <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
                            ) : transaction.type === "expense" ? (
                              <ArrowTrendingDownIcon className="w-5 h-5 text-red-500" />
                            ) : (
                              <BanknotesIcon className="w-5 h-5 text-blue-500" />
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-[#0F172A]">{transaction.description}</p>
                              {transaction.isRecurring && (
                                <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 text-xs font-medium rounded-full">
                                  Recurring
                                </span>
                              )}
                              {isOverdue && (
                                <span className="px-2 py-0.5 bg-red-500/10 text-red-600 text-xs font-medium rounded-full">
                                  Overdue
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500">
                                {transactionDate.toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                              {account && (
                                <span
                                  className="px-2 py-0.5 text-xs font-medium rounded-full"
                                  style={{
                                    backgroundColor: `${account.color}20`,
                                    color: account.color || "#6B7280",
                                  }}
                                >
                                  {account.name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right">
                            <p
                              className={`text-base font-bold ${
                                transaction.type === "income"
                                  ? "text-green-600"
                                  : transaction.type === "expense"
                                  ? "text-red-600"
                                  : "text-blue-600"
                              }`}
                            >
                              {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}
                              {formatAmount(transaction.amount)}
                            </p>
                          </div>

                          {/* Execute Button */}
                          {isOverdue && (
                            <Button
                              size="sm"
                              onClick={async () => {
                                try {
                                  await executeScheduledTransaction(user.uid, transaction.id);
                                  showToast("✅ Transaction executed successfully", "success");
                                  
                                  const scheduled = await getScheduledTransactions(user.uid);
                                  setScheduledTransactions(scheduled);
                                  
                                  const userAccounts = await getAccounts(user.uid);
                                  setAccounts(userAccounts);
                                } catch (error) {
                                  console.error("Error executing transaction:", error);
                                  showToast("❌ Failed to execute transaction", "error");
                                }
                              }}
                              className="bg-[#22C55E] text-white font-medium hover:bg-[#16A34A] transition-colors"
                            >
                              Execute
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {combinedScheduledTransactions.length > 10 && (
                  <p className="text-xs text-gray-500 text-center mt-4">
                    Showing 10 of {combinedScheduledTransactions.length} scheduled transactions
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        )}

        {/* Planning Tools Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] mb-1">Planning Tools</h2>
            <p className="text-sm text-gray-500">Analyze and optimize your recurring transactions</p>
          </div>

          <div className="space-y-6">
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
                {combinedRecurringTransactions.length === 0 ? (
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
                          ticks: { callback: (value) => `${currency.symbol}${value}` },
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
          </div>
        </div>
      </main>
    </>
  );
}
