"use client";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, updatePassword, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { deleteUserAccount } from "@/lib/firestore";
import { Dialog, Transition } from "@headlessui/react";
import {
  ArrowLeftIcon,
  KeyIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/auth");
        return;
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!newPassword || !confirmPassword) {
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

    if (!user) return;

    setIsUpdatingPassword(true);

    try {
      await updatePassword(user, newPassword);
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      // Clear success message after 3 seconds
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (error: any) {
      console.error("Error updating password:", error);
      if (error.code === "auth/requires-recent-login") {
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
      setDeleteError("Please enter your password");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteUserAccount(user, deletePassword);
      router.push("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      setDeleteError(error.message || "Failed to delete account. Please try again.");
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
        <h1 className="text-2xl font-semibold text-[#0F172A]">Impostazioni</h1>
        <p className="text-sm text-gray-500 mt-1">Gestisci profilo, password e account</p>
      </div>

      <main className="px-8 py-8 bg-gray-50">
        <div className="max-w-6xl space-y-6">
          {/* Profile Information Section - Full Width */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 flex items-center justify-center">
                <UserCircleIcon className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">Informazioni Profilo</h2>
                <p className="text-sm text-gray-500">I tuoi dati personali</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm text-[#0F172A]">{user?.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Nome</label>
                <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm text-[#0F172A]">
                    {user?.displayName || "Non impostato"}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Account creato</label>
                <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm text-[#0F172A]">
                    {user?.metadata.creationTime
                      ? new Date(user.metadata.creationTime).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Ultimo accesso</label>
                <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm text-[#0F172A]">
                    {user?.metadata.lastSignInTime
                      ? new Date(user.metadata.lastSignInTime).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Password Management & Account Deletion - 2 Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Change Password Section */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 flex items-center justify-center">
                  <KeyIcon className="w-5 h-5 text-[#22C55E]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0F172A]">Cambia Password</h2>
                  <p className="text-sm text-gray-500">Aggiorna la tua password per mantenere l'account sicuro</p>
                </div>
              </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nuova Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Almeno 6 caratteri"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conferma Nuova Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Ripeti la nuova password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none transition-all"
                />
              </div>

              {passwordError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                  <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-3 rounded-lg">
                  <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
                  {passwordSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                className="w-full py-3 rounded-full text-sm font-medium text-white bg-[#22C55E] hover:bg-[#16A34A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isUpdatingPassword ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Aggiornamento...
                  </div>
                ) : (
                  "Aggiorna Password"
                )}
              </button>
            </form>
            </div>

            {/* Delete Account Section */}
            <div className="bg-white rounded-2xl border border-red-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <TrashIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">Elimina Account</h2>
                <p className="text-sm text-gray-500">Rimuovi permanentemente il tuo account e tutti i dati</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-red-800">
                <strong>Attenzione:</strong> Questa azione è irreversibile. Tutti i tuoi dati verranno
                eliminati permanentemente.
              </p>
            </div>

            <button
              onClick={() => setDeleteModalOpen(true)}
              className="w-full py-3 rounded-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
            >
              Elimina Account
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
                    Elimina Account?
                  </Dialog.Title>

                  <p className="text-sm text-gray-600 text-center mb-6">
                    Questa azione non può essere annullata. Tutti i tuoi dati verranno eliminati
                    permanentemente, inclusi:
                  </p>

                  <ul className="text-sm text-gray-700 space-y-2 mb-6">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      Tutti i conti e fondi
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      Tutte le transazioni e lo storico
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      Categorie, budget e obiettivi
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      Il tuo account e profilo
                    </li>
                  </ul>

                  {/* Password Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Inserisci la tua password per confermare
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        setDeleteError("");
                      }}
                      disabled={isDeleting}
                      placeholder="La tua password"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {deleteError && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
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
                      Annulla
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || !deletePassword.trim()}
                      className="flex-1 py-3 rounded-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Eliminazione...
                        </div>
                      ) : (
                        "Elimina Definitivamente"
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

