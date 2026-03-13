const API_URL = import.meta.env.VITE_API_URL;

import { useEffect, useState } from "react";
import { useDamage } from "../context/DamageContext";
import { getRoleFlags } from "../utils/role";
import { fetchZoneWiseRevenue } from "../context/reportsApi";

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return "₹0";
  return "₹" + Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
};

// Normalize any date format to YYYY-MM-DD
const normalizeDate = (d) => {
  try {
    // Firestore Timestamp object
    if (d && typeof d === "object" && typeof d.toDate === "function") {
      return d.toDate().toISOString().slice(0, 10);
    }
    // Firestore Timestamp as plain object { _seconds, _nanoseconds }
    if (d && typeof d === "object" && d._seconds !== undefined) {
      return new Date(d._seconds * 1000).toISOString().slice(0, 10);
    }
    const n = new Date(d);
    if (!isNaN(n.getTime())) return n.toISOString().slice(0, 10);
  } catch (e) {}
  return String(d).slice(0, 10);
};

export default function AdminDashboard() {
  const { damages } = useDamage();
  const { isAdmin, zone } = getRoleFlags();
  const [totalOutlets,     setTotalOutlets]     = useState(0);
  const [eggsToday,        setEggsToday]        = useState(0);
  const [neccRate,         setNeccRate]         = useState("₹0.00");
  const [damagesThisWeek,  setDamagesThisWeek]  = useState(0);
  const [zoneRevenue,      setZoneRevenue]      = useState({
    "Zone 1": { cash: 0, digital: 0, total: 0 },
    "Zone 2": { cash: 0, digital: 0, total: 0 },
    "Zone 3": { cash: 0, digital: 0, total: 0 },
    "Zone 4": { cash: 0, digital: 0, total: 0 },
    "Zone 5": { cash: 0, digital: 0, total: 0 },
  });
  const [revenueLoading, setRevenueLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    /* ── Total Outlets ── */
    const updateOutlets = async () => {
      try {
        const url = isAdmin
          ? `${API_URL}/outlets/all`
          : zone
          ? `${API_URL}/outlets/zone/${zone}`
          : `${API_URL}/outlets/all`;
        const res  = await fetch(url);
        const list = await res.json();
        setTotalOutlets(
          Array.isArray(list) ? list.filter(o => o.status === "Active").length : 0
        );
      } catch {
        setTotalOutlets(0);
      }
    };
    updateOutlets();
    window.addEventListener("egg:outlets-updated", updateOutlets);

    /* ── Eggs Distributed Today ── */
    const fetchEggsToday = async () => {
      try {
        const res   = await fetch(`${API_URL}/dailysales/all`);
        const sales = await res.json();
        if (!Array.isArray(sales)) { setEggsToday(0); return; }

        // Sum all outlets across ALL docs that match today
        // (there may be multiple docs per date if data was merged)
        let total = 0;
        sales.forEach(doc => {
          if (normalizeDate(doc.date || doc.createdAt) === today) {
            if (doc.outlets && typeof doc.outlets === "object") {
              Object.values(doc.outlets).forEach(v => {
                total += Number(v) || 0;
              });
            } else if (!isNaN(Number(doc.total))) {
              total += Number(doc.total);
            }
          }
        });
        setEggsToday(total);
      } catch {
        setEggsToday(0);
      }
    };
    fetchEggsToday();

    /* ── Today's NECC Rate ── */
    const fetchNeccRate = async () => {
      try {
        const res   = await fetch(`${API_URL}/neccrate/all`);
        const rates = await res.json();
        if (!Array.isArray(rates) || rates.length === 0) { setNeccRate("₹0.00"); return; }

        // Filter for today's rates only
        const todayRates = rates.filter(r =>
          normalizeDate(r.date || r.createdAt) === today
        );

        // Pick from today's rates; fallback to latest available if none today
        const pool = todayRates.length > 0 ? todayRates : rates;
        const latest = pool.reduce((a, b) =>
          new Date(normalizeDate(a.date || a.createdAt)) >=
          new Date(normalizeDate(b.date || b.createdAt)) ? a : b
        );

        let rateNum = 0;
        if (latest.rateValue !== undefined) {
          rateNum = Number(latest.rateValue);
        } else if (latest.rate) {
          const match = String(latest.rate).replace(/,/g, "").match(/([\d.]+)/);
          if (match) rateNum = Number(match[1]);
        }
        if (!isFinite(rateNum) || isNaN(rateNum)) rateNum = 0;
        setNeccRate(`₹${rateNum.toFixed(2)}`);
      } catch {
        setNeccRate("₹0.00");
      }
    };
    fetchNeccRate();

    /* ── Damages Today ── */
    const fetchDamagesToday = async () => {
      try {
        const res     = await fetch(`${API_URL}/daily-damage/all`);
        const allDmg  = await res.json();
        if (!Array.isArray(allDmg)) { setDamagesThisWeek(0); return; }

        let total = 0;
        allDmg.forEach(doc => {
          if (normalizeDate(doc.date || doc.createdAt) === today) {
            if (doc.damages && typeof doc.damages === "object") {
              Object.values(doc.damages).forEach(v => {
                total += Number(v) || 0;
              });
            } else if (!isNaN(Number(doc.total))) {
              total += Number(doc.total);
            }
          }
        });
        setDamagesThisWeek(total);
      } catch {
        setDamagesThisWeek(0);
      }
    };
    fetchDamagesToday();

    /* ── Zone Revenue ── */
    const fetchRevenue = async () => {
      try {
        setRevenueLoading(true);
        const data = await fetchZoneWiseRevenue();
        if (data.success) setZoneRevenue(data.zoneRevenue);
      } catch {
        console.error("Failed to fetch zone revenue");
      } finally {
        setRevenueLoading(false);
      }
    };
    fetchRevenue();

    return () => {
      window.removeEventListener("egg:outlets-updated", updateOutlets);
    };
  }, [zone, isAdmin]);

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">

      {/* Top Bar */}
      <div className="bg-white rounded-xl shadow px-6 py-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Dashboard Overview</h1>
          <p className="text-sm text-gray-500">Welcome back! Here's what's happening today.</p>
        </div>
      </div>

      {/* About */}
      <div className="w-full bg-yellow-200 rounded-xl mb-8 shadow-md p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">About Egg Bucket</h2>
        <p className="text-gray-700">
          Egg Bucket helps manage egg distribution with transparency and real-time reporting.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard title="Total Eggs Distributed Today" value={eggsToday} icon="🥚" />
        <StatCard title="Total Outlets"                value={totalOutlets} icon="🏪" />
        <StatCard title="Damages Today"                value={damagesThisWeek} icon="📉" />
        <StatCard title="Today's NECC Rate"            value={neccRate} icon="📈" />
      </div>

      {/* Zone Revenue */}
      <h2 className="text-xl font-bold mb-4">Today's Revenue by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {revenueLoading ? (
          <p className="text-gray-500 text-center py-10">Loading revenue data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Object.entries(zoneRevenue).map(([zoneName, zoneData]) => (
              <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">{formatCurrency(zoneData.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Milestones */}
      <h2 className="text-xl font-bold mb-4">Achievements & Milestones</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MilestoneCard date="Q1 2024"  title="Expanded to 5 New Regions"           icon="➡️" />
        <MilestoneCard date="Oct 2023" title="1 Million Eggs Distributed Monthly"  icon="🏆" />
        <MilestoneCard date="Aug 2023" title="Launched Digital Payment System"     icon="💳" />
      </div>

      {/* Footer */}
      <div className="mt-12 p-4 bg-orange-100 rounded-xl flex flex-col sm:flex-row justify-between gap-2 text-sm">
        <div><strong>Contact:</strong> 7204704048</div>
        <div><strong>Address:</strong> HSR Layout, Bangalore, Karnataka</div>
      </div>

    </div>
  );
}

/* ── Reusable Components ── */
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