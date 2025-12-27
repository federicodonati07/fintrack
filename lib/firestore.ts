import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  deleteDoc,
  getDocs,
  writeBatch,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { User, Category, Fund, Goal, PlanLimits, PromoCode, Account } from "./types";
import { 
  User as FirebaseUser, 
  deleteUser, 
  reauthenticateWithCredential,
  EmailAuthProvider 
} from "firebase/auth";

/**
 * Create or update user document in Firestore
 */
export async function createUserDocument(
  firebaseUser: FirebaseUser
): Promise<void> {
  if (!firebaseUser) {
    throw new Error("User is required");
  }

  const userRef = doc(db, "users", firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  // If user doesn't exist, create new document and initialize data structures
  if (!userSnap.exists()) {
    const userData: Omit<User, "createdAt" | "updatedAt"> = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      name: firebaseUser.displayName || "",
      photoURL: firebaseUser.photoURL || "",
      role: "user",
      plan: "free",
      planInterval: "monthly",
      stripeCustomerId: "",
      stripeSubscriptionId: "",
    };

    // Create user document
    await setDoc(userRef, {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Initialize default categories
    await initializeDefaultCategories(firebaseUser.uid);

    // Initialize default fund
    await initializeDefaultFund(firebaseUser.uid);

    // Initialize default goal (Emergency Fund)
    await initializeDefaultGoal(firebaseUser.uid);
  } else {
    // Update existing user document with latest info from Firebase Auth
    await setDoc(
      userRef,
      {
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || "",
        photoURL: firebaseUser.photoURL || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

/**
 * Initialize default categories for new user
 */
async function initializeDefaultCategories(userId: string): Promise<void> {
  const defaultCategories: Omit<Category, "createdAt">[] = [
    // Fixed expenses
    { name: "Rent", type: "fixed", color: "#EF4444", archived: false },
    { name: "Utilities", type: "fixed", color: "#F59E0B", archived: false },
    { name: "Insurance", type: "fixed", color: "#10B981", archived: false },
    { name: "Subscriptions", type: "fixed", color: "#3B82F6", archived: false },
    
    // Variable expenses
    { name: "Groceries", type: "variable", color: "#22C55E", archived: false },
    { name: "Transportation", type: "variable", color: "#06B6D4", archived: false },
    { name: "Entertainment", type: "variable", color: "#8B5CF6", archived: false },
    { name: "Shopping", type: "variable", color: "#EC4899", archived: false },
    { name: "Health", type: "variable", color: "#14B8A6", archived: false },
    { name: "Dining Out", type: "variable", color: "#F97316", archived: false },
  ];

  const categoriesRef = collection(db, "users", userId, "categories");
  
  for (const category of defaultCategories) {
    const categoryDoc = doc(categoriesRef);
    await setDoc(categoryDoc, {
      ...category,
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Initialize default fund for new user
 */
async function initializeDefaultFund(userId: string): Promise<void> {
  // No default account created - users start from zero
  // The accounts collection will be empty until the user creates their first account
  return;
}

/**
 * Initialize default goal for new user
 */
async function initializeDefaultGoal(userId: string): Promise<void> {
  const defaultGoal: Omit<Goal, "createdAt"> = {
    name: "Emergency Fund",
    targetAmount: 5000,
    currentAmount: 0,
    completed: false,
  };

  const goalsRef = collection(db, "users", userId, "goals");
  const goalDoc = doc(goalsRef);
  
  await setDoc(goalDoc, {
    ...defaultGoal,
    createdAt: serverTimestamp(),
  });
}

/**
 * Get user document from Firestore
 */
export async function getUserDocument(
  userId: string
): Promise<User | null> {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as User;
  }

  return null;
}

/**
 * Update user plan and subscription info
 */
export async function updateUserPlan(opts: {
  userId: string;
  plan: User["plan"];
  planInterval: User["planInterval"];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) {
  const { userId, plan, planInterval, stripeCustomerId, stripeSubscriptionId } =
    opts;

  console.log(`🔄 Updating plan for user ${userId}:`, {
    plan,
    planInterval,
    stripeCustomerId: stripeCustomerId ? "✅ Present" : "❌ Missing",
    stripeSubscriptionId: stripeSubscriptionId ? "✅ Present" : "❌ Missing",
  });

  const userRef = doc(db, "users", userId);
  
  const updateData: any = {
    plan,
    planInterval,
    updatedAt: serverTimestamp(),
  };

  // Only update Stripe fields if they are provided
  if (stripeCustomerId !== undefined) {
    updateData.stripeCustomerId = stripeCustomerId;
  }
  
  if (stripeSubscriptionId !== undefined) {
    updateData.stripeSubscriptionId = stripeSubscriptionId;
  }

  await updateDoc(userRef, updateData);
  
  console.log(`✅ Successfully updated plan for user ${userId} to ${plan} (${planInterval})`);
}

/**
 * Update user currency preference
 */
export async function updateUserCurrency(
  userId: string,
  currency: string
): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    currency,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete user account completely (Auth + Firestore data)
 * Requires password for re-authentication
 */
export async function deleteUserAccount(
  firebaseUser: FirebaseUser,
  password: string
): Promise<void> {
  if (!firebaseUser) {
    throw new Error("User is required");
  }

  if (!firebaseUser.email) {
    throw new Error("User email is required");
  }

  const userId = firebaseUser.uid;

  try {
    // Re-authenticate user before deletion (Firebase security requirement)
    const credential = EmailAuthProvider.credential(
      firebaseUser.email,
      password
    );
    await reauthenticateWithCredential(firebaseUser, credential);

    // Get user document to check for active subscription
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const stripeSubscriptionId = userData?.stripeSubscriptionId;
      
      // Cancel Stripe subscription if exists
      if (stripeSubscriptionId) {
        try {
          const response = await fetch('/api/stripe/cancel-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              subscriptionId: stripeSubscriptionId,
              immediate: true, // Cancel immediately for account deletion
            }),
          });

          if (!response.ok) {
            console.error('Failed to cancel Stripe subscription:', await response.text());
            // Continue with account deletion even if subscription cancellation fails
          } else {
            const result = await response.json();
            console.log('✅ Stripe subscription cancelled successfully:', result.message);
          }
        } catch (error) {
          console.error('Error cancelling Stripe subscription:', error);
          // Continue with account deletion even if subscription cancellation fails
        }
      }
    }

    // Delete all user subcollections and documents
    await deleteAllUserData(userId);

    // Delete user document
    await deleteDoc(userRef);

    // Delete user from Firebase Authentication
    await deleteUser(firebaseUser);
  } catch (error: any) {
    console.error("Error deleting user account:", error);
    
    // Provide user-friendly error messages
    if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      throw new Error("Password non corretta. Riprova.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Troppi tentativi. Riprova più tardi.");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Errore di rete. Controlla la connessione.");
    } else if (error.code === "auth/requires-recent-login") {
      throw new Error("Devi effettuare nuovamente il login prima di eliminare l'account.");
    }
    
    throw error;
  }
}

/**
 * Delete all user data from Firestore
 */
async function deleteAllUserData(userId: string): Promise<void> {
  const batch = writeBatch(db);
  
  // List of subcollections to delete
  const subcollections = [
    "funds",
    "transactions",
    "expenses",
    "incomes",
    "goals",
    "categories",
    "budgets",
    "automations",
    "integrations",
  ];

  // Delete all documents in each subcollection
  for (const subcollection of subcollections) {
    const collectionRef = collection(db, "users", userId, subcollection);
    const snapshot = await getDocs(collectionRef);
    
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
  }

  // Delete nested transactions in funds
  const fundsRef = collection(db, "users", userId, "funds");
  const fundsSnapshot = await getDocs(fundsRef);
  
  for (const fundDoc of fundsSnapshot.docs) {
    const transactionsRef = collection(
      db,
      "users",
      userId,
      "funds",
      fundDoc.id,
      "transactions"
    );
    const transactionsSnapshot = await getDocs(transactionsRef);
    
    transactionsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
  }

  // Commit all deletions
  await batch.commit();
}

// ==================== CATEGORY OPERATIONS ====================

/**
 * Get all categories for a user
 */
export async function getUserCategories(userId: string): Promise<(Category & { id: string })[]> {
  const categoriesRef = collection(db, "users", userId, "categories");
  const snapshot = await getDocs(categoriesRef);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data() as Category,
  }));
}

/**
 * Create a new category
 */
export async function createCategory(
  userId: string,
  category: Omit<Category, "createdAt">
): Promise<string> {
  const categoriesRef = collection(db, "users", userId, "categories");
  const categoryDoc = doc(categoriesRef);
  
  await setDoc(categoryDoc, {
    ...category,
    createdAt: serverTimestamp(),
  });
  
  return categoryDoc.id;
}

/**
 * Update an existing category
 */
export async function updateCategory(
  userId: string,
  categoryId: string,
  updates: Partial<Omit<Category, "createdAt">>
): Promise<void> {
  const categoryRef = doc(db, "users", userId, "categories", categoryId);
  await updateDoc(categoryRef, updates);
}

/**
 * Delete a category
 */
export async function deleteCategory(
  userId: string,
  categoryId: string
): Promise<void> {
  const categoryRef = doc(db, "users", userId, "categories", categoryId);
  await deleteDoc(categoryRef);
}

// ==================== FUND OPERATIONS ====================

/**
 * Get all funds for a user
 */
export async function getUserFunds(userId: string): Promise<(Fund & { id: string })[]> {
  const fundsRef = collection(db, "users", userId, "funds");
  const snapshot = await getDocs(fundsRef);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data() as Fund,
  }));
}

