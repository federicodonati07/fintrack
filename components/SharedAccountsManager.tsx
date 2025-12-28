"use client";

import { useState, useEffect, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import AnimatedCounter from "@/components/AnimatedCounter";
import {
  PlusIcon,
  XMarkIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  UserPlusIcon,
  ArrowRightOnRectangleIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  BuildingLibraryIcon,
  BanknotesIcon,
  ChartBarIcon,
  WalletIcon,
  CreditCardIcon,
  CurrencyEuroIcon,
  UserCircleIcon,
  ClockIcon,
  SparklesIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
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
import {
  createSharedAccount,
  getSharedAccounts,
  getPendingInvites,
  getSharedAccountInvites,
  createSharedAccountInvite,
  acceptSharedAccountInvite,
  rejectSharedAccountInvite,
  leaveSharedAccount,
  deleteSharedAccount,
  removeMemberFromSharedAccount,
  searchUserByEmail,
  searchUsersByPattern,
  countUserSharedAccounts,
  updateSharedAccountsOrder,
} from "@/lib/sharedAccounts";
import { getPlanLimits, getUserDocument } from "@/lib/firestore";
import { SharedAccount, SharedAccountInvite } from "@/lib/types";
import { useToast } from "@/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";

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

interface Props {
  userId: string;
  userEmail: string;
  userName: string;
  userPlan: "free" | "pro" | "ultra" | "admin";
  onInviteCountChange: (count: number) => void;
}

// Sortable Shared Account Card Component
function SortableSharedAccountCard({
  account,
  accountType,
  userId,
  formatAmount,
  formatCompact,
  showToast,
  copyToClipboard,
  AnimatedCounter,
  onManageClick,
  onDeleteClick,
  onViewClick,
  onLeaveClick,
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

  const TypeIcon = accountType?.icon || UserGroupIcon;
  const isOwner = account.ownerId === userId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 hover:scale-[1.02] transition-all duration-300 cursor-pointer flex flex-col"
      onDoubleClick={() => {
        window.location.href = `/dashboard/analytics/portfolio?account=${account.id}`;
      }}
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
              <h3 className="text-lg font-bold text-[#0F172A]">
                {account.name}
              </h3>
              <p className="text-xs text-gray-500 font-medium">{accountType?.label}</p>
            </div>
          </div>
          {isOwner && (
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${account.color || accountType?.color || "#3B82F6"}15` }}
              title="You are the owner"
            >
              <UserGroupIcon 
                className="w-5 h-5"
                style={{ color: account.color || accountType?.color || "#3B82F6" }}
              />
            </div>
          )}
        </div>

        {/* Balance Section */}
        <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200 transition-all duration-300 group-hover:p-6">
          <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Current Balance</p>
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
        </div>

        {/* Members Info */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex -space-x-2">
            {account.members?.slice(0, 3).map((member: any, idx: number) => (
              <div
                key={idx}
                className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
                title={`${member.name || member.email}`}
              >
                <span className="text-xs font-bold text-gray-600">
                  {(member.name || member.email).charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
            {(account.members?.length || 0) > 3 && (
              <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center">
                <span className="text-xs font-bold text-gray-700">
                  +{(account.members?.length || 0) - 3}
                </span>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {account.members?.length || 0} member{(account.members?.length || 0) !== 1 ? 's' : ''}
          </span>
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
                    copyToClipboard(account.iban, "IBAN");
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
                    copyToClipboard(account.bic, "BIC/SWIFT");
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

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Description - Always at same level */}
        <div className="mb-5 min-h-[3rem]">
          {account.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{account.description}</p>
          )}
        </div>

        {/* Action Buttons - Always at bottom */}
        <div className="flex gap-2 mt-auto">
          {isOwner ? (
            <>
              <button
                onClick={onManageClick}
                className="flex-1 px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-[#0F172A] rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                <UserGroupIcon className="w-4 h-4" />
                Manage
              </button>
              <button
                onClick={onDeleteClick}
                className="px-3 py-2.5 bg-white hover:bg-red-50 border border-red-300 text-red-600 rounded-lg text-sm font-medium transition-all"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onViewClick}
                className="flex-1 px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-[#0F172A] rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                <UserGroupIcon className="w-4 h-4" />
                View
              </button>
              <button
                onClick={onLeaveClick}
                className="px-3 py-2.5 bg-white hover:bg-red-50 border border-red-300 text-red-600 rounded-lg text-sm font-medium transition-all"
              >
                Leave
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SharedAccountsManager({
  userId,
  userEmail,
  userName,
  userPlan,
  onInviteCountChange,
}: Props) {
  const { showToast } = useToast();
  const { formatAmount, currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccount[]>([]);
  const [pendingInvites, setPendingInvites] = useState<SharedAccountInvite[]>([]);
  const [maxSharedAccounts, setMaxSharedAccounts] = useState(0);

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
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SharedAccount | null>(null);
  const [selectedAccountPendingInvites, setSelectedAccountPendingInvites] = useState<SharedAccountInvite[]>([]);
  
  // Form states
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    type: "checking" as "checking" | "savings" | "investment" | "wallet" | "credit_card" | "other",
    initialBalance: 0,
    currency: "EUR",
    iban: "",
    bic: "",
    color: "#3B82F6",
  });
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [addedMembers, setAddedMembers] = useState<Array<{ email: string; name: string; uid: string }>>([]);
  const [searchingUser, setSearchingUser] = useState(false);
  const [maxMembersPerAccount, setMaxMembersPerAccount] = useState(10);
  const [searchResults, setSearchResults] = useState<Array<{
    uid: string;
    email: string;
    name: string;
    plan: string;
  }>>([]);
  const [searchResult, setSearchResult] = useState<any>(null); // For invite modal (existing accounts)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [isViewOnlyMode, setIsViewOnlyMode] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; email: string; name: string } | null>(null);
  const [inviteSearchEmail, setInviteSearchEmail] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState<Array<{
    uid: string;
    email: string;
    name: string;
    plan: string;
  }>>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteSearchTimeout, setInviteSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, [userId]);

  useEffect(() => {
    onInviteCountChange(pendingInvites.length);
  }, [pendingInvites.length]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load plan limits from Firebase
      const limits = await getPlanLimits(userPlan);
      
      // Check if sharedAccounts exists in the limits
      if (limits && typeof limits.sharedAccounts !== 'undefined') {
        setMaxSharedAccounts(limits.sharedAccounts);
      } else {
        // If not found, set to 0 and show warning
        setMaxSharedAccounts(0);
        console.warn(`sharedAccounts limit not found for plan: ${userPlan}`);
      }
      
      // Set max members per account
      if (limits && typeof limits.maxMembersPerSharedAccount !== 'undefined') {
        setMaxMembersPerAccount(limits.maxMembersPerSharedAccount);
      } else {
        setMaxMembersPerAccount(10); // Default fallback
      }
      
      // Load shared accounts
      const accounts = await getSharedAccounts(userId);
      console.log("📊 Loaded shared accounts:", accounts.length, accounts);
      setSharedAccounts(accounts);
      
      // Load pending invites
      const invites = await getPendingInvites(userId);
      setPendingInvites(invites);
    } catch (error) {
      console.error("Error loading shared accounts data:", error);
      showToast("❌ Error loading data", "error");
    } finally {
      setLoading(false);
    }
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
      const oldIndex = sharedAccounts.findIndex((acc) => acc.id === active.id);
      const newIndex = sharedAccounts.findIndex((acc) => acc.id === over.id);

      const newOrder = arrayMove(sharedAccounts, oldIndex, newIndex);
      setSharedAccounts(newOrder);

      // Save order to Firebase
      try {
        await updateSharedAccountsOrder(
          userId,
          newOrder.map((acc) => acc.id)
        );
        showToast("✅ Account order updated", "success");
      } catch (error) {
        console.error("Error updating order:", error);
        showToast("❌ Failed to update order", "error");
      }
    }
  };

  const handleCreateSharedAccount = async () => {
    if (!createForm.name.trim()) {
      showToast("❌ Please enter an account name", "error");
      return;
    }

    if (createForm.initialBalance < 0) {
      showToast("❌ Initial balance cannot be negative", "error");
      return;
    }

    // Check limit
    if (sharedAccounts.length >= maxSharedAccounts) {
      showToast(`❌ You have reached your shared accounts limit (${maxSharedAccounts})`, "error");
      return;
    }

    try {
      // Create shared account with only owner as member
      const ownerMember = { userId, email: userEmail, role: "owner" as "owner" | "member" };

      const accountId = await createSharedAccount(userId, {
        name: createForm.name,
        description: createForm.description,
        type: createForm.type,
        currentBalance: createForm.initialBalance,
        currency: createForm.currency,
        color: createForm.color,
        iban: createForm.iban,
        bic: createForm.bic,
      }, [ownerMember]); // Only owner initially

      // Send invites to all added members
      for (const member of addedMembers) {
        try {
          await createSharedAccountInvite(
            accountId,
            createForm.name,
            userId,
            userEmail,
            userName,
            member.uid,
            member.email
          );
        } catch (error) {
          console.error(`Failed to send invite to ${member.email}:`, error);
        }
      }

      const successMessage = addedMembers.length > 0 
        ? `✅ Shared account created! ${addedMembers.length} invite(s) sent.`
        : "✅ Shared account created successfully!";
      
      showToast(successMessage, "success");
      setShowCreateModal(false);
      setCreateForm({
        name: "",
        description: "",
        type: "checking",
        initialBalance: 0,
        currency: "EUR",
        iban: "",
        bic: "",
        color: "#3B82F6",
      });
      setAddedMembers([]);
      loadData();
    } catch (error: any) {
      console.error("Error creating shared account:", error);
      showToast(`❌ ${error.message || "Error creating shared account"}`, "error");
    }
  };

  const handleSearchUsers = async (pattern: string) => {
    if (!pattern.trim() || pattern.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    
    try {
      setSearchingUser(true);
      
      const users = await searchUsersByPattern(pattern.trim());
      
      // Filter out already added members and self
      const filteredUsers = users.filter(
        u => u.email !== userEmail && !addedMembers.some(m => m.email === u.email)
      );
      
      setSearchResults(filteredUsers);
      setShowDropdown(filteredUsers.length > 0);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setSearchingUser(false);
    }
  };

  const handleSelectUser = async (selectedUser: { uid: string; email: string; name: string; plan: string }) => {
    // Check if would exceed max members limit (owner + members)
    if (addedMembers.length + 1 >= maxMembersPerAccount) {
      showToast(`❌ Maximum ${maxMembersPerAccount} total members per shared account`, "error");
      return;
    }
    
    try {
      // Check user's shared accounts limit
      const userSharedCount = await countUserSharedAccounts(selectedUser.uid);
      const userLimits = await getPlanLimits(selectedUser.plan as any);
      const userMaxShared = userLimits?.sharedAccounts ?? 0;
      
      if (userSharedCount >= userMaxShared) {
        showToast(`❌ ${selectedUser.name} has reached their shared accounts limit (${userSharedCount}/${userMaxShared})`, "error");
        return;
      }
      
      // Add member
      setAddedMembers([...addedMembers, {
        email: selectedUser.email,
        name: selectedUser.name,
        uid: selectedUser.uid,
      }]);
      
      // Reset search
      setInviteEmail("");
      setSearchResults([]);
      setShowDropdown(false);
      
      showToast("✅ Member added to list", "success");
    } catch (error) {
      console.error("Error adding member:", error);
      showToast("❌ Error adding member", "error");
    }
  };
  
  const handleRemoveMember = (email: string) => {
    setAddedMembers(addedMembers.filter(m => m.email !== email));
    showToast("✅ Member removed from list", "success");
  };

  const handleLeaveSharedAccount = async () => {
    if (!selectedAccount) return;

    try {
      await leaveSharedAccount(selectedAccount.id, userId);
      showToast("✅ Left shared account successfully", "success");
      setShowLeaveModal(false);
      setSelectedAccount(null);
      loadData();
    } catch (error: any) {
      console.error("Error leaving shared account:", error);
      showToast(`❌ ${error.message || "Error leaving shared account"}`, "error");
    }
  };

  const handleDeleteSharedAccount = async () => {
    if (!selectedAccount) return;

    try {
      await deleteSharedAccount(selectedAccount.id, userId);
      showToast("✅ Shared account deleted successfully", "success");
      setShowDeleteModal(false);
      setSelectedAccount(null);
      loadData();
    } catch (error: any) {
      console.error("Error deleting shared account:", error);
      showToast(`❌ ${error.message || "Error deleting shared account"}`, "error");
    }
  };

  const handleRemoveMemberFromAccount = async () => {
    if (!selectedAccount || !memberToRemove) return;

    try {
      await removeMemberFromSharedAccount(selectedAccount.id, memberToRemove.userId, userId);
      showToast("✅ Member removed successfully", "success");
      setShowRemoveMemberModal(false);
      setMemberToRemove(null);
      loadData();
    } catch (error: any) {
      console.error("Error removing member:", error);
      showToast(`❌ ${error.message || "Error removing member"}`, "error");
    }
  };

  const handleSearchUsersForInvite = async (pattern: string) => {
    if (!pattern.trim() || pattern.trim().length < 2) {
      setInviteSearchResults([]);
      return;
    }
    
    try {
      setInviteSearching(true);
      
      const users = await searchUsersByPattern(pattern.trim());
      
      // Filter out already members and self
      const currentMemberIds = selectedAccount?.members.map(m => m.userId) || [];
      const filteredUsers = users.filter(
        u => u.email !== userEmail && !currentMemberIds.includes(u.uid)
      );
      
      setInviteSearchResults(filteredUsers);
    } catch (error) {
      console.error("Error searching users:", error);
      setInviteSearchResults([]);
    } finally {
      setInviteSearching(false);
    }
  };

  const handleSendInviteToUser = async (invitedUser: { uid: string; email: string; name: string; plan: string }) => {
    if (!selectedAccount) return;
    
    try {
      // Check if would exceed max members
      if (selectedAccount.members.length >= 10) {
        showToast("❌ Maximum 10 members per shared account", "error");
        return;
      }
      
      // Check user's shared accounts limit
      const userSharedCount = await countUserSharedAccounts(invitedUser.uid);
      const userLimits = await getPlanLimits(invitedUser.plan as any);
      const userMaxShared = userLimits?.sharedAccounts ?? 0;
      
      if (userSharedCount >= userMaxShared) {
        showToast(`❌ ${invitedUser.name} has reached their limit (${userSharedCount}/${userMaxShared})`, "error");
        return;
      }
      
      // Send invite
      await createSharedAccountInvite(
        selectedAccount.id,
        selectedAccount.name,
        userId,
        userEmail,
        userName,
        invitedUser.uid,
        invitedUser.email
      );
      
      showToast("✅ Invite sent successfully!", "success");
      setInviteSearchEmail("");
      setInviteSearchResults([]);
    } catch (error: any) {
      console.error("Error sending invite:", error);
      showToast(`❌ ${error.message || "Error sending invite"}`, "error");
    }
  };

  // For inviting to existing shared accounts (separate modal)
  const handleSearchUserForInvite = async () => {
    if (!inviteEmail.trim() || !selectedAccount) return;

    setSearchingUser(true);
    setSearchResult(null);

    try {
      // Check if user is trying to invite themselves
      if (inviteEmail.toLowerCase() === userEmail.toLowerCase()) {
        setSearchResult({
          found: false,
          canJoin: false,
          message: "You cannot invite yourself",
        });
        setSearchingUser(false);
        return;
      }

      // Search user
      const user = await searchUserByEmail(inviteEmail);

      if (!user) {
        setSearchResult({
          found: false,
          canJoin: false,
          message: "User not found with this email",
        });
        setSearchingUser(false);
        return;
      }

      // Check if already a member
      if (selectedAccount.members.some(m => m.userId === user.uid)) {
        setSearchResult({
          found: true,
          canJoin: false,
          message: "User is already a member of this shared account",
          user: { email: user.email, name: user.name, uid: user.uid },
        });
        setSearchingUser(false);
        return;
      }

      // Get user's plan and check if they can join
      const userData = await getUserDocument(user.uid);
      const userPlanType = (userData?.plan || "free") as "free" | "pro" | "ultra" | "admin";

      if (userPlanType === "free") {
        setSearchResult({
          found: true,
          canJoin: false,
          message: `${user.name} has a Free plan and cannot join shared accounts`,
          user: { email: user.email, name: user.name, uid: user.uid },
        });
        setSearchingUser(false);
        return;
      }

      // Check user's shared accounts count
      const userSharedCount = await countUserSharedAccounts(user.uid);
      const userLimits = await getPlanLimits(userPlanType);
      const userMaxShared = userLimits?.sharedAccounts || 0;

      if (userSharedCount >= userMaxShared) {
        setSearchResult({
          found: true,
          canJoin: false,
          message: `${user.name} has reached their shared accounts limit (${userMaxShared}/${userMaxShared})`,
          user: { email: user.email, name: user.name, uid: user.uid },
        });
        setSearchingUser(false);
        return;
      }

      // User can be invited
      setSearchResult({
        found: true,
        canJoin: true,
        message: `${user.name} can join (${userSharedCount}/${userMaxShared} shared accounts used)`,
        user: { email: user.email, name: user.name, uid: user.uid },
      });
    } catch (error) {
      console.error("Error searching user:", error);
      showToast("❌ Error searching user", "error");
    } finally {
      setSearchingUser(false);
    }
  };

  const handleSendInvite = async () => {
    if (!selectedAccount || !searchResult?.canJoin || !searchResult.user?.uid) return;

    // Validate all required fields
    if (!userId || !userEmail || !userName) {
      showToast("❌ User information is missing. Please refresh the page.", "error");
      return;
    }

    if (!searchResult.user.email) {
      showToast("❌ Invited user email is missing.", "error");
      return;
    }

    try {
      await createSharedAccountInvite(
        selectedAccount.id,
        selectedAccount.name,
        userId,
        userEmail,
        userName,
        searchResult.user.uid,
        searchResult.user.email
      );

      showToast("✅ Invite sent successfully!", "success");
      setShowInviteModal(false);
      setSelectedAccount(null);
      setInviteEmail("");
      setSearchResult(null);
    } catch (error: any) {
      console.error("Error sending invite:", error);
      showToast(`❌ ${error.message || "Error sending invite"}`, "error");
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    // Check if user has reached limit
    if (sharedAccounts.length >= maxSharedAccounts) {
      showToast(`❌ You must leave a shared account first. Your limit is ${maxSharedAccounts}.`, "error");
      return;
    }

    try {
      await acceptSharedAccountInvite(inviteId);
      showToast("✅ Invite accepted!", "success");
      loadData();
    } catch (error: any) {
      console.error("Error accepting invite:", error);
      showToast(`❌ ${error.message || "Error accepting invite"}`, "error");
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    try {
      await rejectSharedAccountInvite(inviteId);
      showToast("✅ Invite rejected", "success");
      loadData();
    } catch (error: any) {
      console.error("Error rejecting invite:", error);
      showToast(`❌ ${error.message || "Error rejecting invite"}`, "error");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`✅ ${label} copied to clipboard`, "success");
  };

  const canCreateSharedAccount = (userPlan === "pro" || userPlan === "ultra" || userPlan === "admin") && sharedAccounts.length < maxSharedAccounts;
  const shouldShowUpgrade = userPlan === "pro" && sharedAccounts.length >= maxSharedAccounts;

  if (userPlan === "free") {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-lg">
            <UserGroupIcon className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-amber-900 mb-1">Shared Accounts - Pro Feature</h3>
            <p className="text-sm text-amber-700 mb-3">
              Upgrade to Pro or Ultra to create and join shared accounts with up to 10 members.
            </p>
            <button
              onClick={() => window.location.href = "/dashboard/plan"}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if limits are initialized
  if (!loading && maxSharedAccounts === 0 && (userPlan === "pro" || userPlan === "ultra" || userPlan === "admin")) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-900 mb-1">Plan Limits Not Configured</h3>
            <p className="text-sm text-red-700 mb-3">
              The shared accounts limit for your plan hasn't been configured yet. Please contact an administrator to initialize the plan limits.
            </p>
            {userPlan === "admin" && (
              <button
                onClick={() => window.location.href = "/dashboard/admin"}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
              >
                Go to Admin Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">Shared Accounts</h2>
          <p className="text-sm text-gray-500 mt-1">
            {sharedAccounts.length} / {maxSharedAccounts} shared accounts
          </p>
        </div>
        {shouldShowUpgrade ? (
          <button
            onClick={() => window.location.href = "/dashboard/plan"}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all animate-pulse flex items-center gap-2"
          >
            <SparklesIcon className="w-5 h-5" />
            Upgrade Plan
          </button>
        ) : (
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!canCreateSharedAccount}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              canCreateSharedAccount
                ? "bg-[#22C55E] hover:bg-[#16A34A] text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <PlusIcon className="w-5 h-5" />
            Create Shared Account
          </button>
        )}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <div className="relative">
                <UserPlusIcon className="w-6 h-6 text-blue-600" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </div>
              Pending Invitations
            </h3>
            <div className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
              {pendingInvites.length}
            </div>
          </div>
          <div className="space-y-3">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="bg-white rounded-xl p-4 border-2 border-blue-100 hover:border-blue-300 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <UserGroupIcon className="w-5 h-5 text-blue-600" />
                      <p className="text-base font-bold text-[#0F172A]">{invite.sharedAccountName}</p>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-semibold">{invite.inviterName}</span> invited you to join
                    </p>
                    <p className="text-xs text-gray-400">{invite.inviterEmail}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptInvite(invite.id)}
                      disabled={sharedAccounts.length >= maxSharedAccounts}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg text-sm font-bold transition-all hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                      title={sharedAccounts.length >= maxSharedAccounts ? `You've reached your limit (${maxSharedAccounts})` : "Accept invitation"}
                    >
                      <CheckIcon className="w-4 h-4" />
                      Accept
                    </button>
                    <button
                      onClick={() => handleRejectInvite(invite.id)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared Accounts List */}
      {sharedAccounts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No shared accounts yet</p>
          <p className="text-xs text-gray-400 mt-1">Create one to start collaborating</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sharedAccounts.map((acc) => acc.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedAccounts.map((account) => {
                const accountType = ACCOUNT_TYPES.find(t => t.value === account.type);
                
                return (
                  <SortableSharedAccountCard
                    key={account.id}
                    account={account}
                    accountType={accountType}
                    userId={userId}
                    formatAmount={formatAmount}
                    formatCompact={formatCompact}
                    showToast={showToast}
                    copyToClipboard={copyToClipboard}
                    AnimatedCounter={AnimatedCounter}
                    onManageClick={async (e: any) => {
                      e.stopPropagation();
                      setSelectedAccount(account);
                      setIsViewOnlyMode(false);
                      setShowManageMembersModal(true);
                      try {
                        const invites = await getSharedAccountInvites(account.id);
                        setSelectedAccountPendingInvites(invites.filter(inv => inv.status === "pending"));
                      } catch (error) {
                        console.error("Error loading invites:", error);
                        setSelectedAccountPendingInvites([]);
                      }
                    }}
                    onDeleteClick={(e: any) => {
                      e.stopPropagation();
                      setSelectedAccount(account);
                      setShowDeleteModal(true);
                    }}
                    onViewClick={async (e: any) => {
                      e.stopPropagation();
                      setSelectedAccount(account);
                      setIsViewOnlyMode(true);
                      setShowManageMembersModal(true);
                      try {
                        const invites = await getSharedAccountInvites(account.id);
                        setSelectedAccountPendingInvites(invites.filter(inv => inv.status === "pending"));
                      } catch (error) {
                        console.error("Error loading invites:", error);
                        setSelectedAccountPendingInvites([]);
                      }
                    }}
                    onLeaveClick={(e: any) => {
                      e.stopPropagation();
                      setSelectedAccount(account);
                      setShowLeaveModal(true);
                    }}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Create Shared Account Modal */}
      <Transition appear show={showCreateModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCreateModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
                  <div className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] p-6">
                    <div className="flex items-center justify-between">
                      <Dialog.Title className="text-2xl font-bold text-white">
                        Create Shared Account
                      </Dialog.Title>
                      <button
                        onClick={() => {
                          setShowCreateModal(false);
                          setCreateForm({
                            name: "",
                            description: "",
                            type: "checking",
                            initialBalance: 0,
                            currency: "EUR",
                            iban: "",
                            bic: "",
                            color: "#3B82F6",
                          });
                          setAddedMembers([]);
                          setInviteEmail("");
                          setSearchResult(null);
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
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        placeholder="E.g. Family Fund"
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={createForm.description}
                        onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
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
                              onClick={() => setCreateForm({ ...createForm, type: type.value as any, color: type.color })}
                              className={`p-4 rounded-xl border-2 transition-all ${
                                createForm.type === type.value
                                  ? "border-[#22C55E] bg-[#22C55E]/5"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <TypeIcon
                                className={`w-6 h-6 mx-auto mb-2 ${
                                  createForm.type === type.value ? "text-[#22C55E]" : "text-gray-400"
                                }`}
                              />
                              <p className={`text-xs font-semibold ${
                                createForm.type === type.value ? "text-[#22C55E]" : "text-gray-600"
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
                          value={createForm.initialBalance}
                          onChange={(e) => setCreateForm({ ...createForm, initialBalance: parseFloat(e.target.value) || 0 })}
                          onWheel={(e) => e.currentTarget.blur()}
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
                        value={createForm.iban}
                        onChange={(e) => setCreateForm({ ...createForm, iban: e.target.value })}
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
                        value={createForm.bic}
                        onChange={(e) => setCreateForm({ ...createForm, bic: e.target.value })}
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
                            onClick={() => setCreateForm({ ...createForm, color })}
                            className={`w-10 h-10 rounded-xl transition-all ${
                              createForm.color === color ? "ring-4 ring-offset-2" : "hover:scale-110"
                            }`}
                            style={{ backgroundColor: color, ringColor: color }}
                          >
                            {createForm.color === color && (
                              <CheckIcon className="w-6 h-6 text-white mx-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600">Custom:</label>
                        <input
                          type="color"
                          value={createForm.color}
                          onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                          className="w-16 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={createForm.color}
                          onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                          placeholder="#000000"
                          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* MEMBERS SECTION - NEW */}
                    <div className="border-t border-gray-200 pt-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-4">
                        Add Members <span className="text-gray-400 font-normal">(Optional - Max {maxMembersPerAccount})</span>
                      </label>
                      
                      {/* Search User */}
                      <div className="space-y-3 mb-4">
                        <div className="relative">
                          <input
                            type="text"
                            value={inviteEmail}
                            onChange={(e) => {
                              const value = e.target.value;
                              setInviteEmail(value);
                              
                              // Clear previous timeout
                              if (searchTimeout) {
                                clearTimeout(searchTimeout);
                              }
                              
                              // Debounce search (300ms)
                              const timeout = setTimeout(() => {
                                handleSearchUsers(value);
                              }, 300);
                              
                              setSearchTimeout(timeout);
                            }}
                            onFocus={() => {
                              if (searchResults.length > 0) {
                                setShowDropdown(true);
                              }
                            }}
                            onBlur={() => {
                              // Delay to allow click on dropdown
                              setTimeout(() => setShowDropdown(false), 200);
                            }}
                            placeholder="Type to search users (min 2 chars)..."
                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#22C55E] text-[#0F172A]"
                          />
                          {searchingUser && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-5 h-5 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                          
                          {/* Dropdown Results */}
                          {showDropdown && searchResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                              {searchResults.map((user) => (
                                <button
                                  key={user.uid}
                                  onClick={() => handleSelectUser(user)}
                                  className="w-full px-4 py-3 hover:bg-[#22C55E]/5 transition-colors text-left border-b border-gray-100 last:border-0"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold text-[#0F172A]">{user.name}</p>
                                      <p className="text-xs text-gray-600">{user.email}</p>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                                      user.plan === "ultra" ? "bg-purple-100 text-purple-700" :
                                      user.plan === "pro" ? "bg-blue-100 text-blue-700" :
                                      "bg-gray-100 text-gray-700"
                                    }`}>
                                      {user.plan.toUpperCase()}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* No results message */}
                          {showDropdown && !searchingUser && inviteEmail.length >= 2 && searchResults.length === 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-amber-200 rounded-xl shadow-xl p-4">
                              <p className="text-sm text-amber-700">
                                ❌ No users found. Users must have Pro/Ultra plan and enable discovery in settings.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Added Members List */}
                      {addedMembers.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-600 mb-2">
                            Added Members ({addedMembers.length}/{maxMembersPerAccount - 1})
                          </p>
                          {addedMembers.map((member) => (
                            <div
                              key={member.email}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
                            >
                              <div>
                                <p className="text-sm font-semibold text-[#0F172A]">{member.name}</p>
                                <p className="text-xs text-gray-500">{member.email}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveMember(member.email)}
                                className="p-2 hover:bg-red-100 rounded-lg transition-colors group"
                              >
                                <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Info */}
                      <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-xs text-blue-700">
                          💡 You (owner) + {addedMembers.length} member{addedMembers.length !== 1 ? 's' : ''} = {addedMembers.length + 1} total
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => {
                          setShowCreateModal(false);
                          setCreateForm({
                            name: "",
                            description: "",
                            type: "checking",
                            initialBalance: 0,
                            currency: "EUR",
                            iban: "",
                            bic: "",
                            color: "#3B82F6",
                          });
                          setAddedMembers([]);
                          setInviteEmail("");
                          setSearchResult(null);
                        }}
                        className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateSharedAccount}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                      >
                        Create Shared Account
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Invite User Modal */}
      <Transition appear show={showInviteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          setShowInviteModal(false);
          setInviteEmail("");
          setSearchResult(null);
        }}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
                  <div className="bg-blue-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <Dialog.Title className="text-lg font-semibold text-white">
                        Invite User
                      </Dialog.Title>
                      <button
                        onClick={() => {
                          setShowInviteModal(false);
                          setInviteEmail("");
                          setSearchResult(null);
                        }}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <XMarkIcon className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {selectedAccount && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <p className="text-xs text-gray-500 mb-1">Inviting to:</p>
                        <p className="text-sm font-bold text-[#0F172A]">{selectedAccount.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedAccount.members?.length || 0} / 10 members
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        User Email
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => {
                            setInviteEmail(e.target.value);
                            setSearchResult(null);
                          }}
                          className="flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="user@example.com"
                        />
                        <button
                          onClick={handleSearchUserForInvite}
                          disabled={!inviteEmail.trim() || searchingUser}
                          className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {searchingUser ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <MagnifyingGlassIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {searchResult && (
                      <div className={`p-4 rounded-lg ${
                        searchResult.canJoin
                          ? "bg-green-50 border-2 border-green-200"
                          : "bg-red-50 border-2 border-red-200"
                      }`}>
                        <p className={`text-sm font-semibold mb-1 ${
                          searchResult.canJoin ? "text-green-900" : "text-red-900"
                        }`}>
                          {searchResult.found ? (searchResult.canJoin ? "✅ User Found" : "⚠️ Cannot Invite") : "❌ User Not Found"}
                        </p>
                        <p className={`text-xs ${
                          searchResult.canJoin ? "text-green-700" : "text-red-700"
                        }`}>
                          {searchResult.message}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 px-6 pb-6">
                    <button
                      onClick={() => {
                        setShowInviteModal(false);
                        setInviteEmail("");
                        setSearchResult(null);
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendInvite}
                      disabled={!searchResult?.canJoin}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Send Invite
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Manage Members Modal */}
      <Transition appear show={showManageMembersModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          setShowManageMembersModal(false);
          setInviteSearchEmail("");
          setInviteSearchResults([]);
        }}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Dialog.Title className="text-xl font-bold text-white">
                          {isViewOnlyMode ? "View Members" : "Manage Members"}
                        </Dialog.Title>
                        <p className="text-sm text-blue-100 mt-1">{selectedAccount?.name}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowManageMembersModal(false);
                          setInviteSearchEmail("");
                          setInviteSearchResults([]);
                          setIsViewOnlyMode(false);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <XMarkIcon className="w-6 h-6 text-white" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Current Members */}
                    <div>
                      <h3 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                        <UserGroupIcon className="w-5 h-5 text-gray-500" />
                        Current Members ({selectedAccount?.members?.length || 0}/10)
                      </h3>
                      <div className="space-y-2">
                        {selectedAccount?.members.map((member) => {
                          const isOwner = member.userId === selectedAccount.ownerId;
                          return (
                            <div
                              key={member.userId}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <span className="text-sm font-bold text-blue-600">
                                    {(member.name || member.email).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                                    {member.name || member.email}
                                    {isOwner && (
                                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">
                                        OWNER
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-gray-500">{member.email}</p>
                                </div>
                              </div>
                              {!isOwner && !isViewOnlyMode && (
                                <button
                                  onClick={() => {
                                    setMemberToRemove({
                                      userId: member.userId,
                                      email: member.email,
                                      name: member.name || member.email,
                                    });
                                    setShowRemoveMemberModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pending Invites */}
                    {selectedAccountPendingInvites.length > 0 && (
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                          <ClockIcon className="w-5 h-5 text-amber-600" />
                          Pending Invites ({selectedAccountPendingInvites.length})
                        </h3>
                        <div className="space-y-2">
                          {selectedAccountPendingInvites.map((invite) => (
                            <div
                              key={invite.id}
                              className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                  <ClockIcon className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-[#0F172A]">
                                    {invite.invitedEmail}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Invited by {invite.inviterEmail}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-bold">
                                  PENDING
                                </span>
                                {!isViewOnlyMode && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await rejectSharedAccountInvite(invite.id);
                                        showToast("✅ Invite cancelled", "success");
                                        // Reload invites
                                        const invites = await getSharedAccountInvites(selectedAccount!.id);
                                        setSelectedAccountPendingInvites(invites.filter(inv => inv.status === "pending"));
                                      } catch (error: any) {
                                        console.error("Error cancelling invite:", error);
                                        showToast(`❌ ${error.message || "Error cancelling invite"}`, "error");
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Invite New Members - Only for owner */}
                    {!isViewOnlyMode && (selectedAccount?.members?.length || 0) < 10 && (
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                          <UserPlusIcon className="w-5 h-5 text-green-600" />
                          Invite New Members
                        </h3>
                        
                        <div className="relative mb-3">
                          <input
                            type="text"
                            value={inviteSearchEmail}
                            onChange={(e) => {
                              const value = e.target.value;
                              setInviteSearchEmail(value);
                              
                              // Clear previous timeout
                              if (inviteSearchTimeout) {
                                clearTimeout(inviteSearchTimeout);
                              }
                              
                              // Debounce search (300ms)
                              const timeout = setTimeout(() => {
                                handleSearchUsersForInvite(value);
                              }, 300);
                              
                              setInviteSearchTimeout(timeout);
                            }}
                            placeholder="Type to search users (min 2 chars)..."
                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#0F172A]"
                          />
                          {inviteSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>

                        {/* Search Results Dropdown */}
                        {inviteSearchResults.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {inviteSearchResults.map((user) => (
                              <div
                                key={user.uid}
                                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                              >
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-[#0F172A]">{user.name}</p>
                                  <p className="text-xs text-gray-600">{user.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                                    user.plan === "ultra" ? "bg-purple-100 text-purple-700" :
                                    user.plan === "pro" ? "bg-blue-100 text-blue-700" :
                                    "bg-gray-100 text-gray-700"
                                  }`}>
                                    {user.plan.toUpperCase()}
                                  </span>
                                  <button
                                    onClick={() => handleSendInviteToUser(user)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Send Invite
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* No results message */}
                        {!inviteSearching && inviteSearchEmail.length >= 2 && inviteSearchResults.length === 0 && (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-sm text-amber-700">
                              ❌ No users found. Users must have Pro/Ultra plan, enable discovery, and not exceed their limit.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Leave Confirmation Modal */}
      <Transition appear show={showLeaveModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowLeaveModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                        <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-bold text-[#0F172A]">
                          Leave Shared Account?
                        </Dialog.Title>
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedAccount?.name}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-6">
                      You will no longer have access to this shared account and its transactions.
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowLeaveModal(false)}
                        className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleLeaveSharedAccount}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Confirmation Modal */}
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <TrashIcon className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-bold text-[#0F172A]">
                          Delete Shared Account?
                        </Dialog.Title>
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedAccount?.name}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-6">
                      This will remove all members and permanently delete this shared account. 
                      This action cannot be undone.
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteSharedAccount}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Remove Member Confirmation Modal */}
      <Transition appear show={showRemoveMemberModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowRemoveMemberModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <UserGroupIcon className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-bold text-[#0F172A]">
                          Remove Member?
                        </Dialog.Title>
                        <p className="text-sm text-gray-600 mt-1">
                          {memberToRemove?.name || memberToRemove?.email}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-6">
                      This user will lose access to <strong>{selectedAccount?.name}</strong> and its transactions.
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowRemoveMemberModal(false);
                          setMemberToRemove(null);
                        }}
                        className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRemoveMemberFromAccount}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Remove Member
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

