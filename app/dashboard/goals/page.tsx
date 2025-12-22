"use client";

import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

export default function GoalsPage() {
  const router = useRouter();

  return (
    <>
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] transition-colors mb-4 group"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <h1 className="text-2xl font-semibold text-[#0F172A]">Obiettivi</h1>
        <p className="text-sm text-gray-500 mt-1">I tuoi obiettivi di risparmio</p>
      </div>

      <main className="px-8 py-8 bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Funzionalità in arrivo</p>
        </div>
      </main>
    </>
  );
}


