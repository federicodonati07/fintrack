"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { ChartBarIcon, DocumentTextIcon, ArrowTrendingUpIcon, ShieldCheckIcon, CheckIcon } from "@heroicons/react/24/outline";
import AnimatedBackground from "@/components/AnimatedBackground";

interface PriceData {
  amount: number;
  currency: string;
  formatted: string;
}

interface StripePrices {
  free: { monthly: PriceData; yearly: PriceData };
  pro: { monthly: PriceData; yearly: PriceData };
  ultra: { monthly: PriceData; yearly: PriceData };
}

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type Plan = "free" | "pro" | "ultra";
type Interval = "monthly" | "yearly";

export default function Home() {
  const router = useRouter();
  const [prices, setPrices] = useState<StripePrices | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch("/api/stripe/prices");
        const data = await response.json();
        setPrices(data);
      } catch (error) {
        console.error("Error fetching prices:", error);
      }
    };

    fetchPrices();
  }, []);

  const handlePlanSelect = (plan: Plan, interval: Interval) => {
    router.push(`/auth?plan=${plan}&interval=${interval}`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">F</span>
                </div>
                <span className="text-xl font-semibold text-[#0F172A]">FinTrack</span>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-[#1E293B] hover:text-[#22C55E] transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm font-medium text-[#1E293B] hover:text-[#22C55E] transition-colors">
                Pricing
              </a>
              <Button
                color="default"
                variant="light"
                className="text-sm font-medium text-[#1E293B] rounded-full cursor-pointer px-5"
              >
                Sign In
              </Button>
              <Button
                onClick={() => router.push("/auth")}
                className="bg-[#22C55E] text-white font-medium text-sm px-6 py-2.5 rounded-full hover:bg-[#16A34A] transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
              >
                Get Started
              </Button>
            </div>
            <div className="md:hidden">
              <Button variant="light" isIconOnly className="rounded-full cursor-pointer">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 -z-10 opacity-30">
          <AnimatedBackground />
        </div>
        
        <div className="relative text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-[#A7F3D0]/20 border border-[#22C55E]/20 mb-8">
            <span className="text-sm font-medium text-[#22C55E]">
              ✨ Replace your Excel spreadsheets
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[#0F172A] mb-6 leading-tight">
            Take control of your
            <span className="text-[#22C55E] block">personal finances</span>
          </h1>
          <p className="text-xl text-[#1E293B] mb-12 max-w-2xl mx-auto leading-relaxed">
            Manual finance management made simple. Track your portfolios, analyze your spending, and gain insights with our intuitive platform designed to replace spreadsheets.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={() => router.push("/auth")}
              size="lg"
              className="bg-[#22C55E] text-white font-semibold text-base px-10 py-6 h-auto rounded-full hover:bg-[#16A34A] transition-all duration-200 shadow-lg shadow-[#22C55E]/20 hover:shadow-xl hover:shadow-[#22C55E]/30 cursor-pointer"
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="bordered"
              className="border-2 border-[#1E293B] text-[#0F172A] font-semibold text-base px-10 py-6 h-auto rounded-full hover:bg-[#1E293B] hover:text-white transition-all duration-200 cursor-pointer"
            >
              Watch Demo
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-6">No credit card required • Free forever plan available</p>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-[#0F172A] mb-4">
              Choose your plan
            </h2>
            <p className="text-lg text-[#1E293B]">
              Start free and upgrade as you grow. All plans include our core features.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <PricingCard
              planId="free"
              interval="monthly"
              name="Free"
              price={prices?.free.monthly.formatted || "€0.00"}
              period="forever"
              description="Perfect for getting started"
              features={[
                "1 Account",
                "5 Expense Categories",
                "Monthly Charts",
                "Basic Analytics",
                "Manual Data Entry",
              ]}
              buttonText="Get Started"
              buttonVariant="bordered"
              onSelect={handlePlanSelect}
            />

            {/* Pro Plan */}
            <PricingCard
              planId="pro"
              interval="monthly"
              name="Pro"
              price={prices?.pro.monthly.formatted || "€9.99"}
              period="month"
              originalPrice={prices?.pro.yearly.formatted ? `${prices.pro.yearly.formatted}/year` : "€99.99/year"}
              description="For serious financial tracking"
              features={[
                "3 Accounts",
                "15 Expense Categories",
                "Quarterly Charts",
                "Advanced Analytics",
                "Manual Data Entry",
                "Export Reports",
                "Priority Support",
              ]}
              buttonText="Get Started"
              buttonVariant="solid"
              featured={true}
              onSelect={handlePlanSelect}
            />

            {/* Ultra Plan */}
            <PricingCard
              planId="ultra"
              interval="monthly"
              name="Ultra"
              price={prices?.ultra.monthly.formatted || "€19.99"}
              period="month"
              originalPrice={prices?.ultra.yearly.formatted ? `${prices.ultra.yearly.formatted}/year` : "€209.99/year"}
              description="Maximum features and flexibility"
              features={[
                "10 Accounts",
                "50 Expense Categories",
                "Full-time Charts",
                "Advanced Analytics",
                "Manual Data Entry",
                "Export Reports",
                "Priority Support",
                "Custom Categories",
                "API Access",
              ]}
              buttonText="Get Started"
              buttonVariant="bordered"
              onSelect={handlePlanSelect}
            />
          </div>
        </div>
      </section>

      {/* Dashboard Preview with Charts */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-6 sm:p-8 shadow-2xl">
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-xl">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Financial Overview</h3>
              <p className="text-sm text-[#1E293B]">Your financial insights at a glance</p>
            </div>
            
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Spending by Category - Doughnut Chart */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="text-sm font-medium text-[#0F172A] mb-4">Spending by Category</h4>
                <div className="h-48">
                  <Doughnut
                    data={{
                      labels: ["Food", "Transport", "Shopping", "Bills", "Entertainment"],
                      datasets: [
                        {
                          label: "Spending",
                          data: [35, 25, 20, 15, 5],
                          backgroundColor: [
                            "#22C55E",
                            "#A7F3D0",
                            "#16A34A",
                            "#86EFAC",
                            "#4ADE80",
                          ],
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: {
                            padding: 15,
                            font: {
                              size: 12,
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Monthly Trend - Line Chart */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="text-sm font-medium text-[#0F172A] mb-4">Monthly Income Trend</h4>
                <div className="h-48">
                  <Line
                    data={{
                      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                      datasets: [
                        {
                          label: "Income",
                          data: [4500, 5200, 4800, 6100, 5500, 6700],
                          borderColor: "#22C55E",
                          backgroundColor: "rgba(34, 197, 94, 0.1)",
                          fill: true,
                          tension: 0.4,
                          pointRadius: 4,
                          pointBackgroundColor: "#22C55E",
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: {
                            color: "rgba(0, 0, 0, 0.05)",
                          },
                        },
                        x: {
                          grid: {
                            display: false,
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Monthly Spending - Bar Chart */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h4 className="text-sm font-medium text-[#0F172A] mb-4">Monthly Spending</h4>
              <div className="h-64">
                <Bar
                  data={{
                    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                    datasets: [
                      {
                        label: "Spending",
                        data: [3200, 2900, 3400, 2800, 3100, 2700],
                        backgroundColor: "#22C55E",
                        borderRadius: 8,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: {
                          color: "rgba(0, 0, 0, 0.05)",
                        },
                      },
                      x: {
                        grid: {
                          display: false,
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
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-[#0F172A] mb-4">
              Everything you need to manage your finances
            </h2>
            <p className="text-lg text-[#1E293B]">
              Powerful features designed to simplify your financial tracking and analysis
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<DocumentTextIcon className="w-8 h-8" />}
              title="Manual Tracking"
              description="Input your financial data manually with an intuitive interface. Perfect for those who want complete control over their records."
            />
            <FeatureCard
              icon={<ChartBarIcon className="w-8 h-8" />}
              title="Advanced Analytics"
              description="Get essential and advanced insights into your portfolios. Visualize trends, patterns, and performance metrics."
            />
            <FeatureCard
              icon={<ArrowTrendingUpIcon className="w-8 h-8" />}
              title="Portfolio Management"
              description="Track multiple portfolios with ease. Organize your investments and monitor their performance in one place."
            />
            <FeatureCard
              icon={<ShieldCheckIcon className="w-8 h-8" />}
              title="Secure & Private"
              description="Your financial data stays private and secure. No sharing with third parties, complete data control."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0F172A] to-[#1E293B]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to simplify your finances?
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Join thousands of users who have replaced their spreadsheets with FinTrack
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => router.push("/auth")}
              size="lg"
              className="bg-[#22C55E] text-white font-semibold text-base px-10 py-6 h-auto rounded-full hover:bg-[#16A34A] transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl"
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="bordered"
              className="border-2 border-white text-white font-semibold text-base px-10 py-6 h-auto rounded-full hover:bg-white hover:text-[#0F172A] transition-all duration-200 cursor-pointer"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-semibold text-[#0F172A]">FinTrack</span>
            </div>
            <div className="flex space-x-6 text-sm text-[#1E293B]">
              <a href="#" className="hover:text-[#22C55E] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#22C55E] transition-colors">Terms</a>
              <a href="#" className="hover:text-[#22C55E] transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-100 text-center text-sm text-gray-500">
            <p>© 2024 FinTrack. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-shadow border border-gray-100">
      <div className="w-14 h-14 bg-[#A7F3D0]/30 rounded-xl flex items-center justify-center text-[#22C55E] mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-[#0F172A] mb-3">{title}</h3>
      <p className="text-[#1E293B] leading-relaxed">{description}</p>
    </div>
  );
}

function PricingCard({
  planId,
  interval,
  name,
  price,
  period,
  originalPrice,
  description,
  features,
  buttonText,
  buttonVariant,
  featured = false,
  onSelect,
}: {
  planId: Plan;
  interval: Interval;
  name: string;
  price: string;
  period: string;
  originalPrice?: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant: "solid" | "bordered";
  featured?: boolean;
  onSelect: (plan: Plan, interval: Interval) => void;
}) {
  const router = useRouter();
  return (
    <div
      className={`bg-white rounded-2xl p-8 shadow-lg border-2 transition-all duration-300 ease-out cursor-pointer ${
        featured
          ? "border-[#22C55E] scale-105 shadow-xl shadow-[#22C55E]/10 hover:scale-110"
          : "border-gray-100 hover:shadow-xl hover:scale-105"
      }`}
    >
      {featured && (
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#A7F3D0]/20 border border-[#22C55E]/20 mb-4">
          <span className="text-xs font-medium text-[#22C55E]">Most Popular</span>
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-[#0F172A] mb-2">{name}</h3>
        <p className="text-sm text-[#1E293B] mb-4">{description}</p>
        <div className="flex items-baseline">
          <span className="text-4xl font-bold text-[#0F172A]">{price}</span>
          <span className="text-[#1E293B] ml-2">/{period}</span>
        </div>
        {originalPrice && (
          <p className="text-sm text-gray-500 mt-2">{originalPrice}</p>
        )}
      </div>

      <Button
        onClick={() => onSelect(planId, interval)}
        size="lg"
        variant={buttonVariant}
        className={`w-full mb-8 font-semibold rounded-full py-6 cursor-pointer transition-all duration-200 ${
          featured
            ? "bg-[#22C55E] text-white hover:bg-[#16A34A] shadow-md hover:shadow-lg"
            : buttonVariant === "solid"
            ? "bg-[#1E293B] text-white hover:bg-[#0F172A] shadow-md hover:shadow-lg"
            : "border-2 border-[#1E293B] text-[#0F172A] hover:bg-[#1E293B] hover:text-white"
        }`}
      >
        {buttonText}
      </Button>

      <ul className="space-y-4">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <CheckIcon className="w-5 h-5 text-[#22C55E] mr-3 mt-0.5 flex-shrink-0" />
            <span className="text-[#1E293B]">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}