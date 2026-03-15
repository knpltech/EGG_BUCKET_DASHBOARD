const API_URL = import.meta.env.VITE_API_URL;

import { useEffect, useState } from "react";
import { getRoleFlags, normalizeZone } from "../utils/role";
import { fetchZoneWiseRevenue } from "../context/reportsApi";

const formatCurrency = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "₹0";
  return "₹" + Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
};

const getLocalIsoDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const normalizeDate = (value) => {
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split("-");
        return `${year}-${month}-${day}`;
      }
    }

    if (value && typeof value === "object" && typeof value.toDate === "function") {
      return getLocalIsoDate(value.toDate());
    }

    if (value && typeof value === "object" && value._seconds !== undefined) {
      return getLocalIsoDate(new Date(value._seconds * 1000));
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return getLocalIsoDate(parsed);
  } catch {}

  return String(value ?? "").slice(0, 10);
};

const getDocTimestamp = (doc) => {
  const value = doc?.updatedAt || doc?.createdAt || doc?.date;

  if (value && typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value && typeof value === "object" && value._seconds !== undefined) {
    return value._seconds * 1000;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getSalesValueForOutlet = (doc, outlet) => {
  const outletId = outlet?.id || outlet;
  const area = outlet?.area || outlet?.name || outletId;
  const values = doc?.outlets;

  if (!values || typeof values !== "object" || Array.isArray(values)) return 0;
  if (values[outletId] !== undefined) return Number(values[outletId]) || 0;
  if (area && values[area] !== undefined) return Number(values[area]) || 0;
  return 0;
};

const getDamageValueForOutlet = (doc, outlet) => {
  const area = outlet?.area || outlet?.name || outlet?.id || outlet;
  const values = doc?.damages;

  if (!values || typeof values !== "object" || Array.isArray(values)) return 0;
  if (area && values[area] !== undefined) return Number(values[area]) || 0;
  return 0;
};

const getLatestDayDoc = (rows, today) => {
  if (!Array.isArray(rows)) return null;

  const dayRows = rows
    .filter((doc) => normalizeDate(doc.date || doc.createdAt) === today)
    .sort((a, b) => getDocTimestamp(b) - getDocTimestamp(a));

  return dayRows[0] || null;
};

const getTodaySalesTotal = (rows, outlets, today) => {
  const doc = getLatestDayDoc(rows, today);
  if (!doc) return 0;
  if (!Array.isArray(outlets) || outlets.length === 0) return Number(doc.total) || 0;

  return outlets.reduce((sum, outlet) => sum + getSalesValueForOutlet(doc, outlet), 0);
};

const getTodayDamageTotal = (rows, outlets, today) => {
  const doc = getLatestDayDoc(rows, today);
  if (!doc) return 0;
  if (!Array.isArray(outlets) || outlets.length === 0) return Number(doc.total) || 0;

  return outlets.reduce((sum, outlet) => sum + getDamageValueForOutlet(doc, outlet), 0);
};

// Zone number strings ("1"…"5") — same format normalizeZone() returns
const ZONE_NUMBERS = ["1", "2", "3", "4", "5"];
const ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

// ── helpers mirrored from SupervisorDashboard ──────────────────────
const normalizeTextKey = (value) => {
  if (value == null) return null;
  return String(value).trim().toLowerCase();
};

const buildOutletIdentitySet = (outlets = []) => {
  const keys = new Set();
  outlets.forEach((outlet) => {
    const idKey   = normalizeTextKey(outlet?.id);
    const nameKey = normalizeTextKey(outlet?.name);
    const areaKey = normalizeTextKey(outlet?.area);
    if (idKey)   keys.add(idKey);
    if (nameKey) keys.add(nameKey);
    if (areaKey) keys.add(areaKey);
  });
  return keys;
};

const isNeccDocForOutlets = (doc, outletIdentitySet) => {
  if (!outletIdentitySet || outletIdentitySet.size === 0) return false;
  const outletIdKey = normalizeTextKey(doc?.outletId);
  const outletKey   = normalizeTextKey(doc?.outlet);
  return Boolean(
    (outletIdKey && outletIdentitySet.has(outletIdKey)) ||
    (outletKey   && outletIdentitySet.has(outletKey))
  );
};

export default function AdminDashboard() {
  const { isAdmin, zone } = getRoleFlags();
  const [totalOutlets, setTotalOutlets] = useState(0);
  const [eggsToday, setEggsToday] = useState(0);
  const [neccRate, setNeccRate] = useState("₹0.00");
  const [damagesToday, setDamagesToday] = useState(0);
  const [zoneRevenue, setZoneRevenue] = useState({
    "Zone 1": { cash: 0, digital: 0, total: 0 },
    "Zone 2": { cash: 0, digital: 0, total: 0 },
    "Zone 3": { cash: 0, digital: 0, total: 0 },
    "Zone 4": { cash: 0, digital: 0, total: 0 },
    "Zone 5": { cash: 0, digital: 0, total: 0 },
  });
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [zoneStats, setZoneStats] = useState(
    Object.fromEntries(ZONES.map((z) => [z, { eggs: 0, outlets: 0, damage: 0, necc: "₹0.00" }]))
  );
  const [zoneStatsLoading, setZoneStatsLoading] = useState(true);

  useEffect(() => {
    const today = getLocalIsoDate();
    let activeOutlets = [];

    const updateOutlets = async () => {
      try {
        const url = isAdmin
          ? `${API_URL}/outlets/all`
          : zone
            ? `${API_URL}/outlets/zone/${zone}`
            : `${API_URL}/outlets/all`;
        const res = await fetch(url);
        const list = await res.json();
        activeOutlets = Array.isArray(list) ? list.filter((outlet) => outlet.status === "Active") : [];
        setTotalOutlets(
          activeOutlets.length
        );
        return activeOutlets;
      } catch {
        setTotalOutlets(0);
        activeOutlets = [];
        return [];
      }
    };

    const computeZoneStats = (outlets, salesRows, damageRows, neccRates) => {
      const stats = Object.fromEntries(ZONES.map((z) => [z, { eggs: 0, outlets: 0, damage: 0, necc: "₹0.00" }]));

      ZONE_NUMBERS.forEach((zoneNum) => {
        const zoneLabel = `Zone ${zoneNum}`;

        // Filter active outlets for this zone — mirrors SupervisorDashboard's normalizeZone comparison
        const zoneOutlets = Array.isArray(outlets)
          ? outlets.filter((o) => o.status === "Active" && normalizeZone(o.zoneId || o.zone || o.zoneNumber) === zoneNum)
          : [];

        const outletIdentitySet = buildOutletIdentitySet(zoneOutlets);

        stats[zoneLabel].outlets = zoneOutlets.length;
        // Guard: if no outlets in this zone, always show 0 (never fall back to doc.total)
        stats[zoneLabel].eggs   = zoneOutlets.length === 0 ? 0 : getTodaySalesTotal(Array.isArray(salesRows)  ? salesRows  : [], zoneOutlets, today);
        stats[zoneLabel].damage = zoneOutlets.length === 0 ? 0 : getTodayDamageTotal(Array.isArray(damageRows) ? damageRows : [], zoneOutlets, today);

        // NECC rate — same logic as SupervisorDashboard (case-insensitive outlet matching)
        if (Array.isArray(neccRates) && neccRates.length > 0) {
          const todayZoneRates = neccRates.filter((rate) => {
            const isToday = normalizeDate(rate.date || rate.createdAt) === today;
            return isToday && isNeccDocForOutlets(rate, outletIdentitySet);
          });

          if (todayZoneRates.length > 0) {
            const latest = todayZoneRates.reduce((a, b) =>
              getDocTimestamp(a) >= getDocTimestamp(b) ? a : b
            );
            let rateNum = 0;
            if (latest.rateValue !== undefined) rateNum = Number(latest.rateValue);
            else if (latest.rate) {
              const match = String(latest.rate).replace(/,/g, "").match(/([\d.]+)/);
              if (match) rateNum = Number(match[1]);
            }
            if (Number.isFinite(rateNum) && rateNum > 0) stats[zoneLabel].necc = `₹${rateNum.toFixed(2)}`;
          }
        }
      });

      return stats;
    };

    const loadDashboard = async () => {
      try {
        const outlets = await updateOutlets();

        const [salesRes, damageRes, neccRes] = await Promise.all([
          fetch(`${API_URL}/dailysales/all`),
          fetch(`${API_URL}/daily-damage/all`),
          fetch(`${API_URL}/neccrate/all`),
        ]);
        const [salesRows, damageRows, neccRates] = await Promise.all([
          salesRes.json(),
          damageRes.json(),
          neccRes.json(),
        ]);

        // Overall stats
        setEggsToday(getTodaySalesTotal(Array.isArray(salesRows) ? salesRows : [], outlets, today));
        setDamagesToday(getTodayDamageTotal(Array.isArray(damageRows) ? damageRows : [], outlets, today));

        if (Array.isArray(neccRates) && neccRates.length > 0) {
          const todayRates = neccRates.filter((r) => normalizeDate(r.date || r.createdAt) === today);
          const pool = todayRates.length > 0 ? todayRates : neccRates;
          const latest = pool.reduce((a, b) => getDocTimestamp(a) >= getDocTimestamp(b) ? a : b);
          let rateNum = 0;
          if (latest.rateValue !== undefined) rateNum = Number(latest.rateValue);
          else if (latest.rate) {
            const match = String(latest.rate).replace(/,/g, "").match(/([\d.]+)/);
            if (match) rateNum = Number(match[1]);
          }
          if (!Number.isFinite(rateNum)) rateNum = 0;
          setNeccRate(`₹${rateNum.toFixed(2)}`);
        } else {
          setNeccRate("₹0.00");
        }

        // Zone stats (reuse already-fetched data, no extra API calls)
        setZoneStats(computeZoneStats(outlets, salesRows, damageRows, neccRates));

        // Revenue (separate — uses cash/digital payments)
        setRevenueLoading(true);
        const revenueData = await fetchZoneWiseRevenue();
        if (revenueData.success) setZoneRevenue(revenueData.zoneRevenue);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setRevenueLoading(false);
        setZoneStatsLoading(false);
      }
    };

    loadDashboard();

    window.addEventListener("egg:outlets-updated", updateOutlets);
    return () => {
      window.removeEventListener("egg:outlets-updated", updateOutlets);
    };
  }, [zone, isAdmin]);

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">
      <div className="bg-white rounded-xl shadow px-6 py-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Dashboard Overview</h1>
          <p className="text-sm text-gray-500">Welcome back! Here&apos;s what&apos;s happening today.</p>
        </div>
      </div>

      <div className="w-full bg-yellow-200 rounded-xl mb-8 shadow-md p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">About Egg Bucket</h2>
        <p className="text-gray-700">
          Egg Bucket helps manage egg distribution with transparency and real-time reporting.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard title="Total Eggs Distributed Today" value={eggsToday} icon="🥚" />
        <StatCard title="Total Outlets" value={totalOutlets} icon="🏪" />
        <StatCard title="Total Eggs Damages Today" value={damagesToday} icon="📉" />
        <StatCard title="Today's NECC Rate" value={neccRate} icon="📈" />
      </div>

      <h2 className="text-xl font-bold mb-4">Today&apos;s Revenue by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {revenueLoading ? (
          <p className="text-gray-500 text-center py-10">Loading revenue data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Object.entries(zoneRevenue).map(([zoneName, zoneData]) => (
              <div
                key={zoneName}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center"
              >
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">
                  {formatCurrency(zoneData.total)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Eggs Distributed Today by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {zoneStatsLoading ? (
          <p className="text-gray-500 text-center py-10">Loading zone data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div
                key={zoneName}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center"
              >
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">
                  {(zoneStats[zoneName]?.eggs ?? 0).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Damages Today by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {zoneStatsLoading ? (
          <p className="text-gray-500 text-center py-10">Loading zone data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div
                key={zoneName}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center"
              >
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">
                  {(zoneStats[zoneName]?.damage ?? 0).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Today&apos;s NECC Rate by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {zoneStatsLoading ? (
          <p className="text-gray-500 text-center py-10">Loading zone data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div
                key={zoneName}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center"
              >
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">
                  {zoneStats[zoneName]?.necc ?? "₹0.00"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Total Outlets by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {zoneStatsLoading ? (
          <p className="text-gray-500 text-center py-10">Loading zone data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div
                key={zoneName}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center"
              >
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">
                  {zoneStats[zoneName]?.outlets ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Achievements & Milestones</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MilestoneCard date="Q1 2024" title="Expanded to 5 New Regions" icon="➡️" />
        <MilestoneCard date="Oct 2023" title="1 Million Eggs Distributed Monthly" icon="🏆" />
        <MilestoneCard date="Aug 2023" title="Launched Digital Payment System" icon="💳" />
      </div>

      <div className="mt-12 p-4 bg-orange-100 rounded-xl flex flex-col sm:flex-row justify-between gap-2 text-sm">
        <div><strong>Contact:</strong> 7204704048</div>
        <div><strong>Address:</strong> HSR Layout, Bangalore, Karnataka</div>
      </div>
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