// ==================== PLAN LIMITS OPERATIONS ====================

/**
 * Get plan limits from Firestore
 * Falls back to default limits if not found
 */
export async function getPlanLimits(plan: "free" | "pro" | "ultra" | "admin"): Promise<PlanLimits["limits"]> {
  try {
    const limitsRef = doc(db, "planLimits", plan);
    const limitsSnap = await getDoc(limitsRef);
    
    if (limitsSnap.exists()) {
      const data = limitsSnap.data() as PlanLimits;
      return data.limits;
    }
    
    // Fallback to default limits
    return getDefaultLimits(plan);
  } catch (error) {
    console.error("Error fetching plan limits:", error);
    return getDefaultLimits(plan);
  }
}

/**
 * Default limits as fallback
 */
function getDefaultLimits(plan: "free" | "pro" | "ultra" | "admin"): PlanLimits["limits"] {
  switch (plan) {
    case "admin":
      return {
        accounts: 999,
        categories: 999,
        goals: 999,
        automations: 999,
      };
    case "ultra":
      return {
        accounts: 10,
        categories: 50,
        goals: 20,
        automations: 20,
      };
    case "pro":
      return {
        accounts: 3,
        categories: 15,
        goals: 10,
        automations: 10,
      };
    default: // free
      return {
        accounts: 1,
        categories: 10,
        goals: 3,
        automations: 2,
      };
  }
}

