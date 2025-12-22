"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getUserDocument,
  getAccounts,
  getTransactions,
  getUserCategories,
} from "@/lib/firestore";
import { User, Account, Category } from "@/lib/types";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/hooks/useToast";

export default function AllTransactionsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    searchText: "",
    type: "all", // all, income, expense, transfer
    accountId: "all",
    category: "all",
    minAmount: "",
    maxAmount: "",
    startDate: "",
    endDate: "",
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

          // Load all transactions
          const transactions = await getTransactions(firebaseUser.uid);
          setAllTransactions(transactions);
          setFilteredTransactions(transactions);
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

  // Apply filters whenever they change
  useEffect(() => {
    let filtered = [...allTransactions];

    // Search text filter
    if (filters.searchText.trim()) {
      const search = filters.searchText.toLowerCase();
      filtered = filtered.filter((t) =>
        t.description.toLowerCase().includes(search)
      );
    }

    // Type filter
    if (filters.type !== "all") {
      filtered = filtered.filter((t) => t.type === filters.type);
    }

    // Account filter
    if (filters.accountId !== "all") {
      filtered = filtered.filter(
        (t) => t.accountId === filters.accountId || t.toAccountId === filters.accountId
      );
    }

    // Category filter
    if (filters.category !== "all") {
      filtered = filtered.filter((t) => t.category === filters.category);
    }

    // Amount filters
    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount);
      filtered = filtered.filter((t) => t.amount >= min);
    }
    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount);
      filtered = filtered.filter((t) => t.amount <= max);
    }

    // Date filters
    if (filters.startDate) {
      const startTimestamp = new Date(filters.startDate).getTime() / 1000;
      filtered = filtered.filter((t) => t.date.seconds >= startTimestamp);
    }
    if (filters.endDate) {
      const endTimestamp = new Date(filters.endDate).getTime() / 1000;
      filtered = filtered.filter((t) => t.date.seconds <= endTimestamp);
    }

    setFilteredTransactions(filtered);
  }, [filters, allTransactions]);

  const clearFilters = () => {
    setFilters({
      searchText: "",
      type: "all",
      accountId: "all",
      category: "all",
      minAmount: "",
      maxAmount: "",
      startDate: "",
      endDate: "",
    });
  };

  const activeFiltersCount = 
    (filters.type !== "all" ? 1 : 0) +
    (filters.accountId !== "all" ? 1 : 0) +
    (filters.category !== "all" ? 1 : 0) +
    (filters.minAmount ? 1 : 0) +
    (filters.maxAmount ? 1 : 0) +
    (filters.startDate ? 1 : 0) +
    (filters.endDate ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-[#0F172A] mb-2">All Transactions</h1>
          <p className="text-gray-600">
            View and filter all your financial transactions
          </p>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filters.searchText}
                onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                placeholder="Search transactions..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="relative px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
            >
              <FunnelIcon className="w-5 h-5" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Type Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              {/* Account Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Account
                </label>
                <select
                  value={filters.accountId}
                  onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                >
                  <option value="all">All Accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Min Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Min Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    €
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={filters.minAmount}
                    onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Max Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Max Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    €
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <p className="text-sm text-gray-500 font-semibold mb-1">Total Transactions</p>
            <p className="text-3xl font-black text-[#0F172A]">{filteredTransactions.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 shadow-lg border border-green-100">
            <p className="text-sm text-green-700 font-semibold mb-1">Income</p>
            <p className="text-3xl font-black text-green-600">
              {filteredTransactions.filter((t) => t.type === "income").length}
            </p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-5 shadow-lg border border-red-100">
            <p className="text-sm text-red-700 font-semibold mb-1">Expenses</p>
            <p className="text-3xl font-black text-red-600">
              {filteredTransactions.filter((t) => t.type === "expense").length}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 shadow-lg border border-blue-100">
            <p className="text-sm text-blue-700 font-semibold mb-1">Transfers</p>
            <p className="text-3xl font-black text-blue-600">
              {filteredTransactions.filter((t) => t.type === "transfer").length}
            </p>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-[#0F172A]">
              {filteredTransactions.length} Transaction{filteredTransactions.length !== 1 ? "s" : ""}
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-16">
                <MagnifyingGlassIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-semibold mb-2">No transactions found</p>
                <p className="text-gray-400 text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              filteredTransactions.map((transaction) => {
                const account = accounts.find((a) => a.id === transaction.accountId);
                const toAccount = accounts.find((a) => a.id === transaction.toAccountId);
                const category = categories.find((c) => c.name === transaction.category);

                return (
                  <div
                    key={transaction.id}
                    className="flex items-center gap-4 p-6 hover:bg-gray-50 transition-colors"
                  >
                    {/* Icon */}
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        transaction.type === "income"
                          ? "bg-gradient-to-br from-green-100 to-emerald-100"
                          : transaction.type === "expense"
                          ? "bg-gradient-to-br from-red-100 to-rose-100"
                          : "bg-gradient-to-br from-blue-100 to-cyan-100"
                      }`}
                    >
                      {transaction.type === "income" ? (
                        <ArrowUpIcon className="w-7 h-7 text-green-600" />
                      ) : transaction.type === "expense" ? (
                        <ArrowDownIcon className="w-7 h-7 text-red-600" />
                      ) : (
                        <ArrowsRightLeftIcon className="w-7 h-7 text-blue-600" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0F172A] text-lg mb-1 truncate">
                        {transaction.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <span className="font-medium">
                          {transaction.type === "transfer"
                            ? `${account?.name} → ${toAccount?.name}`
                            : account?.name}
                        </span>
                        {transaction.type === "expense" && category && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span
                              className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                              style={{
                                backgroundColor: `${category.color || "#6B7280"}20`,
                                color: category.color || "#6B7280",
                              }}
                            >
                              {category.name}
                            </span>
                          </>
                        )}
                        <span className="text-gray-300">•</span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {transaction.date.toDate().toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {transaction.isRecurring && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold">
                              Recurring
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-2xl font-black ${
                          transaction.type === "income"
                            ? "text-green-600"
                            : transaction.type === "expense"
                            ? "text-red-600"
                            : "text-blue-600"
                        }`}
                      >
                        {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}
                        €{transaction.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

