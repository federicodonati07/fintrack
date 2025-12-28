"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Card, CardBody, Button } from "@heroui/react";
import {
  getUserDocument,
  getAccounts,
  getTransactions,
  getAllTransactionsIncludingShared,
  getSubAccounts,
  getUserCategories,
  getAnalyticsConfig,
  saveAnalyticsConfig,
} from "@/lib/firestore";
import { getSharedAccounts } from "@/lib/sharedAccounts";
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  ChartBarIcon,
  CurrencyEuroIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  WalletIcon,
  TagIcon,
  FireIcon,
  ChartPieIcon,
  CalendarIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ClockIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition, Listbox, Checkbox } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
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
import { Line, Bar, Doughnut, Pie } from "react-chartjs-2";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

type ChartConfig = {
  id: string;
  name: string;
  description: string;
  requiredPlan: Plan;
  icon: any;
  component: () => JSX.Element;
};

export default function GlobalAnalyticsPage() {
  const { formatAmount, currency } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [sharedAccounts, setSharedAccounts] = useState<any[]>([]);
  const [includeSharedAccounts, setIncludeSharedAccounts] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subAccounts, setSubAccounts] = useState<any[]>([]);
  const [fundAllocation, setFundAllocation] = useState<Array<{ name: string; balance: number; color: string }>>([]);
  const [historicalPeriod, setHistoricalPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly" | "all">("monthly");
  const [visibleCharts, setVisibleCharts] = useState<string[]>([
    "historical-balance",
    "cash-flow",
    "fund-allocation",
    "expense-breakdown",
  ]);
  const [showChartSelector, setShowChartSelector] = useState(false);
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
        try {
          const userSharedAccounts = await getSharedAccounts(currentUser.uid);
          setSharedAccounts(userSharedAccounts);
        } catch (error) {
          console.error("Error loading shared accounts:", error);
          setSharedAccounts([]);
        }

        const userTransactions = await getAllTransactionsIncludingShared(currentUser.uid);
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

        // Load saved analytics configuration
        const config = await getAnalyticsConfig(currentUser.uid);
        if (config && config.visibleCharts) {
          setVisibleCharts(config.visibleCharts);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const canAccessChart = (requiredPlan: Plan): boolean => {
    const planHierarchy = { free: 0, pro: 1, ultra: 2, admin: 3 };
    return planHierarchy[userPlan] >= planHierarchy[requiredPlan];
  };

  // Filter transactions based on includeSharedAccounts
  const filteredTransactions = useMemo(() => {
    if (includeSharedAccounts) {
      return transactions;
    }
    // Exclude shared account transactions
    return transactions.filter(tx => !tx.isSharedAccountTransaction);
  }, [transactions, includeSharedAccounts]);

  // Analytics calculations
  const monthlyData = useMemo(() => {
    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      return {
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        month: d.getMonth(),
        year: d.getFullYear(),
        income: 0,
        expenses: 0,
        balance: 0,
      };
    });

    filteredTransactions.forEach((tx) => {
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      const monthIndex = last12Months.findIndex(
        (m) => m.month === txDate.getMonth() && m.year === txDate.getFullYear()
      );

      if (monthIndex !== -1) {
        if (tx.type === "income") last12Months[monthIndex].income += tx.amount;
        if (tx.type === "expense") last12Months[monthIndex].expenses += tx.amount;
      }
    });

    // Calculate balance correctly using current balance and working backwards
    // Calculate current total balance (accounts + partitions)
    const accountsBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
    const partitionsBalance = subAccounts.reduce((sum, sub) => sum + (sub.balance || 0), 0);
    const currentTotalBalance = Math.max(0, accountsBalance + partitionsBalance);
    
    // Set current month balance
    const now = new Date();
    const currentMonthIndex = last12Months.findIndex(
      (m) => m.month === now.getMonth() && m.year === now.getFullYear()
    );
    
    if (currentMonthIndex !== -1) {
      last12Months[currentMonthIndex].balance = currentTotalBalance;
      
      // Work backwards
      for (let i = currentMonthIndex - 1; i >= 0; i--) {
        const calculatedBalance = last12Months[i + 1].balance - last12Months[i + 1].income + last12Months[i + 1].expenses;
        last12Months[i].balance = Math.max(0, calculatedBalance);
      }
      
      // Work forwards
      for (let i = currentMonthIndex + 1; i < last12Months.length; i++) {
        const calculatedBalance = last12Months[i - 1].balance + last12Months[i].income - last12Months[i].expenses;
        last12Months[i].balance = Math.max(0, calculatedBalance);
      }
    }

    return last12Months;
  }, [filteredTransactions, accounts, subAccounts]);

  const expensesByCategory = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    filteredTransactions
      .filter((tx) => tx.type === "expense")
      .forEach((tx) => {
        const catName = tx.category || "Uncategorized";
        categoryMap[catName] = (categoryMap[catName] || 0) + tx.amount;
      });
    return Object.entries(categoryMap).map(([name, amount]) => ({ name, amount }));
  }, [filteredTransactions]);

  // Load sub-accounts for fund allocation
  useEffect(() => {
    if (!user || accounts.length === 0 || subAccounts.length === 0) return;

    const allocationData: Array<{ name: string; balance: number; color: string }> = [];
    
    for (const acc of accounts) {
      // Add main account balance
      allocationData.push({
        name: acc.name,
        balance: acc.currentBalance || 0,
        color: acc.color || "#6B7280",
      });
      
      // Add sub-accounts (partitions) for this account
      const accountSubs = subAccounts.filter(sub => sub.parentAccountId === acc.id);
      accountSubs.forEach((sub: any) => {
        allocationData.push({
          name: `${acc.name} - ${sub.name}`,
          balance: sub.balance || 0,
          color: acc.color ? `${acc.color}CC` : "#6B7280CC", // Semi-transparent version
        });
      });
    }
    
    // Add shared accounts if enabled
    if (includeSharedAccounts && sharedAccounts.length > 0) {
      sharedAccounts.forEach((sharedAcc: any) => {
        allocationData.push({
          name: `${sharedAcc.name} (Shared)`,
          balance: sharedAcc.currentBalance || 0,
          color: sharedAcc.color || "#8B5CF6", // Purple default for shared
        });
      });
    }
    
    setFundAllocation(allocationData);
  }, [accounts, subAccounts, sharedAccounts, includeSharedAccounts, user]);

  const totalIncome = useMemo(
    () => filteredTransactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0),
    [filteredTransactions]
  );

  const totalExpenses = useMemo(
    () => filteredTransactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0),
    [filteredTransactions]
  );

  const savingRate = useMemo(() => {
    if (totalIncome === 0) return 0;
    return ((totalIncome - totalExpenses) / totalIncome) * 100;
  }, [totalIncome, totalExpenses]);

  const burnRate = useMemo(() => {
    const monthlyExpenses = monthlyData.map((m) => m.expenses);
    return monthlyExpenses.reduce((sum, e) => sum + e, 0) / monthlyExpenses.length;
  }, [monthlyData]);

  // Chart components
  // Historical Balance Chart
  const HistoricalBalanceChart = () => {
    const generateHistoricalData = () => {
      // Current total balance (accounts + partitions + shared accounts)
      const accountsBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
      const partitionsBalance = subAccounts.reduce((sum, sub) => sum + (sub.balance || 0), 0);
      const sharedBalance = includeSharedAccounts 
        ? sharedAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0)
        : 0;
      const currentTotalBalance = Math.max(0, accountsBalance + partitionsBalance + sharedBalance);
      
      // Sort all filtered transactions by date
      const sortedTransactions = [...filteredTransactions].sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });

      if (sortedTransactions.length === 0) {
        return { labels: ["Now"], data: [currentTotalBalance] };
      }

      const now = new Date();
      const firstTxDate = sortedTransactions[0].date?.toDate ? sortedTransactions[0].date.toDate() : new Date(sortedTransactions[0].date);
      
      // Determine time range and intervals based on period
      let startDate: Date;
      let intervals: Date[] = [];
      
      switch (historicalPeriod) {
        case "daily": {
          // Last 24 hours, hourly
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          for (let i = 24; i >= 0; i--) {
            intervals.push(new Date(now.getTime() - i * 60 * 60 * 1000));
          }
          break;
        }
        case "weekly": {
          // Last 7 days, daily
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          for (let i = 7; i >= 0; i--) {
            intervals.push(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
          }
          break;
        }
        case "monthly": {
          // Last 30 days, daily
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          for (let i = 30; i >= 0; i--) {
            intervals.push(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
          }
          break;
        }
        case "yearly": {
          // Last 12 months, monthly
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 12);
          for (let i = 12; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            intervals.push(date);
          }
          break;
        }
        case "all": {
          // From first transaction to now
          startDate = firstTxDate;
          const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
          
          if (daysDiff <= 30) {
            // Less than 30 days: daily intervals
            for (let i = 0; i <= daysDiff; i++) {
              intervals.push(new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000));
            }
          } else if (daysDiff <= 365) {
            // Less than 1 year: weekly intervals
            const weeks = Math.ceil(daysDiff / 7);
            for (let i = 0; i <= weeks; i++) {
              intervals.push(new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000));
            }
          } else {
            // More than 1 year: monthly intervals
            const current = new Date(startDate);
            while (current <= now) {
              intervals.push(new Date(current));
              current.setMonth(current.getMonth() + 1);
            }
          }
          break;
        }
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          for (let i = 24; i >= 0; i--) {
            intervals.push(new Date(now.getTime() - i * 60 * 60 * 1000));
          }
      }

      // Filter transactions in the time range (exclude partition transactions)
      const relevantTransactions = sortedTransactions.filter(tx => {
        const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        const inRange = txDate >= startDate && txDate <= now;
        const isNotPartition = !tx.type?.startsWith("partition");
        return inRange && isNotPartition;
      });

      // Calculate balance at each interval
      const dataPoints: { date: Date; balance: number }[] = [];
      
      // Start from current balance and work backwards
      let futureBalance = currentTotalBalance;
      
      for (let i = intervals.length - 1; i >= 0; i--) {
        const intervalDate = intervals[i];
        
        // Find all transactions after this interval up to the next interval (or now)
        const nextInterval = i < intervals.length - 1 ? intervals[i + 1] : now;
        const txsInInterval = relevantTransactions.filter(tx => {
          const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
          return txDate > intervalDate && txDate <= nextInterval;
        });
        
        // Subtract these transactions from future balance to get balance at this interval
        let balanceAtInterval = futureBalance;
        for (const tx of txsInInterval) {
          if (tx.type === "income") {
            balanceAtInterval -= tx.amount;
          } else if (tx.type === "expense") {
            balanceAtInterval += tx.amount;
          }
          // Transfers don't affect total balance
        }
        
        dataPoints.unshift({
          date: new Date(intervalDate),
          balance: Math.max(0, balanceAtInterval),
        });
        
        futureBalance = balanceAtInterval;
      }

      // Format labels based on period
      const formatLabel = (date: Date) => {
        switch (historicalPeriod) {
          case "daily":
            return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          case "weekly":
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          case "monthly":
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          case "yearly":
            return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
          case "all": {
            const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
            if (daysDiff <= 30) {
              return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            } else if (daysDiff <= 365) {
              return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            } else {
              return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            }
          }
          default:
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
      };

      return {
        labels: dataPoints.map(p => formatLabel(p.date)),
        data: dataPoints.map(p => p.balance),
      };
    };

    const historicalData = generateHistoricalData();
    const requiredPlan = historicalPeriod === "monthly" || historicalPeriod === "yearly" ? "pro" : historicalPeriod === "all" ? "ultra" : "free";
    const hasAccess = canAccessChart(requiredPlan);

    return (
      <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!hasAccess ? "opacity-60" : ""}`}>
        <CardBody className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#0F172A] rounded-lg">
                <ClockIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#0F172A]">Historical Balance</h3>
                <p className="text-xs text-gray-500">Capital evolution over time</p>
              </div>
            </div>
            
            {/* Period Selector */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {[
                { value: "daily", label: "Day", plan: "free" },
                { value: "weekly", label: "Week", plan: "free" },
                { value: "monthly", label: "Month", plan: "pro" },
                { value: "yearly", label: "Year", plan: "pro" },
                { value: "all", label: "All", plan: "ultra" },
              ].map((period) => (
                <button
                  key={period.value}
                  onClick={() => canAccessChart(period.plan as Plan) && setHistoricalPeriod(period.value as any)}
                  disabled={!canAccessChart(period.plan as Plan)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                    historicalPeriod === period.value
                      ? "bg-[#0F172A] text-white"
                      : canAccessChart(period.plan as Plan)
                      ? "text-gray-600 hover:text-[#0F172A]"
                      : "text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {period.label}
                  {!canAccessChart(period.plan as Plan) && <span className="ml-1">🔒</span>}
                </button>
              ))}
            </div>
          </div>

          {hasAccess ? (
            <div className="h-64">
              <Line
                data={{
                  labels: historicalData.labels,
                  datasets: [{
                    label: "Total Balance",
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
          ) : (
            <div className="text-center py-8">
              <Button
                onClick={() => router.push("/dashboard/plan")}
                className="bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg font-medium"
              >
                Upgrade to {requiredPlan === "ultra" ? "Ultra" : "Pro"}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // Historical Expense Chart
  const HistoricalExpenseChart = () => {
    const generateHistoricalExpenseData = () => {
      // Sort all expense transactions by date
      const expenseTransactions = filteredTransactions
        .filter(tx => tx.type === "expense")
        .sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateA.getTime() - dateB.getTime();
        });

      if (expenseTransactions.length === 0) {
        return { labels: ["Now"], data: [0] };
      }

      const now = new Date();
      const firstTxDate = expenseTransactions[0].date?.toDate 
        ? expenseTransactions[0].date.toDate() 
        : new Date(expenseTransactions[0].date);
      
      // Determine time range and intervals based on period
      let startDate: Date;
      let intervals: Date[] = [];
      
      switch (historicalPeriod) {
        case "daily": {
          // Last 24 hours, hourly
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          for (let i = 24; i >= 0; i--) {
            intervals.push(new Date(now.getTime() - i * 60 * 60 * 1000));
          }
          break;
        }
        case "weekly": {
          // Last 7 days, daily
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          for (let i = 7; i >= 0; i--) {
            intervals.push(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
          }
          break;
        }
        case "monthly": {
          // Last 30 days, daily
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          for (let i = 30; i >= 0; i--) {
            intervals.push(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
          }
          break;
        }
        case "yearly": {
          // Last 12 months, monthly
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 12);
          for (let i = 12; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            intervals.push(date);
          }
          break;
        }
        case "all": {
          // From first transaction to now
          startDate = firstTxDate;
          const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
          
          if (daysDiff <= 30) {
            // Less than 30 days: daily intervals
            for (let i = 0; i <= daysDiff; i++) {
              intervals.push(new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000));
            }
          } else if (daysDiff <= 365) {
            // Less than 1 year: weekly intervals
            const weeks = Math.ceil(daysDiff / 7);
            for (let i = 0; i <= weeks; i++) {
              intervals.push(new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000));
            }
          } else {
            // More than 1 year: monthly intervals
            const current = new Date(startDate);
            while (current <= now) {
              intervals.push(new Date(current));
              current.setMonth(current.getMonth() + 1);
            }
          }
          break;
        }
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          for (let i = 24; i >= 0; i--) {
            intervals.push(new Date(now.getTime() - i * 60 * 60 * 1000));
          }
      }

      // Filter expense transactions in the time range
      const relevantExpenses = expenseTransactions.filter(tx => {
        const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        return txDate >= startDate && txDate <= now;
      });

      // Calculate cumulative expenses at each interval
      const dataPoints: { date: Date; expense: number }[] = [];
      
      for (let i = 0; i < intervals.length; i++) {
        const intervalDate = intervals[i];
        
        // Sum all expenses up to this interval
        const expensesUpToInterval = relevantExpenses.filter(tx => {
          const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
          return txDate <= intervalDate;
        });
        
        const totalExpense = expensesUpToInterval.reduce((sum, tx) => sum + tx.amount, 0);
        
        dataPoints.push({
          date: new Date(intervalDate),
          expense: totalExpense,
        });
      }

      // Format labels based on period
      const formatLabel = (date: Date) => {
        switch (historicalPeriod) {
          case "daily":
            return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          case "weekly":
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          case "monthly":
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          case "yearly":
            return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
          case "all": {
            const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
            if (daysDiff <= 30) {
              return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            } else if (daysDiff <= 365) {
              return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            } else {
              return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            }
          }
          default:
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
      };

      return {
        labels: dataPoints.map(p => formatLabel(p.date)),
        data: dataPoints.map(p => p.expense),
      };
    };

    const historicalExpenseData = generateHistoricalExpenseData();
    const hasAccess = canAccessChart("ultra");

    return (
      <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!hasAccess ? "opacity-60" : ""}`}>
        <CardBody className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-600 rounded-lg">
                <ArrowTrendingDownIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#0F172A]">Historical Expense</h3>
                <p className="text-xs text-gray-500">Cumulative expenses over time</p>
              </div>
            </div>
            
            {/* Period Selector */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {[
                { value: "daily", label: "Day" },
                { value: "weekly", label: "Week" },
                { value: "monthly", label: "Month" },
                { value: "yearly", label: "Year" },
                { value: "all", label: "All" },
              ].map((period) => (
                <button
                  key={period.value}
                  onClick={() => hasAccess && setHistoricalPeriod(period.value as any)}
                  disabled={!hasAccess}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                    historicalPeriod === period.value
                      ? "bg-red-600 text-white"
                      : hasAccess
                      ? "text-gray-600 hover:text-red-600"
                      : "text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {period.label}
                  {!hasAccess && <span className="ml-1">🔒</span>}
                </button>
              ))}
            </div>
          </div>

          {hasAccess ? (
            <div className="h-64">
              <Line
                data={{
                  labels: historicalExpenseData.labels,
                  datasets: [{
                    label: "Total Expenses",
                    data: historicalExpenseData.data,
                    borderColor: "#EF4444",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: "#EF4444",
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
          ) : (
            <div className="text-center py-8">
              <Button
                onClick={() => router.push("/dashboard/plan")}
                className="bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg font-medium"
              >
                Upgrade to Ultra
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  const CashFlowChart = () => (
    <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
      <CardBody className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[#0F172A] rounded-lg">
            <ArrowTrendingUpIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#0F172A]">Cash Flow Analyzer</h3>
            <p className="text-xs text-gray-500">Income vs Expenses trend</p>
          </div>
        </div>
        <div className="h-64">
          <Line
            data={{
              labels: monthlyData.map((m) => m.label),
              datasets: [
                {
                  label: "Income",
                  data: monthlyData.map((m) => m.income),
                  borderColor: "#22C55E",
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  fill: true,
                  tension: 0.4,
                },
                {
                  label: "Expenses",
                  data: monthlyData.map((m) => m.expenses),
                  borderColor: "#EF4444",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  fill: true,
                  tension: 0.4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "top" } },
              scales: {
                x: { grid: { display: false } },
                y: { grid: { color: "#F3F4F6" }, ticks: { callback: (value) => `${currency.symbol}${value}` } },
              },
            }}
          />
        </div>
      </CardBody>
    </Card>
  );


  const FundAllocationChart = () => (
    <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
      <CardBody className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[#0F172A] rounded-lg">
            <WalletIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#0F172A]">Fund Allocation Overview</h3>
            <p className="text-xs text-gray-500">Distribution across accounts</p>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center">
          {fundAllocation.length > 0 ? (
            <Doughnut
              data={{
                labels: fundAllocation.map((f) => f.name),
                datasets: [
                  {
                    data: fundAllocation.map((f) => f.balance),
                    backgroundColor: fundAllocation.map((f) => f.color),
                    borderWidth: 2,
                    borderColor: "#ffffff",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: "right" },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const total = fundAllocation.reduce((sum, f) => sum + f.balance, 0);
                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                        return `${context.label}: ${currency.symbol}${context.parsed.toFixed(2)} (${percentage}%)`;
                      },
                    },
                  },
                },
              }}
            />
          ) : (
            <p className="text-sm text-gray-500">No accounts available</p>
          )}
        </div>
      </CardBody>
    </Card>
  );

  const ExpenseCategoryChart = () => {
    // Map categories with their actual colors
    const categoryColors = expensesByCategory.map((c) => {
      const category = categories.find((cat) => cat.name === c.name);
      return category?.color || "#6B7280";
    });

    return (
      <Card className="border border-gray-200 shadow-sm bg-white rounded-lg">
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#0F172A] rounded-lg">
              <TagIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">Expense Category Breakdown</h3>
              <p className="text-xs text-gray-500">Where your money goes</p>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            {expensesByCategory.length > 0 ? (
              <Pie
                data={{
                  labels: expensesByCategory.map((c) => c.name),
                  datasets: [
                    {
                      data: expensesByCategory.map((c) => c.amount),
                      backgroundColor: categoryColors,
                      borderWidth: 2,
                      borderColor: "#ffffff",
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "right" },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const total = expensesByCategory.reduce((sum, c) => sum + c.amount, 0);
                          const percentage = ((context.parsed / total) * 100).toFixed(1);
                          return `${context.label}: ${currency.symbol}${context.parsed.toFixed(2)} (${percentage}%)`;
                        },
                      },
                    },
                  },
                }}
              />
            ) : (
              <p className="text-sm text-gray-500">No expense data available</p>
            )}
          </div>
        </CardBody>
      </Card>
    );
  };

  const BurnRateChart = () => (
    <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("pro") ? "opacity-60" : ""}`}>
      <CardBody className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[#0F172A] rounded-lg">
            <FireIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#0F172A]">
              Burn Rate Monitor {!canAccessChart("pro") && <span className="text-xs text-gray-500">🔒 Pro</span>}
            </h3>
            <p className="text-xs text-gray-500">Average monthly spending</p>
          </div>
        </div>
        {canAccessChart("pro") ? (
          <div className="space-y-4">
            <div className="text-center p-6 bg-red-50 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{currency.symbol}{burnRate.toFixed(2)}</p>
              <p className="text-sm text-gray-600 mt-1">per month</p>
            </div>
            <div className="h-48">
              <Bar
                data={{
                  labels: monthlyData.map((m) => m.label),
                  datasets: [
                    {
                      label: "Monthly Expenses",
                      data: monthlyData.map((m) => m.expenses),
                      backgroundColor: "rgba(239, 68, 68, 0.8)",
                      borderColor: "#EF4444",
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
                    y: { grid: { color: "#F3F4F6" }, ticks: { callback: (value) => `${currency.symbol}${value}` } },
                  },
                }}
              />
            </div>
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
  );

  const SavingRateChart = () => (
    <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("pro") ? "opacity-60" : ""}`}>
      <CardBody className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[#0F172A] rounded-lg">
            <BanknotesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#0F172A]">
              Saving Rate Tracker {!canAccessChart("pro") && <span className="text-xs text-gray-500">🔒 Pro</span>}
            </h3>
            <p className="text-xs text-gray-500">Savings as % of income</p>
          </div>
        </div>
        {canAccessChart("pro") ? (
          <div className="space-y-4">
            <div className="text-center p-6 bg-[#22C55E]/10 rounded-lg">
              <p className="text-3xl font-bold text-[#22C55E]">{savingRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-600 mt-1">of your income</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Total Income</p>
                <p className="text-lg font-semibold text-[#0F172A]">{currency.symbol}{totalIncome.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
                <p className="text-lg font-semibold text-[#0F172A]">{currency.symbol}{totalExpenses.toFixed(2)}</p>
              </div>
            </div>
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
  );

  const RecurringVsVariableChart = () => (
    <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("pro") ? "opacity-60" : ""}`}>
      <CardBody className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[#0F172A] rounded-lg">
            <ArrowPathIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#0F172A]">
              Recurring vs Variable Expenses {!canAccessChart("pro") && <span className="text-xs text-gray-500">🔒 Pro</span>}
            </h3>
            <p className="text-xs text-gray-500">Fixed vs flexible spending</p>
          </div>
        </div>
        {canAccessChart("pro") ? (
          <div className="h-64 flex items-center justify-center">
            <Doughnut
              data={{
                labels: ["Recurring", "Variable"],
                datasets: [
                  {
                    data: [
                      filteredTransactions.filter((tx) => tx.type === "expense" && tx.isRecurring).reduce((sum, tx) => sum + tx.amount, 0),
                      filteredTransactions.filter((tx) => tx.type === "expense" && !tx.isRecurring).reduce((sum, tx) => sum + tx.amount, 0),
                    ],
                    backgroundColor: ["#EF4444", "#F59E0B"],
                    borderWidth: 2,
                    borderColor: "#ffffff",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: "bottom" },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${currency.symbol}${context.parsed.toFixed(2)}`,
                    },
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
  );

  const BudgetVsActualChart = () => {
    // Calculate average monthly spending per category as "budget"
    const categoryTotals: { [key: string]: { actual: number; count: number } } = {};
    
    filteredTransactions.filter(tx => tx.type === "expense").forEach(tx => {
      const cat = tx.category || "Uncategorized";
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { actual: 0, count: 0 };
      }
      categoryTotals[cat].actual += tx.amount;
      categoryTotals[cat].count += 1;
    });

    const categoryBudgets = Object.entries(categoryTotals).map(([name, data]) => ({
      name,
      budget: (data.actual / Math.max(1, monthlyData.length)) * 1.1, // 10% above average as budget
      actual: data.actual / Math.max(1, monthlyData.length),
    })).slice(0, 8); // Top 8 categories

    return (
      <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("pro") ? "opacity-60" : ""}`}>
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#0F172A] rounded-lg">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">
                Budget vs Actual {!canAccessChart("pro") && <span className="text-xs text-gray-500">🔒 Pro</span>}
              </h3>
              <p className="text-xs text-gray-500">Planned vs real spending</p>
            </div>
          </div>
          {canAccessChart("pro") ? (
            <div className="h-64">
              <Bar
                data={{
                  labels: categoryBudgets.map(c => c.name),
                  datasets: [
                    {
                      label: "Budget",
                      data: categoryBudgets.map(c => c.budget),
                      backgroundColor: "rgba(34, 197, 94, 0.5)",
                      borderColor: "#22C55E",
                      borderWidth: 2,
                    },
                    {
                      label: "Actual",
                      data: categoryBudgets.map(c => c.actual),
                      backgroundColor: "rgba(239, 68, 68, 0.5)",
                      borderColor: "#EF4444",
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { position: "top" },
                    tooltip: {
                      callbacks: {
                        label: (context) => `${context.dataset.label}: ${currency.symbol}${context.parsed.y.toFixed(2)}/month`,
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
    );
  };

  const PeriodComparisonChart = () => {
    // Compare current month vs previous month, and current year vs previous year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const currentMonthData = { income: 0, expenses: 0 };
    const previousMonthData = { income: 0, expenses: 0 };
    const currentYearData = { income: 0, expenses: 0 };
    const previousYearData = { income: 0, expenses: 0 };

    transactions.forEach(tx => {
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      const txMonth = txDate.getMonth();
      const txYear = txDate.getFullYear();

      if (txYear === currentYear && txMonth === currentMonth) {
        if (tx.type === "income") currentMonthData.income += tx.amount;
        if (tx.type === "expense") currentMonthData.expenses += tx.amount;
      } else if (txYear === currentYear && txMonth === currentMonth - 1) {
        if (tx.type === "income") previousMonthData.income += tx.amount;
        if (tx.type === "expense") previousMonthData.expenses += tx.amount;
      }

      if (txYear === currentYear) {
        if (tx.type === "income") currentYearData.income += tx.amount;
        if (tx.type === "expense") currentYearData.expenses += tx.amount;
      } else if (txYear === currentYear - 1) {
        if (tx.type === "income") previousYearData.income += tx.amount;
        if (tx.type === "expense") previousYearData.expenses += tx.amount;
      }
    });

    const comparison = {
      monthOverMonth: {
        current: currentMonthData.income - currentMonthData.expenses,
        previous: previousMonthData.income - previousMonthData.expenses,
        change: (previousMonthData.income - previousMonthData.expenses) !== 0 
          ? ((currentMonthData.income - currentMonthData.expenses) - (previousMonthData.income - previousMonthData.expenses)) / Math.abs(previousMonthData.income - previousMonthData.expenses) * 100
          : 0,
      },
      yearOverYear: {
        current: currentYearData.income - currentYearData.expenses,
        previous: previousYearData.income - previousYearData.expenses,
        change: (previousYearData.income - previousYearData.expenses) !== 0
          ? ((currentYearData.income - currentYearData.expenses) - (previousYearData.income - previousYearData.expenses)) / Math.abs(previousYearData.income - previousYearData.expenses) * 100
          : 0,
      },
    };

    return (
      <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("pro") ? "opacity-60" : ""}`}>
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#0F172A] rounded-lg">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">
                Period Comparison Tool {!canAccessChart("pro") && <span className="text-xs text-gray-500">🔒 Pro</span>}
              </h3>
              <p className="text-xs text-gray-500">MoM, YoY comparison</p>
            </div>
          </div>
          {canAccessChart("pro") ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Month over Month */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
                  <p className="text-xs text-blue-700 font-semibold mb-2 uppercase">Month over Month</p>
                  <p className="text-2xl font-bold text-[#0F172A] mb-1">
                    {currency.symbol}{comparison.monthOverMonth.current.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-2">
                    {comparison.monthOverMonth.change >= 0 ? (
                      <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                    )}
                    <p className={`text-sm font-semibold ${comparison.monthOverMonth.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {comparison.monthOverMonth.change >= 0 ? '+' : ''}{comparison.monthOverMonth.change.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Year over Year */}
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                  <p className="text-xs text-purple-700 font-semibold mb-2 uppercase">Year over Year</p>
                  <p className="text-2xl font-bold text-[#0F172A] mb-1">
                    {currency.symbol}{comparison.yearOverYear.current.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-2">
                    {comparison.yearOverYear.change >= 0 ? (
                      <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                    )}
                    <p className={`text-sm font-semibold ${comparison.yearOverYear.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {comparison.yearOverYear.change >= 0 ? '+' : ''}{comparison.yearOverYear.change.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-48">
                <Bar
                  data={{
                    labels: ["Previous Month", "This Month", "Previous Year", "This Year"],
                    datasets: [{
                      label: "Net Balance",
                      data: [
                        comparison.monthOverMonth.previous,
                        comparison.monthOverMonth.current,
                        comparison.yearOverYear.previous,
                        comparison.yearOverYear.current,
                      ],
                      backgroundColor: [
                        "rgba(100, 116, 139, 0.7)",
                        "rgba(34, 197, 94, 0.7)",
                        "rgba(100, 116, 139, 0.7)",
                        "rgba(34, 197, 94, 0.7)",
                      ],
                      borderColor: ["#64748B", "#22C55E", "#64748B", "#22C55E"],
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
                          label: (context) => `${currency.symbol}${context.parsed.y.toFixed(2)}`,
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
    );
  };

  // Balance Projection Engine
  const BalanceProjectionChart = () => {
    const avgMonthlyIncome = monthlyData.reduce((sum, m) => sum + m.income, 0) / monthlyData.length;
    const avgMonthlyExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0) / monthlyData.length;
    const currentBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
    
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() + i + 1);
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    });

    const projectedBalances = [];
    let runningBalance = currentBalance;
    for (let i = 0; i < 12; i++) {
      runningBalance += (avgMonthlyIncome - avgMonthlyExpenses);
      projectedBalances.push(runningBalance);
    }

    const projection = { months, projectedBalances };

    return (
      <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("ultra") ? "opacity-60" : ""}`}>
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#1E293B] rounded-lg">
              <ArrowTrendingUpIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">
                Balance Projection Engine {!canAccessChart("ultra") && <span className="text-xs text-gray-500">🔒 Ultra</span>}
              </h3>
              <p className="text-xs text-gray-500">Future balance forecast</p>
            </div>
          </div>
          {canAccessChart("ultra") ? (
            <div className="h-64">
              <Line
                data={{
                  labels: projection.months,
                  datasets: [{
                    label: "Projected Balance",
                    data: projection.projectedBalances,
                    borderColor: "#8B5CF6",
                    backgroundColor: "rgba(139, 92, 246, 0.1)",
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => `${currency.symbol}${context.parsed.y.toFixed(2)}`,
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
          ) : (
            <div className="text-center py-8">
              <Button onClick={() => router.push("/dashboard/plan")} className="bg-[#1E293B] hover:bg-[#0F172A] text-white rounded-lg font-medium">
                Upgrade to Ultra
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // Expense Waterfall
  const ExpenseWaterfallChart = () => {
    const startBalance = accounts.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
    const currentBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
    const totalIncome = filteredTransactions.filter(tx => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpenses = filteredTransactions.filter(tx => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);

    const waterfallData = {
      labels: ["Initial", "Income", "Expenses", "Current"],
      values: [startBalance, totalIncome, -totalExpenses, currentBalance],
    };

    return (
      <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("ultra") ? "opacity-60" : ""}`}>
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#1E293B] rounded-lg">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">
                Expense Waterfall {!canAccessChart("ultra") && <span className="text-xs text-gray-500">🔒 Ultra</span>}
              </h3>
              <p className="text-xs text-gray-500">Balance change breakdown</p>
            </div>
          </div>
          {canAccessChart("ultra") ? (
            <div className="h-64">
              <Bar
                data={{
                  labels: waterfallData.labels,
                  datasets: [{
                    label: "Balance Flow",
                    data: waterfallData.values,
                    backgroundColor: waterfallData.values.map(v => v >= 0 ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)"),
                    borderColor: waterfallData.values.map(v => v >= 0 ? "#22C55E" : "#EF4444"),
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
                          label: (context) => `${currency.symbol}${Math.abs(context.parsed.y).toFixed(2)}`,
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
          ) : (
            <div className="text-center py-8">
              <Button onClick={() => router.push("/dashboard/plan")} className="bg-[#1E293B] hover:bg-[#0F172A] text-white rounded-lg font-medium">
                Upgrade to Ultra
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // Financial Stability Index
  const FinancialStabilityChart = () => {
    const savingsScore = Math.min(100, savingRate * 2); // Max 100
    const diversificationScore = Math.min(100, (accounts.length / 5) * 100); // Max at 5 accounts
    const consistencyScore = monthlyData.length >= 6 ? 100 : (monthlyData.length / 6) * 100;
    const debtScore = 100; // Simplified: assume no debt tracking yet
    
    const overall = (savingsScore + diversificationScore + consistencyScore + debtScore) / 4;

    const stabilityIndex = {
      overall,
      components: [
        { name: "Savings Rate", score: savingsScore },
        { name: "Diversification", score: diversificationScore },
        { name: "Consistency", score: consistencyScore },
        { name: "Debt Management", score: debtScore },
      ],
    };

    return (
      <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("ultra") ? "opacity-60" : ""}`}>
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#1E293B] rounded-lg">
              <ChartPieIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">
                Financial Stability Index {!canAccessChart("ultra") && <span className="text-xs text-gray-500">🔒 Ultra</span>}
              </h3>
              <p className="text-xs text-gray-500">Overall financial health</p>
            </div>
          </div>
          {canAccessChart("ultra") ? (
            <div className="space-y-4">
              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                <p className="text-sm text-purple-700 font-semibold mb-2 uppercase">Overall Stability Score</p>
                <p className="text-5xl font-black text-purple-700">{stabilityIndex.overall.toFixed(0)}</p>
                <p className="text-xs text-purple-600 mt-2">out of 100</p>
              </div>
              <div className="h-48">
                <Bar
                  data={{
                    labels: stabilityIndex.components.map(c => c.name),
                    datasets: [{
                      label: "Score",
                      data: stabilityIndex.components.map(c => c.score),
                      backgroundColor: "rgba(139, 92, 246, 0.7)",
                      borderColor: "#8B5CF6",
                      borderWidth: 2,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false } },
                      y: { min: 0, max: 100, grid: { color: "#F3F4F6" }, ticks: { callback: (value) => `${value}%` } },
                    },
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Button onClick={() => router.push("/dashboard/plan")} className="bg-[#1E293B] hover:bg-[#0F172A] text-white rounded-lg font-medium">
                Upgrade to Ultra
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // Money Flow Map
  const MoneyFlowMapChart = () => {
    const [flowPeriod, setFlowPeriod] = useState<"month" | "quarter" | "year" | "all">("month");

    // Filter transactions based on selected period
    const getFlowTransactions = () => {
      const now = new Date();
      let startDate: Date;

      switch (flowPeriod) {
        case "month":
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "quarter":
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case "year":
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case "all":
          return filteredTransactions;
        default:
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
      }

      return filteredTransactions.filter(tx => {
        const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        return txDate >= startDate;
      });
    };

    const flowTransactions = getFlowTransactions();

    // Calculate money flows between different sources/destinations
    const incomeByCategory: { [key: string]: number } = {};
    const expensesByCategory: { [key: string]: number } = {};
    const accountFlows: { [key: string]: { in: number; out: number } } = {};

    flowTransactions.forEach(tx => {
      if (tx.type === "income") {
        const cat = tx.category || "Other Income";
        incomeByCategory[cat] = (incomeByCategory[cat] || 0) + tx.amount;
      } else if (tx.type === "expense") {
        const cat = tx.category || "Other Expenses";
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + tx.amount;
      } else if (tx.type === "transfer") {
        const fromAcc = accounts.find(a => a.id === tx.accountId)?.name || "Unknown";
        const toAcc = accounts.find(a => a.id === tx.toAccountId)?.name || "Unknown";
        
        if (!accountFlows[fromAcc]) accountFlows[fromAcc] = { in: 0, out: 0 };
        if (!accountFlows[toAcc]) accountFlows[toAcc] = { in: 0, out: 0 };
        
        accountFlows[fromAcc].out += tx.amount;
        accountFlows[toAcc].in += tx.amount;
      }
    });

    const topIncome = Object.entries(incomeByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const topExpenses = Object.entries(expensesByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const getPeriodLabel = () => {
      switch (flowPeriod) {
        case "month": return "Last Month";
        case "quarter": return "Last 3 Months";
        case "year": return "Last Year";
        case "all": return "All Time";
        default: return "Last Month";
      }
    };

    return (
      <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("ultra") ? "opacity-60" : ""}`}>
        <CardBody className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#1E293B] rounded-lg">
                <ArrowPathIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#0F172A]">
                  Money Flow Map {!canAccessChart("ultra") && <span className="text-xs text-gray-500">🔒 Ultra</span>}
                </h3>
                <p className="text-xs text-gray-500">Capital movement visualization</p>
              </div>
            </div>

            {/* Period Selector */}
            {canAccessChart("ultra") && (
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {[
                  { value: "month", label: "Month" },
                  { value: "quarter", label: "Quarter" },
                  { value: "year", label: "Year" },
                  { value: "all", label: "All" },
                ].map((period) => (
                  <button
                    key={period.value}
                    onClick={() => setFlowPeriod(period.value as any)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                      flowPeriod === period.value
                        ? "bg-[#0F172A] text-white"
                        : "text-gray-600 hover:text-[#0F172A]"
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {canAccessChart("ultra") ? (
            <div className="space-y-6">
              {/* Income Sources */}
              <div>
                <p className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                  Top Income Sources ({getPeriodLabel()})
                </p>
                <div className="space-y-2">
                  {topIncome.length > 0 ? (
                    topIncome.map(([name, amount]) => (
                      <div key={name} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{name}</span>
                            <span className="text-xs font-bold text-green-600">{currency.symbol}{amount.toFixed(2)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-400 to-green-600"
                              style={{ width: `${(amount / Math.max(...topIncome.map(i => i[1]))) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-4">No income data for this period</p>
                  )}
                </div>
              </div>

              {/* Expense Destinations */}
              <div>
                <p className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                  <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                  Top Expense Categories ({getPeriodLabel()})
                </p>
                <div className="space-y-2">
                  {topExpenses.length > 0 ? (
                    topExpenses.map(([name, amount]) => {
                      const category = categories.find(c => c.name === name);
                      const color = category?.color || "#EF4444";
                      
                      return (
                        <div key={name} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700">{name}</span>
                              <span className="text-xs font-bold text-red-600">{currency.symbol}{amount.toFixed(2)}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full"
                                style={{ 
                                  width: `${(amount / Math.max(...topExpenses.map(e => e[1]))) * 100}%`,
                                  background: `linear-gradient(to right, ${color}aa, ${color})`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-4">No expense data for this period</p>
                  )}
                </div>
              </div>

              {/* Account Flows */}
              {Object.keys(accountFlows).length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 text-blue-600" />
                    Internal Transfers
                  </p>
                  <div className="space-y-2">
                    {Object.entries(accountFlows).slice(0, 5).map(([name, flow]) => (
                      <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs font-medium text-gray-700">{name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-green-600 font-semibold">↓ {currency.symbol}{flow.in.toFixed(0)}</span>
                          <span className="text-xs text-red-600 font-semibold">↑ {currency.symbol}{flow.out.toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Button onClick={() => router.push("/dashboard/plan")} className="bg-[#1E293B] hover:bg-[#0F172A] text-white rounded-lg font-medium">
                Upgrade to Ultra
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // Spending Heatmap
  const SpendingHeatmapChart = () => {
    const [hoveredDay, setHoveredDay] = useState<number | null>(null);

    // Create a 7x5 grid (5 weeks x 7 days) for the last 35 days
    const heatmapData = Array.from({ length: 35 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (34 - i));
      
      const dayExpenses = transactions
        .filter(tx => {
          if (tx.type !== "expense") return false;
          const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
          return txDate.toDateString() === date.toDateString();
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const dayIncome = transactions
        .filter(tx => {
          if (tx.type !== "income") return false;
          const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
          return txDate.toDateString() === date.toDateString();
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      return {
        day: date.getDate(),
        dayOfWeek: date.getDay(),
        weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
        expenses: dayExpenses,
        income: dayIncome,
        net: dayIncome - dayExpenses,
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };
    });

    const maxExpense = Math.max(...heatmapData.map(d => d.expenses), 1);
    const maxIncome = Math.max(...heatmapData.map(d => d.income), 1);

    const getIntensityColor = (expenses: number, income: number) => {
      if (expenses === 0 && income === 0) return "#F3F4F6";
      
      // If both exist, show the dominant one
      if (income > expenses) {
        const intensity = (income / maxIncome);
        if (intensity > 0.75) return "#16A34A"; // Very high income
        if (intensity > 0.5) return "#22C55E";  // High income
        if (intensity > 0.25) return "#4ADE80"; // Medium income
        return "#86EFAC"; // Low income
      } else {
        const intensity = (expenses / maxExpense);
        if (intensity > 0.75) return "#DC2626"; // Very high expense
        if (intensity > 0.5) return "#EF4444";  // High expense
        if (intensity > 0.25) return "#FB923C"; // Medium expense
        return "#FCD34D"; // Low expense
      }
    };

    return (
      <Card className={`border border-gray-200 shadow-sm bg-white rounded-lg ${!canAccessChart("ultra") ? "opacity-60" : ""}`}>
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#1E293B] rounded-lg">
              <FireIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">
                Cash Flow Heatmap {!canAccessChart("ultra") && <span className="text-xs text-gray-500">🔒 Ultra</span>}
              </h3>
              <p className="text-xs text-gray-500">Income & expense activity (Last 35 days)</p>
            </div>
          </div>
          {canAccessChart("ultra") ? (
            <div>
              {/* Day labels */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-[10px] text-center font-semibold text-gray-500">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Heatmap grid */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {heatmapData.map((day, index) => (
                  <div
                    key={index}
                    className="aspect-square rounded-sm flex flex-col items-center justify-center transition-transform hover:scale-110 hover:z-10 relative cursor-pointer"
                    style={{ backgroundColor: getIntensityColor(day.expenses, day.income) }}
                    onMouseEnter={() => setHoveredDay(index)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    <span className="text-[10px] font-bold text-gray-700">{day.day}</span>
                    
                    {/* Tooltip */}
                    {hoveredDay === index && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                          <p className="font-semibold mb-1">{day.date}</p>
                          <p className="text-green-400">Income: {currency.symbol}{day.income.toFixed(2)}</p>
                          <p className="text-red-400">Expenses: {currency.symbol}{day.expenses.toFixed(2)}</p>
                          <p className={`font-semibold mt-1 ${day.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            Net: {currency.symbol}{day.net.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-semibold">Expenses:</span>
                  <div className="flex gap-1">
                    {["#FCD34D", "#FB923C", "#EF4444", "#DC2626"].map((color, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-semibold">Income:</span>
                  <div className="flex gap-1">
                    {["#86EFAC", "#4ADE80", "#22C55E", "#16A34A"].map((color, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Button onClick={() => router.push("/dashboard/plan")} className="bg-[#1E293B] hover:bg-[#0F172A] text-white rounded-lg font-medium">
                Upgrade to Ultra
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  const availableCharts: ChartConfig[] = [
    { id: "historical-balance", name: "Historical Balance", description: "Capital evolution timeline", requiredPlan: "free", icon: ClockIcon, component: HistoricalBalanceChart },
    { id: "historical-expense", name: "Historical Expense", description: "Cumulative expenses over time", requiredPlan: "ultra", icon: ArrowTrendingDownIcon, component: HistoricalExpenseChart },
    { id: "cash-flow", name: "Cash Flow Analyzer", description: "Income vs expenses trends", requiredPlan: "free", icon: ArrowTrendingUpIcon, component: CashFlowChart },
    { id: "fund-allocation", name: "Fund Allocation", description: "Money distribution", requiredPlan: "free", icon: WalletIcon, component: FundAllocationChart },
    { id: "expense-breakdown", name: "Expense Breakdown", description: "Category spending", requiredPlan: "free", icon: TagIcon, component: ExpenseCategoryChart },
    { id: "burn-rate", name: "Burn Rate Monitor", description: "Average spending rate", requiredPlan: "pro", icon: FireIcon, component: BurnRateChart },
    { id: "saving-rate", name: "Saving Rate Tracker", description: "Savings percentage", requiredPlan: "pro", icon: BanknotesIcon, component: SavingRateChart },
    { id: "recurring-variable", name: "Recurring vs Variable", description: "Fixed vs flexible", requiredPlan: "pro", icon: ArrowPathIcon, component: RecurringVsVariableChart },
    { id: "budget-actual", name: "Budget vs Actual", description: "Planned vs real", requiredPlan: "pro", icon: ChartBarIcon, component: BudgetVsActualChart },
    { id: "period-comparison", name: "Period Comparison", description: "MoM, YoY comparison", requiredPlan: "pro", icon: CalendarIcon, component: PeriodComparisonChart },
    { id: "balance-projection", name: "Balance Projection Engine", description: "Future balance forecast", requiredPlan: "ultra", icon: ArrowTrendingUpIcon, component: BalanceProjectionChart },
    { id: "money-flow", name: "Money Flow Map", description: "Capital movement visualization", requiredPlan: "ultra", icon: ArrowPathIcon, component: MoneyFlowMapChart },
    { id: "spending-heatmap", name: "Cash Flow Heatmap", description: "Income & expense activity", requiredPlan: "ultra", icon: FireIcon, component: SpendingHeatmapChart },
    { id: "expense-waterfall", name: "Expense Waterfall", description: "Balance change breakdown", requiredPlan: "ultra", icon: ChartBarIcon, component: ExpenseWaterfallChart },
    { id: "stability-index", name: "Financial Stability Index", description: "Overall financial health", requiredPlan: "ultra", icon: ChartPieIcon, component: FinancialStabilityChart },
  ];

  const SortableChartWrapper = ({ chartId }: { chartId: string }) => {
    const chart = availableCharts.find((c) => c.id === chartId);
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: chartId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    if (!chart) return null;

    // Check if this chart should span 2 columns (like Historical Balance)
    const isWideChart = chartId === "historical-balance" || chartId === "historical-expense";

    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={`relative group ${isWideChart ? 'lg:col-span-2' : ''}`}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-4 left-4 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <Bars3Icon className="w-5 h-5 text-gray-600" />
        </div>

        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveChart(chartId);
          }}
          className="absolute top-4 right-4 z-10 p-2 bg-red-50/90 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
        >
          <XMarkIcon className="w-5 h-5 text-red-600" />
        </button>

        {chart.component()}
      </div>
    );
  };

  const handleRemoveChart = async (chartId: string) => {
    const newVisibleCharts = visibleCharts.filter((id) => id !== chartId);
    setVisibleCharts(newVisibleCharts);

    if (user) {
      try {
        await saveAnalyticsConfig(user.uid, {
          visibleCharts: newVisibleCharts,
          chartOrder: newVisibleCharts,
        });
        showToast("Chart removed successfully", "success");
      } catch (error) {
        console.error("Error saving analytics config:", error);
        showToast("Failed to save configuration", "error");
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = visibleCharts.indexOf(active.id as string);
    const newIndex = visibleCharts.indexOf(over.id as string);

    const newVisibleCharts = arrayMove(visibleCharts, oldIndex, newIndex);
    setVisibleCharts(newVisibleCharts);

    if (user) {
      try {
        await saveAnalyticsConfig(user.uid, {
          visibleCharts: newVisibleCharts,
          chartOrder: newVisibleCharts,
        });
      } catch (error) {
        console.error("Error saving analytics config:", error);
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleChart = async (chartId: string) => {
    const newVisibleCharts = visibleCharts.includes(chartId) 
      ? visibleCharts.filter((id) => id !== chartId) 
      : [...visibleCharts, chartId];
    
    setVisibleCharts(newVisibleCharts);
    
    // Save configuration to Firebase
    if (user) {
      try {
        await saveAnalyticsConfig(user.uid, {
          visibleCharts: newVisibleCharts,
          chartOrder: newVisibleCharts,
        });
      } catch (error) {
        console.error("Error saving analytics config:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading analytics...</p>
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
            <h1 className="text-2xl font-semibold text-[#0F172A] mb-1">Global Analytics</h1>
            <p className="text-sm text-gray-500">Comprehensive financial insights</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Shared Accounts Toggle */}
            {sharedAccounts.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm">
                <Checkbox
                  checked={includeSharedAccounts}
                  onChange={setIncludeSharedAccounts}
                  className="group relative flex items-center"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white group-data-[checked]:bg-[#22C55E] group-data-[checked]:border-[#22C55E] transition-colors">
                    <CheckIcon className="h-3 w-3 text-white opacity-0 group-data-[checked]:opacity-100" />
                  </span>
                </Checkbox>
                <label className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Include Shared Accounts
                </label>
              </div>
            )}
            <Button
              onClick={() => setShowChartSelector(true)}
              className="bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-lg font-medium"
              startContent={<PlusIcon className="w-4 h-4" />}
            >
              Manage Charts
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-8 py-8 bg-gray-50 min-h-screen">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleCharts} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {visibleCharts.map((chartId) => (
                <SortableChartWrapper key={chartId} chartId={chartId} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </main>

      {/* Chart Selector Modal */}
      <Transition appear show={showChartSelector} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowChartSelector(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                  <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-[#0F172A]">
                      Manage Charts
                    </Dialog.Title>
                    <button
                      onClick={() => setShowChartSelector(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <XMarkIcon className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="p-6 max-h-[600px] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {availableCharts.map((chart) => {
                        const isVisible = visibleCharts.includes(chart.id);
                        const canAccess = canAccessChart(chart.requiredPlan);
                        const Icon = chart.icon;

                        return (
                          <div
                            key={chart.id}
                            onClick={() => canAccess && toggleChart(chart.id)}
                            className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
                              isVisible
                                ? "border-[#22C55E] bg-[#22C55E]/5"
                                : "border-gray-200 hover:border-gray-300"
                            } ${!canAccess ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${isVisible ? "bg-[#22C55E]" : "bg-gray-100"}`}>
                                <Icon className={`w-5 h-5 ${isVisible ? "text-white" : "text-gray-600"}`} />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-[#0F172A] mb-0.5">
                                  {chart.name}
                                  {!canAccess && (
                                    <span className="ml-2 text-xs text-gray-500 capitalize">
                                      🔒 {chart.requiredPlan}
                                    </span>
                                  )}
                                </h4>
                                <p className="text-xs text-gray-500">{chart.description}</p>
                              </div>
                              {isVisible && canAccess && (
                                <CheckIcon className="w-5 h-5 text-[#22C55E]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
                    <Button
                      onClick={() => setShowChartSelector(false)}
                      className="bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-lg font-medium"
                    >
                      Done
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
