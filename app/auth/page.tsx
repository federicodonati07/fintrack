"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserDocument } from "@/lib/firestore";
import { Button, Input } from "@heroui/react";
import { EyeIcon, EyeSlashIcon, CheckIcon } from "@heroicons/react/24/outline";

type AuthMode = "login" | "register";
type Plan = "free" | "pro" | "ultra";
type Interval = "monthly" | "yearly";

// Password strength checker
const getPasswordStrength = (password: string) => {
  let strength = 0;
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  Object.values(checks).forEach((check) => {
    if (check) strength++;
  });

  return { strength, checks };
};

export default function AuthPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const redirectingRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const planParam = searchParams.get("plan") as Plan | null;
  const intervalParam = searchParams.get("interval") as Interval | null;

  const passwordStrength = mode === "register" ? getPasswordStrength(password) : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // Prevent multiple redirects
        if (!redirectingRef.current) {
          redirectingRef.current = true;

          try {
            await createUserDocument(currentUser);
            // Redirect to dashboard/home after successful login
            const targetPlan =
              planParam === "pro" || planParam === "ultra" ? planParam : null;
            const targetInterval =
              intervalParam === "yearly" ? "yearly" : "monthly";

            if (targetPlan) {
              router.push(
                `/dashboard?plan=${targetPlan}&interval=${targetInterval}`
              );
            } else {
              router.push("/dashboard");
            }
            // Keep loading state while redirecting
            return;
          } catch (error) {
            console.error("Error creating user document:", error);
            redirectingRef.current = false;
            setLoading(false);
            return;
          }
        }
      } else {
        setUser(null);
        redirectingRef.current = false;
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (mode === "register") {
        // Register new user
        if (!name.trim()) {
          setError("Please enter your name");
          setIsSubmitting(false);
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setIsSubmitting(false);
          return;
        }

        if (password.length < 6) {
          setError("Password should be at least 6 characters");
          setIsSubmitting(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        // Update user profile with name
        await updateProfile(userCredential.user, {
          displayName: name.trim(),
        });

        // The onAuthStateChanged listener will handle document creation and redirect
      } else {
        // Login existing user
        await signInWithEmailAndPassword(auth, email, password);
        // The onAuthStateChanged listener will handle the redirect
      }
    } catch (error) {
      console.error("Auth error:", error);
      const firebaseError = error as { code?: string; message?: string };
      let errorMessage = "Si è verificato un errore. Riprova.";

      switch (firebaseError.code) {
        case "auth/email-already-in-use":
          errorMessage = "Questa email è già registrata. Prova ad accedere.";
          break;
        case "auth/invalid-email":
          errorMessage = "Formato email non valido.";
          break;
        case "auth/weak-password":
          errorMessage = "La password deve contenere almeno 6 caratteri.";
          break;
        case "auth/user-not-found":
          errorMessage = "Nessun account trovato con questa email.";
          break;
        case "auth/wrong-password":
          errorMessage = "Password non corretta.";
          break;
        case "auth/invalid-credential":
          errorMessage = "Email o password non corretti.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Troppi tentativi falliti. Riprova più tardi.";
          break;
        case "auth/network-request-failed":
          errorMessage = "Errore di connessione. Controlla la tua rete.";
          break;
        case "auth/operation-not-allowed":
          errorMessage = "Operazione non consentita. Contatta il supporto.";
          break;
        case "auth/user-disabled":
          errorMessage = "Questo account è stato disabilitato.";
          break;
        case "auth/requires-recent-login":
          errorMessage = "Per sicurezza, effettua nuovamente il login.";
          break;
        case "auth/popup-closed-by-user":
        case "auth/cancelled-popup-request":
          errorMessage = "Login annullato.";
          break;
        default:
          errorMessage = firebaseError.message || errorMessage;
      }

      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
      const firebaseError = error as { message?: string };
      alert(`Error signing out: ${firebaseError.message || "Unknown error"}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#1E293B]">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-white font-bold text-3xl">
                {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-[#0F172A] mb-2">
              Welcome, {user.displayName || user.email}!
            </h1>
            <p className="text-[#1E293B]">You are successfully signed in.</p>
          </div>
          <Button
            onClick={handleSignOut}
            className="bg-[#1E293B] text-white font-semibold px-8 py-6 rounded-full hover:bg-[#0F172A] transition-all duration-200 cursor-pointer"
          >
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 sm:p-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-2xl">F</span>
            </div>
            <span className="text-3xl font-semibold text-[#0F172A]">
              FinTrack
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[#0F172A] mb-2">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-[#1E293B]">
            {mode === "login"
              ? "Sign in to manage your finances"
              : "Start managing your finances today"}
          </p>
        </div>

        {/* Toggle Mode */}
        <div className="flex items-center justify-center mb-6 bg-gray-100 rounded-full p-1">
          <button
            onClick={() => {
              setMode("login");
              setError("");
              setPassword("");
              setConfirmPassword("");
              setName("");
            }}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all duration-200 ${
              mode === "login"
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#1E293B] hover:text-[#0F172A]"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setMode("register");
              setError("");
              setPassword("");
              setConfirmPassword("");
              setName("");
            }}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all duration-200 ${
              mode === "register"
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#1E293B] hover:text-[#0F172A]"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-2">
                Full Name
              </label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
                variant="flat"
                classNames={{
                  base: "w-full",
                  input: "text-[#0F172A] text-base outline-none border-none focus:outline-none focus:border-none",
                  inputWrapper: "!bg-gray-50 !border-0 !border-none shadow-none hover:bg-gray-100 focus-within:bg-gray-100 focus-within:ring-2 focus-within:ring-[#22C55E] focus-within:ring-offset-0 focus-within:!border-0 focus-within:!border-none rounded-xl transition-all duration-200 [&_input]:outline-none [&_input]:border-none [&_input]:focus:outline-none [&_input]:focus:border-none",
                }}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-2">
              Email
            </label>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              variant="flat"
              classNames={{
                base: "w-full",
                input: "text-[#0F172A] text-base outline-none border-none focus:outline-none focus:border-none",
                inputWrapper: "!bg-gray-50 !border-0 !border-none shadow-none hover:bg-gray-100 focus-within:bg-gray-100 focus-within:ring-2 focus-within:ring-[#22C55E] focus-within:ring-offset-0 focus-within:!border-0 focus-within:!border-none rounded-xl transition-all duration-200 [&_input]:outline-none [&_input]:border-none [&_input]:focus:outline-none [&_input]:focus:border-none",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-2">
              Password
            </label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              required
              disabled={isSubmitting}
              variant="flat"
              endContent={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="focus:outline-none hover:opacity-70 transition-opacity"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              }
              classNames={{
                base: "w-full",
                input: "text-[#0F172A] text-base outline-none border-none focus:outline-none focus:border-none",
                inputWrapper: "!bg-gray-50 !border-0 !border-none shadow-none hover:bg-gray-100 focus-within:bg-gray-100 focus-within:ring-2 focus-within:ring-[#22C55E] focus-within:ring-offset-0 focus-within:!border-0 focus-within:!border-none rounded-xl transition-all duration-200 [&_input]:outline-none [&_input]:border-none [&_input]:focus:outline-none [&_input]:focus:border-none",
              }}
            />
          </div>

          {/* Password Strength Indicator (only for register) */}
          {mode === "register" && password && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      level <= (passwordStrength?.strength || 0)
                        ? level <= 2
                          ? "bg-red-400"
                          : level <= 4
                          ? "bg-yellow-400"
                          : "bg-[#22C55E]"
                        : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <PasswordCheck
                  checked={passwordStrength?.checks.length || false}
                  label="At least 8 characters"
                />
                <PasswordCheck
                  checked={passwordStrength?.checks.uppercase || false}
                  label="One uppercase letter"
                />
                <PasswordCheck
                  checked={passwordStrength?.checks.lowercase || false}
                  label="One lowercase letter"
                />
                <PasswordCheck
                  checked={passwordStrength?.checks.number || false}
                  label="One number"
                />
                <PasswordCheck
                  checked={passwordStrength?.checks.special || false}
                  label="One special character"
                  className="col-span-2"
                />
              </div>
            </div>
          )}

          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-2">
                Confirm Password
              </label>
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                required
                disabled={isSubmitting}
                variant="flat"
                isInvalid={
                  confirmPassword !== "" && password !== confirmPassword
                }
                errorMessage={
                  confirmPassword !== "" && password !== confirmPassword
                    ? "Passwords do not match"
                    : ""
                }
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="focus:outline-none hover:opacity-70 transition-opacity"
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                }
                classNames={{
                  base: "w-full",
                  input: "text-[#0F172A] text-base outline-none border-none focus:outline-none focus:border-none",
                  inputWrapper: "!bg-gray-50 !border-0 !border-none shadow-none hover:bg-gray-100 focus-within:bg-gray-100 focus-within:ring-2 focus-within:ring-[#22C55E] focus-within:ring-offset-0 focus-within:!border-0 focus-within:!border-none rounded-xl transition-all duration-200 [&_input]:outline-none [&_input]:border-none [&_input]:focus:outline-none [&_input]:focus:border-none data-[invalid=true]:ring-2 data-[invalid=true]:ring-red-500 data-[invalid=true]:focus-within:ring-red-500",
                  errorMessage: "text-red-500 text-xs mt-1",
                }}
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#22C55E] text-white font-semibold text-base px-6 py-6 rounded-full hover:bg-[#16A34A] transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </div>
            ) : (
              mode === "login" ? "Sign In" : "Create Account"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          By continuing, you agree to FinTrack&apos;s Terms of Service and Privacy
          Policy
        </p>
      </div>
    </div>
  );
}

function PasswordCheck({
  checked,
  label,
  className = "",
}: {
  checked: boolean;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 transition-all duration-200 ${
        checked ? "text-[#22C55E]" : "text-gray-400"
      } ${className}`}
    >
      <div
        className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
          checked
            ? "bg-[#22C55E] border-[#22C55E]"
            : "bg-white border-2 border-gray-300"
        }`}
      >
        {checked && <CheckIcon className="w-3 h-3 text-white" />}
      </div>
      <span className="text-xs">{label}</span>
    </div>
  );
}