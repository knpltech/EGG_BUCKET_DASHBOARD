import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { normalizeZone } from "../utils/role";

const API_URL = import.meta.env.VITE_API_URL;

const formatCurrency = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "₹0";
  return "₹" + Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
};

const toNumber = (value) => {
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
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

const getPaymentValueForOutlet = (doc, outlet) => {
  const values = doc?.outlets;
  if (!values || typeof values !== "object" || Array.isArray(values)) return 0;

  const keys = [outlet?.id, outlet?.area, outlet?.name].filter(Boolean);
  for (const key of keys) {
    if (values[key] !== undefined) return Number(values[key]) || 0;
  }

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

const getTodayPaymentTotal = (rows, outlets, today) => {
  if (!Array.isArray(outlets) || outlets.length === 0) return 0;

  const dayRows = Array.isArray(rows)
    ? rows
        .filter((doc) => normalizeDate(doc.date || doc.createdAt) === today)
        .sort((a, b) => getDocTimestamp(a) - getDocTimestamp(b))
    : [];

  const latestValues = new Map();

  dayRows.forEach((doc) => {
    outlets.forEach((outlet) => {
      const outletKey = outlet?.id || outlet?.area || outlet?.name;
      if (!outletKey) return;
      latestValues.set(outletKey, getPaymentValueForOutlet(doc, outlet));
    });
  });

  return Array.from(latestValues.values()).reduce((sum, value) => sum + (Number(value) || 0), 0);
};

const getTodayMappedOutletsTotal = (rows, outlets, today) => {
  const doc = getLatestDayDoc(rows, today);
  if (!doc) return 0;
  if (!Array.isArray(outlets) || outlets.length === 0) return 0;
  return outlets.reduce((sum, outlet) => sum + getPaymentValueForOutlet(doc, outlet), 0);
};

const extractSupervisorZones = (user) => {
  if (!user || typeof user !== "object") return [];
  const rawZones = [];
  if (Array.isArray(user.zoneIds)) rawZones.push(...user.zoneIds);
  if (Array.isArray(user.zones)) rawZones.push(...user.zones);
  if (Array.isArray(user.assignedZones)) rawZones.push(...user.assignedZones);
  rawZones.push(user.zoneId, user.zone, user.zoneNumber);
  return Array.from(new Set(rawZones.map((z) => normalizeZone(z)).filter(Boolean)));
};

const isOutletInSupervisorZones = (outlet, normalizedZones) => {
  if (!Array.isArray(normalizedZones) || normalizedZones.length === 0) return false;
  const outletZone = normalizeZone(outlet?.zoneId || outlet?.zone || outlet?.zoneNumber);
  return Boolean(outletZone && normalizedZones.includes(outletZone));
};

const formatZoneLabel = (zoneKey) => {
  if (!zoneKey) return "";
  return `Zone ${String(zoneKey).trim()}`;
};

const getClosingStockBySupervisorZone = (rows, normalizedZones, today, zoneSales = {}, zoneDamages = {}) => {
  const zoneSet = new Set((normalizedZones || []).map((zoneKey) => String(zoneKey)));
  const latestByZone = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const rowDate = normalizeDate(row?.date || row?.createdAt);
    if (rowDate !== today) continue;

    const zoneNumber = normalizeZone(row?.zone);
    if (!zoneNumber || !zoneSet.has(String(zoneNumber))) continue;

    const zoneLabel = formatZoneLabel(zoneNumber);
    const existing = latestByZone.get(zoneLabel);
    if (!existing || getDocTimestamp(row) >= getDocTimestamp(existing)) {
      latestByZone.set(zoneLabel, row);
    }
  }

  return Object.fromEntries(
    (normalizedZones || []).map((zoneNumber) => {
      const zoneLabel = formatZoneLabel(zoneNumber);
      const row = latestByZone.get(zoneLabel);
      if (!row) return [zoneLabel, 0];

      const openingStock = toNumber(row?.openingStock);
      const stockIn = toNumber(row?.stockIn);
      const salesQty = zoneSales[zoneLabel] !== undefined ? toNumber(zoneSales[zoneLabel]) : toNumber(row?.salesQty);
      const damagesQty = zoneDamages[zoneLabel] !== undefined ? toNumber(zoneDamages[zoneLabel]) : toNumber(row?.damagesQty);
      const closingValue = openingStock + stockIn - salesQty - damagesQty;
      return [zoneLabel, Number.isFinite(closingValue) ? closingValue : 0];
    })
  );
};

export default function SupervisorDashboard() {
  const [eggsToday, setEggsToday] = useState(0);
  const [totalCashPayments, setTotalCashPayments] = useState(0);
  const [totalIncentive, setTotalIncentive] = useState(0);
  const [totalAdvance, setTotalAdvance] = useState(0);
  const [totalFoodAllowance, setTotalFoodAllowance] = useState(0);
  const [damagesToday, setDamagesToday] = useState(0);
  const [neccRate, setNeccRate] = useState("₹0.00");
  const [zoneClosingStock, setZoneClosingStock] = useState({});

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

  const totalClosingStock = useMemo(() => {
    const total = Object.values(zoneClosingStock || {}).reduce((sum, value) => sum + toNumber(value), 0);
    return Number.isFinite(total) ? total : 0;
  }, [zoneClosingStock]);

  const showZoneBreakdown = normalizedUserZones.length > 1;

  const fetchSupervisorDashboard = useCallback(async () => {
    const today = getLocalIsoDate();

    try {
      const [outletsRes, salesRes, damagesRes, cashRes, digitalRes, incentiveRes, advanceRes, zoneStockRes, foodAllowanceRes] = await Promise.all([
        fetch(`${API_URL}/outlets/all`),
        fetch(`${API_URL}/dailysales/all`),
        fetch(`${API_URL}/daily-damage/all`),
        fetch(`${API_URL}/cash-payments/all`),
        fetch(`${API_URL}/digital-payments/all`),
        fetch(`${API_URL}/incentive/all`),
        fetch(`${API_URL}/advance/all`),
        fetch(`${API_URL}/zone-stock/all`),
        fetch(`${API_URL}/food-allowance/all`),
      ]);

      const outletsRaw = await outletsRes.json();
      const salesRaw = await salesRes.json();
      const damagesRaw = await damagesRes.json();
      const cashRaw = await cashRes.json();
      const digitalRaw = await digitalRes.json();
      const incentiveRaw = await incentiveRes.json();
      const advanceRaw = await advanceRes.json();
      const zoneStockRaw = await zoneStockRes.json();
      const foodAllowanceRaw = await foodAllowanceRes.json();

      const zoneOutlets = Array.isArray(outletsRaw)
        ? outletsRaw.filter((outlet) => isOutletInSupervisorZones(outlet, normalizedUserZones))
        : [];

      const activeOutlets = zoneOutlets.filter((outlet) => outlet.status === "Active");
      const salesTotal = getTodaySalesTotal(salesRaw, activeOutlets, today);
      const cashTotal = getTodayPaymentTotal(cashRaw, activeOutlets, today);
      const digitalTotal = getTodayPaymentTotal(digitalRaw, activeOutlets, today);
      const totalRevenue = cashTotal + digitalTotal;

      setEggsToday(salesTotal);
      setTotalCashPayments(cashTotal);
      setTotalIncentive(getTodayMappedOutletsTotal(incentiveRaw, activeOutlets, today));
      setTotalAdvance(getTodayMappedOutletsTotal(advanceRaw, activeOutlets, today));
      setTotalFoodAllowance(getTodayMappedOutletsTotal(foodAllowanceRaw, activeOutlets, today));
      setDamagesToday(getTodayDamageTotal(damagesRaw, activeOutlets, today));
      const computedRate = salesTotal > 0 ? totalRevenue / salesTotal : 0;
      setNeccRate(`₹${computedRate.toFixed(2)}`);

      const zoneSales = Object.fromEntries(
        (normalizedUserZones || []).map((zoneNumber) => {
          const zoneOutlets = activeOutlets.filter(
            (outlet) => normalizeZone(outlet?.zoneId || outlet?.zone || outlet?.zoneNumber) === String(zoneNumber)
          );
          return [formatZoneLabel(zoneNumber), getTodaySalesTotal(salesRaw, zoneOutlets, today)];
        })
      );

      const zoneDamages = Object.fromEntries(
        (normalizedUserZones || []).map((zoneNumber) => {
          const zoneOutlets = activeOutlets.filter(
            (outlet) => normalizeZone(outlet?.zoneId || outlet?.zone || outlet?.zoneNumber) === String(zoneNumber)
          );
          return [formatZoneLabel(zoneNumber), getTodayDamageTotal(damagesRaw, zoneOutlets, today)];
        })
      );

      setZoneClosingStock(getClosingStockBySupervisorZone(zoneStockRaw, normalizedUserZones, today, zoneSales, zoneDamages));
    } catch {
      setEggsToday(0);
      setTotalCashPayments(0);
      setTotalIncentive(0);
      setTotalAdvance(0);
      setTotalFoodAllowance(0);
      setDamagesToday(0);
      setNeccRate("₹0.00");
      setZoneClosingStock({});
    }
  }, [normalizedUserZones]);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      if (!mounted) return;
      await fetchSupervisorDashboard();
    };

    refresh();

    const intervalId = window.setInterval(refresh, 30000);
    const handleFocus = () => refresh();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchSupervisorDashboard]);

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard title="Total Eggs Distributed Today" value={eggsToday} icon="🥚" />
            <StatCard title="Total Cash Payments" value={formatCurrency(totalCashPayments)} icon="💵" />
            <StatCard title="Damages Today" value={damagesToday} icon="📉" />
            <StatCard title="Today&apos;s NECC Rate" value={neccRate} icon="📈" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatCard title="Today&apos;s Closing Stock" value={totalClosingStock.toLocaleString("en-IN")} icon="📦" />
            <StatCard title="Total Incentives" value={formatCurrency(totalIncentive)} icon="🎯" />
            <StatCard title="Total Advances" value={formatCurrency(totalAdvance)} icon="💰" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
            <StatCard title="Total Food Allowances" value={formatCurrency(totalFoodAllowance)} icon="🍽️" />
          </div>

          {showZoneBreakdown ? (
            <div className="mb-8 rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-gray-800">Closing Stock by Assigned Zone</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(normalizedUserZones || []).map((zoneNumber) => {
                  const zoneLabel = formatZoneLabel(zoneNumber);
                  const closingValue = toNumber(zoneClosingStock?.[zoneLabel]);
                  return (
                    <div key={zoneLabel} className="rounded-lg border border-gray-200 p-4 text-center">
                      <p className="mb-2 font-semibold text-orange-600">{zoneLabel}</p>
                      <p className="text-3xl font-bold text-orange-600">{closingValue.toLocaleString("en-IN")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

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
