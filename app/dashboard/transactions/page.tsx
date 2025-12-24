"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getUserDocument,
  getAccounts,
  createTransaction,
  getTransactions,
  getUserCategories,
  deleteTransaction,
} from "@/lib/firestore";
import { User, Account, Category, Transaction } from "@/lib/types";
import { Button } from "@heroui/react";
import {
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
  XMarkIcon,
  CalendarIcon,
  BanknotesIcon,
  TagIcon,
  ClockIcon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/hooks/useToast";

const INCOME_CATEGORIES = [
  { value: "salary", label: "Salary", icon: "💼", color: "#10B981" },
  { value: "investment", label: "Investment Return", icon: "📈", color: "#3B82F6" },
  { value: "generic_return", label: "Generic Return", icon: "💰", color: "#8B5CF6" },
  { value: "other", label: "Other Income", icon: "✨", color: "#F59E0B" },
];

const RECURRING_INTERVALS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function TransactionsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense" | "transfer">("income");

  const [formData, setFormData] = useState({
    amount: 0,
    accountId: "",
    toAccountId: "",
    category: "",
    incomeCategory: "salary",
    description: "",
    date: new Date().toISOString().split("T")[0],
    isRecurring: false,
    recurringInterval: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth");
        return;
      }

      try {
        const userDoc = await getUserDocument(firebaseUser.uid);
        if (userDoc) {
          setUser(userDoc);
          
          // Load accounts
          const userAccounts = await getAccounts(firebaseUser.uid);
          setAccounts(userAccounts);
          
          // Load categories
          const userCategories = await getUserCategories(firebaseUser.uid);
          setCategories(userCategories);
          
          // Load recent transactions
          const transactions = await getTransactions(firebaseUser.uid);
          setRecentTransactions(transactions.slice(0, 5));
        }
      } catch (error) {
        console.error("Error loading data:", error);
        showToast("❌ Error loading data", "error");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const resetForm = () => {
    setFormData({
      amount: 0,
      accountId: "",
      toAccountId: "",
      category: "",
      incomeCategory: "salary",
      description: "",
      date: new Date().toISOString().split("T")[0],
      isRecurring: false,
      recurringInterval: "monthly",
    });
  };

  const handleCreateTransaction = async () => {
    if (!user) return;

    // Validation
    if (formData.amount <= 0) {
      showToast("❌ Amount must be greater than 0", "error");
      return;
    }
    if (!formData.accountId) {
      showToast("❌ Please select an account", "error");
      return;
    }
    if (transactionType === "transfer" && !formData.toAccountId) {
      showToast("❌ Please select a destination account", "error");
      return;
    }
    if (transactionType === "expense" && !formData.category) {
      showToast("❌ Please select a category", "error");
      return;
    }
    if (!formData.description.trim()) {
      showToast("❌ Please add a description", "error");
      return;
    }

    try {
      await createTransaction(user.uid, {
        type: transactionType,
        amount: formData.amount,
        accountId: formData.accountId,
        toAccountId: transactionType === "transfer" ? formData.toAccountId : undefined,
        category: transactionType === "expense" ? formData.category : undefined,
        incomeCategory: transactionType === "income" ? formData.incomeCategory as any : undefined,
        description: formData.description,
        date: new Date(formData.date),
        isRecurring: formData.isRecurring,
        recurringInterval: formData.isRecurring ? formData.recurringInterval : undefined,
      });

      // Reload data
      const userAccounts = await getAccounts(user.uid);
      setAccounts(userAccounts);
      const transactions = await getTransactions(user.uid);
      setRecentTransactions(transactions.slice(0, 5));

      setShowForm(false);
      resetForm();
      showToast("✅ Transaction created successfully!", "success");
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      showToast(`❌ ${error.message || "Error creating transaction"}`, "error");
    }
  };

  const openForm = (type: "income" | "expense" | "transfer") => {
    setTransactionType(type);
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;

    if (!confirm("Are you sure you want to delete this transaction? This will reverse its effects on your account balances.")) {
      return;
    }

    try {
      await deleteTransaction(user.uid, transactionId);
      
      // Reload data
      const userAccounts = await getAccounts(user.uid);
      setAccounts(userAccounts);
      const transactions = await getTransactions(user.uid);
      setRecentTransactions(transactions.slice(0, 5));
      
      showToast("✅ Transaction deleted successfully!", "success");
    } catch (error: any) {
      console.error("Error deleting transaction:", error);
      showToast(`❌ ${error.message || "Error deleting transaction"}`, "error");
    }
  };

  const activeAccounts = accounts.filter((a) => !a.archived);
  const activeCategories = categories.filter((c) => !c.archived);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Premium Design */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 blur-3xl -z-10"></div>
          <h1 className="text-5xl font-black bg-gradient-to-r from-[#0F172A] via-gray-800 to-[#0F172A] bg-clip-text text-transparent mb-3">
            Income / Expenses
          </h1>
          <p className="text-gray-600 text-lg">Manage your income, expenses, and transfers with ease</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Income Card */}
          <button
            onClick={() => openForm("income")}
            className="group relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-8 text-left hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ArrowUpIcon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Add Income</h3>
              <p className="text-white/80 text-sm">Record salary, investments, or returns</p>
            </div>
          </button>

          {/* Expense Card */}
          <button
            onClick={() => openForm("expense")}
            className="group relative bg-gradient-to-br from-red-500 to-rose-600 rounded-3xl p-8 text-left hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ArrowDownIcon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Add Expense</h3>
              <p className="text-white/80 text-sm">Track your spending by category</p>
            </div>
          </button>

          {/* Transfer Card */}
          <button
            onClick={() => openForm("transfer")}
            className="group relative bg-gradient-to-br from-blue-500 to-cyan-600 rounded-3xl p-8 text-left hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ArrowsRightLeftIcon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Transfer Funds</h3>
              <p className="text-white/80 text-sm">Move money between accounts</p>
            </div>
          </button>
        </div>

        {/* Transaction Form / Recent Transactions */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          {!showForm ? (
            <>
              {/* Recent Transactions Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[#0F172A]">Recent Transactions</h2>
                  <button
                    onClick={() => router.push("/dashboard/transactions/all")}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    View All →
                  </button>
                </div>
              </div>
              
              {/* Recent Transactions List */}
              <div className="p-6">
                {recentTransactions.length === 0 ? (
                  <div className="text-center py-12">
                    <BanknotesIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-semibold mb-2">No transactions yet</p>
                    <p className="text-gray-400 text-sm">Start by adding your first income, expense, or transfer</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentTransactions.map((transaction) => {
                      const account = accounts.find((a) => a.id === transaction.accountId);
                      const toAccount = accounts.find((a) => a.id === transaction.toAccountId);
                      const category = categories.find((c) => c.name === transaction.category);
                      
                      return (
                        <div
                          key={transaction.id}
                          className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-200"
                        >
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform bg-gradient-to-br ${
                              transaction.type === "income"
                                ? "from-green-500 to-emerald-600"
                                : transaction.type === "expense"
                                ? "from-red-500 to-rose-600"
                                : transaction.type.startsWith("partition")
                                ? "from-purple-500 to-pink-600"
                                : "from-blue-500 to-cyan-600"
                            }`}
                          >
                            {transaction.type === "income" ? (
                              <ArrowUpIcon className="w-7 h-7 text-white" />
                            ) : transaction.type === "expense" ? (
                              <ArrowDownIcon className="w-7 h-7 text-white" />
                            ) : transaction.type.startsWith("partition") ? (
                              <span className="text-2xl">📊</span>
                            ) : (
                              <ArrowsRightLeftIcon className="w-7 h-7 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#0F172A] truncate text-base mb-1">{transaction.description}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                                {transaction.type === "transfer"
                                  ? `${account?.name} → ${toAccount?.name}`
                                  : account?.name}
                              </span>
                              {transaction.type === "expense" && category && (
                                <span
                                  className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                                  style={{ backgroundColor: category.color || "#6B7280" }}
                                >
                                  {category.name}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {transaction.date.toDate().toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric"
                                })}
                              </span>
                              {transaction.type.startsWith("partition") && (
                                <span className="text-xs text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full font-bold">
                                  📊 Partition
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p
                                className={`font-black text-xl ${
                                  transaction.type === "income"
                                    ? "text-green-600"
                                    : transaction.type === "expense"
                                    ? "text-red-600"
                                    : transaction.type.startsWith("partition")
                                    ? "text-purple-600"
                                    : "text-blue-600"
                                }`}
                              >
                                {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}€
                                {transaction.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTransaction(transaction.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-2.5 text-red-600 hover:bg-red-50 rounded-xl"
                              title="Delete transaction"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Transaction Form Header */}
              <div
                className={`p-6 ${
                  transactionType === "income"
                    ? "bg-gradient-to-r from-green-500 to-emerald-600"
                    : transactionType === "expense"
                    ? "bg-gradient-to-r from-red-500 to-rose-600"
                    : "bg-gradient-to-r from-blue-500 to-cyan-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">
                    {transactionType === "income"
                      ? "Add Income"
                      : transactionType === "expense"
                      ? "Add Expense"
                      : "Transfer Funds"}
                  </h2>
                  <button
                    onClick={closeForm}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>

              {/* Transaction Form */}
              <div className="p-8 space-y-6 max-h-[600px] overflow-y-auto">
                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">
                      €
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount || ""}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] text-2xl font-bold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    />
                  </div>
                </div>

                {/* Account Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {transactionType === "transfer" ? "From Account *" : "Account *"}
                  </label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  >
                    <option value="">Select account...</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} (€{account.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Account (for transfers) */}
                {transactionType === "transfer" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      To Account *
                    </label>
                    <select
                      value={formData.toAccountId}
                      onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    >
                      <option value="">Select account...</option>
                      {activeAccounts
                        .filter((a) => a.id !== formData.accountId)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} (€{account.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Income Category */}
                {transactionType === "income" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Income Category *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {INCOME_CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          onClick={() => setFormData({ ...formData, incomeCategory: cat.value as any })}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${
                            formData.incomeCategory === cat.value
                              ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                              : "border-gray-200 hover:border-green-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{cat.icon}</span>
                            <span className="font-semibold text-gray-700">{cat.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expense Category */}
                {transactionType === "expense" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category *
                    </label>
                    <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                      {activeCategories.map((category) => (
                        <button
                          key={category.name}
                          onClick={() => setFormData({ ...formData, category: category.name })}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${
                            formData.category === category.name
                              ? "border-red-500 bg-red-50 ring-2 ring-red-200"
                              : "border-gray-200 hover:border-red-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm"
                              style={{ backgroundColor: category.color || "#6B7280" }}
                            ></div>
                            <span className="font-semibold text-gray-700 truncate">
                              {category.name}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {activeCategories.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        No categories available. Create one first!
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Add details about this transaction..."
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all resize-none"
                    rows={3}
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date *
                  </label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    />
                  </div>
                </div>

                {/* Recurring */}
                <div className="border-t border-gray-200 pt-6">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.isRecurring}
                        onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                        className="sr-only"
                      />
                      <div
                        className={`w-12 h-6 rounded-full transition-colors ${
                          formData.isRecurring ? "bg-green-500" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                            formData.isRecurring ? "translate-x-6" : "translate-x-0.5"
                          } mt-0.5`}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700">Recurring Transaction</p>
                      <p className="text-sm text-gray-500">Automatically repeat this transaction</p>
                    </div>
                  </label>

                  {formData.isRecurring && (
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Repeat Interval
                      </label>
                      <select
                        value={formData.recurringInterval}
                        onChange={(e) => setFormData({ ...formData, recurringInterval: e.target.value as any })}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      >
                        {RECURRING_INTERVALS.map((interval) => (
                          <option key={interval.value} value={interval.value}>
                            {interval.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeForm}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTransaction}
                    className={`flex-1 px-6 py-3 text-white rounded-xl font-semibold hover:shadow-lg transition-all ${
                      transactionType === "income"
                        ? "bg-gradient-to-r from-green-500 to-emerald-600"
                        : transactionType === "expense"
                        ? "bg-gradient-to-r from-red-500 to-rose-600"
                        : "bg-gradient-to-r from-blue-500 to-cyan-600"
                    }`}
                  >
                    {transactionType === "transfer" ? "Transfer" : "Create Transaction"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
