import { useCallback, useEffect, useMemo, useState } from "react";
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

const getStockQuantityBySupervisorZone = (rows, normalizedZones, today) => {
  const zoneSet = new Set((normalizedZones || []).map((zoneKey) => String(zoneKey)));

  return Object.fromEntries(
    (normalizedZones || []).map((zoneNumber) => {
      const zoneLabel = formatZoneLabel(zoneNumber);
      const total = (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
        const rowDate = normalizeDate(row?.date || row?.createdAt);
        const zoneValue = normalizeZone(row?.zone);
        if (rowDate !== today || !zoneValue || !zoneSet.has(String(zoneValue))) return sum;
        if (zoneValue !== String(zoneNumber)) return sum;
        return sum + toNumber(row?.stockQuantity);
      }, 0);

      return [zoneLabel, total];
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
  const [zoneStockQuantity, setZoneStockQuantity] = useState({});

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

  const totalStockQuantity = useMemo(() => {
    const total = Object.values(zoneStockQuantity || {}).reduce((sum, value) => sum + toNumber(value), 0);
    return Number.isFinite(total) ? total : 0;
  }, [zoneStockQuantity]);

  const showZoneBreakdown = normalizedUserZones.length > 1;

  const fetchSupervisorDashboard = useCallback(async () => {
    const today = getLocalIsoDate();

    try {
      const [outletsRes, salesRes, damagesRes, cashRes, digitalRes, incentiveRes, advanceRes, stockOptionsRes, foodAllowanceRes] = await Promise.all([
        fetch(`${API_URL}/outlets/all`),
        fetch(`${API_URL}/dailysales/all`),
        fetch(`${API_URL}/daily-damage/all`),
        fetch(`${API_URL}/cash-payments/all`),
        fetch(`${API_URL}/digital-payments/all`),
        fetch(`${API_URL}/incentive/all`),
        fetch(`${API_URL}/advance/all`),
        fetch(`${API_URL}/stock-options/date/${today}`),
        fetch(`${API_URL}/food-allowance/all`),
      ]);

      const outletsRaw = await outletsRes.json();
      const salesRaw = await salesRes.json();
      const damagesRaw = await damagesRes.json();
      const cashRaw = await cashRes.json();
      const digitalRaw = await digitalRes.json();
      const incentiveRaw = await incentiveRes.json();
      const advanceRaw = await advanceRes.json();
      let stockOptionsRaw = await stockOptionsRes.json();
      if (!Array.isArray(stockOptionsRaw) && stockOptionsRaw) stockOptionsRaw = [stockOptionsRaw];
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

      setZoneStockQuantity(getStockQuantityBySupervisorZone(stockOptionsRaw, normalizedUserZones, today));
    } catch {
      setEggsToday(0);
      setTotalCashPayments(0);
      setTotalIncentive(0);
      setTotalAdvance(0);
      setTotalFoodAllowance(0);
      setDamagesToday(0);
      setNeccRate("₹0.00");
      setZoneStockQuantity({});
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
            <StatCard title="Today&apos;s Stock Quantity" value={totalStockQuantity.toLocaleString("en-IN")} icon="📦" />
            <StatCard title="Total Incentives" value={formatCurrency(totalIncentive)} icon="🎯" />
            <StatCard title="Total Advances" value={formatCurrency(totalAdvance)} icon="💰" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
            <StatCard title="Total Food Allowances" value={formatCurrency(totalFoodAllowance)} icon="🍽️" />
          </div>

          {showZoneBreakdown ? (
            <div className="mb-8 rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-gray-800">Stock Quantity by Assigned Zone</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(normalizedUserZones || []).map((zoneNumber) => {
                  const zoneLabel = formatZoneLabel(zoneNumber);
                  const closingValue = toNumber(zoneStockQuantity?.[zoneLabel]);
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
