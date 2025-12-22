"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  HomeIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  TagIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CurrencyEuroIcon,
  FlagIcon,
  BoltIcon,
  ArrowsUpDownIcon,
  UserCircleIcon,
  Cog8ToothIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
  WalletIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserDocument } from "@/lib/firestore";
import { useEffect } from "react";

interface NavItem {
  label: string;
  href?: string;
  icon?: any;
  children?: NavItem[];
  divider?: boolean;
  section?: string;
}

const navigationItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: HomeIcon,
  },
  {
    label: "Accounts / Funds",
    href: "/dashboard/accounts",
    icon: BanknotesIcon,
  },
  {
    label: "Transactions",
    icon: ArrowsRightLeftIcon,
    children: [
      { label: "Income / Expenses", href: "/dashboard/transactions" },
      { label: "All Transactions", href: "/dashboard/transactions/all" },
    ],
  },
  {
    label: "Categories",
    href: "/dashboard/categories",
    icon: TagIcon,
  },
  { divider: true, section: "Analysis" },
  {
    label: "Reports",
    icon: DocumentTextIcon,
    children: [
      { label: "Monthly Report", href: "/dashboard/reports/monthly" },
      { label: "Annual Report", href: "/dashboard/reports/yearly" },
      { label: "Category Breakdown", href: "/dashboard/reports/categories" },
    ],
  },
  {
    label: "Budget",
    href: "/dashboard/budget",
    icon: CurrencyEuroIcon,
  },
  {
    label: "Goals",
    href: "/dashboard/goals",
    icon: FlagIcon,
  },
];

const accountItems: NavItem[] = [
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Cog8ToothIcon,
  },
  {
    label: "Plan",
    href: "/dashboard/plan",
    icon: ChartBarIcon,
  },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (user) {
        setCurrentUserId(user.uid);
        const userDoc = await getUserDocument(user.uid);
        if (userDoc && (userDoc.role === "admin" || userDoc.plan === "admin")) {
          setIsAdmin(true);
        }
      }
    };

    checkAdmin();
  }, []);

  // Update main content padding when sidebar is collapsed
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    const mainContent = document.getElementById("dashboard-main");
    if (mainContent) {
      if (!isCollapsed) {
        mainContent.classList.remove("lg:pl-64");
        mainContent.classList.add("lg:pl-20");
      } else {
        mainContent.classList.remove("lg:pl-20");
        mainContent.classList.add("lg:pl-64");
      }
    }
  };

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const renderNavItem = (item: NavItem, index: number) => {
    if (item.divider) {
      return (
        <div key={`divider-${index}`} className="my-6">
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {item.section}
            </p>
          </div>
          <div className="h-px bg-gray-100"></div>
        </div>
      );
    }

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.label);
    const isActive = item.href === pathname;
    const Icon = item.icon;

    if (hasChildren) {
      return (
        <div key={item.label} className="mb-1">
          <button
            onClick={() => toggleExpand(item.label)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#0F172A] hover:bg-gray-50 rounded-lg transition-colors group cursor-pointer"
            title={isCollapsed ? item.label : undefined}
          >
            <div className="flex items-center gap-3">
              {Icon && <Icon className="w-5 h-5 text-gray-400 group-hover:text-[#22C55E] flex-shrink-0" />}
              {!isCollapsed && <span>{item.label}</span>}
            </div>
            {!isCollapsed && (
              <ChevronDownIcon
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            )}
          </button>
          {isExpanded && !isCollapsed && (
            <div className="ml-8 mt-1 space-y-1">
              {item.children.map((child) => {
                const isChildActive = child.href === pathname;
                const ChildIcon = child.icon;
                return (
                  <button
                    key={child.label}
                    onClick={() => {
                      if (child.href) router.push(child.href);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                      isChildActive
                        ? "text-[#22C55E] bg-[#22C55E]/5 font-medium"
                        : "text-gray-600 hover:text-[#0F172A] hover:bg-gray-50"
                    }`}
                  >
                    {ChildIcon && <ChildIcon className="w-4 h-4" />}
                    {child.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.label}
        onClick={() => {
          if (item.href) router.push(item.href);
          setMobileOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors mb-1 cursor-pointer ${
          isActive
            ? "text-[#22C55E] bg-[#22C55E]/5"
            : "text-gray-700 hover:text-[#0F172A] hover:bg-gray-50"
        }`}
        title={isCollapsed ? item.label : undefined}
      >
        {Icon && (
          <Icon
            className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-[#22C55E]" : "text-gray-400 group-hover:text-[#22C55E]"}`}
          />
        )}
        {!isCollapsed && item.label}
      </button>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          {!isCollapsed && <span className="text-lg font-semibold text-[#0F172A]">FinTrack</span>}
        </div>
        {/* Collapse Toggle Button - Only on Desktop */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:block p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronDownIcon
            className={`w-5 h-5 text-gray-500 transition-transform ${
              isCollapsed ? "rotate-90" : "-rotate-90"
            }`}
          />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          {navigationItems.map((item, index) => renderNavItem(item, index))}
        </nav>
      </div>

      {/* Account Section */}
      <div className="border-t border-gray-100 px-3 py-4">
        {!isCollapsed && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
              Account
            </p>
          </div>
        )}
        <nav className="space-y-1">
          {isAdmin && (
            <button
              onClick={() => {
                router.push("/dashboard/admin");
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors mb-1 cursor-pointer ${
                pathname === "/dashboard/admin"
                  ? "text-purple-600 bg-purple-50"
                  : "text-gray-700 hover:text-purple-600 hover:bg-purple-50"
              }`}
              title={isCollapsed ? "Admin" : undefined}
            >
              <ShieldCheckIcon
                className={`w-5 h-5 flex-shrink-0 ${pathname === "/dashboard/admin" ? "text-purple-600" : "text-gray-400"}`}
              />
              {!isCollapsed && "Admin Dashboard"}
            </button>
          )}
          {accountItems.map((item, index) => renderNavItem(item, index))}
        </nav>
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors mt-2 cursor-pointer"
          title={isCollapsed ? "Logout" : undefined}
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0 text-red-600" />
          {!isCollapsed && "Logout"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
      >
        {mobileOpen ? (
          <XMarkIcon className="w-6 h-6 text-gray-600" />
        ) : (
          <Bars3Icon className="w-6 h-6 text-gray-600" />
        )}
      </button>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed top-0 left-0 w-72 h-full bg-white z-50 shadow-2xl">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-100 transition-all duration-300 ${
          isCollapsed ? "lg:w-20" : "lg:w-64"
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
