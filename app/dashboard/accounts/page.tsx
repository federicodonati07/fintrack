"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getUserDocument,
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getPlanLimits,
  createSubAccount,
  getSubAccounts,
  deleteSubAccount,
  transferSubAccountFunds,
  createInternalSubAccountTransaction,
} from "@/lib/firestore";
import { User, Account } from "@/lib/types";
import {
  BanknotesIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  WalletIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  CreditCardIcon,
  CurrencyEuroIcon,
  CheckIcon,
  SparklesIcon,
  PencilIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking Account", icon: BuildingLibraryIcon, color: "#3B82F6" },
  { value: "savings", label: "Savings", icon: BanknotesIcon, color: "#22C55E" },
  { value: "investment", label: "Investment", icon: ChartBarIcon, color: "#8B5CF6" },
  { value: "wallet", label: "Wallet", icon: WalletIcon, color: "#F59E0B" },
  { value: "credit_card", label: "Credit Card", icon: CreditCardIcon, color: "#EF4444" },
  { value: "other", label: "Other", icon: CurrencyEuroIcon, color: "#6B7280" },
];

const PRESET_COLORS = [
  "#0F172A", "#1E293B", "#475569", "#64748B", "#94A3B8", "#CBD5E1",
  "#22C55E", "#16A34A", "#15803D", "#166534", "#14532D", "#052E16",
];

const INTEREST_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const ASSET_TYPES = [
  { value: "etf", label: "ETF", icon: "📊" },
  { value: "bond", label: "Bond", icon: "📜" },
  { value: "stock", label: "Stock", icon: "📈" },
];

