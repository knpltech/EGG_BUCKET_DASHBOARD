import React from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function SupervisorDashboard() {
  // Always show all admin features except Users and Add Distributor, with empty data and outlets
  return (
    <div className="flex min-h-screen">
      <Sidebar supervisor />
      <div className="flex-1">
        <Topbar supervisor />
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Supervisor Dashboard</h1>
          <p className="mb-6 text-gray-600">Welcome! You can manage all features below. Data and outlets will be empty until you add them.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <a href="/supervisor/damages" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">🥚</span>
              <span className="font-semibold text-lg">Daily Damages</span>
              <span className="text-xs text-gray-500 mt-1">Enter and view daily damages</span>
            </a>
            <a href="/supervisor/neccrate" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">💹</span>
              <span className="font-semibold text-lg">NECC Rate</span>
              <span className="text-xs text-gray-500 mt-1">View NECC rates</span>
            </a>
            <a href="/supervisor/dailysales" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">📊</span>
              <span className="font-semibold text-lg">Daily Sales</span>
              <span className="text-xs text-gray-500 mt-1">Enter and view daily sales</span>
            </a>
            <a href="/supervisor/digital-payments" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">💳</span>
              <span className="font-semibold text-lg">Digital Payments</span>
              <span className="text-xs text-gray-500 mt-1">Manage digital payments</span>
            </a>
            <a href="/supervisor/cash-payments" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">💵</span>
              <span className="font-semibold text-lg">Cash Payments</span>
              <span className="text-xs text-gray-500 mt-1">Manage cash payments</span>
            </a>
            <a href="/supervisor/reports" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">📈</span>
              <span className="font-semibold text-lg">Reports</span>
              <span className="text-xs text-gray-500 mt-1">View reports</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
