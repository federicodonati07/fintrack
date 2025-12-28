"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AnimatedCounter from "@/components/AnimatedCounter";
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
  updateAccountsOrder,
} from "@/lib/firestore";
import SharedAccountsManager from "@/components/SharedAccountsManager";
import { getSharedAccounts } from "@/lib/sharedAccounts";
import { User, Account } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";
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
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { Dialog, Transition, Listbox } from "@headlessui/react";
import { Fragment } from "react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  "#EF4444", "#DC2626", "#B91C1C", "#991B1B", "#7F1D1D", "#450A0A",
  "#F59E0B", "#D97706", "#B45309", "#92400E", "#78350F", "#451A03",
  "#3B82F6", "#2563EB", "#1D4ED8", "#1E40AF", "#1E3A8A", "#172554",
  "#8B5CF6", "#7C3AED", "#6D28D9", "#5B21B6", "#4C1D95", "#2E1065",
  "#EC4899", "#DB2777", "#BE185D", "#9D174D", "#831843", "#500724",
  "#06B6D4", "#0891B2", "#0E7490", "#155E75", "#164E63", "#083344",
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

// Sortable Account Card Component
function SortableAccountCard({ 
  account, 
  accountType, 
  accountTotals, 
  copyToClipboard,
  openSubAccountsModal,
  openEditModal,
  openDeleteModal,
  router,
  formatAmount,
  formatCompact,
  AnimatedCounter
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const TypeIcon = accountType?.icon || BanknotesIcon;

  const handleDoubleClick = () => {
    router.push(`/dashboard/analytics/portfolio?account=${account.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 hover:scale-[1.02] transition-all duration-300 flex flex-col cursor-pointer"
      onDoubleClick={handleDoubleClick}
    >
      {/* Colored accent bar - DRAGGABLE with grip */}
      <div
        {...attributes}
        {...listeners}
        className="h-8 cursor-grab active:cursor-grabbing flex items-center justify-center relative"
        style={{
          backgroundColor: account.color || accountType?.color || "#3B82F6",
        }}
      >
        {/* Grip indicator */}
        <div className="flex gap-1">
          <div className="w-1 h-4 bg-white/40 rounded-full"></div>
          <div className="w-1 h-4 bg-white/40 rounded-full"></div>
          <div className="w-1 h-4 bg-white/40 rounded-full"></div>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ 
                backgroundColor: `${account.color || accountType?.color || "#3B82F6"}15`,
              }}
            >
              <TypeIcon 
                className="w-6 h-6" 
                style={{ color: account.color || accountType?.color || "#3B82F6" }}
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">{account.name}</h3>
              <p className="text-xs text-gray-500 font-medium">{accountType?.label}</p>
            </div>
          </div>
          {account.hasSubAccounts && (
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${account.color || accountType?.color || "#3B82F6"}15` }}
            >
              <ChartBarIcon 
                className="w-5 h-5"
                style={{ color: account.color || accountType?.color || "#3B82F6" }}
              />
            </div>
          )}
        </div>

        {/* Balance Section */}
        <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200 transition-all duration-300 group-hover:p-6">
          <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">
            {account.hasSubAccounts ? "Available Balance" : "Current Balance"}
          </p>
          <p className="text-3xl font-bold text-[#0F172A] transition-all duration-300 group-hover:text-4xl">
            <span className="group-hover:hidden">
              <AnimatedCounter
                value={account.currentBalance}
                duration={1.25}
                formatFn={(val) => formatCompact(val)}
              />
            </span>
            <span className="hidden group-hover:inline">
              {formatAmount(account.currentBalance)}
            </span>
          </p>
          {account.hasSubAccounts && accountTotals[account.id] && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">
                Total with Partitions
              </p>
              <p 
                className="text-xl font-bold transition-all duration-300 group-hover:text-3xl"
                style={{ color: account.color || accountType?.color || "#3B82F6" }}
              >
                <span className="group-hover:hidden">
                  <AnimatedCounter
                    value={accountTotals[account.id]}
                    duration={1.25}
                    formatFn={(val) => formatCompact(val)}
                  />
                </span>
                <span className="hidden group-hover:inline">
                  {formatAmount(accountTotals[account.id])}
                </span>
              </p>
            </div>
          )}
          <p className="text-xs text-gray-400 font-medium mt-3">
            Initial: {formatAmount(account.initialBalance)}
          </p>
        </div>

        {/* IBAN & BIC Section */}
        {(account.iban || account.bic) && (
          <div className="mb-5 space-y-3">
            {account.iban && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">IBAN</p>
                  <p className="text-xs font-mono text-[#0F172A] truncate">{account.iban}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(account.iban!, "IBAN");
                  }}
                  className="ml-3 p-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all flex-shrink-0"
                  title="Copy IBAN"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            {account.bic && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">BIC/SWIFT</p>
                  <p className="text-xs font-mono text-[#0F172A] truncate">{account.bic}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(account.bic!, "BIC/SWIFT");
                  }}
                  className="ml-3 p-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all flex-shrink-0"
                  title="Copy BIC/SWIFT"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Spacer to push content to bottom */}
        <div className="flex-1"></div>

        {/* Description - Always at same level */}
        <div className="mb-5 min-h-[3rem]">
          {account.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{account.description}</p>
          )}
        </div>

        {/* Action Buttons - Always at bottom */}
        <div className="space-y-2 mt-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openSubAccountsModal(account);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-[#0F172A] rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold text-sm"
          >
            <ChartBarIcon className="w-4 h-4" />
            {account.hasSubAccounts ? "View Partitions" : "Manage Partitions"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(account);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-[#0F172A] rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium text-sm"
            >
              <PencilIcon className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openDeleteModal(account);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-400 transition-all font-medium text-sm"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const router = useRouter();
  const { formatAmount, currency } = useCurrency();
  const { toast, showToast, hideToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<"free" | "pro" | "ultra" | "admin">("free");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sharedAccounts, setSharedAccounts] = useState<any[]>([]);
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
  const [transferDirection, setTransferDirection] = useState<"toSubAccount" | "toAccount" | "betweenSubAccounts">("toSubAccount");
  const [transferSourceType, setTransferSourceType] = useState<"account" | "partition">("account");
  const [transferDestinationType, setTransferDestinationType] = useState<"account" | "partition">("partition");
  const [selectedSourceSubAccount, setSelectedSourceSubAccount] = useState<any | null>(null);

  // Helper function to format with K/M/B
  const formatCompact = (amount: number): string => {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    
    if (absAmount >= 1_000_000_000) {
      return `${sign}${currency.symbol}${(absAmount / 1_000_000_000).toFixed(2)}B`;
    } else if (absAmount >= 1_000_000) {
      return `${sign}${currency.symbol}${(absAmount / 1_000_000).toFixed(2)}M`;
    } else if (absAmount >= 100_000) {
      return `${sign}${currency.symbol}${(absAmount / 1_000).toFixed(2)}K`;
    }
    return formatAmount(amount);
  };
  const [selectedDestSubAccount, setSelectedDestSubAccount] = useState<any | null>(null);
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
          setUserPlan(userDoc.plan as any);
          setUserEmail(userDoc.email || firebaseUser.email || "");
          setUserName(userDoc.name || userDoc.displayName || "Unknown User");
          
          // Load plan limits
          const limits = await getPlanLimits(userDoc.plan as any);
          setMaxAccounts(limits.accounts);
          
          // Load accounts
          const userAccounts = await getAccounts(firebaseUser.uid);
          setAccounts(userAccounts);
          
          // Load shared accounts
          try {
            const userSharedAccounts = await getSharedAccounts(firebaseUser.uid);
            setSharedAccounts(userSharedAccounts);
          } catch (error) {
            console.error("Error loading shared accounts:", error);
            setSharedAccounts([]);
          }
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
    setTransferSourceType("account");
    setTransferDestinationType("partition");
    setSelectedSourceSubAccount(null);
    setSelectedDestSubAccount(subAccount);
    setShowTransferModal(true);
  };

  const handleTransferFunds = async () => {
    if (!user || !selectedAccount) return;

    if (transferAmount <= 0) {
      showToast("❌ Amount must be greater than 0", "error");
      return;
    }

    try {
      // Determine transfer type
      if (transferSourceType === "account" && transferDestinationType === "partition") {
        // Account to Partition
        if (!selectedDestSubAccount) {
          showToast("❌ Please select a destination partition", "error");
          return;
        }
        await transferSubAccountFunds(
          user.uid,
          selectedAccount.id,
          selectedDestSubAccount.id,
          transferAmount,
          "toSubAccount"
        );
      } else if (transferSourceType === "partition" && transferDestinationType === "account") {
        // Partition to Account
        if (!selectedSourceSubAccount) {
          showToast("❌ Please select a source partition", "error");
          return;
        }
        await transferSubAccountFunds(
          user.uid,
          selectedAccount.id,
          selectedSourceSubAccount.id,
          transferAmount,
          "toAccount"
        );
      } else if (transferSourceType === "partition" && transferDestinationType === "partition") {
        // Partition to Partition
        if (!selectedSourceSubAccount || !selectedDestSubAccount) {
          showToast("❌ Please select both source and destination partitions", "error");
          return;
        }
        if (selectedSourceSubAccount.id === selectedDestSubAccount.id) {
          showToast("❌ Source and destination cannot be the same", "error");
          return;
        }
        await createInternalSubAccountTransaction(
          user.uid,
          selectedAccount.id,
          selectedSourceSubAccount.id,
          selectedDestSubAccount.id,
          transferAmount
        );
      }

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

      setShowTransferModal(false);
      setTransferAmount(0);
      setSelectedSourceSubAccount(null);
      setSelectedDestSubAccount(null);
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = accounts.findIndex((acc) => acc.id === active.id);
      const newIndex = accounts.findIndex((acc) => acc.id === over.id);

      const newOrder = arrayMove(accounts, oldIndex, newIndex);
      setAccounts(newOrder);

      // Save order to Firebase
      if (user) {
        try {
          await updateAccountsOrder(
            user.uid,
            newOrder.map((acc) => acc.id)
          );
          showToast("✅ Account order updated", "success");
        } catch (error) {
          console.error("Error updating order:", error);
          showToast("❌ Failed to update order", "error");
          // Revert on error
          const userAccounts = await getAccounts(user.uid);
          setAccounts(userAccounts);
        }
      }
    }
  };

  const activeAccounts = accounts.filter((a) => !a.archived);
  const totalBalance = activeAccounts.reduce((sum, acc) => {
    // Use accountTotals if available (includes partitions), otherwise use currentBalance
    return sum + (accountTotals[acc.id] || acc.currentBalance);
  }, 0) + sharedAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

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
                    {pendingInvitesCount > 0 && (
                      <div className="mt-2 inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-semibold">
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                        {pendingInvitesCount} pending invite{pendingInvitesCount > 1 ? "s" : ""}
                      </div>
                    )}
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
                      <AnimatedCounter
                        value={totalBalance}
                        duration={1.25}
                        formatFn={(val) => formatCompact(val)}
                      />
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeAccounts.map((acc) => acc.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeAccounts.map((account) => {
                  const accountType = ACCOUNT_TYPES.find((t) => t.value === account.type);
                  
                  return (
                    <SortableAccountCard
                      key={account.id}
                      account={account}
                      accountType={accountType}
                      accountTotals={accountTotals}
                      copyToClipboard={copyToClipboard}
                      openSubAccountsModal={openSubAccountsModal}
                      openEditModal={openEditModal}
                      openDeleteModal={openDeleteModal}
                      router={router}
                      formatAmount={formatAmount}
                      formatCompact={formatCompact}
                      AnimatedCounter={AnimatedCounter}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Shared Accounts Section */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8">
          {user && (
            <SharedAccountsManager
              userId={user.uid}
              userEmail={userEmail}
              userName={userName}
              userPlan={userPlan}
              onInviteCountChange={(count) => setPendingInvitesCount(count)}
            />
          )}
        </div>
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
                <div className="flex flex-wrap gap-3 mb-3">
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
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">Custom:</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-16 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#000000"
                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm"
                  />
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="bg-[#0F172A] p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Edit Account</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Account Name */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Account Name*
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Checking Account"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all text-[#0F172A]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this account"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all text-[#0F172A] resize-none"
                  rows={3}
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Account Type*
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {ACCOUNT_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setFormData({ ...formData, type: type.value })}
                        className={`p-3 rounded-lg border transition-all ${
                          formData.type === type.value
                            ? "border-[#22C55E] bg-[#22C55E]/5 shadow-sm"
                            : "border-gray-300 hover:border-[#22C55E]/50 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${type.color}15` }}
                          >
                            <Icon className="w-5 h-5" style={{ color: type.color }} />
                          </div>
                          <span className="font-medium text-sm text-[#0F172A]">{type.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* IBAN (Optional) */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  IBAN <span className="text-gray-500 font-normal text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  placeholder="e.g., IT60X0542811101000000123456"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all font-mono text-sm text-[#0F172A]"
                />
              </div>

              {/* BIC/SWIFT (Optional) */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  BIC/SWIFT <span className="text-gray-500 font-normal text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.bic}
                  onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                  placeholder="e.g., BCITITMMXXX"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all font-mono text-sm text-[#0F172A]"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Card Color
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-9 h-9 rounded-lg transition-all ${
                        formData.color === color ? "ring-2 ring-offset-2 ring-[#22C55E]" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {formData.color === color && (
                        <CheckIcon className="w-5 h-5 text-white mx-auto" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 font-medium">Custom:</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-9 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#000000"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-2.5 bg-gray-100 text-[#0F172A] rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateAccount}
                  className="flex-1 px-6 py-2.5 bg-[#22C55E] text-white rounded-lg font-semibold hover:bg-[#16A34A] transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {/* Delete Modal */}
      <Transition appear show={showDeleteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteModal(false)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
                  <div className="bg-gradient-to-r from-red-500 to-red-600 p-6">
                    <Dialog.Title className="text-2xl font-bold text-white">
                      Delete Account
                    </Dialog.Title>
                  </div>

                  {selectedAccount && (
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
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                          <TrashIcon className="w-5 h-5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Sub-Accounts Modal (View Partitions) */}
      {showSubAccountsModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="bg-[#0F172A] p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Account Partitions</h2>
                  <p className="text-white/70 text-sm mt-1">{selectedAccount.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowSubAccountsModal(false);
                    setSelectedAccount(null);
                    setSubAccounts([]);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => {
                    resetSubAccountForm();
                    setShowCreateSubAccountModal(true);
                  }}
                  className="flex-1 py-2.5 px-4 bg-[#22C55E] text-white rounded-lg font-semibold hover:bg-[#16A34A] transition-colors flex items-center justify-center gap-2"
                >
                  <PlusIcon className="w-5 h-5" />
                  Add Partition
                </button>
                {subAccounts.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedSourceSubAccount(null);
                      setSelectedDestSubAccount(null);
                      setTransferAmount(0);
                      setTransferSourceType("account");
                      setTransferDestinationType("partition");
                      setShowTransferModal(true);
                    }}
                    className="flex-1 py-2.5 px-4 bg-[#0F172A] text-white rounded-lg font-semibold hover:bg-[#1E293B] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Transfer Funds
                  </button>
                )}
              </div>

              {subAccounts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <ChartBarIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-700 font-semibold mb-1">No partitions yet</p>
                  <p className="text-gray-500 text-sm">Create a savings or investment partition</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subAccounts.map((sub) => (
                    <div
                      key={sub.id}
                      className="border border-gray-300 rounded-lg p-5 hover:border-[#22C55E] hover:shadow-sm transition-all bg-white"
                    >
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <ChartBarIcon className="w-5 h-5 text-[#22C55E]" />
                          <h3 className="text-lg font-bold text-[#0F172A]">{sub.name}</h3>
                        </div>
                        <span className="text-xs font-semibold text-[#22C55E] bg-[#22C55E]/10 px-2 py-1 rounded-md">
                          {sub.type === "savings" ? "Savings" : "Investment"}
                        </span>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Balance</p>
                        <p className="text-2xl font-bold text-[#0F172A]">
                          {formatAmount(sub.balance || 0)}
                        </p>
                      </div>

                      {sub.type === "savings" && (
                        <div className="bg-[#22C55E]/5 rounded-lg p-3 space-y-2 border border-[#22C55E]/20">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 font-medium">Interest Rate</span>
                            <span className="font-semibold text-[#22C55E]">{sub.interestRate}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 font-medium">Frequency</span>
                            <span className="font-semibold text-[#0F172A] capitalize">{sub.interestFrequency}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 font-medium">Total Earned</span>
                            <span className="font-semibold text-[#22C55E]">
                              {formatAmount(sub.totalInterestEarned || 0)}
                            </span>
                          </div>
                          {sub.nextInterestDate && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 font-medium">Next Payment</span>
                              <span className="font-semibold text-[#0F172A]">
                                {sub.nextInterestDate.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {sub.type === "investment" && sub.holdings && sub.holdings.length > 0 && (
                        <div className="bg-[#3B82F6]/5 rounded-lg p-3 space-y-2 border border-[#3B82F6]/20">
                          <p className="text-xs font-semibold text-[#0F172A] mb-2">Holdings</p>
                          {sub.holdings.map((holding: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                              <span className="text-gray-600 font-medium">
                                <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-1.5 font-semibold">
                                  {holding.assetType.toUpperCase()}
                                </span>
                                {holding.ticker || holding.name}
                              </span>
                              <span className="font-semibold text-[#3B82F6]">{holding.percentage}%</span>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="bg-[#0F172A] p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Create Partition</h2>
                <button
                  onClick={() => {
                    setShowCreateSubAccountModal(false);
                    resetSubAccountForm();
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Partition Name *
                </label>
                <input
                  type="text"
                  value={subAccountFormData.name}
                  onChange={(e) => setSubAccountFormData({ ...subAccountFormData, name: e.target.value })}
                  placeholder="e.g., Emergency Fund, ETF Portfolio"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSubAccountFormData({ ...subAccountFormData, type: "savings" })}
                    className={`p-4 rounded-lg border transition-all ${
                      subAccountFormData.type === "savings"
                        ? "border-[#22C55E] bg-[#22C55E]/5 shadow-sm"
                        : "border-gray-300 hover:border-[#22C55E]/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 mx-auto mb-2 bg-[#22C55E]/10 rounded-lg flex items-center justify-center">
                        <BanknotesIcon className="w-6 h-6 text-[#22C55E]" />
                      </div>
                      <p className="font-semibold text-[#0F172A]">Savings</p>
                      <p className="text-xs text-gray-500 mt-1">With interest payments</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setSubAccountFormData({ ...subAccountFormData, type: "investment" })}
                    className={`p-4 rounded-lg border transition-all ${
                      subAccountFormData.type === "investment"
                        ? "border-[#3B82F6] bg-[#3B82F6]/5 shadow-sm"
                        : "border-gray-300 hover:border-[#3B82F6]/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 mx-auto mb-2 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center">
                        <ChartBarIcon className="w-6 h-6 text-[#3B82F6]" />
                      </div>
                      <p className="font-semibold text-[#0F172A]">Investment</p>
                      <p className="text-xs text-gray-500 mt-1">ETF, Bonds, Stocks</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Amount to Transfer *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">
                    {currency.symbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={subAccountFormData.amount || ""}
                    onChange={(e) => setSubAccountFormData({ ...subAccountFormData, amount: parseFloat(e.target.value) || 0 })}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all text-[#0F172A]"
                  />
                </div>
                {selectedAccount && (
                  <p className="text-xs text-gray-500 mt-2">
                    Available balance: {formatAmount(selectedAccount.currentBalance)}
                  </p>
                )}
              </div>

              {subAccountFormData.type === "savings" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Interest Rate (%) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={subAccountFormData.interestRate || ""}
                      onChange={(e) => setSubAccountFormData({ ...subAccountFormData, interestRate: parseFloat(e.target.value) || 0 })}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="e.g., 3.5"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all text-[#0F172A]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Interest Frequency *
                    </label>
                    <select
                      value={subAccountFormData.interestFrequency}
                      onChange={(e) => setSubAccountFormData({ ...subAccountFormData, interestFrequency: e.target.value as any })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all text-[#0F172A]"
                    >
                      {INTEREST_FREQUENCIES.map((freq) => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={subAccountFormData.startDate}
                      onChange={(e) => setSubAccountFormData({ ...subAccountFormData, startDate: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all text-[#0F172A]"
                    />
                  </div>
                </>
              )}

              {subAccountFormData.type === "investment" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-[#0F172A]">
                      Holdings (ETF/Bond/Stock)
                    </label>
                    <button
                      onClick={addHolding}
                      className="text-sm text-[#22C55E] hover:text-[#16A34A] font-semibold flex items-center gap-1"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Holding
                    </button>
                  </div>
                  <div className="space-y-3">
                    {subAccountFormData.holdings.map((holding, idx) => (
                      <div key={idx} className="border border-gray-300 rounded-lg p-4 space-y-3 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <select
                            value={holding.assetType}
                            onChange={(e) => updateHolding(idx, "assetType", e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-[#0F172A]"
                          >
                            {ASSET_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeHolding(idx)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={holding.ticker}
                          onChange={(e) => updateHolding(idx, "ticker", e.target.value)}
                          placeholder="Ticker (e.g., VWCE)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-[#0F172A]"
                        />
                        <input
                          type="text"
                          value={holding.name}
                          onChange={(e) => updateHolding(idx, "name", e.target.value)}
                          placeholder="Name (e.g., Vanguard FTSE All-World)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-[#0F172A]"
                        />
                        <input
                          type="number"
                          value={holding.percentage || ""}
                          onChange={(e) => updateHolding(idx, "percentage", parseFloat(e.target.value) || 0)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="Percentage"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-[#0F172A]"
                        />
                      </div>
                    ))}
                    {subAccountFormData.holdings.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                        No holdings added yet. Click "Add Holding" to add ETF, Bond, or Stock.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCreateSubAccountModal(false);
                    resetSubAccountForm();
                  }}
                  className="flex-1 px-6 py-2.5 bg-gray-100 text-[#0F172A] rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSubAccount}
                  className="flex-1 px-6 py-2.5 bg-[#22C55E] text-white rounded-lg font-semibold hover:bg-[#16A34A] transition-colors"
                >
                  Create Partition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal */}
      {showTransferModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-gray-200">
            <div className="bg-[#0F172A] p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Transfer Funds</h2>
                  <p className="text-sm text-white/70 mt-1">Move money between account and partitions</p>
                </div>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedSourceSubAccount(null);
                    setSelectedDestSubAccount(null);
                    setTransferAmount(0);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Transfer Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-3">
                  Transfer Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      setTransferSourceType("account");
                      setTransferDestinationType("partition");
                      setSelectedSourceSubAccount(null);
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      transferSourceType === "account" && transferDestinationType === "partition"
                        ? "border-[#22C55E] bg-[#22C55E]/5"
                        : "border-gray-300 hover:border-[#22C55E]/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                        <BuildingLibraryIcon className="w-5 h-5 text-[#22C55E]" />
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                        <ChartBarIcon className="w-5 h-5 text-[#3B82F6]" />
                      </div>
                    </div>
                    <p className="font-semibold text-sm text-[#0F172A]">Account → Partition</p>
                    <p className="text-xs text-gray-500 mt-1">Move funds from main account to a partition</p>
                  </button>
                  <button
                    onClick={() => {
                      setTransferSourceType("partition");
                      setTransferDestinationType("account");
                      setSelectedDestSubAccount(null);
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      transferSourceType === "partition" && transferDestinationType === "account"
                        ? "border-[#22C55E] bg-[#22C55E]/5"
                        : "border-gray-300 hover:border-[#22C55E]/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                        <ChartBarIcon className="w-5 h-5 text-[#3B82F6]" />
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                        <BuildingLibraryIcon className="w-5 h-5 text-[#22C55E]" />
                      </div>
                    </div>
                    <p className="font-semibold text-sm text-[#0F172A]">Partition → Account</p>
                    <p className="text-xs text-gray-500 mt-1">Withdraw funds from partition to main account</p>
                  </button>
                  <button
                    onClick={() => {
                      setTransferSourceType("partition");
                      setTransferDestinationType("partition");
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      transferSourceType === "partition" && transferDestinationType === "partition"
                        ? "border-[#22C55E] bg-[#22C55E]/5"
                        : "border-gray-300 hover:border-[#22C55E]/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                        <ChartBarIcon className="w-5 h-5 text-[#3B82F6]" />
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4" />
                      </svg>
                      <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                        <ChartBarIcon className="w-5 h-5 text-[#3B82F6]" />
                      </div>
                    </div>
                    <p className="font-semibold text-sm text-[#0F172A]">Partition → Partition</p>
                    <p className="text-xs text-gray-500 mt-1">Rebalance funds between two partitions</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Source Selection */}
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Transfer From
                  </label>
                  {transferSourceType === "account" ? (
                    <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <BuildingLibraryIcon className="w-5 h-5 text-[#22C55E]" />
                        <p className="font-semibold text-[#0F172A]">{selectedAccount.name}</p>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">Available Balance</p>
                      <p className="text-lg font-bold text-[#0F172A]">
                        {formatAmount(selectedAccount.currentBalance)}
                      </p>
                    </div>
                  ) : (
                    <Listbox value={selectedSourceSubAccount} onChange={setSelectedSourceSubAccount}>
                      <div className="relative">
                        <Listbox.Button className="w-full p-4 bg-white border border-gray-300 rounded-lg text-left focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all">
                          {selectedSourceSubAccount ? (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <ChartBarIcon className="w-5 h-5 text-[#3B82F6]" />
                                <p className="font-semibold text-[#0F172A]">{selectedSourceSubAccount.name}</p>
                              </div>
                              <p className="text-xs text-gray-500 mb-1">Balance</p>
                              <p className="text-lg font-bold text-[#0F172A]">
                                {formatAmount(selectedSourceSubAccount.balance || 0)}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Select a partition...</span>
                              <ChevronUpDownIcon className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                        </Listbox.Button>
                        <Transition
                          as={Fragment}
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                        >
                          <Listbox.Options className="absolute z-10 mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {subAccounts.map((sub) => (
                              <Listbox.Option
                                key={sub.id}
                                value={sub}
                                className={({ active }) =>
                                  `cursor-pointer select-none p-3 ${
                                    active ? "bg-[#22C55E]/10" : ""
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className={`font-semibold text-sm ${selected ? "text-[#22C55E]" : "text-[#0F172A]"}`}>
                                        {sub.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {formatAmount(sub.balance || 0)}
                                      </p>
                                    </div>
                                    {selected && <CheckIcon className="w-5 h-5 text-[#22C55E]" />}
                                  </div>
                                )}
                              </Listbox.Option>
                            ))}
                          </Listbox.Options>
                        </Transition>
                      </div>
                    </Listbox>
                  )}
                </div>

                {/* Destination Selection */}
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Transfer To
                  </label>
                  {transferDestinationType === "account" ? (
                    <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <BuildingLibraryIcon className="w-5 h-5 text-[#22C55E]" />
                        <p className="font-semibold text-[#0F172A]">{selectedAccount.name}</p>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">Current Balance</p>
                      <p className="text-lg font-bold text-[#0F172A]">
                        {formatAmount(selectedAccount.currentBalance)}
                      </p>
                    </div>
                  ) : (
                    <Listbox value={selectedDestSubAccount} onChange={setSelectedDestSubAccount}>
                      <div className="relative">
                        <Listbox.Button className="w-full p-4 bg-white border border-gray-300 rounded-lg text-left focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all">
                          {selectedDestSubAccount ? (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <ChartBarIcon className="w-5 h-5 text-[#3B82F6]" />
                                <p className="font-semibold text-[#0F172A]">{selectedDestSubAccount.name}</p>
                              </div>
                              <p className="text-xs text-gray-500 mb-1">Balance</p>
                              <p className="text-lg font-bold text-[#0F172A]">
                                {formatAmount(selectedDestSubAccount.balance || 0)}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Select a partition...</span>
                              <ChevronUpDownIcon className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                        </Listbox.Button>
                        <Transition
                          as={Fragment}
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                        >
                          <Listbox.Options className="absolute z-10 mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {subAccounts.filter(sub => 
                              transferSourceType === "partition" ? sub.id !== selectedSourceSubAccount?.id : true
                            ).map((sub) => (
                              <Listbox.Option
                                key={sub.id}
                                value={sub}
                                className={({ active }) =>
                                  `cursor-pointer select-none p-3 ${
                                    active ? "bg-[#22C55E]/10" : ""
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className={`font-semibold text-sm ${selected ? "text-[#22C55E]" : "text-[#0F172A]"}`}>
                                        {sub.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {formatAmount(sub.balance || 0)}
                                      </p>
                                    </div>
                                    {selected && <CheckIcon className="w-5 h-5 text-[#22C55E]" />}
                                  </div>
                                )}
                              </Listbox.Option>
                            ))}
                          </Listbox.Options>
                        </Transition>
                      </div>
                    </Listbox>
                  )}
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Amount to Transfer
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">
                    {currency.symbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferAmount || ""}
                    onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-xl font-semibold focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all text-[#0F172A]"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    Available:{" "}
                    <span className="font-semibold text-[#0F172A]">
                      {formatAmount(
                        transferSourceType === "account"
                          ? selectedAccount.currentBalance
                          : selectedSourceSubAccount?.balance || 0
                      )}
                    </span>
                  </span>
                  {transferAmount > 0 && (
                    <span className="text-[#22C55E] font-semibold">
                      New balance: {formatAmount(
                        (transferDestinationType === "account"
                          ? selectedAccount.currentBalance
                          : selectedDestSubAccount?.balance || 0) + transferAmount
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedSourceSubAccount(null);
                    setSelectedDestSubAccount(null);
                    setTransferAmount(0);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-[#0F172A] rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferFunds}
                  className="flex-1 px-6 py-3 bg-[#22C55E] text-white rounded-lg font-semibold hover:bg-[#16A34A] transition-colors"
                >
                  Confirm Transfer
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