/**
 * Initialize default plan limits (Admin only)
 */
export async function initializePlanLimits(): Promise<void> {
  const plans: Array<"free" | "pro" | "ultra" | "admin"> = ["free", "pro", "ultra", "admin"];
  
  for (const plan of plans) {
    const limitsRef = doc(db, "planLimits", plan);
    const limitsSnap = await getDoc(limitsRef);
    
    if (!limitsSnap.exists()) {
      const defaultLimits = getDefaultLimits(plan);
      await setDoc(limitsRef, {
        plan,
        limits: defaultLimits,
        features: getPlanFeatures(plan),
        updatedAt: serverTimestamp(),
      });
    }
  }
}

/**
 * Get plan features
 */
function getPlanFeatures(plan: "free" | "pro" | "ultra" | "admin"): string[] {
  switch (plan) {
    case "admin":
      return [
        "All Ultra features",
        "Admin dashboard",
        "User management",
        "Plan limits management",
        "Stripe integration control",
        "Promo codes management",
        "System analytics",
      ];
    case "ultra":
      return [
        "10 accounts",
        "50 categories",
        "20 goals",
        "20 automations",
        "Advanced analytics",
        "Priority support",
        "Custom reports",
      ];
    case "pro":
      return [
        "3 accounts",
        "15 categories",
        "10 goals",
        "10 automations",
        "Goal tracking",
        "Automated rules",
      ];
    default:
      return [
        "1 account",
        "10 categories",
        "3 goals",
        "2 automations",
        "Basic tracking",
      ];
  }
}

/**
 * Update plan limits (Admin only)
 */
export async function updatePlanLimits(
  plan: "free" | "pro" | "ultra" | "admin",
  limits: Partial<PlanLimits["limits"]>
): Promise<void> {
  const limitsRef = doc(db, "planLimits", plan);
  await updateDoc(limitsRef, {
    limits,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get all plan limits (Admin only)
 */
export async function getAllPlanLimits(): Promise<Record<string, PlanLimits>> {
  const limitsRef = collection(db, "planLimits");
  const snapshot = await getDocs(limitsRef);
  
  const limits: Record<string, PlanLimits> = {};
  snapshot.docs.forEach((doc) => {
    limits[doc.id] = doc.data() as PlanLimits;
  });
  
  return limits;
}

// ==================== PROMO CODE OPERATIONS (Admin only) ====================

/**
 * Create promo code
 */
export async function createPromoCode(code: string, data: Omit<PromoCode, "createdAt" | "updatedAt">): Promise<void> {
  const promoRef = doc(db, "promoCodes", code);
  await setDoc(promoRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get promo code
 */
export async function getPromoCode(code: string): Promise<PromoCode | null> {
  const promoRef = doc(db, "promoCodes", code);
  const promoSnap = await getDoc(promoRef);
  
  if (promoSnap.exists()) {
    return promoSnap.data() as PromoCode;
  }
  
  return null;
}

/**
 * Get all promo codes (Admin only)
 */
export async function getAllPromoCodes(): Promise<(PromoCode & { id: string })[]> {
  const promosRef = collection(db, "promoCodes");
  const snapshot = await getDocs(promosRef);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data() as PromoCode,
  }));
}

/**
 * Get all users (Admin only)
 */
export async function getAllUsers(): Promise<(User & { uid: string })[]> {
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);
  
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data() as User,
  }));
}

/**
 * Update user plan and role (Admin only)
 */
export async function updateUserPlanAdmin(
  userId: string,
  plan: "free" | "pro" | "ultra" | "admin",
  role?: "user" | "admin"
): Promise<void> {
  const userRef = doc(db, "users", userId);
  const updateData: any = {
    plan,
    updatedAt: serverTimestamp(),
  };
  
  if (role !== undefined) {
    updateData.role = role;
  }
  
  await updateDoc(userRef, updateData);
}

/**
 * Delete user data (Admin only - doesn't delete Firebase Auth user)
 */
