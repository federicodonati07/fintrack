"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Card, CardBody, Button } from "@heroui/react";
import {
  getUserDocument,
  getAccounts,
  getTransactions,
  getSubAccounts,
  getUserCategories,
} from "@/lib/firestore";
import {
  ArrowLeftIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  FireIcon,
  ArrowsRightLeftIcon,
  TagIcon,
  WalletIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { Listbox, Transition } from "@headlessui/react";
import { Fragment } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type Plan = "free" | "pro" | "ultra" | "admin";
type Period = "daily" | "weekly" | "monthly" | "yearly" | "all";

export default function PortfolioAnalyticsPage() {
  const { formatAmount, currency } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subAccounts, setSubAccounts] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>("monthly");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast, hideToast} = useToast();

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

        // Check if user has Ultra plan
        if (plan !== "ultra" && plan !== "admin") {
          router.push("/dashboard/plan");
          return;
        }

        const userAccounts = await getAccounts(currentUser.uid);
        setAccounts(userAccounts);
        
        // Check if there's an account ID in the URL query params
        const accountIdFromUrl = searchParams.get("account");
        if (accountIdFromUrl && userAccounts.length > 0) {
          const preselectedAccount = userAccounts.find(acc => acc.id === accountIdFromUrl);
          if (preselectedAccount) {
            setSelectedAccount(preselectedAccount);
          } else {
            setSelectedAccount(userAccounts[0]);
          }
        } else if (userAccounts.length > 0) {
          setSelectedAccount(userAccounts[0]);
        }

        const userTransactions = await getTransactions(currentUser.uid);
        setTransactions(userTransactions);

        const userCategories = await getUserCategories(currentUser.uid);
        setCategories(userCategories);

        // Load all sub-accounts for all accounts IN PARALLEL
        const subAccountsPromises = userAccounts.map(async (account) => {
          const subs = await getSubAccounts(currentUser.uid, account.id);
          return subs.map(sub => ({ ...sub, parentAccountId: account.id }));
        });
        const allSubAccountsArrays = await Promise.all(subAccountsPromises);
        const allSubAccounts = allSubAccountsArrays.flat();
        setSubAccounts(allSubAccounts);

        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Filter transactions for selected account (including partition transactions)
  const accountTransactions = useMemo(() => {
    if (!selectedAccount) return [];
    return transactions.filter(
      (tx) => {
        // Regular transactions
        if (tx.accountId === selectedAccount.id || tx.toAccountId === selectedAccount.id) {
          return true;
        }
        // Partition transactions for this account
        if (tx.type?.startsWith("partition") && tx.accountId === selectedAccount.id) {
          return true;
        }
        return false;
      }
    );
  }, [transactions, selectedAccount]);

  // Calculate historical balance data based on period
  const historicalData = useMemo(() => {
    if (!selectedAccount) {
      return { labels: ["Now"], data: [0] };
    }

    // Calculate current total balance including partitions
    const accountSubAccounts = subAccounts.filter(sub => sub.parentAccountId === selectedAccount.id);
    const partitionsBalance = accountSubAccounts.reduce((sum, sub) => sum + (sub.balance || 0), 0);
    const currentTotalBalance = (selectedAccount.currentBalance || 0) + partitionsBalance;
    
    const now = new Date();
    
    // Sort transactions by date
    const sortedTx = [...accountTransactions].sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    if (sortedTx.length === 0) {
      return { labels: ["Now"], data: [Math.max(0, currentTotalBalance)] };
    }

    const firstTxDate = sortedTx[0].date?.toDate ? sortedTx[0].date.toDate() : new Date(sortedTx[0].date);
    
    // Determine time range based on period
    let startDate: Date;
    switch (period) {
      case "daily":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 12);
        break;
      case "yearly":
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 5);
        break;
      case "all":
        startDate = firstTxDate;
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Filter transactions in the time range (exclude partition transactions from graph)
    const relevantTransactions = sortedTx.filter(tx => {
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      const inRange = txDate >= startDate && txDate <= now;
      const isNotPartition = !tx.type?.startsWith("partition");
      return inRange && isNotPartition;
    });

    if (relevantTransactions.length === 0) {
      return { labels: ["Now"], data: [Math.max(0, currentTotalBalance)] };
    }

    // Build data points only at transaction dates
    const dataPoints: { date: Date; balance: number }[] = [];
    
    // Start from current total balance and work backwards
    let runningBalance = currentTotalBalance;
    
    // Go through transactions from newest to oldest
    for (let i = relevantTransactions.length - 1; i >= 0; i--) {
      const tx = relevantTransactions[i];
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      
      // Add current point before processing this transaction
      dataPoints.unshift({
        date: new Date(txDate),
        balance: Math.max(0, runningBalance),
      });
      
      // Subtract this transaction to get previous balance
      // Only income and expense affect the TOTAL balance (account + partitions)
      if (tx.type === "income" && tx.accountId === selectedAccount.id) {
        runningBalance -= tx.amount;
      } else if (tx.type === "expense" && tx.accountId === selectedAccount.id) {
        runningBalance += tx.amount;
      } else if (tx.type === "transfer") {
        if (tx.accountId === selectedAccount.id) {
          runningBalance += tx.amount;
        }
        if (tx.toAccountId === selectedAccount.id) {
          runningBalance -= tx.amount;
        }
      }
    }
    
    // Add the oldest point (before first transaction)
    if (dataPoints.length > 0) {
      dataPoints.unshift({
        date: new Date(dataPoints[0].date.getTime() - 1000),
        balance: Math.max(0, runningBalance),
      });
    }
    
    // Add current point at the end (MUST be currentTotalBalance)
    dataPoints.push({
      date: now,
      balance: Math.max(0, currentTotalBalance),
    });

    // Format labels based on period
    const formatLabel = (date: Date) => {
      switch (period) {
        case "daily":
        case "weekly":
          return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        case "monthly":
          return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        case "yearly":
        case "all":
          return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        default:
          return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
    };

    return {
      labels: dataPoints.map(p => formatLabel(p.date)),
      data: dataPoints.map(p => p.balance),
    };
  }, [selectedAccount, accountTransactions, subAccounts, period]);

  // Calculate inflow/outflow
  const inflowOutflowData = useMemo(() => {
    const inflow = accountTransactions
      .filter(tx => 
        (tx.type === "income" && tx.accountId === selectedAccount?.id) ||
        (tx.type === "transfer" && tx.toAccountId === selectedAccount?.id)
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const outflow = accountTransactions
      .filter(tx => 
        (tx.type === "expense" && tx.accountId === selectedAccount?.id) ||
        (tx.type === "transfer" && tx.accountId === selectedAccount?.id)
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    return { inflow, outflow, net: inflow - outflow };
  }, [accountTransactions, selectedAccount]);

  // Expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    accountTransactions
      .filter(tx => tx.type === "expense" && tx.accountId === selectedAccount?.id)
      .forEach(tx => {
        const cat = tx.category || "Uncategorized";
        categoryMap[cat] = (categoryMap[cat] || 0) + tx.amount;
      });

    return Object.entries(categoryMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [accountTransactions, selectedAccount]);

  // Recurring transactions impact
  const recurringImpact = useMemo(() => {
    const recurring = accountTransactions.filter(tx => tx.recurring);
    const totalRecurring = recurring.reduce((sum, tx) => {
      if (tx.type === "income" && tx.accountId === selectedAccount?.id) return sum + tx.amount;
      if (tx.type === "expense" && tx.accountId === selectedAccount?.id) return sum - tx.amount;
      return sum;
    }, 0);

    const monthlyRecurring = totalRecurring / Math.max(1, accountTransactions.length > 0 ? 12 : 1);

    return {
      count: recurring.length,
      monthlyImpact: monthlyRecurring,
      totalImpact: totalRecurring,
    };
  }, [accountTransactions, selectedAccount]);

  // Burn rate (monthly spending average)
  const burnRate = useMemo(() => {
    const expenses = accountTransactions.filter(tx => tx.type === "expense" && tx.accountId === selectedAccount?.id);
    const totalExpenses = expenses.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Calculate months of data
    if (expenses.length === 0) return 0;
    
    const dates = expenses.map(tx => tx.date?.toDate ? tx.date.toDate() : new Date(tx.date));
    const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const monthsDiff = Math.max(1, (latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

    return totalExpenses / monthsDiff;
  }, [accountTransactions, selectedAccount]);

  // Portfolio stability indicator
  const stabilityScore = useMemo(() => {
    if (accountTransactions.length < 3) return 50; // Not enough data

    const incomes = accountTransactions.filter(tx => tx.type === "income" && tx.accountId === selectedAccount?.id);
    const expenses = accountTransactions.filter(tx => tx.type === "expense" && tx.accountId === selectedAccount?.id);

    const totalIncome = incomes.reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpenses = expenses.reduce((sum, tx) => sum + tx.amount, 0);

    // Calculate variance in monthly expenses
    const monthlyExpenses: { [key: string]: number } = {};
    expenses.forEach(tx => {
      const date = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyExpenses[key] = (monthlyExpenses[key] || 0) + tx.amount;
    });

    const expenseValues = Object.values(monthlyExpenses);
    const avgExpense = expenseValues.reduce((sum, val) => sum + val, 0) / Math.max(1, expenseValues.length);
    const variance = expenseValues.reduce((sum, val) => sum + Math.pow(val - avgExpense, 2), 0) / Math.max(1, expenseValues.length);
    const volatility = Math.sqrt(variance) / Math.max(1, avgExpense);

    // Lower volatility = higher stability
    const volatilityScore = Math.max(0, 100 - (volatility * 50));
    
    // Positive net flow = higher stability
    const netFlowScore = totalIncome > totalExpenses ? 100 : (totalIncome / Math.max(1, totalExpenses)) * 100;

    // Balance relative to expenses
    const balanceScore = Math.min(100, ((selectedAccount?.currentBalance || 0) / Math.max(1, avgExpense)) * 20);

    return (volatilityScore + netFlowScore + balanceScore) / 3;
  }, [accountTransactions, selectedAccount]);

  // Balance projection (next 12 months)
  const balanceProjection = useMemo(() => {
    const avgIncome = inflowOutflowData.inflow / Math.max(1, accountTransactions.length > 0 ? 12 : 1);
    const avgExpenses = inflowOutflowData.outflow / Math.max(1, accountTransactions.length > 0 ? 12 : 1);
    const currentBalance = selectedAccount?.currentBalance || 0;

    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() + i + 1);
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    });

    const projectedBalances = [];
    let runningBalance = currentBalance;
    for (let i = 0; i < 12; i++) {
      runningBalance += (avgIncome - avgExpenses);
      projectedBalances.push(runningBalance);
    }

    return { months, projectedBalances };
  }, [inflowOutflowData, accountTransactions, selectedAccount]);

  // Transfer analysis - REMOVED

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading portfolio analytics...</p>
        </div>
      </div>
    );
  }

  if (!selectedAccount) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <WalletIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-semibold">No accounts available</p>
          <p className="text-gray-400 text-sm mt-2">Create an account to view portfolio analytics</p>
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
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A] mb-1">Portfolio Analytics</h1>
            <p className="text-sm text-gray-500">Deep dive into individual account performance</p>
          </div>

          {/* Account Selector */}
          <Listbox value={selectedAccount} onChange={setSelectedAccount}>
            <div className="relative">
              <Listbox.Button className="relative w-64 cursor-pointer rounded-lg bg-white py-3 pl-4 pr-10 text-left border-2 border-gray-200 hover:border-[#22C55E] transition-colors">
                <span className="block truncate font-semibold text-[#0F172A]">
                  {selectedAccount?.name}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {accounts.map((account) => (
                    <Listbox.Option
                      key={account.id}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-3 pl-10 pr-4 ${
                          active ? "bg-[#22C55E]/10 text-[#0F172A]" : "text-gray-900"
                        }`
                      }
                      value={account}
                    >
                      {({ selected }) => (
                        <>
                          <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                            {account.name}
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#22C55E]">
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-8 py-8 bg-gray-50 min-h-screen">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border border-gray-200 shadow-sm">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Current Balance</p>
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {currency.symbol}{((selectedAccount?.currentBalance || 0) + 
                       subAccounts.filter(sub => sub.parentAccountId === selectedAccount?.id)
                                  .reduce((sum, sub) => sum + (sub.balance || 0), 0)
                    ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <WalletIcon className="w-8 h-8 text-[#22C55E]" />
              </div>
            </CardBody>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Total Inflow</p>
                  <p className="text-2xl font-bold text-green-600">
                    {currency.symbol}{inflowOutflowData.inflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <ArrowTrendingUpIcon className="w-8 h-8 text-green-500" />
              </div>
            </CardBody>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Total Outflow</p>
                  <p className="text-2xl font-bold text-red-600">
                    {currency.symbol}{inflowOutflowData.outflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <ArrowTrendingDownIcon className="w-8 h-8 text-red-500" />
              </div>
            </CardBody>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Stability Score</p>
                  <p className="text-2xl font-bold text-[#0F172A]">{stabilityScore.toFixed(0)}/100</p>
                </div>
                <ChartBarIcon className="w-8 h-8 text-purple-500" />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Period Selector */}
        <div className="mb-8">
          <div className="flex gap-2 bg-white p-1.5 rounded-lg border border-gray-200 w-fit">
            {[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
              { value: "all", label: "All Time" },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value as Period)}
                className={`px-4 py-2 text-sm font-semibold rounded transition-all ${
                  period === p.value
                    ? "bg-[#0F172A] text-white"
                    : "text-gray-600 hover:text-[#0F172A]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Historical Balance Chart */}
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg lg:col-span-2">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <ClockIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">Historical Balance</h3>
                  <p className="text-xs text-gray-500">Balance evolution over time</p>
                </div>
              </div>
              <div className="h-64">
                <Line
                  data={{
                    labels: historicalData.labels,
                    datasets: [{
                      label: "Balance",
                      data: historicalData.data,
                      borderColor: "#22C55E",
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      fill: true,
                      tension: 0.4,
                      borderWidth: 3,
                      pointRadius: 3,
                      pointHoverRadius: 6,
                      pointBackgroundColor: "#22C55E",
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${currency.symbol}${context.parsed.y.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                        },
                      },
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: { 
                        grid: { color: "#F3F4F6" }, 
                        ticks: { callback: (value) => `${currency.symbol}${value}` } 
                      },
                    },
                  }}
                />
              </div>
            </CardBody>
          </Card>

          {/* Inflow vs Outflow Chart */}
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <ArrowsRightLeftIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">Inflow vs Outflow</h3>
                  <p className="text-xs text-gray-500">Money in and out</p>
                </div>
              </div>
              <div className="h-64">
                <Bar
                  data={{
                    labels: ["Inflow", "Outflow", "Net"],
                    datasets: [{
                      label: "Amount",
                      data: [inflowOutflowData.inflow, inflowOutflowData.outflow, Math.abs(inflowOutflowData.net)],
                      backgroundColor: [
                        "rgba(34, 197, 94, 0.7)",
                        "rgba(239, 68, 68, 0.7)",
                        inflowOutflowData.net >= 0 ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)",
                      ],
                      borderColor: ["#22C55E", "#EF4444", inflowOutflowData.net >= 0 ? "#22C55E" : "#EF4444"],
                      borderWidth: 2,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${currency.symbol}${context.parsed.y.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                        },
                      },
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: { grid: { color: "#F3F4F6" }, ticks: { callback: (value) => `${currency.symbol}${value}` } },
                    },
                  }}
                />
              </div>
            </CardBody>
          </Card>

          {/* Expense Breakdown Chart */}
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <TagIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">Expense Breakdown</h3>
                  <p className="text-xs text-gray-500">Spending by category</p>
                </div>
              </div>
              <div className="h-64">
                {expenseBreakdown.length > 0 ? (
                  <Doughnut
                    data={{
                      labels: expenseBreakdown.map(e => e.name),
                      datasets: [{
                        data: expenseBreakdown.map(e => e.amount),
                        backgroundColor: [
                          "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
                          "#8B5CF6", "#EC4899", "#6366F1", "#14B8A6",
                        ],
                        borderWidth: 2,
                        borderColor: "#FFFFFF",
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: "right" },
                        tooltip: {
                          callbacks: {
                            label: (context) => `${context.label}: ${currency.symbol}${context.parsed.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                          },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    No expense data available
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Transaction Timeline */}
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <ClockIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">Transaction Timeline</h3>
                  <p className="text-xs text-gray-500">Recent activity</p>
                </div>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {accountTransactions.slice(0, 10).map((tx, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        tx.type === "income" ? "bg-green-500" : tx.type === "expense" ? "bg-red-500" : "bg-blue-500"
                      }`} />
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">{tx.description || tx.type}</p>
                        <p className="text-xs text-gray-500">
                          {(tx.date?.toDate ? tx.date.toDate() : new Date(tx.date)).toLocaleDateString("en-US")}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold ${
                      tx.type === "income" ? "text-green-600" : tx.type === "expense" ? "text-red-600" : "text-blue-600"
                    }`}>
                      {tx.type === "expense" ? "-" : "+"}{currency.symbol}{tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
                {accountTransactions.length === 0 && (
                  <div className="text-center py-8 text-gray-400">No transactions yet</div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Recurring Impact Chart */}
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <ArrowPathIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">Recurring Impact</h3>
                  <p className="text-xs text-gray-500">Impact of recurring transactions</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
                  <p className="text-xs text-blue-700 font-semibold mb-2 uppercase">Monthly Recurring Impact</p>
                  <p className="text-3xl font-bold text-[#0F172A]">
                    {currency.symbol}{recurringImpact.monthlyImpact.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">{recurringImpact.count} recurring transactions</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Count</p>
                    <p className="text-xl font-bold text-[#0F172A]">{recurringImpact.count}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Total Impact</p>
                    <p className="text-xl font-bold text-[#0F172A]">
                      {currency.symbol}{recurringImpact.totalImpact.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Burn Rate Chart */}
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <FireIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">Burn Rate</h3>
                  <p className="text-xs text-gray-500">Average monthly spending</p>
                </div>
              </div>
              <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl text-center">
                <p className="text-xs text-orange-700 font-semibold mb-2 uppercase">Monthly Burn Rate</p>
                <p className="text-5xl font-black text-orange-700">
                  {currency.symbol}{burnRate.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-orange-600 mt-2">per month</p>
                {burnRate > 0 && selectedAccount && (
                  <p className="text-sm text-gray-600 mt-4">
                    Runway: {Math.floor((selectedAccount.currentBalance || 0) / burnRate)} months
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Portfolio Stability Chart */}
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <ChartBarIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">Portfolio Stability</h3>
                  <p className="text-xs text-gray-500">Overall stability indicator</p>
                </div>
              </div>
              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl text-center">
                <p className="text-xs text-purple-700 font-semibold mb-2 uppercase">Stability Score</p>
                <p className="text-6xl font-black text-purple-700">{stabilityScore.toFixed(0)}</p>
                <p className="text-xs text-purple-600 mt-2">out of 100</p>
                <div className="mt-4 w-full bg-purple-200 rounded-full h-3">
                  <div 
                    className="bg-purple-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${stabilityScore}%` }}
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Balance Projection Chart */}
          <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#0F172A] rounded-lg">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">Balance Projection</h3>
                  <p className="text-xs text-gray-500">12-month forecast</p>
                </div>
              </div>
              <div className="h-64">
                <Line
                  data={{
                    labels: balanceProjection.months,
                    datasets: [{
                      label: "Projected Balance",
                      data: balanceProjection.projectedBalances,
                      borderColor: "#8B5CF6",
                      backgroundColor: "rgba(139, 92, 246, 0.1)",
                      fill: true,
                      tension: 0.4,
                      borderWidth: 3,
                      pointRadius: 4,
                      pointHoverRadius: 6,
                      pointBackgroundColor: "#8B5CF6",
                      borderDash: [5, 5],
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${currency.symbol}${context.parsed.y.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                        },
                      },
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: { grid: { color: "#F3F4F6" }, ticks: { callback: (value) => `${currency.symbol}${value}` } },
                    },
                  }}
                />
              </div>
            </CardBody>
          </Card>

          {/* Transfer Analysis Chart - REMOVED */}
        </div>
      </main>
    </>
  );
}

