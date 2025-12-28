import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { SharedAccount, SharedAccountInvite } from "./types";

/**
 * SHARED ACCOUNTS CRUD
 */

/**
 * Create a new shared account
 */
export async function createSharedAccount(
  userId: string,
  accountData: {
    name: string;
    description: string;
    type: "checking" | "savings" | "investment" | "wallet" | "credit_card" | "other";
    currentBalance: number;
    currency: string;
    iban?: string;
    bic?: string;
    color?: string;
    icon?: string;
  },
  members?: Array<{ userId: string; email: string; role: "owner" | "member" }>
): Promise<string> {
  const sharedAccountsRef = collection(db, "sharedAccounts");
  const newAccountRef = doc(sharedAccountsRef);

  // Build members array with full details
  const membersArray = members || [{ userId, email: "", role: "owner" as "owner" | "member" }];

  // Remove undefined fields
  const sharedAccountData: any = {
    name: accountData.name,
    description: accountData.description,
    type: accountData.type,
    currentBalance: accountData.currentBalance || 0,
    currency: accountData.currency,
    archived: false,
    members: membersArray,
    ownerId: userId, // Creator is the owner
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Only add optional fields if they have values
  if (accountData.iban) sharedAccountData.iban = accountData.iban;
  if (accountData.bic) sharedAccountData.bic = accountData.bic;
  if (accountData.color) sharedAccountData.color = accountData.color;
  if (accountData.icon) sharedAccountData.icon = accountData.icon;

  await setDoc(newAccountRef, sharedAccountData);
  return newAccountRef.id;
}

/**
 * Get all shared accounts for a user
 */
export async function getSharedAccounts(userId: string): Promise<SharedAccount[]> {
  const sharedAccountsRef = collection(db, "sharedAccounts");
  // Since members is an array of objects, we need to fetch all and filter client-side
  const snapshot = await getDocs(sharedAccountsRef);
  
  const userSharedAccounts = snapshot.docs
    .filter((doc) => {
      const data = doc.data();
      return data.members?.some((m: any) => m.userId === userId);
    })
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SharedAccount[];

  // Sort by order if available, otherwise by creation date
  return userSharedAccounts.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
    const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
    return dateB - dateA;
  });
}

/**
 * Get a specific shared account by ID
 */
export async function getSharedAccountById(
  sharedAccountId: string
): Promise<SharedAccount | null> {
  const accountRef = doc(db, "sharedAccounts", sharedAccountId);
  const accountSnap = await getDoc(accountRef);

  if (!accountSnap.exists()) {
    return null;
  }

  return {
    id: accountSnap.id,
    ...accountSnap.data(),
  } as SharedAccount;
}

/**
 * Update shared account
 */
