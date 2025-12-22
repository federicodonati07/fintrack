import { Timestamp } from "firebase/firestore";

export type UserRole = "user" | "admin";
export type PlanType = "free" | "pro" | "ultra";
export type PlanInterval = "monthly" | "yearly";
export type CardType = "debit" | "credit";
export type TransactionType = "add" | "remove" | "edit";
export type RecurringInterval = "monthly" | "yearly";

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

export interface Transaction {
  type: TransactionType;
  amount: number;
  reason: string;
  previousAmount?: number;
  newAmount?: number;
  createdAt: Timestamp;
}

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