export async function deleteUserDataAdmin(userId: string): Promise<void> {
  const batch = writeBatch(db);
  
  // Delete all subcollections
  const subcollections = ['categories', 'funds', 'goals', 'expenses', 'incomes', 'transactions', 'accounts'];
  
  for (const subcollection of subcollections) {
    const subcollectionRef = collection(db, "users", userId, subcollection);
    const snapshot = await getDocs(subcollectionRef);
    snapshot.docs.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
    });
  }
  
  // Delete user document
  const userRef = doc(db, "users", userId);
  batch.delete(userRef);
  
  await batch.commit();
}

/**
 * CRUD operations for Accounts
 */

/**
 * Get all accounts for a user
 */
export async function getAccounts(userId: string) {
  const accountsRef = collection(db, "users", userId, "accounts");
  const snapshot = await getDocs(accountsRef);
  
  const accounts: any[] = [];
  snapshot.forEach((doc) => {
    accounts.push({ id: doc.id, ...doc.data() });
  });
  
  // Sort by custom order if available, otherwise by creation date
  return accounts.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
    const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
    return dateB - dateA;
  });
}

/**
 * Update account order for drag-and-drop
 */
export async function updateAccountsOrder(
  userId: string,
  accountIds: string[]
): Promise<void> {
  const batch = writeBatch(db);

  accountIds.forEach((accountId, index) => {
    const accountRef = doc(db, "users", userId, "accounts", accountId);
    batch.update(accountRef, { order: index });
  });

  await batch.commit();
}

/**
 * Save user's analytics dashboard configuration
 */
