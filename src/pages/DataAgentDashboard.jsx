import React, { useEffect, useState } from "react";
import logo from "../assets/Logo.png";
import { Link, useLocation } from "react-router-dom";

export default function DataAgentDashboard() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {}
  const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);

  // Sidebar items mapping
  const sidebarItems = [
    { role: "daily_sales", name: "Daily Sales", path: "/admin/dailysales" },
    { role: "outlets", name: "Outlets", path: "/admin/outlets" },
    { role: "digital_payments", name: "Digital Payments", path: "/admin/digital-payments" },
    { role: "cash_payments", name: "Cash Payments", path: "/admin/cash-payments" },
    { role: "neccrate", name: "NECC Rate", path: "/admin/neccrate" },
    { role: "daily_damages", name: "Daily Damages", path: "/admin/damages" },
    // Support legacy role value for backward compatibility
    { role: "dailydamages", name: "Daily Damages", path: "/admin/damages" },
  ];

  // Stat state
  const [totalOutlets, setTotalOutlets] = useState(0);
  const [eggsToday, setEggsToday] = useState(0);
  const [neccRate, setNeccRate] = useState('₹0.00');
  const [damagesToday, setDamagesToday] = useState(0);
  const [digitalPaymentsToday, setDigitalPaymentsToday] = useState(0);
  const [cashPaymentsToday, setCashPaymentsToday] = useState(0);

  // Get user zone
  const userZone = user?.zoneId || user?.zone || null;

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL;
    // Outlets - fetch zone-specific if user has a zone
    const fetchOutlets = async () => {
      try {
        const url = userZone 
          ? `${API_URL}/outlets/zone/${userZone}`
          : `${API_URL}/outlets/all`;
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
    fetchOutlets();
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
    // Damages today (from localStorage or backend if needed)
    setDamagesToday(0);
    // Digital Payments today
    const fetchDigitalPayments = async () => {
      try {
        const res = await fetch(`${API_URL}/digital-payments/all`);
        const payments = await res.json();
        const today = new Date().toISOString().slice(0, 10);
        const todayRow = Array.isArray(payments) ? payments.find(r => r.date === today) : null;
        setDigitalPaymentsToday(todayRow && !isNaN(Number(todayRow.total)) ? Number(todayRow.total) : 0);
      } catch {
        setDigitalPaymentsToday(0);
      }
    };
    fetchDigitalPayments();
    // Cash Payments today
    const fetchCashPayments = async () => {
      try {
        const res = await fetch(`${API_URL}/cash-payments/all`);
        const payments = await res.json();
        const today = new Date().toISOString().slice(0, 10);
        const todayRow = Array.isArray(payments) ? payments.find(r => r.date === today) : null;
        setCashPaymentsToday(todayRow && !isNaN(Number(todayRow.total)) ? Number(todayRow.total) : 0);
      } catch {
        setCashPaymentsToday(0);
      }
    };
    fetchCashPayments();
  }, []);

  // Stat cards config
  const statCards = [
    { role: "daily_sales", title: "Total Eggs Distributed Today", value: eggsToday, icon: "🥚" },
    { role: "outlets", title: "Total Outlets", value: totalOutlets, icon: "🏪" },
    { role: "daily_damages", title: "Damages Today", value: damagesToday, icon: "📉" },
    { role: "neccrate", title: "Today's NECC Rate", value: neccRate, icon: "📈" },
    { role: "digital_payments", title: "Digital Payments Processed Today", value: `₹${digitalPaymentsToday.toLocaleString()}`, icon: "💳" },
    { role: "cash_payments", title: "Cash Payments Logged Today", value: `₹${cashPaymentsToday.toLocaleString()}`, icon: "💵" },
  ];

  const location = useLocation();
  return (
    <div className="flex min-h-screen bg-eggBg px-4 py-6 md:px-8">
      {/* SIDEBAR */}
      <div className="w-64 bg-[#F4D7B8] p-6 flex flex-col shadow-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="inline-block bg-eggBg p-1 rounded-md">
            <img src={logo} alt="Egg Bucket Logo" className="w-8 sm:w-10 md:w-12 h-auto object-contain mix-blend-multiply opacity-95" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Egg Bucket</h1>
        </div>
        <div className="space-y-3 text-gray-700 font-medium">
          {sidebarItems.filter(item => {
            if (item.role === "daily_damages") {
              return roles.includes("daily_damages") || roles.includes("dailydamages");
            }
            return roles.includes(item.role);
          }).map(item => (
            <Link key={item.role} to={item.path} className="block">
              <SidebarItem name={item.name} active={location.pathname === item.path} />
            </Link>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 overflow-auto">
        {/* TOP BAR */}
        <div className="flex justify-between items-center mb-6">
          <div></div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">🔔</span>
            <img src="https://i.pravatar.cc/40" className="w-10 h-10 rounded-full border" />
          </div>
        </div>

        {/* HERO BANNER */}
        <div className="w-full h-60 bg-yellow-200 rounded-xl mb-8 shadow-md flex items-center justify-center">
          <h2 className="text-3xl font-bold text-gray-800">About Egg Bucket</h2>
        </div>

        {/* QUICK STATS ROW */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          {statCards.filter(card => roles.includes(card.role)).map(card => (
            <StatCard key={card.title} title={card.title} value={card.value} icon={card.icon} />
          ))}
        </div>

        {/* ACHIEVEMENTS */}
        <h2 className="text-xl font-bold mb-4">Achievements & Milestones</h2>
        <div className="grid grid-cols-3 gap-4">
          <MilestoneCard date="Q1 2024" title="Expanded to 5 New Regions" icon="➡️" />
          <MilestoneCard date="Oct 2023" title="1 Million Eggs Distributed Monthly" icon="🏆" />
          <MilestoneCard date="Aug 2023" title="Launched Digital Payment System" icon="💳" />
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
  