import React from "react";
import logo from "../assets/Logo.png";

export default function AdminDashboard() {
  return (
    <div className="flex min-h-screen bg-eggBg px-4 py-6 md:px-8">

      {/* --------------------------------------- */}
      {/* SIDEBAR */}
      {/* --------------------------------------- */}
      <div className="w-64 bg-[#F4D7B8] p-6 flex flex-col shadow-xl">

        <div className="flex items-center gap-3 mb-8">
          <div className="inline-block bg-eggBg p-1 rounded-md">
            <img src={logo} alt="Egg Bucket Logo" className="w-8 sm:w-10 md:w-12 h-auto object-contain mix-blend-multiply opacity-95" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Egg Bucket</h1>
        </div>

        <div className="space-y-3 text-gray-700 font-medium">

          <SidebarItem name="Dashboard" active />
          <SidebarItem name="Daily Damages" />

        </div>
      </div>

      {/* --------------------------------------- */}
      {/* MAIN CONTENT */}
      {/* --------------------------------------- */}
      <div className="flex-1 p-6 overflow-auto">

        {/* TOP BAR */}
        <div className="flex justify-between items-center mb-6">
          <div></div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">🔔</span>
            <img
              src="https://i.pravatar.cc/40"
              className="w-10 h-10 rounded-full border"
            />
          </div>
        </div>

        {/* HERO BANNER */}
        <div className="w-full h-60 bg-yellow-200 rounded-xl mb-8 shadow-md flex items-center justify-center">
          <h2 className="text-3xl font-bold text-gray-800">About Egg Bucket</h2>
        </div>

        {/* QUICK STATS ROW */}
        <div className="grid grid-cols-4 gap-4 mb-10">

          <StatCard
            title="Total Eggs Distributed Today"
            value="12,540"
            icon="🥚"
          />

          <StatCard
            title="Total Outlets"
            value="452"
            icon="🏪"
          />

          <StatCard
            title="Damages This Week"
            value="85"
            icon="📉"
          />

          <StatCard
            title="Today's NECC Rate"
            value="₹ 5.20/egg"
            icon="📈"
          />

        </div>

        {/* ACHIEVEMENTS */}
        <h2 className="text-xl font-bold mb-4">Achievements & Milestones</h2>

        <div className="grid grid-cols-3 gap-4">

          <MilestoneCard
            date="Q1 2024"
            title="Expanded to 5 New Regions"
            icon="➡️"
          />

          <MilestoneCard
            date="Oct 2023"
            title="1 Million Eggs Distributed Monthly"
            icon="🏆"
          />

          <MilestoneCard
            date="Aug 2023"
            title="Launched Digital Payment System"
            icon="💳"
          />

        </div>

        {/* FOOTER */}
        <footer className="mt-10 text-gray-700 text-sm flex justify-between">
          <p>Contact Us: support@eggbucket.com | +91 123 456 7890</p>
          <p>Address: 123 Egg Lane, Poultry Park, New Delhi</p>
        </footer>

      </div>
    </div>
  );
}

/* --------------------------------------------- */
/* COMPONENTS */
/* --------------------------------------------- */

function SidebarItem({ name, active }) {
  return (
    <div
      className={`cursor-pointer px-4 py-2 rounded-lg ${
        active ? "bg-white shadow font-semibold" : "hover:bg-white/60"
      }`}
    >
      {name}
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white shadow-md rounded-xl p-4 flex flex-col">
      <p className="text-gray-600">{title}</p>
      <div className="flex justify-between items-center mt-2">
        <h3 className="text-3xl font-bold text-orange-600">{value}</h3>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function MilestoneCard({ date, title, icon }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-3">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-gray-500 text-sm">{date}</p>
        <p className="font-semibold">{title}</p>
      </div>
    </div>
  );
}
