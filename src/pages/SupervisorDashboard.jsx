import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { normalizeZone } from "../utils/role";

const API_URL = import.meta.env.VITE_API_URL;

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

const getLatestDayDoc = (rows, today) => {
  if (!Array.isArray(rows)) return null;

  const dayRows = rows
    .filter((doc) => normalizeDate(doc.date || doc.createdAt) === today)
    .sort((a, b) => getDocTimestamp(b) - getDocTimestamp(a));

  return dayRows[0] || null;
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

const getTodaySalesTotal = (rows, outlets, today) => {
  const doc = getLatestDayDoc(rows, today);
  if (!doc) return 0;
  if (!Array.isArray(outlets) || outlets.length === 0) return 0;

  return outlets.reduce((sum, outlet) => sum + getSalesValueForOutlet(doc, outlet), 0);
};

const getTodayDamageTotal = (rows, outlets, today) => {
  const doc = getLatestDayDoc(rows, today);
  if (!doc) return 0;
  if (!Array.isArray(outlets) || outlets.length === 0) return 0;

  return outlets.reduce((sum, outlet) => sum + getDamageValueForOutlet(doc, outlet), 0);
};

const extractSupervisorZones = (user) => {
  if (!user || typeof user !== "object") return [];
  const rawZones = [];

  if (Array.isArray(user.zoneIds)) rawZones.push(...user.zoneIds);
  if (Array.isArray(user.zones)) rawZones.push(...user.zones);
  if (Array.isArray(user.assignedZones)) rawZones.push(...user.assignedZones);

  rawZones.push(user.zoneId, user.zone, user.zoneNumber);

  return Array.from(
    new Set(rawZones.map((z) => normalizeZone(z)).filter(Boolean))
  );
};

const isOutletInSupervisorZones = (outlet, normalizedZones) => {
  if (!Array.isArray(normalizedZones) || normalizedZones.length === 0) return false;
  const outletZone = normalizeZone(outlet?.zoneId || outlet?.zone || outlet?.zoneNumber);
  return Boolean(outletZone && normalizedZones.includes(outletZone));
};

const normalizeTextKey = (value) => {
  if (value == null) return null;
  return String(value).trim().toLowerCase();
};

const buildOutletIdentitySet = (outlets = []) => {
  const keys = new Set();
  outlets.forEach((outlet) => {
    const idKey = normalizeTextKey(outlet?.id);
    const nameKey = normalizeTextKey(outlet?.name);
    const areaKey = normalizeTextKey(outlet?.area);
    if (idKey) keys.add(idKey);
    if (nameKey) keys.add(nameKey);
    if (areaKey) keys.add(areaKey);
  });
  return keys;
};

const isNeccDocForOutlets = (doc, outletIdentitySet) => {
  if (!outletIdentitySet || outletIdentitySet.size === 0) return false;
  const outletIdKey = normalizeTextKey(doc?.outletId);
  const outletKey = normalizeTextKey(doc?.outlet);
  return Boolean(
    (outletIdKey && outletIdentitySet.has(outletIdKey)) ||
    (outletKey && outletIdentitySet.has(outletKey))
  );
};

const formatZoneLabel = (zoneKey) => {
  if (!zoneKey) return "";
  return `Zone ${String(zoneKey).trim()}`;
};

export default function SupervisorDashboard() {
  const [eggsToday, setEggsToday] = useState(0);
  const [totalOutlets, setTotalOutlets] = useState(0);
  const [damagesToday, setDamagesToday] = useState(0);
  const [neccRate, setNeccRate] = useState("₹0.00");

  const normalizedUserZones = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      return extractSupervisorZones(user);
    } catch {
      return [];
    }
  }, []);

  const zoneTitle = useMemo(() => {
    if (!normalizedUserZones.length) return "";
    return normalizedUserZones.map(formatZoneLabel).join(", ");
  }, [normalizedUserZones]);

  const supervisorUsername = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      return user?.username ? `@${user.username}` : "";
    } catch {
      return "";
    }
  }, []);

  useEffect(() => {
    const today = getLocalIsoDate();

    const fetchSupervisorDashboard = async () => {
      try {
        const [outletsRes, salesRes, damagesRes, ratesRes] = await Promise.all([
          fetch(`${API_URL}/outlets/all`),
          fetch(`${API_URL}/dailysales/all`),
          fetch(`${API_URL}/daily-damage/all`),
          fetch(`${API_URL}/neccrate/all`),
        ]);

        const outletsRaw = await outletsRes.json();
        const salesRaw = await salesRes.json();
        const damagesRaw = await damagesRes.json();
        const ratesRaw = await ratesRes.json();

        const zoneOutlets = Array.isArray(outletsRaw)
          ? outletsRaw.filter((outlet) => isOutletInSupervisorZones(outlet, normalizedUserZones))
          : [];

        const activeOutlets = zoneOutlets.filter((outlet) => outlet.status === "Active");
        const outletIdentitySet = buildOutletIdentitySet(activeOutlets);
        setTotalOutlets(activeOutlets.length);
        setEggsToday(getTodaySalesTotal(salesRaw, activeOutlets, today));
        setDamagesToday(getTodayDamageTotal(damagesRaw, activeOutlets, today));

        if (!Array.isArray(ratesRaw) || ratesRaw.length === 0) {
          setNeccRate("₹0.00");
        } else {
          const todayZoneRates = ratesRaw.filter((rate) => {
            const isToday = normalizeDate(rate.date || rate.createdAt) === today;
            if (!isToday) return false;
            return isNeccDocForOutlets(rate, outletIdentitySet);
          });

          if (todayZoneRates.length === 0) {
            setNeccRate("₹0.00");
            return;
          }

          const latest = todayZoneRates.reduce((a, b) => (getDocTimestamp(a) >= getDocTimestamp(b) ? a : b));

          let rateNum = 0;
          if (latest.rateValue !== undefined) {
            rateNum = Number(latest.rateValue);
          } else if (latest.rate) {
            const match = String(latest.rate).replace(/,/g, "").match(/([\d.]+)/);
            if (match) rateNum = Number(match[1]);
          }

          if (!Number.isFinite(rateNum)) rateNum = 0;
          setNeccRate(`₹${rateNum.toFixed(2)}`);
        }
      } catch {
        setEggsToday(0);
        setTotalOutlets(0);
        setDamagesToday(0);
        setNeccRate("₹0.00");
      }
    };

    fetchSupervisorDashboard();
  }, [normalizedUserZones]);

  return (
    <div className="flex min-h-screen">
      <Sidebar supervisor />
      <div className="flex-1">
        <Topbar supervisor />
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">
            Supervisor Dashboard{zoneTitle ? ` - ${zoneTitle}` : ""}
          </h1>
          {supervisorUsername ? (
            <p className="mb-4 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-4 py-1 text-base font-bold tracking-wide text-orange-700 shadow-sm">
              {supervisorUsername}
            </p>
          ) : null}
          <p className="mb-6 text-gray-600">Today&apos;s overview for your assigned zone outlets.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Total Eggs Distributed Today" value={eggsToday} icon="🥚" />
            <StatCard title="Total Outlets" value={totalOutlets} icon="🏪" />
            <StatCard title="Damages Today" value={damagesToday} icon="📉" />
            <StatCard title="Today&apos;s NECC Rate" value={neccRate} icon="📈" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <Link to="/supervisor/damages" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">🥚</span>
              <span className="font-semibold text-lg">Daily Damages</span>
              <span className="text-xs text-gray-500 mt-1">Enter and view daily damages</span>
            </Link>
            <Link to="/supervisor/neccrate" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">💹</span>
              <span className="font-semibold text-lg">NECC Rate</span>
              <span className="text-xs text-gray-500 mt-1">View NECC rates</span>
            </Link>
            <Link to="/supervisor/dailysales" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">📊</span>
              <span className="font-semibold text-lg">Daily Sales Quantity</span>
              <span className="text-xs text-gray-500 mt-1">Enter and view daily sales quantity</span>
            </Link>
            <Link to="/supervisor/digital-payments" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">💳</span>
              <span className="font-semibold text-lg">Digital Payments</span>
              <span className="text-xs text-gray-500 mt-1">Manage digital payments</span>
            </Link>
            <Link to="/supervisor/cash-payments" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">💵</span>
              <span className="font-semibold text-lg">Cash Payments</span>
              <span className="text-xs text-gray-500 mt-1">Manage cash payments</span>
            </Link>
            <Link to="/supervisor/reports" className="rounded-xl bg-orange-100 p-6 shadow hover:bg-orange-200 transition flex flex-col items-center">
              <span className="text-2xl mb-2">📈</span>
              <span className="font-semibold text-lg">Reports</span>
              <span className="text-xs text-gray-500 mt-1">View reports</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white shadow-md rounded-xl p-6 flex flex-col">
      <p className="text-gray-600 text-sm md:text-base">{title}</p>
      <div className="flex justify-between items-center mt-2">
        <h3 className="text-3xl font-bold text-orange-600">{value}</h3>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}
