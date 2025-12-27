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
  deleteTransaction,
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
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function AllTransactionsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { formatAmount, currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [displayedTransactions, setDisplayedTransactions] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
    setPage(1); // Reset to first page when filters change
  }, [filters, allTransactions]);

  // Update displayed transactions when page or filtered transactions change
  useEffect(() => {
    const startIndex = 0;
    const endIndex = page * ITEMS_PER_PAGE;
    setDisplayedTransactions(filteredTransactions.slice(startIndex, endIndex));
  }, [page, filteredTransactions]);

  const loadMore = () => {
    setPage((prev) => prev + 1);
  };

  const hasMore = displayedTransactions.length < filteredTransactions.length;

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

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;

    if (!confirm("Are you sure you want to delete this transaction? This will reverse its effects on your account balances.")) {
      return;
    }

    try {
      await deleteTransaction(user.uid, transactionId);
      
      // Reload transactions and accounts
      const transactions = await getTransactions(user.uid);
      setAllTransactions(transactions);
      setFilteredTransactions(transactions);
      
      const userAccounts = await getAccounts(user.uid);
      setAccounts(userAccounts);
      
      // Close detail modal if it's open
      if (showDetailModal) {
        setShowDetailModal(false);
        setSelectedTransaction(null);
      }
      
      showToast("✅ Transaction deleted successfully!", "success");
    } catch (error: any) {
      console.error("Error deleting transaction:", error);
      showToast(`❌ ${error.message || "Error deleting transaction"}`, "error");
    }
  };

  const openDetailModal = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedTransaction(null);
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h1 className="text-2xl font-semibold text-[#0F172A] mb-1">All Transactions</h1>
            <p className="text-sm text-gray-500">
              View and filter all your financial transactions
            </p>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filters.searchText}
                onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                placeholder="Search transactions..."
                className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all"
              />
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="relative px-6 py-2.5 bg-[#0F172A] text-white rounded-lg font-medium hover:bg-[#1E293B] transition-all flex items-center gap-2"
            >
              <FunnelIcon className="w-5 h-5" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#22C55E] text-white text-xs font-bold rounded-full flex items-center justify-center">
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
                  <option value="partition_creation">Partition Creation</option>
                  <option value="partition_transfer_to">To Partition</option>
                  <option value="partition_transfer_from">From Partition</option>
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
                    {currency.symbol}
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
                    {currency.symbol}
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
              {filteredTransactions.filter((t) => t.type === "transfer" || t.type?.startsWith("partition")).length}
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

          <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100">
            {displayedTransactions.length === 0 ? (
              <div className="text-center py-16">
                <MagnifyingGlassIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-semibold mb-2">No transactions found</p>
                <p className="text-gray-400 text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              displayedTransactions.map((transaction) => {
                const account = accounts.find((a) => a.id === transaction.accountId);
                const toAccount = accounts.find((a) => a.id === transaction.toAccountId);
                const category = categories.find((c) => c.name === transaction.category);

                return (
                  <div
                    key={transaction.id}
                    onClick={() => openDetailModal(transaction)}
                    className="group flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        transaction.type === "income"
                          ? "bg-[#22C55E]/10"
                          : transaction.type === "expense"
                          ? "bg-red-500/10"
                          : "bg-blue-500/10"
                      }`}
                    >
                      {transaction.type === "income" ? (
                        <ArrowUpIcon className="w-6 h-6 text-[#22C55E]" />
                      ) : transaction.type === "expense" ? (
                        <ArrowDownIcon className="w-6 h-6 text-red-600" />
                      ) : (
                        <ArrowsRightLeftIcon className="w-6 h-6 text-blue-600" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#0F172A] text-base mb-1.5 truncate">
                        {transaction.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {transaction.type === "transfer" ? (
                          <>
                            <span 
                              className="font-medium text-white px-2.5 py-1 rounded text-xs"
                              style={{ backgroundColor: account?.color || "#6B7280" }}
                            >
                              {account?.name}
                            </span>
                            <ArrowsRightLeftIcon className="w-3 h-3 text-gray-400" />
                            <span 
                              className="font-medium text-white px-2.5 py-1 rounded text-xs"
                              style={{ backgroundColor: toAccount?.color || "#6B7280" }}
                            >
                              {toAccount?.name}
                            </span>
                          </>
                        ) : (
                          <span 
                            className="font-medium text-white px-2.5 py-1 rounded text-xs"
                            style={{ backgroundColor: account?.color || "#6B7280" }}
                          >
                            {account?.name}
                          </span>
                        )}
                        {transaction.type === "income" && transaction.category && (
                          <span className="px-2.5 py-1 rounded text-xs font-medium bg-[#22C55E] text-white">
                            {transaction.category.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </span>
                        )}
                        {transaction.type === "expense" && category && (
                          <span
                            className="px-2.5 py-1 rounded text-xs font-medium text-white"
                            style={{
                              backgroundColor: `${category.color || "#6B7280"}`,
                            }}
                          >
                            {category.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-gray-500 text-xs">
                          <CalendarIcon className="w-4 h-4" />
                          {transaction.date.toDate().toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Amount and Actions */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p
                          className={`text-lg font-semibold ${
                            transaction.type === "income"
                              ? "text-[#22C55E]"
                              : transaction.type === "expense"
                              ? "text-red-600"
                              : "text-blue-600"
                          }`}
                        >
                          {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}
                          {formatAmount(transaction.amount)}
                        </p>
                      </div>
                      
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTransaction(transaction.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                        title="Delete transaction"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Load More Button */}
          {displayedTransactions.length < filteredTransactions.length && (
            <div className="p-6 border-t border-gray-100 text-center">
              <button
                onClick={loadMore}
                className="px-6 py-3 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl font-semibold transition-colors"
              >
                Load More ({filteredTransactions.length - displayedTransactions.length} remaining)
              </button>
            </div>
          )}
        </div>

        {/* Transaction Detail Modal */}
        {showDetailModal && selectedTransaction && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div
                className={`p-6 border-b border-gray-200 ${
                  selectedTransaction.type === "income"
                    ? "bg-[#22C55E]/5"
                    : selectedTransaction.type === "expense"
                    ? "bg-red-500/5"
                    : "bg-blue-500/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2
                    className={`text-2xl font-bold ${
                      selectedTransaction.type === "income"
                        ? "text-[#22C55E]"
                        : selectedTransaction.type === "expense"
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}
                  >
                    Transaction Details
                  </h2>
                  <button
                    onClick={closeDetailModal}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-6">
                {/* Amount */}
                <div className="text-center p-6 bg-gray-50 rounded-2xl">
                  <p className="text-sm text-gray-500 font-semibold mb-2 uppercase tracking-wider">Amount</p>
                  <p
                    className={`text-5xl font-black ${
                      selectedTransaction.type === "income"
                        ? "text-[#22C55E]"
                        : selectedTransaction.type === "expense"
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}
                  >
                    {selectedTransaction.type === "expense" ? "-" : selectedTransaction.type === "income" ? "+" : ""}
                    {currency.symbol}{selectedTransaction.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Description */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-lg font-semibold text-[#0F172A]">{selectedTransaction.description}</p>
                </div>

                {/* Type */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Type</p>
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        selectedTransaction.type === "income"
                          ? "bg-[#22C55E]/10"
                          : selectedTransaction.type === "expense"
                          ? "bg-red-500/10"
                          : "bg-blue-500/10"
                      }`}
                    >
                      {selectedTransaction.type === "income" ? (
                        <ArrowUpIcon className="w-5 h-5 text-[#22C55E]" />
                      ) : selectedTransaction.type === "expense" ? (
                        <ArrowDownIcon className="w-5 h-5 text-red-600" />
                      ) : (
                        <ArrowsRightLeftIcon className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <span className="font-semibold text-[#0F172A] capitalize">{selectedTransaction.type}</span>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date</p>
                  <p className="font-semibold text-[#0F172A] flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-gray-400" />
                    {selectedTransaction.date.toDate().toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {/* Account(s) */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {selectedTransaction.type === "transfer" ? "From / To Accounts" : "Account"}
                  </p>
                  {selectedTransaction.type === "transfer" ? (
                    <div className="flex items-center gap-3">
                      <span
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                        style={{
                          backgroundColor: accounts.find((a) => a.id === selectedTransaction.accountId)?.color || "#6B7280",
                        }}
                      >
                        {accounts.find((a) => a.id === selectedTransaction.accountId)?.name}
                      </span>
                      <ArrowsRightLeftIcon className="w-5 h-5 text-gray-400" />
                      <span
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                        style={{
                          backgroundColor: accounts.find((a) => a.id === selectedTransaction.toAccountId)?.color || "#6B7280",
                        }}
                      >
                        {accounts.find((a) => a.id === selectedTransaction.toAccountId)?.name}
                      </span>
                    </div>
                  ) : (
                    <span
                      className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{
                        backgroundColor: accounts.find((a) => a.id === selectedTransaction.accountId)?.color || "#6B7280",
                      }}
                    >
                      {accounts.find((a) => a.id === selectedTransaction.accountId)?.name}
                    </span>
                  )}
                </div>

                {/* Category (if expense or income) */}
                {selectedTransaction.category && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</p>
                    {selectedTransaction.type === "income" ? (
                      <span className="inline-block px-4 py-2 rounded-lg text-sm font-semibold bg-[#22C55E] text-white">
                        {selectedTransaction.category.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                    ) : (
                      <span
                        className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white"
                        style={{
                          backgroundColor: categories.find((c) => c.name === selectedTransaction.category)?.color || "#6B7280",
                        }}
                      >
                        {selectedTransaction.category}
                      </span>
                    )}
                  </div>
                )}

                {/* Recurring Status */}
                {selectedTransaction.isRecurring && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recurring</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-semibold">
                        {selectedTransaction.recurringInterval?.toUpperCase()}
                      </span>
                      {selectedTransaction.endDate && (
                        <span className="text-gray-600">
                          Until {selectedTransaction.endDate.toDate().toLocaleDateString("en-US")}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 px-8 py-6 flex justify-between items-center bg-gray-50">
                <button
                  onClick={() => {
                    closeDetailModal();
                    handleDeleteTransaction(selectedTransaction.id);
                  }}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
                >
                  <TrashIcon className="w-5 h-5" />
                  Delete Transaction
                </button>
                <button
                  onClick={closeDetailModal}
                  className="px-6 py-3 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

