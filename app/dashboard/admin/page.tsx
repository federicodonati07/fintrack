"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getUserDocument,
  getAllUsers,
  getAllPlanLimits,
  updatePlanLimits,
  initializePlanLimits,
  getAllPromoCodes,
  createPromoCode,
  updateUserPlanAdmin,
  deleteUserDataAdmin,
} from "@/lib/firestore";
import { User, PlanLimits, PromoCode } from "@/lib/types";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import {
  ShieldCheckIcon,
  UserGroupIcon,
  CogIcon,
  TagIcon,
  CreditCardIcon,
  CheckIcon,
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChartBarIcon as ChartIcon,
} from "@heroicons/react/24/outline";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<(User & { uid: string })[]>([]);
  const [planLimits, setPlanLimits] = useState<Record<string, PlanLimits>>({});
  const [editedLimits, setEditedLimits] = useState<Record<string, PlanLimits["limits"]>>({});
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [promoCodes, setPromoCodes] = useState<(PromoCode & { id: string })[]>([]);
  const [selectedTab, setSelectedTab] = useState("users");
  const [limitsInitialized, setLimitsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<(User & { uid: string }) | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newPlan, setNewPlan] = useState<"free" | "pro" | "ultra" | "admin">("free");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth");
        return;
      }
      setCurrentUser(user);

      try {
        const userDoc = await getUserDocument(user.uid);
        if (!userDoc || (userDoc.role !== "admin" && userDoc.plan !== "admin")) {
          showToast("Access denied. Admin privileges required.", "error");
          router.push("/dashboard");
          return;
        }

        setIsAdmin(true);
        await loadAdminData();
      } catch (error) {
        console.error("Error checking admin access:", error);
        router.push("/dashboard");
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadAdminData = async () => {
    try {
      const [usersData, limitsData, promosData] = await Promise.all([
        getAllUsers(),
        getAllPlanLimits(),
        getAllPromoCodes(),
      ]);

      setUsers(usersData);
      setPlanLimits(limitsData);
      
      // Check if limits are already initialized
      const hasLimits = Object.keys(limitsData).length > 0;
      setLimitsInitialized(hasLimits);
      
      // Initialize edited limits with current values
      const initialEdited: Record<string, PlanLimits["limits"]> = {};
      Object.entries(limitsData).forEach(([plan, data]) => {
        initialEdited[plan] = { ...data.limits };
      });
      setEditedLimits(initialEdited);
      
      setPromoCodes(promosData);
    } catch (error) {
      console.error("Error loading admin data:", error);
      showToast("Error loading admin data", "error");
    }
  };

  const handleInitializeLimits = async () => {
    try {
      await initializePlanLimits();
      await loadAdminData();
      setLimitsInitialized(true);
      showToast("✅ Plan limits initialized successfully!", "success");
    } catch (error) {
      console.error("Error initializing limits:", error);
      showToast("❌ Error initializing limits", "error");
    }
  };

  const handleLimitChange = (plan: string, field: string, value: number) => {
    setEditedLimits((prev) => ({
      ...prev,
      [plan]: {
        ...prev[plan],
        [field]: value,
      },
    }));
  };

  const handleSavePlanLimits = async (plan: string) => {
    setSavingPlan(plan);
    try {
      await updatePlanLimits(plan as any, editedLimits[plan]);
      await loadAdminData();
      showToast(`✅ ${plan.toUpperCase()} plan limits saved successfully!`, "success");
    } catch (error) {
      console.error("Error updating limits:", error);
      showToast("❌ Error saving limits", "error");
    } finally {
      setSavingPlan(null);
    }
  };

  const handleEditUser = (user: User & { uid: string }) => {
    setSelectedUser(user);
    setNewPlan(user.plan as any);
    setNewRole(user.role);
    setShowEditModal(true);
  };

  const handleUpdateUserPlan = async () => {
    if (!selectedUser) return;
    
    try {
      await updateUserPlanAdmin(selectedUser.uid, newPlan, newRole);
      await loadAdminData();
      setShowEditModal(false);
      setSelectedUser(null);
      showToast(`✅ User updated: ${newPlan.toUpperCase()} plan, ${newRole.toUpperCase()} role!`, "success");
    } catch (error) {
      console.error("Error updating user:", error);
      showToast("❌ Error updating user", "error");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await deleteUserDataAdmin(selectedUser.uid);
      await loadAdminData();
      setShowDeleteModal(false);
      setSelectedUser(null);
      showToast("✅ User deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting user:", error);
      showToast("❌ Error deleting user", "error");
    }
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.name.toLowerCase().includes(query) ||
      user.plan.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  });

  // Prepare chart data
  const userGrowthData = useMemo(() => {
    const sortedUsers = [...users].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
      const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
      return dateA - dateB;
    });

    const dataPoints: { date: string; count: number }[] = [];
    let cumulativeCount = 0;

    sortedUsers.forEach((user) => {
      if (user.createdAt?.toDate) {
        cumulativeCount++;
        const date = user.createdAt.toDate().toLocaleDateString("it-IT");
        const existingPoint = dataPoints.find((p) => p.date === date);
        if (existingPoint) {
          existingPoint.count = cumulativeCount;
        } else {
          dataPoints.push({ date, count: cumulativeCount });
        }
      }
    });

    return {
      labels: dataPoints.map((p) => p.date),
      datasets: [
        {
          label: "Total Users",
          data: dataPoints.map((p) => p.count),
          borderColor: "#16A34A",
          backgroundColor: (context: any) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, "rgba(34, 197, 94, 0.3)");
            gradient.addColorStop(0.5, "rgba(34, 197, 94, 0.15)");
            gradient.addColorStop(1, "rgba(34, 197, 94, 0.02)");
            return gradient;
          },
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#16A34A",
          pointBorderWidth: 3,
          pointHoverBackgroundColor: "#22C55E",
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 3,
        },
      ],
    };
  }, [users]);

  const planDistributionData = useMemo(() => {
    const planCounts = users.reduce((acc, user) => {
      acc[user.plan] = (acc[user.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const planOrder = ["free", "pro", "ultra", "admin"];
    const sortedPlans = planOrder.filter((plan) => planCounts[plan]);
    const sortedCounts = sortedPlans.map((plan) => planCounts[plan]);

    return {
      labels: sortedPlans.map((p) => p.toUpperCase()),
      datasets: [
        {
          data: sortedCounts,
          backgroundColor: [
            "#94A3B8", // Free - Gray
            "#3B82F6", // Pro - Blue
            "#22C55E", // Ultra - Green
            "#A855F7", // Admin - Purple
          ],
          borderColor: "#ffffff",
          borderWidth: 4,
          hoverOffset: 16,
          hoverBorderColor: "#ffffff",
          hoverBorderWidth: 5,
        },
      ],
    };
  }, [users]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-lg text-[#1E293B] font-medium">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={hideToast} />

      <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#334155] border-b border-gray-700 px-8 py-8">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-gray-300 hover:text-white mb-6 transition-colors group"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center shadow-xl">
              <ShieldCheckIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Admin Control Panel</h1>
              <p className="text-gray-300">System management and configuration</p>
            </div>
          </div>
        </div>
      </div>

      <main className="px-8 py-10 bg-gradient-to-br from-gray-50 via-white to-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <TabGroup>
            <TabList className="flex gap-2 bg-white rounded-2xl p-2 shadow-md border border-gray-100">
              <Tab className={({ selected }) =>
                `flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  selected
                    ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`
              }>
                <UserGroupIcon className="w-5 h-5" />
                Users
              </Tab>
              <Tab className={({ selected }) =>
                `flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  selected
                    ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`
              }>
                <ChartIcon className="w-5 h-5" />
                Analytics
              </Tab>
              <Tab className={({ selected }) =>
                `flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  selected
                    ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`
              }>
                <CogIcon className="w-5 h-5" />
                Plan Limits
              </Tab>
              <Tab className={({ selected }) =>
                `flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  selected
                    ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`
              }>
                <TagIcon className="w-5 h-5" />
                Promos
              </Tab>
              <Tab className={({ selected }) =>
                `flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  selected
                    ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`
              }>
                <CreditCardIcon className="w-5 h-5" />
                Stripe
              </Tab>
            </TabList>

            <TabPanels className="mt-6">
              {/* Users Tab */}
              <TabPanel>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Header */}
                  <div className="bg-[#0F172A] p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-[#22C55E] flex items-center justify-center">
                        <UserGroupIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">User Management</h2>
                        <p className="text-gray-300 text-sm mt-0.5">
                          View and manage all registered users
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Search and Table */}
                  <div className="p-6 space-y-5">
                    {/* Search Bar */}
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search users by email, name, plan, or role..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-11 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] transition-all"
                      />
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <Table 
                        aria-label="Users table"
                        isStriped
                        classNames={{
                          wrapper: "shadow-none",
                          th: "bg-gray-50 text-[#0F172A] font-bold text-xs uppercase",
                          td: "py-4",
                        }}
                      >
                        <TableHeader>
                          <TableColumn>EMAIL</TableColumn>
                          <TableColumn>NAME</TableColumn>
                          <TableColumn>PLAN</TableColumn>
                          <TableColumn>ROLE</TableColumn>
                          <TableColumn>CREATED</TableColumn>
                          <TableColumn>ACTIONS</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent="No users found">
                          {filteredUsers.map((user) => (
                            <TableRow key={user.uid} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="font-medium">{user.email}</TableCell>
                              <TableCell>{user.name || "—"}</TableCell>
                              <TableCell>
                                <Chip
                                  className="font-semibold"
                                  size="sm"
                                  color={
                                    user.plan === "admin"
                                      ? "secondary"
                                      : user.plan === "ultra"
                                      ? "success"
                                      : user.plan === "pro"
                                      ? "primary"
                                      : "default"
                                  }
                                  variant="flat"
                                >
                                  {user.plan.toUpperCase()}
                                </Chip>
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  className="font-semibold"
                                  size="sm"
                                  color={user.role === "admin" ? "danger" : "default"} 
                                  variant="flat"
                                >
                                  {user.role.toUpperCase()}
                                </Chip>
                              </TableCell>
                              <TableCell className="text-gray-600 text-sm">
                                {user.createdAt?.toDate?.()?.toLocaleDateString("it-IT") || "N/A"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEditUser(user)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit plan"
                                  >
                                    <PencilIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setShowDeleteModal(true);
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete user"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </TabPanel>

              {/* Analytics Tab */}
              <TabPanel>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* User Growth Chart */}
                  <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
                    <div className="bg-gradient-to-br from-[#22C55E] via-[#16A34A] to-[#15803D] p-6 relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/5"></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
                              <ChartIcon className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold text-white">User Growth</h2>
                              <p className="text-green-100 text-sm mt-1">
                                📈 Cumulative registrations
                              </p>
                            </div>
                          </div>
                          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/30">
                            <p className="text-3xl font-black text-white">{users.length}</p>
                            <p className="text-xs text-green-100 font-semibold">Total Users</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-6 border-2 border-green-100 shadow-inner">
                        <Line
                          data={userGrowthData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: true,
                            aspectRatio: 1.4,
                            plugins: {
                              legend: {
                                display: false,
                              },
                              tooltip: {
                                backgroundColor: "rgba(22, 163, 74, 0.95)",
                                padding: 16,
                                borderRadius: 12,
                                titleFont: { size: 15, weight: "bold" },
                                bodyFont: { size: 14 },
                                titleColor: "#ffffff",
                                bodyColor: "#ffffff",
                                borderColor: "rgba(255, 255, 255, 0.2)",
                                borderWidth: 1,
                                displayColors: false,
                                callbacks: {
                                  title: (items) => `📅 ${items[0].label}`,
                                  label: (context) => `👥 ${context.parsed.y} users`,
                                },
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                ticks: {
                                  precision: 0,
                                  font: { size: 12, weight: "600" },
                                  color: "#16A34A",
                                  padding: 8,
                                },
                                grid: {
                                  color: "rgba(34, 197, 94, 0.08)",
                                  lineWidth: 2,
                                },
                                border: {
                                  display: false,
                                },
                              },
                              x: {
                                ticks: {
                                  font: { size: 11, weight: "600" },
                                  color: "#15803D",
                                  maxRotation: 45,
                                  minRotation: 45,
                                  padding: 8,
                                },
                                grid: {
                                  display: false,
                                },
                                border: {
                                  display: false,
                                },
                              },
                            },
                            interaction: {
                              intersect: false,
                              mode: "index",
                            },
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Plan Distribution Chart */}
                  <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
                    <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-6 relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/5"></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
                              <ChartIcon className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold text-white">Plan Distribution</h2>
                              <p className="text-blue-100 text-sm mt-1">
                                🎯 Subscription breakdown
                              </p>
                            </div>
                          </div>
                          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/30">
                            <p className="text-3xl font-black text-white">
                              {Object.keys(users.reduce((acc, u) => ({ ...acc, [u.plan]: 1 }), {})).length}
                            </p>
                            <p className="text-xs text-blue-100 font-semibold">Plan Types</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-100 shadow-inner">
                        <div className="max-w-sm mx-auto">
                          <Pie
                            data={planDistributionData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: true,
                              plugins: {
                                legend: {
                                  position: "bottom",
                                  labels: {
                                    padding: 20,
                                    font: { size: 14, weight: "700" },
                                    color: "#1E293B",
                                    usePointStyle: true,
                                    pointStyle: "circle",
                                    boxWidth: 12,
                                    boxHeight: 12,
                                  },
                                },
                                tooltip: {
                                  backgroundColor: "rgba(59, 130, 246, 0.95)",
                                  padding: 16,
                                  borderRadius: 12,
                                  titleFont: { size: 15, weight: "bold" },
                                  bodyFont: { size: 14 },
                                  titleColor: "#ffffff",
                                  bodyColor: "#ffffff",
                                  borderColor: "rgba(255, 255, 255, 0.2)",
                                  borderWidth: 1,
                                  displayColors: true,
                                  boxWidth: 16,
                                  boxHeight: 16,
                                  boxPadding: 8,
                                  callbacks: {
                                    title: (items) => `${items[0].label} Plan`,
                                    label: (context) => {
                                      const label = context.label || "";
                                      const value = context.parsed || 0;
                                      const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                      const percentage = ((value / total) * 100).toFixed(1);
                                      return [
                                        `Users: ${value}`,
                                        `Percentage: ${percentage}%`,
                                      ];
                                    },
                                  },
                                },
                              },
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabPanel>

              {/* Plan Limits Tab */}
              <TabPanel>
                <div className="space-y-6">
                  {!limitsInitialized && (
                    <div className="flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 shadow-md">
                      <div>
                        <h3 className="text-lg font-bold text-amber-900">⚠️ Setup Required</h3>
                        <p className="text-sm text-amber-700 mt-1">
                          Plan limits not initialized. Click to set up default values.
                        </p>
                      </div>
                      <Button
                        onClick={handleInitializeLimits}
                        className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-2xl hover:shadow-lg hover:shadow-[#22C55E]/30 transition-all px-6 font-semibold"
                      >
                        Initialize Defaults
                      </Button>
                    </div>
                  )}

                {/* 2x2 Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.entries(planLimits)
                    .sort((a, b) => {
                      const order = { free: 0, pro: 1, ultra: 2, admin: 3 };
                      return (order[a[0] as keyof typeof order] || 99) - (order[b[0] as keyof typeof order] || 99);
                    })
                    .map(([planName, plan]) => {
                    const colors = {
                      free: { from: "from-gray-500", to: "to-gray-600", bg: "bg-gray-50", border: "border-gray-200" },
                      pro: { from: "from-blue-500", to: "to-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
                      ultra: { from: "from-[#22C55E]", to: "to-[#16A34A]", bg: "bg-green-50", border: "border-green-200" },
                      admin: { from: "from-purple-600", to: "to-indigo-600", bg: "bg-purple-50", border: "border-purple-200" },
                    };
                    const color = colors[planName as keyof typeof colors] || colors.free;

                    return (
                      <div key={planName} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className={`bg-gradient-to-r ${color.from} ${color.to} p-5`}>
                          <div className="flex flex-col gap-3">
                            <div>
                              <h3 className="text-xl font-bold text-white capitalize">{planName} Plan</h3>
                              <p className="text-white/80 text-xs mt-1">
                                Configure limits
                              </p>
                            </div>
                            <Button
                              onClick={() => handleSavePlanLimits(planName)}
                              disabled={savingPlan === planName}
                              className={`w-full bg-white/20 hover:bg-white/30 text-white border-2 border-white/30 rounded-xl font-semibold transition-all ${
                                savingPlan === planName ? "opacity-50" : ""
                              }`}
                              startContent={<CheckIcon className="w-4 h-4" />}
                              size="sm"
                            >
                              {savingPlan === planName ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </div>

                        {/* Limits Grid */}
                        <div className="p-5 flex-1">
                          <div className="grid grid-cols-2 gap-4">
                            {editedLimits[planName] &&
                              Object.entries(editedLimits[planName]).map(([key, value]) => (
                                <div key={key} className="space-y-1.5">
                                  <label
                                    htmlFor={`${planName}-${key}`}
                                    className="block text-xs font-semibold text-[#0F172A] capitalize"
                                  >
                                    {key}
                                  </label>
                                  <input
                                    id={`${planName}-${key}`}
                                    type="number"
                                    value={value}
                                    onChange={(e) =>
                                      handleLimitChange(planName, key, parseInt(e.target.value) || 0)
                                    }
                                    className={`w-full h-11 px-3 ${color.bg} ${color.border} border-2 rounded-xl text-[#0F172A] font-semibold text-base focus:outline-none focus:ring-2 focus:ring-[#22C55E] transition-all`}
                                    min="0"
                                  />
                                  <p className="text-[10px] text-gray-500">
                                    Current: <span className="font-semibold">{plan.limits[key as keyof typeof plan.limits]}</span>
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              </TabPanel>

              {/* Promo Codes Tab */}
              <TabPanel>
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <TagIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">Promo Codes</h2>
                        <p className="text-gray-300 text-sm mt-1">
                          Manage discount codes and promotions
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8">
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-6">
                      <p className="text-amber-800 font-medium">
                        🚧 Promo code management coming soon...
                      </p>
                      <p className="text-amber-600 text-sm mt-2">
                        Create and manage promotional discount codes
                      </p>
                    </div>

                    {promoCodes.length > 0 && (
                      <div className="overflow-x-auto">
                        <Table 
                          aria-label="Promo codes table"
                          classNames={{
                            wrapper: "shadow-none",
                          }}
                        >
                          <TableHeader>
                            <TableColumn className="bg-gray-50 text-[#0F172A] font-bold">CODE</TableColumn>
                            <TableColumn className="bg-gray-50 text-[#0F172A] font-bold">DISCOUNT</TableColumn>
                            <TableColumn className="bg-gray-50 text-[#0F172A] font-bold">USES</TableColumn>
                            <TableColumn className="bg-gray-50 text-[#0F172A] font-bold">STATUS</TableColumn>
                          </TableHeader>
                          <TableBody emptyContent="No promo codes created yet">
                            {promoCodes.map((promo) => (
                              <TableRow key={promo.id} className="hover:bg-gray-50 transition-colors">
                                <TableCell className="font-mono font-bold">{promo.code}</TableCell>
                                <TableCell className="font-semibold">{promo.discountPercent}%</TableCell>
                                <TableCell>
                                  {promo.currentUses} / {promo.maxUses}
                                </TableCell>
                                <TableCell>
                                  <Chip 
                                    className="font-semibold"
                                    color={promo.active ? "success" : "danger"} 
                                    variant="flat"
                                  >
                                    {promo.active ? "Active" : "Inactive"}
                                  </Chip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </TabPanel>

              {/* Stripe Settings Tab */}
              <TabPanel>
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                        <CreditCardIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">Stripe Integration</h2>
                        <p className="text-gray-300 text-sm mt-1">
                          Configure payment processing and pricing
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8">
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                      <p className="text-blue-800 font-medium">
                        🚧 Stripe pricing management coming soon...
                      </p>
                      <p className="text-blue-600 text-sm mt-2">
                        Manage subscription prices and payment settings
                      </p>
                    </div>
                  </div>
                </div>
              </TabPanel>
            </TabPanels>
          </TabGroup>
        </div>
      </main>

      {/* Edit User Plan Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <PencilIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Edit User Plan</h2>
                  <p className="text-xs text-gray-500 mt-1">Update subscription plan</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-5 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
                <p className="text-base font-semibold text-[#0F172A]">{selectedUser.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Plan</label>
                <div className="grid grid-cols-2 gap-3">
                  {["free", "pro", "ultra", "admin"].map((plan) => (
                    <button
                      key={plan}
                      onClick={() => setNewPlan(plan as any)}
                      className={`p-3 rounded-xl font-semibold text-sm transition-all ${
                        newPlan === plan
                          ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {plan.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {["user", "admin"].map((role) => (
                    <button
                      key={role}
                      onClick={() => setNewRole(role as any)}
                      className={`p-3 rounded-xl font-semibold text-sm transition-all ${
                        newRole === role
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {role.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-100">
              <Button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1 bg-gray-100 text-[#0F172A] rounded-2xl hover:bg-gray-200 font-semibold h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateUserPlan}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:shadow-lg hover:scale-105 transition-all font-semibold h-12"
              >
                Update Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                  <TrashIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Delete User</h2>
                  <p className="text-xs text-gray-500 mt-1">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-6 mb-6">
              <p className="text-gray-700 text-center mb-2">
                Are you sure you want to delete this user?
              </p>
              <p className="text-sm font-semibold text-[#0F172A] text-center mb-2">
                {selectedUser.email}
              </p>
              <p className="text-xs text-gray-600 text-center">
                All user data including categories, funds, and goals will be permanently deleted.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1 bg-gray-100 text-[#0F172A] rounded-2xl hover:bg-gray-200 font-semibold h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteUser}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl hover:shadow-lg hover:scale-105 transition-all font-semibold h-12"
              >
                Delete Forever
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