export async function updateSharedAccount(
  sharedAccountId: string,
  updates: Partial<Omit<SharedAccount, "id" | "memberIds" | "createdBy" | "createdAt">>
): Promise<void> {
  const accountRef = doc(db, "sharedAccounts", sharedAccountId);
  await updateDoc(accountRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete shared account (owner only, removes all members and related invites)
 */
export async function deleteSharedAccount(
  sharedAccountId: string,
  requestingUserId: string
): Promise<void> {
  const accountRef = doc(db, "sharedAccounts", sharedAccountId);
  const accountSnap = await getDoc(accountRef);

  if (!accountSnap.exists()) {
    throw new Error("Shared account not found");
  }

  const accountData = accountSnap.data();
  
  // Check if requesting user is the owner
  if (accountData.ownerId !== requestingUserId) {
    throw new Error("Only the owner can delete this shared account");
  }

  const batch = writeBatch(db);

  // Delete the account
  batch.delete(accountRef);

  // Delete all related invites
  const invitesRef = collection(db, "sharedAccountInvites");
  const q = query(invitesRef, where("sharedAccountId", "==", sharedAccountId));
  const invitesSnapshot = await getDocs(q);

  invitesSnapshot.docs.forEach((inviteDoc) => {
    batch.delete(inviteDoc.ref);
  });

  await batch.commit();
}

/**
 * Leave a shared account (remove user from members)
 */
export async function leaveSharedAccount(
  sharedAccountId: string,
  userId: string
): Promise<void> {
  const accountRef = doc(db, "sharedAccounts", sharedAccountId);
  const accountSnap = await getDoc(accountRef);

  if (!accountSnap.exists()) {
    throw new Error("Shared account not found");
  }

  const account = accountSnap.data();
  
  // Don't allow owner to leave - they must delete the account instead
  if (account.ownerId === userId) {
    throw new Error("Owner cannot leave. Delete the account instead.");
  }
  
  const updatedMembers = account.members.filter((m: any) => m.userId !== userId);

  await updateDoc(accountRef, {
    members: updatedMembers,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove a member from shared account (owner only)
 */
export async function removeMemberFromSharedAccount(
  sharedAccountId: string,
  memberUserId: string,
  requestingUserId: string
): Promise<void> {
  const accountRef = doc(db, "sharedAccounts", sharedAccountId);
  const accountSnap = await getDoc(accountRef);

  if (!accountSnap.exists()) {
    throw new Error("Shared account not found");
  }

  const accountData = accountSnap.data();
  
  // Check if requesting user is the owner
  if (accountData.ownerId !== requestingUserId) {
    throw new Error("Only the owner can remove members");
  }
  
  // Don't allow removing the owner
  if (memberUserId === accountData.ownerId) {
    throw new Error("Cannot remove the owner");
  }

  // Remove member from members array
  const updatedMembers = accountData.members.filter((m: any) => m.userId !== memberUserId);

  await updateDoc(accountRef, {
    members: updatedMembers,
    updatedAt: serverTimestamp(),
  });
}

/**
 * INVITES MANAGEMENT
 */

/**
 * Create an invite to a shared account
 */
export async function createSharedAccountInvite(
  sharedAccountId: string,
  sharedAccountName: string,
  inviterUserId: string,
  inviterEmail: string,
  inviterName: string,
  invitedUserId: string,
  invitedEmail: string
): Promise<string> {
  // Validate required parameters
  if (!sharedAccountId) {
    throw new Error("sharedAccountId is required");
  }
  if (!sharedAccountName) {
    throw new Error("sharedAccountName is required");
  }
  if (!inviterUserId) {
    throw new Error("inviterUserId is required");
  }
  if (!inviterEmail) {
    throw new Error("inviterEmail is required");
  }
  if (!inviterName) {
    throw new Error("inviterName is required");
  }
  if (!invitedUserId) {
    throw new Error("invitedUserId is required");
  }
  if (!invitedEmail) {
    throw new Error("invitedEmail is required");
  }

  // Check if invite already exists
  const invitesRef = collection(db, "sharedAccountInvites");
  const existingInviteQuery = query(
    invitesRef,
    where("sharedAccountId", "==", sharedAccountId),
    where("invitedUserId", "==", invitedUserId),
    where("status", "==", "pending")
  );
  const existingInvites = await getDocs(existingInviteQuery);

  if (!existingInvites.empty) {
    throw new Error("Invite already sent to this user");
  }

  // Create invite
  const newInviteRef = doc(invitesRef);
  const inviteData: Omit<SharedAccountInvite, "id"> = {
    sharedAccountId,
    sharedAccountName,
    inviterUserId,
    inviterEmail,
    inviterName,
    invitedUserId,
    invitedEmail,
    status: "pending",
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(newInviteRef, inviteData);
  return newInviteRef.id;
}

/**
 * Get all pending invites for a user
 */
export async function getPendingInvites(userId: string): Promise<SharedAccountInvite[]> {
  const invitesRef = collection(db, "sharedAccountInvites");
  const q = query(
    invitesRef,
    where("invitedUserId", "==", userId),
    where("status", "==", "pending")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as SharedAccountInvite[];
}

/**
 * Get all invites for a shared account
 */
export async function getSharedAccountInvites(
  sharedAccountId: string
): Promise<SharedAccountInvite[]> {
  const invitesRef = collection(db, "sharedAccountInvites");
  const q = query(invitesRef, where("sharedAccountId", "==", sharedAccountId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as SharedAccountInvite[];
}

/**
 * Accept a shared account invite
 */
export async function acceptSharedAccountInvite(inviteId: string): Promise<void> {
  const inviteRef = doc(db, "sharedAccountInvites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invite not found");
  }

  const invite = inviteSnap.data() as SharedAccountInvite;

  // Get shared account
  const accountRef = doc(db, "sharedAccounts", invite.sharedAccountId);
  const accountSnap = await getDoc(accountRef);

  if (!accountSnap.exists()) {
    throw new Error("Shared account not found");
  }

  const account = accountSnap.data() as SharedAccount;

  // Check if already a member
  if (account.members?.some(m => m.userId === invite.invitedUserId)) {
    throw new Error("Already a member of this shared account");
  }

  // Check max members limit (10)
  if (account.members && account.members.length >= 10) {
    throw new Error("Shared account has reached maximum members limit (10)");
  }

  const batch = writeBatch(db);

  // Add user to shared account members
  const newMember = {
    userId: invite.invitedUserId,
    email: invite.invitedEmail,
    role: "member" as "owner" | "member",
  };
  
  batch.update(accountRef, {
    members: [...(account.members || []), newMember],
    updatedAt: serverTimestamp(),
  });

  // Update invite status
  batch.update(inviteRef, {
    status: "accepted",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Reject a shared account invite
 */
export async function rejectSharedAccountInvite(inviteId: string): Promise<void> {
  const inviteRef = doc(db, "sharedAccountInvites", inviteId);
  await updateDoc(inviteRef, {
    status: "rejected",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an invite (only by inviter before acceptance)
 */
export async function deleteSharedAccountInvite(inviteId: string): Promise<void> {
  const inviteRef = doc(db, "sharedAccountInvites", inviteId);
  await deleteDoc(inviteRef);
}

/**
 * Search user by email (respects privacy settings)
 */
export async function searchUserByEmail(email: string): Promise<{
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  allowSharedAccountDiscovery: boolean;
} | null> {
  if (!email || !email.trim()) {
    return null;
  }

  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", email.trim().toLowerCase()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data();

  // Check privacy setting (default: false for privacy)
  if (userData.allowSharedAccountDiscovery === false) {
    return null; // User has disabled discovery
  }

  return {
    uid: userDoc.id,
    email: userData.email || email,
    name: userData.name || userData.displayName || "Unknown User",
    displayName: userData.displayName || userData.name || "Unknown User",
    allowSharedAccountDiscovery: userData.allowSharedAccountDiscovery ?? false,
  };
}

/**
 * Search users by email pattern (for autocomplete/dropdown)
 * Only returns users with Pro/Ultra plan and discovery enabled
 */
export async function searchUsersByPattern(emailPattern: string): Promise<Array<{
  uid: string;
  email: string;
  name: string;
  plan: string;
}>> {
  if (!emailPattern || emailPattern.length < 2) {
    return [];
  }

  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);

  const matchingUsers: Array<{
    uid: string;
    email: string;
    name: string;
    plan: string;
  }> = [];

  snapshot.docs.forEach((doc) => {
    const userData = doc.data();
    const email = userData.email?.toLowerCase() || "";
    const name = userData.name?.toLowerCase() || "";
    const pattern = emailPattern.toLowerCase();

    // Check if email OR name contains pattern
    if (email.includes(pattern) || name.includes(pattern)) {
      // Check privacy setting (must be enabled)
      if (userData.allowSharedAccountDiscovery !== true) {
        return; // Skip users with discovery disabled
      }

      // Check plan (only Pro/Ultra/Admin)
      const plan = userData.plan || "free";
      if (plan === "free") {
        return; // Skip free users
      }

      matchingUsers.push({
        uid: doc.id,
        email: userData.email || "",
        name: userData.name || userData.displayName || "Unknown User",
        plan: plan,
      });
    }
  });

  // Limit to 5 results
  return matchingUsers.slice(0, 5);
}

/**
 * Count user's shared accounts
 */
export async function countUserSharedAccounts(userId: string): Promise<number> {
  const sharedAccounts = await getSharedAccounts(userId);
  return sharedAccounts.length;
}

/**
 * Get transactions for a shared account
 */
export async function getSharedAccountTransactions(sharedAccountId: string) {
  const transactionsRef = collection(db, "transactions");
  const q = query(transactionsRef, where("sharedAccountId", "==", sharedAccountId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get shared account by member user ID (alias for getSharedAccounts)
 */
export async function getSharedAccountsByMember(userId: string): Promise<SharedAccount[]> {
  return getSharedAccounts(userId);
}

/**
 * Update shared account order for drag-and-drop
 */
export async function updateSharedAccountsOrder(
  userId: string,
  accountIds: string[]
): Promise<void> {
  const batch = writeBatch(db);

  // Get user's shared accounts to update only their order
  const userSharedAccounts = await getSharedAccounts(userId);
  const userAccountIds = new Set(userSharedAccounts.map(acc => acc.id));

  accountIds.forEach((accountId, index) => {
    // Only update accounts that belong to the user
    if (userAccountIds.has(accountId)) {
      const accountRef = doc(db, "sharedAccounts", accountId);
      batch.update(accountRef, { order: index });
    }
  });

  await batch.commit();
}

