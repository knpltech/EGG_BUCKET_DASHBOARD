const API_URL = import.meta.env.VITE_API_URL;

import { useEffect, useState } from "react";
import { useDamage } from "../context/DamageContext";
import { getRoleFlags } from "../utils/role";


export default function AdminDashboard() {
  const { damages } = useDamage();
  const { isAdmin, zone } = getRoleFlags();
  const [totalOutlets, setTotalOutlets] = useState(0);
  const [eggsToday, setEggsToday] = useState(0);
  const [neccRate, setNeccRate] = useState('₹0.00');
  const [damagesThisWeek, setDamagesThisWeek] = useState(0);

  useEffect(() => {
    const updateOutlets = async () => {
      try {
        // Admin sees all outlets, others filter by zone
        const url = isAdmin
          ? `${API_URL}/outlets/all`
          : (zone ? `${API_URL}/outlets/zone/${zone}` : `${API_URL}/outlets/all`);
        const res = await fetch(url);
        const list = await res.json();
        const activeOutlets = Array.isArray(list)
          ? list.filter(o => o.status === "Active").length
          : 0;
        setTotalOutlets(activeOutlets);
      } catch {
        setTotalOutlets(0);
      }
    };
    updateOutlets();

    // Listen for outlet updates (real-time sync)
    const handleOutletsUpdated = () => {
      updateOutlets();
    };
    window.addEventListener('egg:outlets-updated', handleOutletsUpdated);

    // Eggs distributed today
    const fetchEggsToday = async () => {
      try {
        const res = await fetch(`${API_URL}/dailysales/all`);
        const sales = await res.json();
        const today = new Date().toISOString().slice(0, 10);
        const todayRow = Array.isArray(sales) ? sales.find(r => r.date === today) : null;
        setEggsToday(todayRow && !isNaN(Number(todayRow.total)) ? Number(todayRow.total) : 0);
      } catch {
        setEggsToday(0);
      }
    };
    fetchEggsToday();

    // NECC Rate (latest)
    const fetchNeccRate = async () => {
      try {
        const res = await fetch(`${API_URL}/neccrate/all`);
        const rates = await res.json();
        let latest = null;
        if (Array.isArray(rates) && rates.length > 0) {
          latest = rates.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
        }
        let rateNum = 0;
        if (latest && latest.rate) {
          // Extract numeric value from string like '₹5.80 per egg'
          const match = String(latest.rate).replace(/,/g, '').match(/([\d.]+)/);
          if (match) rateNum = Number(match[1]);
        }
        if (!isFinite(rateNum) || isNaN(rateNum)) rateNum = 0;
        setNeccRate(`₹${rateNum.toFixed(2)}`);
      } catch {
        setNeccRate('₹0.00');
      }
    };
    fetchNeccRate();

    // Damages today
    const today = new Date().toISOString().slice(0, 10);
    const damagesToday = Array.isArray(damages)
      ? damages.find(d => d.date === today)
      : null;
    setDamagesThisWeek(damagesToday && !isNaN(Number(damagesToday.total)) ? Number(damagesToday.total) : 0);

    return () => {
      window.removeEventListener('egg:outlets-updated', handleOutletsUpdated);
    };
  }, [damages, zone]);

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">

      {/* Dashboard Overview Top Bar */}
      <div className="bg-white rounded-xl shadow px-6 py-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Dashboard Overview
          </h1>
          <p className="text-sm text-gray-500">
            Welcome back! Here’s what’s happening today.
          </p>
        </div>
      </div>

      {/* About Egg Bucket */}
      <div className="w-full bg-yellow-200 rounded-xl mb-8 shadow-md p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          About Egg Bucket
        </h2>
        <p className="text-gray-700">
          Egg Bucket helps manage egg distribution with transparency and
          real-time reporting.
        </p>
      </div>

      {/* Stat Cards */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard title="Total Eggs Distributed Today" value={eggsToday} icon="🥚" />
        <StatCard title="Total Outlets" value={totalOutlets} icon="🏪" />
        <StatCard title="Damages Today" value={damagesThisWeek} icon="📉" />
        <StatCard title="Today's NECC Rate" value={neccRate} icon="📈" />
      </div>

      {/* Achievements */}
      <h2 className="text-xl font-bold mb-4">Achievements & Milestones</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MilestoneCard date="Q1 2024" title="Expanded to 5 New Regions" icon="➡️" />
        <MilestoneCard date="Oct 2023" title="1 Million Eggs Distributed Monthly" icon="🏆" />
        <MilestoneCard date="Aug 2023" title="Launched Digital Payment System" icon="💳" />
      </div>

      {/* Footer */}
      <div className="mt-12 p-4 bg-orange-100 rounded-xl flex flex-col sm:flex-row justify-between gap-2 text-sm">
        <div>
          <strong>Contact:</strong> eggbukect@144.com
        </div>
        <div>
          <strong>Address:</strong> Bandepalya, Bangalore, Karnataka
        </div>
      </div>

    </div>
  );
}

/* ---------------- Reusable Components ---------------- */

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
