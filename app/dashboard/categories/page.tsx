"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getUserDocument,
  getUserCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getPlanLimits,
} from "@/lib/firestore";
import { Category } from "@/lib/types";
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  TagIcon,
  ArrowsRightLeftIcon,
  CheckIcon,
  ChevronUpDownIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Button, Card, CardBody } from "@heroui/react";
import { Listbox, Transition } from "@headlessui/react";
import { Fragment } from "react";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";

type Plan = "free" | "pro" | "ultra" | "admin";

type CategoryWithId = Category & { id: string };

const PREDEFINED_COLORS = [
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#22C55E", // Green
  "#06B6D4", // Cyan
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#A855F7", // Purple
  "#EAB308", // Yellow
];

export default function CategoriesPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<Plan>("free");
  const [limit, setLimit] = useState(10);
  const [categories, setCategories] = useState<CategoryWithId[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithId | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "custom" as "fixed" | "variable" | "custom",
    color: PREDEFINED_COLORS[0],
  });
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/auth");
        return;
      }
      setUser(currentUser);

      try {
        const userDoc = await getUserDocument(currentUser.uid);
        if (userDoc) {
          const plan = userDoc.plan as Plan;
          setUserPlan(plan);
          
          // Fetch dynamic plan limits
          const planLimits = await getPlanLimits(plan);
          setLimit(planLimits.categories);
        }

        // Fetch categories
        const userCategories = await getUserCategories(currentUser.uid);
        setCategories(userCategories);
      } catch (error) {
        console.error("Error fetching data:", error);
        showToast("Errore nel caricamento dei dati", "error");
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, showToast]);

  const handleCreateCategory = async () => {
    if (!user) return;

    if (!formData.name.trim()) {
      showToast("Inserisci un nome per la categoria", "error");
      return;
    }

    // Check limit
    if (categories.length >= limit) {
      showToast(
        `Limite raggiunto! Il piano ${userPlan.toUpperCase()} permette massimo ${limit} categorie. Effettua l'upgrade per aggiungerne altre.`,
        "error"
      );
      setShowCreateModal(false);
      return;
    }

    try {
      const newCategoryId = await createCategory(user.uid, {
        name: formData.name,
        type: formData.type,
        color: formData.color,
        archived: false,
      });

      const newCategory: CategoryWithId = {
        id: newCategoryId,
        name: formData.name,
        type: formData.type,
        color: formData.color,
        archived: false,
        createdAt: new Date() as any,
      };

      setCategories([...categories, newCategory]);
      setShowCreateModal(false);
      setFormData({ name: "", type: "custom", color: PREDEFINED_COLORS[0] });
      showToast("Categoria creata con successo!", "success");
    } catch (error) {
      console.error("Error creating category:", error);
      showToast("Errore nella creazione della categoria", "error");
    }
  };

  const handleUpdateCategory = async () => {
    if (!user || !selectedCategory) return;

    if (!formData.name.trim()) {
      showToast("Inserisci un nome per la categoria", "error");
      return;
    }

    try {
      await updateCategory(user.uid, selectedCategory.id, {
        name: formData.name,
        type: formData.type,
        color: formData.color,
      });

      setCategories(
        categories.map((cat) =>
          cat.id === selectedCategory.id
            ? { ...cat, name: formData.name, type: formData.type, color: formData.color }
            : cat
        )
      );

      setShowEditModal(false);
      setSelectedCategory(null);
      setFormData({ name: "", type: "custom", color: PREDEFINED_COLORS[0] });
      showToast("Categoria aggiornata con successo!", "success");
    } catch (error) {
      console.error("Error updating category:", error);
      showToast("Errore nell'aggiornamento della categoria", "error");
    }
  };

  const handleDeleteCategory = async () => {
    if (!user || !selectedCategory) return;

    try {
      await deleteCategory(user.uid, selectedCategory.id);
      setCategories(categories.filter((cat) => cat.id !== selectedCategory.id));
      setShowDeleteModal(false);
      setSelectedCategory(null);
      showToast("Categoria eliminata con successo!", "success");
    } catch (error) {
      console.error("Error deleting category:", error);
      showToast("Errore nell'eliminazione della categoria", "error");
    }
  };

  const openEditModal = (category: CategoryWithId) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color || PREDEFINED_COLORS[0],
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (category: CategoryWithId) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-lg text-[#1E293B] font-medium">Loading categories...</p>
        </div>
      </div>
    );
  }

  const categoriesByType = {
    fixed: categories.filter((c) => c.type === "fixed"),
    variable: categories.filter((c) => c.type === "variable"),
    custom: categories.filter((c) => c.type === "custom"),
  };

  return (
    <>
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />

      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F172A] transition-colors mb-4 group font-medium"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A] mb-1">
              Categories
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                categories.length >= limit 
                  ? "bg-gray-100 text-gray-600" 
                  : "bg-[#22C55E]/10 text-[#22C55E]"
              }`}>
                {categories.length}/{limit}
              </span>
              <span>categories created</span>
            </p>
          </div>
          {categories.length >= limit ? (
            <Button
              onClick={() => router.push("/dashboard/plan")}
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-medium px-6 rounded-lg transition-colors h-11"
              startContent={<SparklesIcon className="w-5 h-5" />}
            >
              Upgrade Plan
            </Button>
          ) : (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg transition-colors shadow-sm font-medium px-6 h-11 bg-[#0F172A] text-white hover:bg-[#1E293B]"
              startContent={<PlusIcon className="w-5 h-5" />}
            >
              New Category
            </Button>
          )}
        </div>
      </div>

      <main className="px-8 py-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Fixed Categories */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-[#0F172A] flex items-center justify-center">
                <TagIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">Fixed Expenses</h2>
                <p className="text-xs text-gray-500">Regular monthly expenses</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoriesByType.fixed.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                />
              ))}
            </div>
            {categoriesByType.fixed.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <TagIcon className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">No fixed categories yet</p>
              </div>
            )}
          </div>

          {/* Variable Categories */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-[#0F172A] flex items-center justify-center">
                <ArrowsRightLeftIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">Variable Expenses</h2>
                <p className="text-xs text-gray-500">Flexible spending categories</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoriesByType.variable.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                />
              ))}
            </div>
            {categoriesByType.variable.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <ArrowsRightLeftIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm text-gray-400">No variable categories yet</p>
              </div>
            )}
          </div>

          {/* Custom Categories */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center">
                <PlusIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0F172A]">Custom Categories</h2>
                <p className="text-xs text-gray-500">Your personalized categories</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categoriesByType.custom.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                />
              ))}
            </div>
            {categoriesByType.custom.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#22C55E]/20 to-[#16A34A]/20 flex items-center justify-center mx-auto mb-4">
                  <PlusIcon className="w-8 h-8 text-[#22C55E]" />
                </div>
                <p className="text-sm text-gray-600 font-medium mb-2">No custom categories yet</p>
                <p className="text-xs text-gray-400">Create your first custom category!</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center">
                    <PlusIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#0F172A]">New Category</h2>
                    <p className="text-xs text-gray-500 mt-1">Create a custom expense category</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: "", type: "custom", color: PREDEFINED_COLORS[0] });
                  }}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              {limit - categories.length <= 3 && limit - categories.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-xs text-amber-700">
                    ⚠️ Solo <strong>{limit - categories.length}</strong> {limit - categories.length === 1 ? "categoria rimanente" : "categorie rimanenti"} nel tuo piano
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-8">
              <div>
                <label htmlFor="category-name" className="block text-sm font-medium text-[#0F172A] mb-2">
                  Category Name
                </label>
                <input
                  id="category-name"
                  type="text"
                  placeholder="e.g., Travel"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 px-4 bg-gray-50 border-0 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:bg-white transition-all"
                />
              </div>

              <div>
                <Listbox
                  value={formData.type}
                  onChange={(value) => setFormData({ ...formData, type: value as "fixed" | "variable" | "custom" })}
                >
                  <div className="relative">
                    <Listbox.Label className="block text-sm font-medium text-[#0F172A] mb-2">
                      Type
                    </Listbox.Label>
                    <Listbox.Button className="relative w-full h-12 px-4 bg-gray-50 rounded-xl text-left text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:bg-white transition-all cursor-pointer">
                      <span className="block truncate capitalize">{formData.type}</span>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </span>
                    </Listbox.Button>
                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute z-10 mt-2 w-full bg-white rounded-xl shadow-lg max-h-60 py-2 overflow-auto focus:outline-none border border-gray-100">
                        <Listbox.Option
                          value="fixed"
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-3 px-4 ${
                              active ? "bg-[#22C55E]/10 text-[#22C55E]" : "text-gray-900"
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                                Fixed
                              </span>
                              {selected && (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#22C55E]">
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                        <Listbox.Option
                          value="variable"
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-3 px-4 ${
                              active ? "bg-[#22C55E]/10 text-[#22C55E]" : "text-gray-900"
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                                Variable
                              </span>
                              {selected && (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#22C55E]">
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                        <Listbox.Option
                          value="custom"
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-3 px-4 ${
                              active ? "bg-[#22C55E]/10 text-[#22C55E]" : "text-gray-900"
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                                Custom
                              </span>
                              {selected && (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#22C55E]">
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>

              <div>
                <label className="text-sm font-medium text-[#0F172A] mb-3 block">
                  Color
                </label>
                <div className="grid grid-cols-6 gap-3">
                  {PREDEFINED_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-12 h-12 rounded-2xl transition-all ${
                        formData.color === color
                          ? "ring-4 ring-offset-2 ring-[#22C55E] scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
              <Button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: "", type: "custom", color: PREDEFINED_COLORS[0] });
                }}
                className="flex-1 bg-gray-100 text-[#0F172A] rounded-2xl hover:bg-gray-200 font-semibold h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCategory}
                className="flex-1 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-2xl hover:shadow-lg hover:scale-105 transition-all font-semibold h-12"
              >
                Create Category
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <PencilIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A]">Edit Category</h2>
                  <p className="text-xs text-gray-500 mt-1">Update category details</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedCategory(null);
                  setFormData({ name: "", type: "custom", color: PREDEFINED_COLORS[0] });
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-8">
              <div>
                <label htmlFor="edit-category-name" className="block text-sm font-medium text-[#0F172A] mb-2">
                  Category Name
                </label>
                <input
                  id="edit-category-name"
                  type="text"
                  placeholder="e.g., Travel"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 px-4 bg-gray-50 border-0 rounded-xl text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:bg-white transition-all"
                />
              </div>

              <div>
                <Listbox
                  value={formData.type}
                  onChange={(value) => setFormData({ ...formData, type: value as "fixed" | "variable" | "custom" })}
                >
                  <div className="relative">
                    <Listbox.Label className="block text-sm font-medium text-[#0F172A] mb-2">
                      Type
                    </Listbox.Label>
                    <Listbox.Button className="relative w-full h-12 px-4 bg-gray-50 rounded-xl text-left text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:bg-white transition-all cursor-pointer">
                      <span className="block truncate capitalize">{formData.type}</span>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </span>
                    </Listbox.Button>
                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute z-10 mt-2 w-full bg-white rounded-xl shadow-lg max-h-60 py-2 overflow-auto focus:outline-none border border-gray-100">
                        <Listbox.Option
                          value="fixed"
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-3 px-4 ${
                              active ? "bg-[#22C55E]/10 text-[#22C55E]" : "text-gray-900"
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                                Fixed
                              </span>
                              {selected && (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#22C55E]">
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                        <Listbox.Option
                          value="variable"
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-3 px-4 ${
                              active ? "bg-[#22C55E]/10 text-[#22C55E]" : "text-gray-900"
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                                Variable
                              </span>
                              {selected && (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#22C55E]">
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                        <Listbox.Option
                          value="custom"
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-3 px-4 ${
                              active ? "bg-[#22C55E]/10 text-[#22C55E]" : "text-gray-900"
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                                Custom
                              </span>
                              {selected && (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#22C55E]">
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>

              <div>
                <label className="text-sm font-medium text-[#0F172A] mb-3 block">
                  Color
                </label>
                <div className="grid grid-cols-6 gap-3">
                  {PREDEFINED_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-12 h-12 rounded-2xl transition-all ${
                        formData.color === color
                          ? "ring-4 ring-offset-2 ring-[#22C55E] scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
              <Button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedCategory(null);
                  setFormData({ name: "", type: "custom", color: PREDEFINED_COLORS[0] });
                }}
                className="flex-1 bg-gray-100 text-[#0F172A] rounded-2xl hover:bg-gray-200 font-semibold h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateCategory}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:shadow-lg hover:scale-105 transition-all font-semibold h-12"
              >
                Update Category
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                  <TrashIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A]">Delete Category</h2>
                  <p className="text-xs text-gray-500 mt-1">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedCategory(null);
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mb-6">
              <p className="text-gray-700 text-center">
                Are you sure you want to delete{" "}
                <span className="font-bold text-[#0F172A]">"{selectedCategory.name}"</span>?
              </p>
              <p className="text-sm text-gray-500 text-center mt-2">
                This category will be permanently removed.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedCategory(null);
                }}
                className="flex-1 bg-gray-100 text-[#0F172A] rounded-2xl hover:bg-gray-200 font-semibold h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteCategory}
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

// Category Card Component
function CategoryCard({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryWithId;
  onEdit: (category: CategoryWithId) => void;
  onDelete: (category: CategoryWithId) => void;
}) {
  return (
    <div className="group relative bg-white border-2 border-gray-200 rounded-lg p-5 hover:shadow-md hover:border-gray-300 transition-all duration-200">
      {/* Color indicator bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
        style={{ backgroundColor: category.color || "#22C55E" }}
      />
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: category.color || "#22C55E" }}
          >
            <TagIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#0F172A] truncate text-sm">{category.name}</h3>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize inline-block mt-1 font-medium">
              {category.type}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={() => onEdit(category)}
          className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-gray-600 hover:text-[#0F172A] hover:bg-gray-50 rounded-lg transition-all"
        >
          <PencilIcon className="w-4 h-4" />
          Edit
        </button>
        <button
          onClick={() => onDelete(category)}
          className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-gray-600 hover:text-[#0F172A] hover:bg-gray-50 rounded-lg transition-all"
        >
          <TrashIcon className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  );
}



