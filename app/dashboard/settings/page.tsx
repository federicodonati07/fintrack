"use client";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, updatePassword, User, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { deleteUserAccount, getUserDocument, updateUserCurrency } from "@/lib/firestore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, Transition, Listbox, Switch } from "@headlessui/react";
import {
  ArrowLeftIcon,
  KeyIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  UserCircleIcon,
  CurrencyDollarIcon,
  CheckIcon,
  ChevronUpDownIcon,
  SparklesIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { CURRENCIES, getCurrencyByCode } from "@/lib/currencies";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const { setCurrencyCode } = useCurrency();

  // Name editing state
  const [displayName, setDisplayName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState("");

  // Currency state
  const [selectedCurrency, setSelectedCurrency] = useState("EUR");
  const [isUpdatingCurrency, setIsUpdatingCurrency] = useState(false);
  const [currencySuccess, setCurrencySuccess] = useState("");

  // Privacy state
  const [allowSharedAccountDiscovery, setAllowSharedAccountDiscovery] = useState(false);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [privacySuccess, setPrivacySuccess] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Delete account state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/auth");
        return;
      }
      setUser(currentUser);
      
      // Load user's current currency, plan, and name from Firestore
      try {
        const userDoc = await getUserDocument(currentUser.uid);
        if (userDoc?.name) {
          setDisplayName(userDoc.name);
        }
        if (userDoc?.currency) {
          setSelectedCurrency(userDoc.currency);
        }
        if (userDoc?.plan) {
          setUserPlan(userDoc.plan);
        }
        if (userDoc?.allowSharedAccountDiscovery !== undefined) {
          setAllowSharedAccountDiscovery(userDoc.allowSharedAccountDiscovery);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleUpdateName = async () => {
    if (!user) return;

    setIsUpdatingName(true);
    setNameSuccess("");

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name: displayName,
      });
      setNameSuccess("✅ Name updated successfully!");
      setIsEditingName(false);
      
      setTimeout(() => setNameSuccess(""), 3000);
    } catch (error) {
      console.error("Error updating name:", error);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleCancelEditName = async () => {
    setIsEditingName(false);
    // Reload name from database
    if (user) {
      try {
        const userDoc = await getUserDocument(user.uid);
        if (userDoc?.name) {
          setDisplayName(userDoc.name);
        }
      } catch (error) {
        console.error("Error loading name:", error);
      }
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    if (!user) return;

    setIsUpdatingCurrency(true);
    setCurrencySuccess("");

    try {
      await updateUserCurrency(user.uid, newCurrency);
      setSelectedCurrency(newCurrency);
      setCurrencyCode(newCurrency); // Update context
      setCurrencySuccess("Currency updated successfully!");
      
      setTimeout(() => setCurrencySuccess(""), 3000);
    } catch (error) {
      console.error("Error updating currency:", error);
    } finally {
      setIsUpdatingCurrency(false);
    }
  };

  const handlePrivacyToggle = async (enabled: boolean) => {
    if (!user) return;

    setIsUpdatingPrivacy(true);
    setPrivacySuccess("");

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        allowSharedAccountDiscovery: enabled,
      });
      setAllowSharedAccountDiscovery(enabled);
      setPrivacySuccess(enabled 
        ? "✅ You can now be found in shared account searches" 
        : "✅ You are now hidden from shared account searches");
      
      setTimeout(() => setPrivacySuccess(""), 3000);
    } catch (error) {
      console.error("Error updating privacy:", error);
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (!user || !user.email) return;

    setIsUpdatingPassword(true);

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      // Clear success message after 3 seconds
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (error: any) {
      console.error("Error updating password:", error);
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        setPasswordError("Current password is incorrect");
      } else if (error.code === "auth/requires-recent-login") {
        setPasswordError("Please log out and log back in before changing your password");
      } else {
        setPasswordError(error.message || "Failed to update password");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    if (!deletePassword.trim()) {
      setDeleteError("Enter your password");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteUserAccount(user, deletePassword);
      router.push("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      setDeleteError(error.message || "Errore durante l'eliminazione dell'account. Riprova.");
      setIsDeleting(false);
    }
  };

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModalOpen(false);
      setDeletePassword("");
      setDeleteError("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] transition-colors mb-4 group cursor-pointer"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <h1 className="text-2xl font-semibold text-[#0F172A]">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile, password and account</p>
      </div>

      <main className="px-8 py-8 bg-gray-50">
        <div className="max-w-6xl">
          {/* Grid Layout - 2 columns on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Profile Information Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                  <UserCircleIcon className="w-5 h-5 text-[#22C55E]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0F172A]">Profile Information</h2>
                  <p className="text-xs text-gray-500">Your personal data</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-[#0F172A]">{user?.email}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                  {isEditingName ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none transition-all"
                        placeholder="Enter your name"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateName}
                          disabled={isUpdatingName || !displayName.trim()}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUpdatingName ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={handleCancelEditName}
                          disabled={isUpdatingName}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between group">
                      <p className="text-sm text-[#0F172A]">
                        {displayName || "Not set"}
                      </p>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="text-xs font-medium text-[#22C55E] hover:text-[#16A34A] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                  {nameSuccess && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg mt-2">
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      <p className="text-xs text-green-800">{nameSuccess}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Current Plan</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                        userPlan === "ultra" ? "bg-purple-100 text-purple-800" :
                        userPlan === "pro" ? "bg-blue-100 text-blue-800" :
                        userPlan === "admin" ? "bg-red-100 text-red-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {userPlan.toUpperCase()}
                      </span>
                    </div>
                    {userPlan !== "ultra" && userPlan !== "admin" && (
                      <button
                        onClick={() => router.push("/dashboard/plan")}
                        className="flex items-center gap-1 text-xs font-semibold text-[#22C55E] hover:text-[#16A34A] transition-colors"
                      >
                        <SparklesIcon className="w-4 h-4" />
                        Upgrade
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Account created</label>
                    <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-[#0F172A]">
                        {user?.metadata.creationTime
                          ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Last access</label>
                    <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-[#0F172A]">
                        {user?.metadata.lastSignInTime
                          ? new Date(user.metadata.lastSignInTime).toLocaleDateString("en-US", {
                              day: "numeric",
                              month: "short",
                            })
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Currency Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CurrencyDollarIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0F172A]">Currency</h2>
                  <p className="text-xs text-gray-500">Your preferred currency</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Preferred Currency
                  </label>
                  <Listbox value={selectedCurrency} onChange={handleCurrencyChange} disabled={isUpdatingCurrency}>
                    <div className="relative">
                      <Listbox.Button className="relative w-full cursor-pointer rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent">
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{getCurrencyByCode(selectedCurrency)?.flag}</span>
                          <span className="block truncate font-medium text-sm text-gray-900">
                            {selectedCurrency} - {getCurrencyByCode(selectedCurrency)?.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({getCurrencyByCode(selectedCurrency)?.symbol})
                          </span>
                        </span>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                          <ChevronUpDownIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </span>
                      </Listbox.Button>
                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Listbox.Options className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                          {CURRENCIES.map((currency) => (
                            <Listbox.Option
                              key={currency.code}
                              className={({ active }) =>
                                `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                                  active ? 'bg-[#22C55E]/10 text-[#0F172A]' : 'text-gray-900'
                                }`
                              }
                              value={currency.code}
                            >
                              {({ selected, active }) => (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{currency.flag}</span>
                                    <span className={`block truncate text-sm ${selected ? 'font-semibold' : 'font-normal'}`}>
                                      {currency.code} - {currency.name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      ({currency.symbol})
                                    </span>
                                  </div>
                                  {selected ? (
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#22C55E]">
                                      <CheckIcon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </Listbox.Option>
                          ))}
                        </Listbox.Options>
                      </Transition>
                    </div>
                  </Listbox>
                </div>

                {currencySuccess && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    <p className="text-xs text-green-800">{currencySuccess}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Privacy Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <ShieldExclamationIcon className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0F172A]">Privacy</h2>
                  <p className="text-xs text-gray-500">Control who can find you</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 pr-4">
                    <h3 className="text-sm font-semibold text-[#0F172A] mb-1">
                      Allow Shared Account Discovery
                    </h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      When enabled, other users can find and invite you to shared accounts by searching your email. 
                      When disabled, you remain hidden from all searches (default for privacy).
                    </p>
                  </div>
                  <Switch
                    checked={allowSharedAccountDiscovery}
                    onChange={handlePrivacyToggle}
                    disabled={isUpdatingPrivacy}
                    className={`${
                      allowSharedAccountDiscovery ? 'bg-[#22C55E]' : 'bg-gray-300'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:ring-offset-2 disabled:opacity-50`}
                  >
                    <span
                      className={`${
                        allowSharedAccountDiscovery ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>

                {privacySuccess && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    <p className="text-xs text-green-800">{privacySuccess}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Change Password Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                  <KeyIcon className="w-5 h-5 text-[#22C55E]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0F172A]">Change Password</h2>
                  <p className="text-xs text-gray-500">Update your password</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Enter your current password"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Repeat the new password"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none transition-all"
                  />
                </div>

                {passwordError && (
                  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                    <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                    {passwordSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-[#22C55E] hover:bg-[#16A34A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isUpdatingPassword ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Updating...
                    </div>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </div>

            {/* Delete Account Section */}
            <div className="bg-white rounded-lg border border-red-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <TrashIcon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0F172A]">Delete Account</h2>
                  <p className="text-xs text-gray-500">Permanently remove your account</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-800">
                  <strong>Warning:</strong> This action is irreversible. All your data will be
                  permanently deleted.
                </p>
              </div>

              <button
                onClick={() => setDeleteModalOpen(true)}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Account Confirmation Modal */}
      <Transition appear show={deleteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeDeleteModal}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-8 shadow-2xl transition-all">
                  {/* Warning Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                      <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
                    </div>
                  </div>

                  <Dialog.Title className="text-xl font-semibold text-center text-[#0F172A] mb-3">
                    Delete Account?
                  </Dialog.Title>

                  <p className="text-sm text-gray-600 text-center mb-6">
                    This action cannot be undone. All your data will be permanently deleted,
                    including:
                  </p>

                  <ul className="text-sm text-gray-700 space-y-2 mb-6">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      All accounts and funds
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      All transactions and history
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      Categories, budgets and goals
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      Your account and profile
                    </li>
                  </ul>

                  {/* Password Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter your password to confirm
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      Use the same password you used to log in
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        setDeleteError("");
                      }}
                      disabled={isDeleting}
                      placeholder="Your password"
                      autoFocus
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {deleteError && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1 font-medium">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        {deleteError}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={closeDeleteModal}
                      disabled={isDeleting}
                      className="flex-1 py-3 rounded-full text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || !deletePassword.trim()}
                      className="flex-1 py-3 rounded-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Deleting...
                        </div>
                      ) : (
                        "Delete Permanently"
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

