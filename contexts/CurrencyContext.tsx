"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserDocument } from "@/lib/firestore";
import { getCurrencyByCode, type Currency } from "@/lib/currencies";

interface CurrencyContextType {
  currency: Currency;
  currencyCode: string;
  setCurrencyCode: (code: string) => void;
  formatAmount: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencyCode, setCurrencyCodeState] = useState("EUR");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getUserDocument(user.uid);
          if (userDoc?.currency) {
            setCurrencyCodeState(userDoc.currency);
          }
        } catch (error) {
          console.error("Error loading user currency:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const setCurrencyCode = (code: string) => {
    setCurrencyCodeState(code);
  };

  const currency = getCurrencyByCode(currencyCode) || {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    flag: "🇪🇺",
  };

  const formatAmount = (amount: number) => {
    return `${currency.symbol}${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencyCode,
        setCurrencyCode,
        formatAmount,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}



