"use client";

import { Fragment, useEffect } from "react";
import { Transition } from "@headlessui/react";
import {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  show: boolean;
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  show,
  message,
  type,
  onClose,
  duration = 5000,
}: ToastProps) {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  const icons = {
    success: <CheckCircleIcon className="w-6 h-6 text-[#22C55E]" />,
    error: <XCircleIcon className="w-6 h-6 text-red-500" />,
    info: <InformationCircleIcon className="w-6 h-6 text-blue-500" />,
  };

  const bgColors = {
    success: "bg-[#22C55E]/10 border-[#22C55E]/30",
    error: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
  };

  return (
    <Transition
      show={show}
      as={Fragment}
      enter="transform ease-out duration-300 transition"
      enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enterTo="translate-y-0 opacity-100 sm:translate-x-0"
      leave="transition ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
        <div
          className={`${bgColors[type]} border rounded-2xl shadow-lg p-4 backdrop-blur-sm`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">{icons[type]}</div>
            <div className="flex-1 pt-0.5">
              <p className="text-sm font-medium text-[#0F172A]">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 inline-flex text-gray-400 hover:text-gray-500 focus:outline-none transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  );
}








