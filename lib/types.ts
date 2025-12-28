import { Timestamp } from "firebase/firestore";

export type UserRole = "user" | "admin";
export type PlanType = "free" | "pro" | "ultra" | "admin";
export type PlanInterval = "monthly" | "yearly";
export type CardType = "debit" | "credit";
export type TransactionType = "income" | "expense" | "transfer" | "partition_creation" | "partition_transfer_to" | "partition_transfer_from";
export type RecurringInterval = "daily" | "weekly" | "monthly" | "yearly";
export type IncomeCategory = "salary" | "investment" | "generic_return" | "other";
export type TransactionStatus = "completed" | "scheduled" | "cancelled";
export type InterestFrequency = "daily" | "monthly" | "yearly";
export type AssetType = "etf" | "bond" | "stock";
export type SubAccountType = "savings" | "investment";
export type SharedAccountInviteStatus = "pending" | "accepted" | "rejected";

export interface User {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: UserRole;
  plan: PlanType;
  planInterval: PlanInterval;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  allowSharedAccountDiscovery?: boolean; // Privacy setting for shared account search (default: false)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Fund {
  name: string;
  description?: string;
  balance: number;
  iban?: string;
  cards?: Card[];
  color?: string;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Card {
  id: string;
  type: CardType;
  last4: string;
  brand: string;
}

// New unified transaction interface
export interface Transaction {
  id: string;
  type: TransactionType; // "income" | "expense" | "transfer"
  amount: number;
  accountId: string; // Main account for income/expense, source for transfer
  toAccountId?: string; // Only for transfers
  sharedAccountId?: string; // Shared account ID (if transaction is for a shared account)
  category?: string; // Category ID for expenses, income category for income
  incomeCategory?: IncomeCategory; // Specific category for income
  description: string;
  date: Timestamp; // Date of the transaction
  status: TransactionStatus;
  
  // Sub-account fields (for internal portfolio transactions)
  subAccountId?: string; // Source sub-account ID
  toSubAccountId?: string; // Destination sub-account ID (for internal transfers)
  isInterestPayment?: boolean; // True if this is an automatic interest payment
  isInternalTransaction?: boolean; // True if transaction is within sub-accounts
  
  // Recurring transaction fields
  isRecurring: boolean;
  recurringInterval?: RecurringInterval;
  nextScheduledDate?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Backward compatibility (deprecated - use Transaction instead)
export interface Expense {
  fundId?: string;
  amount: number;
  category: string;
  note?: string;
  isRecurring: boolean;
  recurringInterval?: RecurringInterval;
  date: Timestamp;
  createdAt: Timestamp;
}

export interface Income {
  fundId?: string;
  amount: number;
  source: string;
  note?: string;
  isRecurring: boolean;
  recurringInterval?: RecurringInterval;
  date: Timestamp;
  createdAt: Timestamp;
}

export interface Goal {
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Timestamp;
  completed: boolean;
  createdAt: Timestamp;
}

export interface Category {
  name: string;
  type: "fixed" | "variable" | "custom";
  color?: string;
  icon?: string;
  budget?: number;
  archived: boolean;
  createdAt: Timestamp;
}

export interface Account {
  id: string;
  name: string;
  description: string;
  type: "checking" | "savings" | "investment" | "wallet" | "credit_card" | "other";
  initialBalance: number;
  currentBalance: number;
  currency: string;
  iban?: string;
  bic?: string;
  color?: string;
  icon?: string;
  archived: boolean;
  hasSubAccounts?: boolean; // Indica se questo account ha partizioni
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Sub-Account base interface
export interface SubAccount {
  id: string;
  parentAccountId: string;
  name: string;
  type: SubAccountType;
  balance: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Savings sub-account with interest
export interface SavingsSubAccount extends SubAccount {
  type: "savings";
  interestRate: number; // Annual interest rate (e.g., 3.5 for 3.5%)
  interestFrequency: InterestFrequency;
  startDate: Timestamp;
  lastInterestDate?: Timestamp;
  nextInterestDate?: Timestamp;
  totalInterestEarned: number;
}

// Investment holding (ETF, Bond, Stock)
export interface InvestmentHolding {
  id: string;
  assetType: AssetType;
  ticker: string; // Symbol/Ticker (e.g., VWCE, BTP, AAPL)
  name: string; // Full name
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  percentage: number; // Percentage of investment sub-account
  totalValue: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Investment sub-account (PAC - Piano di Accumulo)
export interface InvestmentSubAccount extends SubAccount {
  type: "investment";
  holdings: InvestmentHolding[];
  totalInvested: number;
  totalValue: number;
  totalReturn: number; // Gain/Loss
  totalReturnPercentage: number;
}

export interface Budget {
  categoryId: string;
  amount: number;
  spent: number;
  period: "monthly" | "yearly";
  alertThreshold?: number; // Percentage (e.g., 80 = alert at 80%)
  alertEnabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Automation {
  name: string;
  type: "recurring" | "rule";
  enabled: boolean;
  // For recurring expenses
  expenseTemplate?: {
    amount: number;
    category: string;
    fundId?: string;
    note?: string;
  };
  interval?: RecurringInterval;
  nextExecution?: Timestamp;
  // For smart rules (IF → THEN)
  rule?: {
    condition: {
      field: string; // e.g., "amount", "category"
      operator: "equals" | "greaterThan" | "lessThan" | "contains";
      value: string | number;
    };
    action: {
      type: "categorize" | "notify" | "tag";
      value: string;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Integration {
  type: "bank" | "csv" | "api";
  name: string;
  enabled: boolean;
  credentials?: {
    apiKey?: string;
    bankId?: string;
  };
  lastSync?: Timestamp;
  createdAt: Timestamp;
}

export interface PlanLimits {
  plan: PlanType;
  limits: {
    accounts: number;
    categories: number;
    goals: number;
    automations: number;
    sharedAccounts: number; // Max shared accounts user can participate in
    maxMembersPerSharedAccount: number; // Max members per each shared account
  };
  features: string[];
  updatedAt: Timestamp;
}

export interface PromoCode {
  code: string;
  discountPercent: number;
  discountAmount?: number;
  validUntil?: Timestamp;
  maxUses: number;
  currentUses: number;
  applicablePlans: PlanType[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Shared Account (Conto Congiunto)
export interface SharedAccount {
  id: string;
  name: string;
  description: string;
  type: "checking" | "savings" | "investment" | "wallet" | "credit_card" | "other";
  currentBalance: number;
  currency: string;
  iban?: string;
  bic?: string;
  color?: string;
  icon?: string;
  archived: boolean;
  
  // Members management
  members: Array<{ userId: string; email: string; role: "owner" | "member" }>; // Max 10 members
  ownerId: string; // User ID of the creator/owner (for permissions)
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Shared Account Invite
export interface SharedAccountInvite {
  id: string;
  sharedAccountId: string;
  sharedAccountName: string;
  inviterUserId: string;
  inviterEmail: string;
  inviterName: string;
  invitedUserId: string;
  invitedEmail: string;
  status: SharedAccountInviteStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