export default function AccountsPage() {
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSubAccountsModal, setShowSubAccountsModal] = useState(false);
  const [showCreateSubAccountModal, setShowCreateSubAccountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedSubAccount, setSelectedSubAccount] = useState<any | null>(null);
  const [subAccounts, setSubAccounts] = useState<any[]>([]);
  const [maxAccounts, setMaxAccounts] = useState(5);
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferDirection, setTransferDirection] = useState<"toSubAccount" | "toAccount">("toSubAccount");
  const [accountTotals, setAccountTotals] = useState<{ [key: string]: number }>({});

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "checking" as "checking" | "savings" | "investment" | "wallet" | "credit_card" | "other",
    initialBalance: 0,
    currency: "EUR",
    iban: "",
    bic: "",
    color: PRESET_COLORS[0],
    // Partition options
    enablePartitioning: false,
  });

  // Sub-account form state
  const [subAccountFormData, setSubAccountFormData] = useState({
    name: "",
    type: "savings" as "savings" | "investment",
    amount: 0, // Changed from percentage to amount
    // Savings specific
    interestRate: 0,
    interestFrequency: "monthly" as "daily" | "monthly" | "yearly",
    startDate: new Date().toISOString().split("T")[0],
    // Investment specific (holdings)
    holdings: [] as Array<{
      assetType: "etf" | "bond" | "stock";
      ticker: string;
      name: string;
      percentage: number;
    }>,
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
          
          // Load plan limits
          const limits = await getPlanLimits(userDoc.plan as any);
          setMaxAccounts(limits.accounts);
          
          // Load accounts
          const userAccounts = await getAccounts(firebaseUser.uid);
          setAccounts(userAccounts);
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

  // Calculate totals including partitions
  useEffect(() => {
    const calculateTotals = async () => {
      if (!user) return;

      const totals: { [key: string]: number } = {};
      for (const account of accounts) {
        if (account.hasSubAccounts) {
          const subs = await getSubAccounts(user.uid, account.id);
          const partitionsTotal = subs.reduce((sum, sub) => sum + (sub.balance || 0), 0);
          totals[account.id] = account.currentBalance + partitionsTotal;
        } else {
          totals[account.id] = account.currentBalance;
        }
      }
      setAccountTotals(totals);
    };

    calculateTotals();
  }, [accounts, user]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "checking" as "checking" | "savings" | "investment" | "wallet" | "credit_card" | "other",
      initialBalance: 0,
      currency: "EUR",
      iban: "",
      bic: "",
      color: PRESET_COLORS[0],
      enablePartitioning: false,
    });
  };

  const resetSubAccountForm = () => {
    setSubAccountFormData({
      name: "",
      type: "savings",
      amount: 0,
      interestRate: 0,
      interestFrequency: "monthly",
      startDate: new Date().toISOString().split("T")[0],
      holdings: [],
    });
  };

  const handleCreateAccount = async () => {
    if (!user || !formData.name.trim()) {
      showToast("❌ Please fill in all required fields", "error");
      return;
    }

    if (accounts.filter((a) => !a.archived).length >= maxAccounts) {
      showToast(`❌ Account limit reached (${maxAccounts})`, "error");
      return;
    }

    try {
      await createAccount(user.uid, formData);
      const updatedAccounts = await getAccounts(user.uid);
      setAccounts(updatedAccounts);
      setShowCreateModal(false);
      resetForm();
      showToast("✅ Account created successfully!", "success");
    } catch (error) {
      console.error("Error creating account:", error);
      showToast("❌ Error creating account", "error");
    }
  };

  const handleUpdateAccount = async () => {
    if (!user || !selectedAccount) return;

    try {
      await updateAccount(user.uid, selectedAccount.id, {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        iban: formData.iban,
        bic: formData.bic,
        color: formData.color,
      });
      const updatedAccounts = await getAccounts(user.uid);
      setAccounts(updatedAccounts);
      setShowEditModal(false);
      setSelectedAccount(null);
      resetForm();
      showToast("✅ Account updated successfully!", "success");
    } catch (error) {
      console.error("Error updating account:", error);
      showToast("❌ Error updating account", "error");
    }
  };

  const openSubAccountsModal = async (account: Account) => {
    if (!user) return;
    setSelectedAccount(account);
    try {
      const subs = await getSubAccounts(user.uid, account.id);
      setSubAccounts(subs);
      setShowSubAccountsModal(true);
    } catch (error) {
      console.error("Error loading sub-accounts:", error);
      showToast("❌ Error loading partitions", "error");
    }
  };

  const openEditModal = (account: Account) => {
    setSelectedAccount(account);
    setFormData({
      name: account.name,
      description: account.description || "",
      type: account.type,
      initialBalance: account.currentBalance,
      currency: account.currency,
      iban: account.iban || "",
      bic: account.bic || "",
      color: account.color || PRESET_COLORS[0],
      enablePartitioning: account.hasSubAccounts || false,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (account: Account) => {
    setSelectedAccount(account);
    setShowDeleteModal(true);
  };

  const handleCreateSubAccount = async () => {
    if (!user || !selectedAccount) return;

    if (!subAccountFormData.name.trim()) {
      showToast("❌ Please enter a name for the partition", "error");
      return;
    }

    if (subAccountFormData.amount <= 0) {
      showToast("❌ Amount must be greater than 0", "error");
      return;
    }

    // Validate amount doesn't exceed account balance
    if (subAccountFormData.amount > selectedAccount.currentBalance) {
      showToast(`❌ Amount cannot exceed account balance (€${selectedAccount.currentBalance.toFixed(2)})`, "error");
      return;
    }

    try {
      await createSubAccount(user.uid, selectedAccount.id, {
        name: subAccountFormData.name,
        type: subAccountFormData.type,
        amount: subAccountFormData.amount,
        interestRate: subAccountFormData.type === "savings" ? subAccountFormData.interestRate : undefined,
        interestFrequency: subAccountFormData.type === "savings" ? subAccountFormData.interestFrequency : undefined,
        startDate: subAccountFormData.type === "savings" ? new Date(subAccountFormData.startDate) : undefined,
        holdings: subAccountFormData.type === "investment" ? subAccountFormData.holdings : undefined,
      });

      // Reload accounts and sub-accounts
      const userAccounts = await getAccounts(user.uid);
      setAccounts(userAccounts);
      const subs = await getSubAccounts(user.uid, selectedAccount.id);
      setSubAccounts(subs);
      
      // Update selected account
      const updatedAccount = userAccounts.find(a => a.id === selectedAccount.id);
      if (updatedAccount) {
        setSelectedAccount(updatedAccount);
      }
      
      setShowCreateSubAccountModal(false);
      resetSubAccountForm();
      showToast("✅ Partition created successfully!", "success");
    } catch (error: any) {
      console.error("Error creating sub-account:", error);
      showToast(`❌ ${error.message || "Error creating partition"}`, "error");
    }
  };

  const handleDeleteSubAccount = async (subAccountId: string) => {
    if (!user || !selectedAccount) return;

    if (!confirm("Are you sure you want to delete this partition? The balance will be returned to the main account.")) {
      return;
    }

    try {
      await deleteSubAccount(user.uid, selectedAccount.id, subAccountId);
      
      // Reload accounts and sub-accounts to reflect updated balances
      const userAccounts = await getAccounts(user.uid);
      setAccounts(userAccounts);
      const subs = await getSubAccounts(user.uid, selectedAccount.id);
      setSubAccounts(subs);
      
      // Update selected account
      const updatedAccount = userAccounts.find(a => a.id === selectedAccount.id);
      if (updatedAccount) {
        setSelectedAccount(updatedAccount);
      }
      
      showToast("✅ Partition deleted successfully! Balance returned to main account.", "success");
    } catch (error) {
      console.error("Error deleting sub-account:", error);
      showToast("❌ Error deleting partition", "error");
    }
  };

  const openTransferModal = (subAccount: any) => {
    setSelectedSubAccount(subAccount);
    setTransferAmount(0);
    setTransferDirection("toSubAccount");
    setShowTransferModal(true);
  };

  const handleTransferFunds = async () => {
    if (!user || !selectedAccount || !selectedSubAccount) return;

    if (transferAmount <= 0) {
      showToast("❌ Amount must be greater than 0", "error");
      return;
    }

    try {
      await transferSubAccountFunds(
        user.uid,
        selectedAccount.id,
        selectedSubAccount.id,
        transferAmount,
        transferDirection
      );

      // Reload accounts and sub-accounts
      const userAccounts = await getAccounts(user.uid);
      setAccounts(userAccounts);
      const subs = await getSubAccounts(user.uid, selectedAccount.id);
      setSubAccounts(subs);

      // Update selected account and sub-account
      const updatedAccount = userAccounts.find(a => a.id === selectedAccount.id);
      if (updatedAccount) {
        setSelectedAccount(updatedAccount);
      }
      const updatedSubAccount = subs.find(s => s.id === selectedSubAccount.id);
      if (updatedSubAccount) {
        setSelectedSubAccount(updatedSubAccount);
      }

      setShowTransferModal(false);
      setTransferAmount(0);
      showToast("✅ Funds transferred successfully!", "success");
    } catch (error: any) {
      console.error("Error transferring funds:", error);
      showToast(`❌ ${error.message || "Error transferring funds"}`, "error");
    }
  };

  const calculateTotalWithPartitions = async (account: Account) => {
    if (!user || !account.hasSubAccounts) {
      return account.currentBalance;
    }

    const subs = await getSubAccounts(user.uid, account.id);
    const partitionsTotal = subs.reduce((sum, sub) => sum + (sub.balance || 0), 0);
    return account.currentBalance + partitionsTotal;
  };

  const addHolding = () => {
    const totalPercentage = subAccountFormData.holdings.reduce((sum, h) => sum + h.percentage, 0);
    if (totalPercentage >= 100) {
      showToast("❌ Total holdings percentage cannot exceed 100%", "error");
      return;
    }

    setSubAccountFormData({
      ...subAccountFormData,
      holdings: [
        ...subAccountFormData.holdings,
        { assetType: "etf", ticker: "", name: "", percentage: 0 },
      ],
    });
  };

  const updateHolding = (index: number, field: string, value: any) => {
    const newHoldings = [...subAccountFormData.holdings];
    newHoldings[index] = { ...newHoldings[index], [field]: value };
    setSubAccountFormData({ ...subAccountFormData, holdings: newHoldings });
  };

  const removeHolding = (index: number) => {
    const newHoldings = subAccountFormData.holdings.filter((_, i) => i !== index);
    setSubAccountFormData({ ...subAccountFormData, holdings: newHoldings });
  };

  const handleDeleteAccount = async () => {
    if (!user || !selectedAccount) return;

    try {
      await deleteAccount(user.uid, selectedAccount.id);
      const updatedAccounts = await getAccounts(user.uid);
      setAccounts(updatedAccounts);
      setShowDeleteModal(false);
      setSelectedAccount(null);
      showToast("✅ Account deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting account:", error);
      showToast("❌ Error deleting account", "error");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`✅ ${label} copied to clipboard!`, "success");
    }).catch(() => {
      showToast(`❌ Failed to copy ${label}`, "error");
    });
  };

  const activeAccounts = accounts.filter((a) => !a.archived);
  const totalBalance = activeAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <Toast {...toast} onClose={hideToast} />

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#334155] p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-black/5"></div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center ring-4 ring-white/20">
                    <BanknotesIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-1">Accounts & Funds</h1>
                    <p className="text-gray-300">Manage your accounts and funds</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/20">
                    <p className="text-xs text-gray-300 font-semibold mb-1">Plan Limit</p>
                    <p className="text-2xl font-bold text-white">
                      {activeAccounts.length}/{maxAccounts}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/20">
                    <p className="text-xs text-gray-300 font-semibold mb-1">Total Balance</p>
                    <p className="text-2xl font-bold text-white">
                      €{totalBalance.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Limit Warning */}
          {activeAccounts.length >= maxAccounts - 2 && activeAccounts.length < maxAccounts && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
              <p className="text-amber-800 font-semibold">
                ⚠️ You only have {maxAccounts - activeAccounts.length} slots available
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Account / Upgrade Button */}
      <div className="max-w-7xl mx-auto mb-6">
        {activeAccounts.length >= maxAccounts ? (
          <Button
            onClick={() => router.push("/dashboard/plan")}
            className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-bold px-8 py-3 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all animate-pulse"
            startContent={<SparklesIcon className="w-5 h-5" />}
          >
            Upgrade Plan
          </Button>
        ) : (
          <Button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-semibold px-6 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all"
            startContent={<PlusIcon className="w-5 h-5" />}
          >
            New Account
          </Button>
        )}
      </div>

      {/* Active Accounts Grid */}
      <div className="max-w-7xl mx-auto mb-8">
        <h2 className="text-xl font-bold text-[#0F172A] mb-4 flex items-center gap-2">
          <BanknotesIcon className="w-6 h-6 text-[#22C55E]" />
          Active Accounts ({activeAccounts.length})
        </h2>
        
        {activeAccounts.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-12 text-center">
            <BanknotesIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No accounts created</p>
            <p className="text-gray-400 text-sm mt-2">Create your first account to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeAccounts.map((account) => {
              const accountType = ACCOUNT_TYPES.find((t) => t.value === account.type);
              const TypeIcon = accountType?.icon || BanknotesIcon;
              
              return (
                <div
                  key={account.id}
                  className="group relative bg-white rounded-3xl shadow-lg border border-gray-100/50 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Header with gradient */}
                  <div
                    className="p-7 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${account.color || accountType?.color || "#3B82F6"} 0%, ${account.color || accountType?.color || "#3B82F6"}ee 50%, ${account.color || accountType?.color || "#3B82F6"}dd 100%)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-black/0 via-black/5 to-black/10"></div>
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-5">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center ring-2 ring-white/30 shadow-lg">
                          <TypeIcon className="w-7 h-7 text-white drop-shadow" />
                        </div>
                        <div className="flex gap-2">
                          <span className="text-xs font-bold text-white/90 bg-white/25 backdrop-blur-sm px-4 py-1.5 rounded-full shadow">
                            {accountType?.label}
                          </span>
                          {account.hasSubAccounts && (
                            <span className="text-xs font-bold text-white bg-purple-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow animate-pulse">
                              📊 Partitioned
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-sm">{account.name}</h3>
                      <p className="text-white/80 text-sm line-clamp-2 leading-relaxed">{account.description}</p>
                    </div>
                  </div>

                  {/* Balance Section */}
                  <div className="p-7 bg-gradient-to-br from-gray-50/50 to-white">
                    <div className="mb-6">
                      <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">
                        {account.hasSubAccounts ? "Available Balance" : "Current Balance"}
                      </p>
                      <p className="text-4xl font-black text-[#0F172A] mb-1">
                        €{account.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      {account.hasSubAccounts && accountTotals[account.id] && (
                        <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                          <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider mb-1">Total with Partitions</p>
                          <p className="text-2xl font-black text-purple-700">
                            €{accountTotals[account.id].toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 font-medium mt-2">
                        Initial: €{account.initialBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* IBAN & BIC Section */}
                    {(account.iban || account.bic) && (
                      <div className="mb-6 space-y-2 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
                        {account.iban && (
                          <div className="flex items-center justify-between group/copy">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">IBAN</p>
                              <p className="text-xs font-mono text-gray-700 truncate">{account.iban}</p>
                            </div>
                            <button
                              onClick={() => copyToClipboard(account.iban!, "IBAN")}
                              className="ml-3 p-2 bg-white text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:shadow-md transition-all flex-shrink-0"
                              title="Copy IBAN"
                            >
                              <DocumentDuplicateIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {account.bic && (
                          <div className="flex items-center justify-between group/copy">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">BIC/SWIFT</p>
                              <p className="text-xs font-mono text-gray-700 truncate">{account.bic}</p>
                            </div>
                            <button
                              onClick={() => copyToClipboard(account.bic!, "BIC/SWIFT")}
                              className="ml-3 p-2 bg-white text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:shadow-md transition-all flex-shrink-0"
                              title="Copy BIC/SWIFT"
                            >
                              <DocumentDuplicateIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      {/* Manage Partitions Button - Always visible */}
                      <button
                        onClick={() => openSubAccountsModal(account)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-600 rounded-xl hover:from-purple-100 hover:to-pink-100 hover:shadow-md transition-all font-semibold text-sm group/btn"
                      >
                        <ChartBarIcon className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                        {account.hasSubAccounts ? "View Partitions" : "Manage Partitions"}
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => openEditModal(account)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-600 rounded-xl hover:from-blue-100 hover:to-cyan-100 hover:shadow-md transition-all font-semibold text-sm group/btn"
                        >
                          <PencilIcon className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteModal(account)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-50 to-orange-50 text-red-600 rounded-xl hover:from-red-100 hover:to-orange-100 hover:shadow-md transition-all font-semibold text-sm group/btn"
                        >
                          <TrashIcon className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Hover effect overlay */}
                  <div className="absolute inset-0 ring-2 ring-transparent group-hover:ring-gray-200/50 rounded-3xl pointer-events-none transition-all"></div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Create New Account</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="E.g. Main Account"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Account description..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all resize-none"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ACCOUNT_TYPES.map((type) => {
                    const TypeIcon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setFormData({ ...formData, type: type.value as any, color: type.color })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.type === type.value
                            ? "border-[#22C55E] bg-[#22C55E]/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <TypeIcon
                          className={`w-6 h-6 mx-auto mb-2 ${
                            formData.type === type.value ? "text-[#22C55E]" : "text-gray-400"
                          }`}
                        />
                        <p className={`text-xs font-semibold ${
                          formData.type === type.value ? "text-[#22C55E]" : "text-gray-600"
                        }`}>
                          {type.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Initial Balance */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Initial Balance *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                    €
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all"
                  />
                </div>
              </div>

              {/* IBAN */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  IBAN <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  placeholder="IT00X0000000000000000000000"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all font-mono text-sm"
                />
              </div>

              {/* BIC/SWIFT */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  BIC/SWIFT <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.bic}
                  onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                  placeholder="BCITITMMXXX"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all font-mono text-sm"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-10 h-10 rounded-xl transition-all ${
                        formData.color === color ? "ring-4 ring-offset-2" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color, ringColor: color }}
                    >
                      {formData.color === color && (
                        <CheckIcon className="w-6 h-6 text-white mx-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAccount}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Edit Account</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Account Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Account Name*
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Checking Account"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this account"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Account Type*
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {ACCOUNT_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setFormData({ ...formData, type: type.value })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.type === type.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${type.color}20` }}
                          >
                            <Icon className="w-5 h-5" style={{ color: type.color }} />
                          </div>
                          <span className="font-semibold text-gray-700">{type.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* IBAN (Optional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  IBAN <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  placeholder="e.g., IT60X0542811101000000123456"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              {/* BIC/SWIFT (Optional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  BIC/SWIFT <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.bic}
                  onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                  placeholder="e.g., BCITITMMXXX"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Card Color
                </label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-10 h-10 rounded-xl transition-all ${
                        formData.color === color ? "ring-4 ring-offset-2" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color, ringColor: color }}
                    >
                      {formData.color === color && (
                        <CheckIcon className="w-6 h-6 text-white mx-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateAccount}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6">
              <h2 className="text-2xl font-bold text-white">Delete Account</h2>
            </div>

            <div className="p-8">
              <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6">
                <TrashIcon className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-center text-gray-700 mb-2">
                Are you sure you want to delete the account
              </p>
              <p className="text-center text-xl font-bold text-[#0F172A] mb-6">
                "{selectedAccount.name}"?
              </p>
              <p className="text-center text-sm text-gray-500 mb-8">
                This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedAccount(null);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Accounts Modal (View Partitions) */}
      {showSubAccountsModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Account Partitions</h2>
                  <p className="text-white/80 text-sm mt-1">{selectedAccount.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowSubAccountsModal(false);
                    setSelectedAccount(null);
                    setSubAccounts([]);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-8">
              <button
                onClick={() => {
                  resetSubAccountForm();
                  setShowCreateSubAccountModal(true);
                }}
                className="w-full mb-6 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Add New Partition
              </button>

              {subAccounts.length === 0 ? (
                <div className="text-center py-12">
                  <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-semibold mb-2">No partitions yet</p>
                  <p className="text-gray-400 text-sm">Create a savings or investment partition</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {subAccounts.map((sub) => (
                    <div
                      key={sub.id}
                      className="border-2 border-gray-200 rounded-2xl p-6 hover:border-purple-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                            {sub.type === "savings" ? "💰" : "📈"} {sub.name}
                          </h3>
                          <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                            {sub.type === "savings" ? "Savings" : "Investment"}
                          </span>
                        </div>
                        <button
                          onClick={() => openTransferModal(sub)}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          Transfer
                        </button>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-gray-500 font-semibold">Balance</p>
                        <p className="text-3xl font-bold text-[#0F172A]">
                          €{sub.balance?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                        </p>
                      </div>

                      {sub.type === "savings" && (
                        <div className="bg-green-50 rounded-xl p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Interest Rate</span>
                            <span className="font-semibold text-green-600">{sub.interestRate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Frequency</span>
                            <span className="font-semibold text-gray-700 capitalize">{sub.interestFrequency}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Total Interest Earned</span>
                            <span className="font-semibold text-green-600">
                              €{sub.totalInterestEarned?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                            </span>
                          </div>
                          {sub.nextInterestDate && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Next Payment</span>
                              <span className="font-semibold text-gray-700">
                                {sub.nextInterestDate.toDate().toLocaleDateString("en-US")}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {sub.type === "investment" && sub.holdings && sub.holdings.length > 0 && (
                        <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Holdings</p>
                          {sub.holdings.map((holding: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">
                                {holding.assetType === "etf" ? "📊" : holding.assetType === "bond" ? "📜" : "📈"}{" "}
                                {holding.ticker || holding.name}
                              </span>
                              <span className="font-semibold text-blue-600">{holding.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Sub-Account Modal */}
      {showCreateSubAccountModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Create Partition</h2>
                <button
                  onClick={() => {
                    setShowCreateSubAccountModal(false);
                    resetSubAccountForm();
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Partition Name *
                </label>
                <input
                  type="text"
                  value={subAccountFormData.name}
                  onChange={(e) => setSubAccountFormData({ ...subAccountFormData, name: e.target.value })}
                  placeholder="e.g., Emergency Fund, ETF Portfolio"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSubAccountFormData({ ...subAccountFormData, type: "savings" })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      subAccountFormData.type === "savings"
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-green-300"
                    }`}
                  >
                    <div className="text-center">
                      <p className="text-3xl mb-2">💰</p>
                      <p className="font-semibold">Savings</p>
                      <p className="text-xs text-gray-500 mt-1">With interest payments</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setSubAccountFormData({ ...subAccountFormData, type: "investment" })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      subAccountFormData.type === "investment"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="text-center">
                      <p className="text-3xl mb-2">📈</p>
                      <p className="font-semibold">Investment</p>
                      <p className="text-xs text-gray-500 mt-1">ETF, Bonds, Stocks</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount to Transfer *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={subAccountFormData.amount}
                  onChange={(e) => setSubAccountFormData({ ...subAccountFormData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 1000.00"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                {selectedAccount && (
                  <p className="text-sm text-gray-500 mt-2">
                    Available balance: €{selectedAccount.currentBalance.toFixed(2)}
                  </p>
                )}
              </div>

              {subAccountFormData.type === "savings" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Interest Rate (%) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={subAccountFormData.interestRate}
                      onChange={(e) => setSubAccountFormData({ ...subAccountFormData, interestRate: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g., 3.5"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Interest Frequency *
                    </label>
                    <select
                      value={subAccountFormData.interestFrequency}
                      onChange={(e) => setSubAccountFormData({ ...subAccountFormData, interestFrequency: e.target.value as any })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      {INTEREST_FREQUENCIES.map((freq) => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={subAccountFormData.startDate}
                      onChange={(e) => setSubAccountFormData({ ...subAccountFormData, startDate: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </>
              )}

              {subAccountFormData.type === "investment" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Holdings (ETF/Bond/Stock)
                    </label>
                    <button
                      onClick={addHolding}
                      className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      + Add Holding
                    </button>
                  </div>
                  <div className="space-y-3">
                    {subAccountFormData.holdings.map((holding, idx) => (
                      <div key={idx} className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <select
                            value={holding.assetType}
                            onChange={(e) => updateHolding(idx, "assetType", e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          >
                            {ASSET_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.icon} {type.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeHolding(idx)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={holding.ticker}
                          onChange={(e) => updateHolding(idx, "ticker", e.target.value)}
                          placeholder="Ticker (e.g., VWCE)"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <input
                          type="text"
                          value={holding.name}
                          onChange={(e) => updateHolding(idx, "name", e.target.value)}
                          placeholder="Name (e.g., Vanguard FTSE All-World)"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          value={holding.percentage}
                          onChange={(e) => updateHolding(idx, "percentage", parseFloat(e.target.value) || 0)}
                          placeholder="Percentage"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                    ))}
                    {subAccountFormData.holdings.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No holdings added yet. Click "Add Holding" to add ETF, Bond, or Stock.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateSubAccountModal(false);
                    resetSubAccountForm();
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSubAccount}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Create Partition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal */}
      {showTransferModal && selectedAccount && selectedSubAccount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Transfer Funds</h2>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* Direction Selector */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setTransferDirection("toSubAccount")}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    transferDirection === "toSubAccount"
                      ? "border-blue-500 bg-blue-50 shadow-lg"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">🏦➡️💰</div>
                    <p className="font-bold text-sm text-gray-700">Account → Partition</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Move to {selectedSubAccount.name}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setTransferDirection("toAccount")}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    transferDirection === "toAccount"
                      ? "border-purple-500 bg-purple-50 shadow-lg"
                      : "border-gray-200 hover:border-purple-300"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">💰➡️🏦</div>
                    <p className="font-bold text-sm text-gray-700">Partition → Account</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Move from {selectedSubAccount.name}
                    </p>
                  </div>
                </button>
              </div>

              {/* Balance Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Account Balance</p>
                  <p className="text-xl font-bold text-gray-700">
                    €{selectedAccount.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl">
                  <p className="text-xs text-purple-600 font-semibold uppercase mb-1">Partition Balance</p>
                  <p className="text-xl font-bold text-purple-700">
                    €{selectedSubAccount.balance?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                  </p>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount to Transfer *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Available: €
                  {(transferDirection === "toSubAccount"
                    ? selectedAccount.currentBalance
                    : selectedSubAccount.balance || 0
                  ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferFunds}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Transfer Funds
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} onClose={hideToast} />
    </div>
  );
}