export async function saveAnalyticsConfig(
  userId: string,
  config: { visibleCharts: string[]; chartOrder: string[] }
): Promise<void> {
  const configRef = doc(db, "users", userId, "settings", "analytics");
  await setDoc(configRef, {
    ...config,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get user's analytics dashboard configuration
 */
export async function getAnalyticsConfig(userId: string): Promise<any> {
  const configRef = doc(db, "users", userId, "settings", "analytics");
  const configSnap = await getDoc(configRef);
  return configSnap.exists() ? configSnap.data() : null;
}

/**
 * Create a new account
 */
export async function createAccount(
  userId: string,
  accountData: {
    name: string;
    description: string;
    type: "checking" | "savings" | "investment" | "wallet" | "credit_card" | "other";
    initialBalance: number;
    currency: string;
    iban?: string;
    bic?: string;
    color?: string;
    icon?: string;
  }
) {
  const accountsRef = collection(db, "users", userId, "accounts");
  const newAccountRef = doc(accountsRef);
  
  await setDoc(newAccountRef, {
    ...accountData,
    currentBalance: accountData.initialBalance,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  // Create initial balance transaction if balance > 0
  if (accountData.initialBalance > 0) {
    const transactionsRef = collection(db, "users", userId, "transactions");
    const newTransactionRef = doc(transactionsRef);
    
    await setDoc(newTransactionRef, {
      type: "income",
      amount: accountData.initialBalance,
      accountId: newAccountRef.id,
      incomeCategory: "other",
      description: `Initial balance for ${accountData.name}`,
      date: serverTimestamp(),
      status: "completed",
      isRecurring: false,
      isInitialBalance: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  
  return newAccountRef.id;
}

/**
 * Update an account
 */
export async function updateAccount(
  userId: string,
  accountId: string,
  accountData: Partial<{
    name: string;
    description: string;
    type: "checking" | "savings" | "investment" | "wallet" | "credit_card" | "other";
    currentBalance: number;
    currency: string;
    iban: string;
    bic: string;
    color: string;
    icon: string;
    archived: boolean;
  }>
) {
  const accountRef = doc(db, "users", userId, "accounts", accountId);
  await updateDoc(accountRef, {
    ...accountData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an account
 */
export async function deleteAccount(userId: string, accountId: string) {
  const accountRef = doc(db, "users", userId, "accounts", accountId);
  await deleteDoc(accountRef);
}

/**
 * Update account balance
 */
export async function updateAccountBalance(
  userId: string,
  accountId: string,
  amount: number,
  type: "add" | "subtract"
) {
  const accountRef = doc(db, "users", userId, "accounts", accountId);
  const accountSnap = await getDoc(accountRef);
  
  if (!accountSnap.exists()) {
    throw new Error("Account not found");
  }
  
  const currentBalance = accountSnap.data().currentBalance || 0;
  const newBalance = type === "add" ? currentBalance + amount : currentBalance - amount;
  
  await updateDoc(accountRef, {
    currentBalance: newBalance,
    updatedAt: serverTimestamp(),
  });
  
  return newBalance;
}

/**
 * Transfer funds between accounts
 */
export async function transferBetweenAccounts(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number
) {
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }
  
  // Get both accounts
  const fromAccountRef = doc(db, "users", userId, "accounts", fromAccountId);
  const toAccountRef = doc(db, "users", userId, "accounts", toAccountId);
  
  const fromAccountSnap = await getDoc(fromAccountRef);
  const toAccountSnap = await getDoc(toAccountRef);
  
  if (!fromAccountSnap.exists() || !toAccountSnap.exists()) {
    throw new Error("One or both accounts not found");
  }
  
  const fromBalance = fromAccountSnap.data().currentBalance || 0;
  
  if (fromBalance < amount) {
    throw new Error("Insufficient funds");
  }
  
  // Update both accounts in a batch
  const batch = writeBatch(db);
  
  batch.update(fromAccountRef, {
    currentBalance: fromBalance - amount,
    updatedAt: serverTimestamp(),
  });
  
  const toBalance = toAccountSnap.data().currentBalance || 0;
  batch.update(toAccountRef, {
    currentBalance: toBalance + amount,
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
  
  return {
    fromBalance: fromBalance - amount,
    toBalance: toBalance + amount,
  };
}

// ==================== SUB-ACCOUNTS ====================

/**
 * Create a sub-account (Savings or Investment partition)
 */
export async function createSubAccount(
  userId: string,
  accountId: string,
  subAccountData: {
    name: string;
    type: "savings" | "investment";
    amount: number;
    // Savings specific
    interestRate?: number;
    interestFrequency?: "daily" | "monthly" | "yearly";
    startDate?: Date;
    // Investment specific
    holdings?: any[];
  }
) {
  const subAccountsRef = collection(db, "users", userId, "accounts", accountId, "subAccounts");
  const newSubAccountRef = doc(subAccountsRef);

  // Get parent account
  const parentAccountRef = doc(db, "users", userId, "accounts", accountId);
  const parentAccountSnap = await getDoc(parentAccountRef);
  
  if (!parentAccountSnap.exists()) {
    throw new Error("Parent account not found");
  }

  const parentBalance = parentAccountSnap.data().currentBalance || 0;
  const subAccountBalance = subAccountData.amount;

  // Validate amount
  if (subAccountBalance <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  if (subAccountBalance > parentBalance) {
    throw new Error("Insufficient balance in parent account");
  }

  if (subAccountData.type === "savings") {
    // Calculate next interest date
    let nextInterestDate = null;
    if (subAccountData.startDate && subAccountData.interestFrequency) {
      const date = new Date(subAccountData.startDate);
      switch (subAccountData.interestFrequency) {
        case "daily":
          date.setDate(date.getDate() + 1);
          break;
        case "monthly":
          date.setMonth(date.getMonth() + 1);
          break;
        case "yearly":
          date.setFullYear(date.getFullYear() + 1);
          break;
      }
      nextInterestDate = Timestamp.fromDate(date);
    }

    await setDoc(newSubAccountRef, {
      parentAccountId: accountId,
      name: subAccountData.name,
      type: "savings",
      balance: subAccountBalance,
      interestRate: subAccountData.interestRate || 0,
      interestFrequency: subAccountData.interestFrequency || "monthly",
      startDate: subAccountData.startDate ? Timestamp.fromDate(subAccountData.startDate) : serverTimestamp(),
      lastInterestDate: null,
      nextInterestDate: nextInterestDate,
      totalInterestEarned: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else if (subAccountData.type === "investment") {
    await setDoc(newSubAccountRef, {
      parentAccountId: accountId,
      name: subAccountData.name,
      type: "investment",
      balance: subAccountBalance,
      holdings: subAccountData.holdings || [],
      totalInvested: subAccountBalance,
      totalValue: subAccountBalance,
      totalReturn: 0,
      totalReturnPercentage: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Subtract amount from parent account balance
  await updateDoc(parentAccountRef, {
    currentBalance: parentBalance - subAccountBalance,
    hasSubAccounts: true,
    updatedAt: serverTimestamp(),
  });

  // Create transaction record for partition creation
  const transactionsRef = collection(db, "users", userId, "transactions");
  const newTransactionRef = doc(transactionsRef);
  const parentAccountData = parentAccountSnap.data();
  
  await setDoc(newTransactionRef, {
    type: "partition_creation",
    amount: subAccountBalance,
    accountId: accountId,
    subAccountId: newSubAccountRef.id,
    subAccountName: subAccountData.name,
    subAccountType: subAccountData.type,
    description: `Created ${subAccountData.type} partition "${subAccountData.name}" in ${parentAccountData.name}`,
    date: serverTimestamp(),
    status: "completed",
    isRecurring: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newSubAccountRef.id;
}

/**
 * Get all sub-accounts for an account
 */
export async function getSubAccounts(userId: string, accountId: string) {
  const subAccountsRef = collection(db, "users", userId, "accounts", accountId, "subAccounts");
  const snapshot = await getDocs(subAccountsRef);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get a specific sub-account by ID
 */
export async function getSubAccountById(userId: string, accountId: string, subAccountId: string) {
  const subAccountRef = doc(db, "users", userId, "accounts", accountId, "subAccounts", subAccountId);
  const snapshot = await getDoc(subAccountRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

/**
 * Update a sub-account
 */
export async function updateSubAccount(
  userId: string,
  accountId: string,
  subAccountId: string,
  updateData: Partial<{
    name: string;
    interestRate: number;
    interestFrequency: "daily" | "monthly" | "yearly";
    holdings: any[];
  }>
) {
  const subAccountRef = doc(db, "users", userId, "accounts", accountId, "subAccounts", subAccountId);
  await updateDoc(subAccountRef, {
    ...updateData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a sub-account and return its balance to the parent account
 */
export async function deleteSubAccount(userId: string, accountId: string, subAccountId: string) {
  const subAccountRef = doc(db, "users", userId, "accounts", accountId, "subAccounts", subAccountId);
  const subAccountSnap = await getDoc(subAccountRef);
  
  if (!subAccountSnap.exists()) {
    throw new Error("Sub-account not found");
  }
  
  const subAccountBalance = subAccountSnap.data().balance || 0;
  
  // Return balance to parent account
  const parentAccountRef = doc(db, "users", userId, "accounts", accountId);
  const parentAccountSnap = await getDoc(parentAccountRef);
  
  if (parentAccountSnap.exists()) {
    const parentBalance = parentAccountSnap.data().currentBalance || 0;
    await updateDoc(parentAccountRef, {
      currentBalance: parentBalance + subAccountBalance,
      updatedAt: serverTimestamp(),
    });
  }
  
  // Delete sub-account
  await deleteDoc(subAccountRef);
  
  // Check if there are any remaining sub-accounts
  const remainingSubAccounts = await getSubAccounts(userId, accountId);
  if (remainingSubAccounts.length === 0) {
    await updateDoc(parentAccountRef, {
      hasSubAccounts: false,
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Transfer funds between parent account and sub-account
 */
export async function transferSubAccountFunds(
  userId: string,
  accountId: string,
  subAccountId: string,
  amount: number,
  direction: "toSubAccount" | "toAccount"
) {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const parentAccountRef = doc(db, "users", userId, "accounts", accountId);
  const subAccountRef = doc(db, "users", userId, "accounts", accountId, "subAccounts", subAccountId);

  const parentAccountSnap = await getDoc(parentAccountRef);
  const subAccountSnap = await getDoc(subAccountRef);

  if (!parentAccountSnap.exists() || !subAccountSnap.exists()) {
    throw new Error("Account or sub-account not found");
  }

  const parentBalance = parentAccountSnap.data().currentBalance || 0;
  const subAccountBalance = subAccountSnap.data().balance || 0;

  if (direction === "toSubAccount") {
    // Transfer from parent to sub-account
    if (parentBalance < amount) {
      throw new Error("Insufficient balance in account");
    }

    await updateDoc(parentAccountRef, {
      currentBalance: parentBalance - amount,
      updatedAt: serverTimestamp(),
    });

    await updateDoc(subAccountRef, {
      balance: subAccountBalance + amount,
      updatedAt: serverTimestamp(),
    });
  } else {
    // Transfer from sub-account to parent
    if (subAccountBalance < amount) {
      throw new Error("Insufficient balance in partition");
    }

    await updateDoc(subAccountRef, {
      balance: subAccountBalance - amount,
      updatedAt: serverTimestamp(),
    });

    await updateDoc(parentAccountRef, {
      currentBalance: parentBalance + amount,
      updatedAt: serverTimestamp(),
    });
  }

  // Create transaction record for this transfer
  const transactionsRef = collection(db, "users", userId, "transactions");
  const newTransactionRef = doc(transactionsRef);
  
  const subAccountData = subAccountSnap.data();
  const parentAccountData = parentAccountSnap.data();
  
  await setDoc(newTransactionRef, {
    type: direction === "toSubAccount" ? "partition_transfer_to" : "partition_transfer_from",
    amount: amount,
    accountId: accountId,
    subAccountId: subAccountId,
    subAccountName: subAccountData.name,
    subAccountType: subAccountData.type,
    direction: direction,
    description: direction === "toSubAccount" 
      ? `Transfer from ${parentAccountData.name} to partition ${subAccountData.name}`
      : `Transfer from partition ${subAccountData.name} to ${parentAccountData.name}`,
    date: serverTimestamp(),
    status: "completed",
    isRecurring: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    parentBalance: direction === "toSubAccount" ? parentBalance - amount : parentBalance + amount,
    subAccountBalance: direction === "toSubAccount" ? subAccountBalance + amount : subAccountBalance - amount,
  };
}

// ==================== TRANSACTIONS ====================

/**
 * Create a new transaction (income, expense, or transfer)
 */
export async function createTransaction(
  userId: string,
  transactionData: {
    type: "income" | "expense" | "transfer";
    amount: number;
    accountId: string;
    toAccountId?: string;
    category?: string;
    incomeCategory?: "salary" | "investment" | "generic_return" | "other";
    description: string;
    date: Date;
    isRecurring: boolean;
    recurringInterval?: "daily" | "weekly" | "monthly" | "yearly";
  }
) {
  const transactionsRef = collection(db, "users", userId, "transactions");
  const newTransactionRef = doc(transactionsRef);

  // If it's a transfer, update both accounts and create the transaction
  if (transactionData.type === "transfer" && transactionData.toAccountId) {
    // Use the existing transferBetweenAccounts function
    await transferBetweenAccounts(
      userId,
      transactionData.accountId,
      transactionData.toAccountId,
      transactionData.amount
    );
  } else if (transactionData.type === "income") {
    // Add to account balance
    await updateAccountBalance(userId, transactionData.accountId, transactionData.amount, "add");
  } else if (transactionData.type === "expense") {
    // Subtract from account balance
    await updateAccountBalance(userId, transactionData.accountId, transactionData.amount, "subtract");
  }

  // Calculate next scheduled date if recurring
  let nextScheduledDate = null;
  if (transactionData.isRecurring && transactionData.recurringInterval) {
    const date = new Date(transactionData.date);
    switch (transactionData.recurringInterval) {
      case "daily":
        date.setDate(date.getDate() + 1);
        break;
      case "weekly":
        date.setDate(date.getDate() + 7);
        break;
      case "monthly":
        date.setMonth(date.getMonth() + 1);
        break;
      case "yearly":
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    nextScheduledDate = Timestamp.fromDate(date);
  }

  // Create the transaction record
  await setDoc(newTransactionRef, {
    type: transactionData.type,
    amount: transactionData.amount,
    accountId: transactionData.accountId,
    toAccountId: transactionData.toAccountId || null,
    category: transactionData.category || null,
    incomeCategory: transactionData.incomeCategory || null,
    description: transactionData.description,
    date: Timestamp.fromDate(transactionData.date),
    status: "completed",
    isRecurring: transactionData.isRecurring,
    recurringInterval: transactionData.recurringInterval || null,
    nextScheduledDate: nextScheduledDate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newTransactionRef.id;
}

/**
 * Get all transactions for a user
 */
export async function getTransactions(userId: string): Promise<any[]> {
  const transactionsRef = collection(db, "users", userId, "transactions");
  const q = query(transactionsRef, orderBy("date", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get filtered transactions
 */
export async function getFilteredTransactions(
  userId: string,
  filters?: {
    type?: "income" | "expense" | "transfer";
    accountId?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    searchText?: string;
    minAmount?: number;
    maxAmount?: number;
  }
): Promise<any[]> {
  const transactionsRef = collection(db, "users", userId, "transactions");
  let q = query(transactionsRef, orderBy("date", "desc"));

  // Apply type filter
  if (filters?.type) {
    q = query(transactionsRef, where("type", "==", filters.type), orderBy("date", "desc"));
  }

  const snapshot = await getDocs(q);
  let transactions = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Apply client-side filters
  if (filters) {
    if (filters.accountId) {
      transactions = transactions.filter(
        (t) => t.accountId === filters.accountId || t.toAccountId === filters.accountId
      );
    }
    if (filters.category) {
      transactions = transactions.filter((t) => t.category === filters.category);
    }
    if (filters.startDate) {
      const startTimestamp = Timestamp.fromDate(filters.startDate);
      transactions = transactions.filter((t) => t.date.seconds >= startTimestamp.seconds);
    }
    if (filters.endDate) {
      const endTimestamp = Timestamp.fromDate(filters.endDate);
      transactions = transactions.filter((t) => t.date.seconds <= endTimestamp.seconds);
    }
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      transactions = transactions.filter((t) =>
        t.description.toLowerCase().includes(search)
      );
    }
    if (filters.minAmount !== undefined) {
      transactions = transactions.filter((t) => t.amount >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      transactions = transactions.filter((t) => t.amount <= filters.maxAmount!);
    }
  }

  return transactions;
}

/**
 * Get a single transaction by ID
 */
export async function getTransactionById(
  userId: string,
  transactionId: string
): Promise<any | null> {
  const transactionRef = doc(db, "users", userId, "transactions", transactionId);
  const transactionSnap = await getDoc(transactionRef);

  if (!transactionSnap.exists()) {
    return null;
  }

  return {
    id: transactionSnap.id,
    ...transactionSnap.data(),
  };
}

/**
 * Update a transaction
 */
export async function updateTransaction(
  userId: string,
  transactionId: string,
  updates: Partial<{
    description: string;
    category: string;
    incomeCategory: string;
    isRecurring: boolean;
    recurringInterval: "daily" | "weekly" | "monthly" | "yearly";
  }>
) {
  const transactionRef = doc(db, "users", userId, "transactions", transactionId);
  await updateDoc(transactionRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a transaction and reverse its effects on account balances
 */
export async function deleteTransaction(userId: string, transactionId: string) {
  const transactionRef = doc(db, "users", userId, "transactions", transactionId);
  const transactionSnap = await getDoc(transactionRef);
  
  if (!transactionSnap.exists()) {
    throw new Error("Transaction not found");
  }
  
  const transaction = transactionSnap.data();
  
  // Reverse the transaction effects on accounts
  if (transaction.type === "income") {
    // Subtract the income from the account
    await updateAccountBalance(userId, transaction.accountId, transaction.amount, "subtract");
  } else if (transaction.type === "expense") {
    // Add back the expense to the account
    await updateAccountBalance(userId, transaction.accountId, transaction.amount, "add");
  } else if (transaction.type === "transfer") {
    // Reverse the transfer
    if (transaction.accountId && transaction.toAccountId) {
      // Add back to source account
      await updateAccountBalance(userId, transaction.accountId, transaction.amount, "add");
      // Subtract from destination account
      await updateAccountBalance(userId, transaction.toAccountId, transaction.amount, "subtract");
    }
  }
  
  // Delete the transaction
  await deleteDoc(transactionRef);
}

// ==================== SUB-ACCOUNT UTILITIES ====================

/**
 * Calculate and apply interest for a savings sub-account
 */
export async function calculateSubAccountInterest(
  userId: string,
  accountId: string,
  subAccountId: string
) {
  const subAccount = await getSubAccountById(userId, accountId, subAccountId);
  
  if (!subAccount || subAccount.type !== "savings") {
    throw new Error("Invalid savings sub-account");
  }

  const now = new Date();
  const nextInterestDate = subAccount.nextInterestDate?.toDate();

  if (!nextInterestDate || now < nextInterestDate) {
    return; // Not time for interest yet
  }

  // Calculate interest
  const balance = subAccount.balance || 0;
  const interestRate = subAccount.interestRate || 0;
  let interest = 0;

  switch (subAccount.interestFrequency) {
    case "daily":
      interest = (balance * interestRate) / 365 / 100;
      break;
    case "monthly":
      interest = (balance * interestRate) / 12 / 100;
      break;
    case "yearly":
      interest = (balance * interestRate) / 100;
      break;
  }

  // Round to 2 decimals
  interest = Math.round(interest * 100) / 100;

  // Update sub-account balance and totals
  const newBalance = balance + interest;
  const newTotalInterest = (subAccount.totalInterestEarned || 0) + interest;

  // Calculate next interest date
  const nextDate = new Date(nextInterestDate);
  switch (subAccount.interestFrequency) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case "yearly":
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }

  const subAccountRef = doc(db, "users", userId, "accounts", accountId, "subAccounts", subAccountId);
  await updateDoc(subAccountRef, {
    balance: newBalance,
    totalInterestEarned: newTotalInterest,
    lastInterestDate: Timestamp.fromDate(now),
    nextInterestDate: Timestamp.fromDate(nextDate),
    updatedAt: serverTimestamp(),
  });

  // Create a transaction record for the interest payment
  await createTransaction(userId, {
    type: "income",
    amount: interest,
    accountId: accountId,
    incomeCategory: "investment",
    description: `Interest payment for ${subAccount.name} (${subAccount.interestRate}% ${subAccount.interestFrequency})`,
    date: now,
    isRecurring: false,
  });

  return interest;
}

/**
 * Check and apply interest for all due savings sub-accounts
 */
export async function checkAndApplyAllInterests(userId: string) {
  const accountsRef = collection(db, "users", userId, "accounts");
  const accountsSnapshot = await getDocs(accountsRef);

  for (const accountDoc of accountsSnapshot.docs) {
    const accountData = accountDoc.data();
    if (accountData.hasSubAccounts) {
      const subAccounts = await getSubAccounts(userId, accountDoc.id);
      
      for (const subAccount of subAccounts) {
        if (subAccount.type === "savings") {
          try {
            await calculateSubAccountInterest(userId, accountDoc.id, subAccount.id);
          } catch (error) {
            console.error(`Error calculating interest for sub-account ${subAccount.id}:`, error);
          }
        }
      }
    }
  }
}

/**
 * Create an internal transaction between sub-accounts
 */
export async function createInternalSubAccountTransaction(
  userId: string,
  accountId: string,
  fromSubAccountId: string,
  toSubAccountId: string,
  amount: number,
  description: string
) {
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Get both sub-accounts
  const fromSubAccount = await getSubAccountById(userId, accountId, fromSubAccountId);
  const toSubAccount = await getSubAccountById(userId, accountId, toSubAccountId);

  if (!fromSubAccount || !toSubAccount) {
    throw new Error("One or both sub-accounts not found");
  }

  if (fromSubAccount.balance < amount) {
    throw new Error("Insufficient balance in source sub-account");
  }

  // Update balances
  const fromSubAccountRef = doc(db, "users", userId, "accounts", accountId, "subAccounts", fromSubAccountId);
  const toSubAccountRef = doc(db, "users", userId, "accounts", accountId, "subAccounts", toSubAccountId);

  await updateDoc(fromSubAccountRef, {
    balance: fromSubAccount.balance - amount,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(toSubAccountRef, {
    balance: toSubAccount.balance + amount,
    updatedAt: serverTimestamp(),
  });

  // Create transaction record
  const transactionsRef = collection(db, "users", userId, "transactions");
  const newTransactionRef = doc(transactionsRef);

  await setDoc(newTransactionRef, {
    type: "transfer",
    amount: amount,
    accountId: accountId,
    toAccountId: accountId, // Same parent account
    subAccountId: fromSubAccountId,
    toSubAccountId: toSubAccountId,
    isInternalTransaction: true,
    description: description,
    date: serverTimestamp(),
    status: "completed",
    isRecurring: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newTransactionRef.id;
}
