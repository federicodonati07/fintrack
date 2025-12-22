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
} from "firebase/firestore";
import { db } from "./firebase";
import { User, Category, Fund, Goal } from "./types";
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
  const defaultFund: Omit<Fund, "createdAt" | "updatedAt"> = {
    name: "Main Account",
    description: "Your primary account",
    balance: 0,
    color: "#22C55E",
    archived: false,
  };

  const fundsRef = collection(db, "users", userId, "funds");
  const fundDoc = doc(fundsRef);
  
  await setDoc(fundDoc, {
    ...defaultFund,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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

    // Delete all user subcollections and documents
    await deleteAllUserData(userId);

    // Delete user document
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);

    // Delete user from Firebase Authentication
    await deleteUser(firebaseUser);
  } catch (error: any) {
    console.error("Error deleting user account:", error);
    
    // Provide user-friendly error messages
    if (error.code === "auth/wrong-password") {
      throw new Error("Incorrect password. Please try again.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please try again later.");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your connection.");
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
