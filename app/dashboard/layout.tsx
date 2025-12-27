"use client";

import Sidebar from "@/components/Sidebar";
import { CurrencyProvider } from "@/contexts/CurrencyContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CurrencyProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="lg:pl-64 transition-all duration-300" id="dashboard-main">
          {children}
        </main>
      </div>
    </CurrencyProvider>
  );
}

