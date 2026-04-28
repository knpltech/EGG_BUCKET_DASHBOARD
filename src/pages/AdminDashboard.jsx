const API_URL = import.meta.env.VITE_API_URL;

import { useCallback, useEffect, useRef, useState } from "react";
import { getRoleFlags, normalizeZone } from "../utils/role";
import { fetchZoneWiseRevenue } from "../context/reportsApi";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

const formatDateDMY = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
};

function CalendarIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="8.5" cy="14.5" r="1" />
      <circle cx="12" cy="14.5" r="1" />
      <circle cx="15.5" cy="14.5" r="1" />
    </svg>
  );
}

function BaseCalendar({ rows = [], selectedDate, onSelectDate, showDots = false }) {
  const today = new Date();
  const initialDate = selectedDate ? new Date(selectedDate) : today;
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());

  useEffect(() => {
    if (!selectedDate) return;
    const date = new Date(selectedDate);
    if (!Number.isNaN(date.getTime())) {
      setViewMonth(date.getMonth());
      setViewYear(date.getFullYear());
    }
  }, [selectedDate]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const buildIso = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const hasEntryForDate = (iso) => Array.isArray(rows) && rows.some((row) => row?.date === iso);

  const weeks = [];
  let day = 1 - firstDay;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++, day++) week.push(day < 1 || day > daysInMonth ? null : day);
    weeks.push(week);
  }

  const goPrevMonth = () => setViewMonth((month) => {
    if (month === 0) {
      setViewYear((year) => year - 1);
      return 11;
    }
    return month - 1;
  });

  const goNextMonth = () => setViewMonth((month) => {
    if (month === 11) {
      setViewYear((year) => year + 1);
      return 0;
    }
    return month + 1;
  });

  const yearOptions = [];
  for (let year = viewYear - 3; year <= viewYear + 3; year++) yearOptions.push(year);

  return (
    <div className="w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button type="button" onClick={goPrevMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">‹</button>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400" value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))}>
            {MONTHS.map((month, index) => (
              <option key={month} value={index}>{month.slice(0, 3)}</option>
            ))}
          </select>
          <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400" value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))}>
            {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <button type="button" onClick={goNextMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">›</button>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1 px-4 text-center text-[11px] font-medium text-gray-400">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1 px-3 pb-3 text-center text-xs">
        {weeks.map((week, weekIndex) =>
          week.map((weekDay, dayIndex) => {
            if (!weekDay) return <div key={`${weekIndex}-${dayIndex}`} />;
            const iso = buildIso(viewYear, viewMonth, weekDay);
            const isSelected = selectedDate === iso;
            const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === weekDay;
            const hasEntry = showDots && hasEntryForDate(iso);

            return (
              <button key={`${weekIndex}-${dayIndex}`} type="button" onClick={() => onSelectDate(iso)} className={showDots ? "flex flex-col items-center gap-1" : "flex h-8 items-center justify-center"}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isSelected ? "bg-green-500 text-white" : isToday ? "border border-green-500 text-green-600" : "text-gray-700 hover:bg-gray-100"}`}>
                  {weekDay}
                </div>
                {showDots && <div className={`h-1.5 w-1.5 rounded-full ${hasEntry ? "bg-green-500" : "bg-red-400"}`} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

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

const getNeccRateNumber = (doc) => {
  if (!doc) return 0;
  if (doc.rateValue !== undefined) {
    const value = Number(doc.rateValue);
    if (Number.isFinite(value)) return value;
  }
  if (doc.rate !== undefined) {
    const match = String(doc.rate).replace(/,/g, "").match(/([\d.]+)/);
    if (match) return Number(match[1]) || 0;
  }
  return 0;
};

const getAverageNeccRate = (docs = []) => {
  const numeric = docs
    .map((doc) => getNeccRateNumber(doc))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!numeric.length) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
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

const getLatestDayDoc = (rows, selectedDate) => {
  if (!Array.isArray(rows)) return null;
  const dayRows = rows
    .filter((doc) => normalizeDate(doc.date || doc.createdAt) === selectedDate)
    .sort((a, b) => getDocTimestamp(b) - getDocTimestamp(a));
  return dayRows[0] || null;
};

const getSalesTotal = (rows, outlets, selectedDate) => {
  const doc = getLatestDayDoc(rows, selectedDate);
  if (!doc) return 0;
  if (!Array.isArray(outlets) || outlets.length === 0) return Number(doc.total) || 0;
  return outlets.reduce((sum, outlet) => sum + getSalesValueForOutlet(doc, outlet), 0);
};

const getDamageTotal = (rows, outlets, selectedDate) => {
  const doc = getLatestDayDoc(rows, selectedDate);
  if (!doc) return 0;
  if (!Array.isArray(outlets) || outlets.length === 0) return Number(doc.total) || 0;
  return outlets.reduce((sum, outlet) => sum + getDamageValueForOutlet(doc, outlet), 0);
};

const ZONE_NUMBERS = ["1", "2", "3", "4", "5"];
const ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

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

const createEmptyZoneRevenue = () => ({
  "Zone 1": { cash: 0, digital: 0, total: 0 },
  "Zone 2": { cash: 0, digital: 0, total: 0 },
  "Zone 3": { cash: 0, digital: 0, total: 0 },
  "Zone 4": { cash: 0, digital: 0, total: 0 },
  "Zone 5": { cash: 0, digital: 0, total: 0 },
});

const createEmptyZoneStats = () =>
  Object.fromEntries(ZONES.map((zoneName) => [zoneName, { eggs: 0, outlets: 0, damage: 0, necc: "₹0.00" }]));

const createEmptyZoneClosing = () =>
  Object.fromEntries(ZONES.map((zoneName) => [zoneName, 0]));

const createEmptyZoneAmounts = () =>
  Object.fromEntries(ZONES.map((zoneName) => [zoneName, 0]));

const getAmountValueForOutlet = (doc, outlet) => {
  const values = doc?.outlets;
  if (!values || typeof values !== "object" || Array.isArray(values)) return 0;

  const keys = [outlet?.id, outlet?.area, outlet?.name].filter(Boolean);
  for (const key of keys) {
    if (values[key] !== undefined) return Number(values[key]) || 0;
  }

  return 0;
};

const getZoneWiseAmountTotals = (rows = [], outlets = [], selectedDate) => {
  const zoneTotals = createEmptyZoneAmounts();

  const activeOutlets = Array.isArray(outlets)
    ? outlets.filter((outlet) => outlet && outlet.status === "Active")
    : [];

  const zoneOutletsMap = new Map();
  activeOutlets.forEach((outlet) => {
    const normalizedZone = normalizeZone(outlet.zoneId || outlet.zone || outlet.zoneNumber);
    if (!normalizedZone) return;

    const zoneLabel = `Zone ${normalizedZone}`;
    if (!ZONES.includes(zoneLabel)) return;

    if (!zoneOutletsMap.has(zoneLabel)) zoneOutletsMap.set(zoneLabel, []);
    zoneOutletsMap.get(zoneLabel).push(outlet);
  });

  const dayRows = Array.isArray(rows)
    ? rows
        .filter((doc) => normalizeDate(doc.date || doc.createdAt) === selectedDate)
        .sort((a, b) => getDocTimestamp(a) - getDocTimestamp(b))
    : [];

  zoneOutletsMap.forEach((zoneOutlets, zoneLabel) => {
    const latestValues = new Map();

    dayRows.forEach((doc) => {
      zoneOutlets.forEach((outlet) => {
        const outletKey = outlet?.id || outlet?.area || outlet?.name;
        if (!outletKey) return;
        latestValues.set(outletKey, getAmountValueForOutlet(doc, outlet));
      });
    });

    zoneTotals[zoneLabel] = Array.from(latestValues.values()).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );
  });

  return zoneTotals;
};

const getZoneWiseClosingStock = (rows = [], selectedDate, zoneSales = {}, zoneDamages = {}) => {
  const latestByZone = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const rowDate = normalizeDate(row?.date || row?.createdAt);
    if (rowDate !== selectedDate) continue;

    const normalizedZone = normalizeZone(row?.zone);
    if (!normalizedZone) continue;

    const zoneLabel = `Zone ${normalizedZone}`;
    if (!ZONES.includes(zoneLabel)) continue;

    const existing = latestByZone.get(zoneLabel);
    if (!existing || getDocTimestamp(row) >= getDocTimestamp(existing)) {
      latestByZone.set(zoneLabel, row);
    }
  }

  return Object.fromEntries(
    ZONES.map((zoneLabel) => {
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

export default function AdminDashboard() {
  const { isAdmin, isViewer, zone } = getRoleFlags();
  const hasGlobalDashboardScope = isAdmin || isViewer;
  const calendarRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState(getLocalIsoDate());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [totalOutlets, setTotalOutlets] = useState(0);
  const [eggsToday, setEggsToday] = useState(0);
  const [damagesToday, setDamagesToday] = useState(0);
  const [zoneRevenue, setZoneRevenue] = useState(createEmptyZoneRevenue);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [zoneStats, setZoneStats] = useState(createEmptyZoneStats);
  const [zoneStatsLoading, setZoneStatsLoading] = useState(true);
  const [zoneClosingStock, setZoneClosingStock] = useState(createEmptyZoneClosing);
  const [zoneClosingLoading, setZoneClosingLoading] = useState(true);
  const [zoneIncentive, setZoneIncentive] = useState(createEmptyZoneAmounts);
  const [zoneAdvance, setZoneAdvance] = useState(createEmptyZoneAmounts);
  const [zoneFoodAllowance, setZoneFoodAllowance] = useState(createEmptyZoneAmounts);
  const [amountLoading, setAmountLoading] = useState(true);
  const totalClosingStockAllZones = ZONES.reduce(
    (sum, zoneName) => sum + toNumber(zoneClosingStock?.[zoneName]),
    0
  );
  const totalIncentiveAllZones = ZONES.reduce(
    (sum, zoneName) => sum + (Number(zoneIncentive?.[zoneName]) || 0),
    0
  );
  const totalAdvanceAllZones = ZONES.reduce(
    (sum, zoneName) => sum + (Number(zoneAdvance?.[zoneName]) || 0),
    0
  );
  const totalFoodAllowanceAllZones = ZONES.reduce(
    (sum, zoneName) => sum + (Number(zoneFoodAllowance?.[zoneName]) || 0),
    0
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadDashboard = useCallback(async () => {
    const computeZoneStats = (outlets, salesRows, damageRows, neccRates) => {
      const stats = createEmptyZoneStats();

      ZONE_NUMBERS.forEach((zoneNum) => {
        const zoneLabel = `Zone ${zoneNum}`;
        const zoneOutlets = Array.isArray(outlets)
          ? outlets.filter((outlet) => outlet.status === "Active" && normalizeZone(outlet.zoneId || outlet.zone || outlet.zoneNumber) === zoneNum)
          : [];

        const outletIdentitySet = buildOutletIdentitySet(zoneOutlets);
        stats[zoneLabel].outlets = zoneOutlets.length;
        stats[zoneLabel].eggs = zoneOutlets.length === 0 ? 0 : getSalesTotal(Array.isArray(salesRows) ? salesRows : [], zoneOutlets, selectedDate);
        stats[zoneLabel].damage = zoneOutlets.length === 0 ? 0 : getDamageTotal(Array.isArray(damageRows) ? damageRows : [], zoneOutlets, selectedDate);

        if (Array.isArray(neccRates) && neccRates.length > 0) {
          const selectedZoneRates = neccRates.filter((rate) => {
            const isSelectedDate = normalizeDate(rate.date || rate.createdAt) === selectedDate;
            return isSelectedDate && isNeccDocForOutlets(rate, outletIdentitySet);
          });

          if (selectedZoneRates.length > 0) {
            const averageRate = getAverageNeccRate(selectedZoneRates);
            if (Number.isFinite(averageRate) && averageRate > 0) {
              stats[zoneLabel].necc = `₹${averageRate.toFixed(2)}`;
            }
          }
        }
      });

      return stats;
    };

    const updateOutlets = async () => {
      try {
        const url = hasGlobalDashboardScope
          ? `${API_URL}/outlets/all`
          : zone
            ? `${API_URL}/outlets/zone/${zone}`
            : `${API_URL}/outlets/all`;
        const res = await fetch(url);
        const list = await res.json();
        const activeOutlets = Array.isArray(list) ? list.filter((outlet) => outlet.status === "Active") : [];
        setTotalOutlets(activeOutlets.length);
        return activeOutlets;
      } catch {
        setTotalOutlets(0);
        return [];
      }
    };

      setRevenueLoading(true);
      setZoneStatsLoading(true);
      setZoneClosingLoading(true);
      setAmountLoading(true);

      try {
        const outlets = await updateOutlets();
        const [salesRes, damageRes, neccRes, zoneStockRes, incentiveRes, advanceRes, foodAllowanceRes] = await Promise.all([
          fetch(`${API_URL}/dailysales/all`),
          fetch(`${API_URL}/daily-damage/all`),
          fetch(`${API_URL}/neccrate/all`),
          fetch(`${API_URL}/zone-stock/all`),
          fetch(`${API_URL}/incentive/all`),
          fetch(`${API_URL}/advance/all`),
          fetch(`${API_URL}/food-allowance/all`),
        ]);

        const [salesRows, damageRows, neccRates, zoneStockRows, incentiveRows, advanceRows, foodAllowanceRows] = await Promise.all([
          salesRes.json(),
          damageRes.json(),
          neccRes.json(),
          zoneStockRes.json(),
          incentiveRes.json(),
          advanceRes.json(),
          foodAllowanceRes.json(),
        ]);

        setEggsToday(getSalesTotal(Array.isArray(salesRows) ? salesRows : [], outlets, selectedDate));
        setDamagesToday(getDamageTotal(Array.isArray(damageRows) ? damageRows : [], outlets, selectedDate));

        const computedZoneStats = computeZoneStats(outlets, salesRows, damageRows, neccRates);
        setZoneStats(computedZoneStats);

        const zoneSales = Object.fromEntries(
          ZONES.map((zoneName) => [zoneName, toNumber(computedZoneStats?.[zoneName]?.eggs)])
        );
        const zoneDamages = Object.fromEntries(
          ZONES.map((zoneName) => [zoneName, toNumber(computedZoneStats?.[zoneName]?.damage)])
        );

        const revenueData = await fetchZoneWiseRevenue(selectedDate);
        setZoneRevenue(revenueData.success ? revenueData.zoneRevenue : createEmptyZoneRevenue());
        setZoneClosingStock(
          getZoneWiseClosingStock(Array.isArray(zoneStockRows) ? zoneStockRows : [], selectedDate, zoneSales, zoneDamages)
        );
        setZoneIncentive(getZoneWiseAmountTotals(Array.isArray(incentiveRows) ? incentiveRows : [], outlets, selectedDate));
        setZoneAdvance(getZoneWiseAmountTotals(Array.isArray(advanceRows) ? advanceRows : [], outlets, selectedDate));
        setZoneFoodAllowance(getZoneWiseAmountTotals(Array.isArray(foodAllowanceRows) ? foodAllowanceRows : [], outlets, selectedDate));
      } catch (err) {
        console.error("Dashboard load error:", err);
        setEggsToday(0);
        setDamagesToday(0);
        setZoneRevenue(createEmptyZoneRevenue());
        setZoneStats(createEmptyZoneStats());
        setZoneClosingStock(createEmptyZoneClosing());
        setZoneIncentive(createEmptyZoneAmounts());
        setZoneAdvance(createEmptyZoneAmounts());
        setZoneFoodAllowance(createEmptyZoneAmounts());
      } finally {
        setRevenueLoading(false);
        setZoneStatsLoading(false);
        setZoneClosingLoading(false);
        setAmountLoading(false);
      }
    }, [hasGlobalDashboardScope, selectedDate, zone]);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      if (!mounted) return;
      await loadDashboard();
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
  }, [loadDashboard]);

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">
      <div className="bg-white rounded-xl shadow px-6 py-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Dashboard Overview</h1>
          <p className="text-sm text-gray-500">Welcome back! Here&apos;s what&apos;s happening for the selected date.</p>
        </div>
      </div>

      <div className="w-full bg-yellow-200 rounded-xl mb-8 shadow-md p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">About Egg Bucket</h2>
        <p className="text-gray-700">
          Egg Bucket helps manage egg distribution with transparency and real-time reporting.
        </p>
      </div>

      <div className="mb-8 flex justify-end">
        <div className="relative flex w-full flex-col gap-2 sm:max-w-xs" ref={calendarRef}>
          <label htmlFor="admin-dashboard-date" className="text-sm font-semibold text-gray-700 sm:text-right">
            Select date
          </label>
          <div className="relative z-30">
            <button
              id="admin-dashboard-date"
              type="button"
              onClick={() => setIsCalendarOpen((open) => !open)}
              className="flex min-w-[150px] w-full items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
            >
              <span>{selectedDate ? formatDateDMY(selectedDate) : "dd-mm-yyyy"}</span>
              <CalendarIcon className="h-4 w-4 text-gray-500" />
            </button>
            {isCalendarOpen && (
              <div className="absolute right-0 top-full mt-2 z-50">
                <BaseCalendar
                  selectedDate={selectedDate}
                  onSelectDate={(iso) => {
                    setSelectedDate(iso);
                    setIsCalendarOpen(false);
                  }}
                  showDots={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard title="Total Eggs Distributed" value={eggsToday} icon="🥚" />
        <StatCard title="Total Outlets" value={totalOutlets} icon="🏪" />
        <StatCard title="Total Egg Damages" value={damagesToday} icon="📉" />
        <StatCard
          title="Total Closing Stock (All Zones)"
          value={zoneClosingLoading ? "..." : totalClosingStockAllZones.toLocaleString("en-IN")}
          icon="📦"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
        <StatCard
          title="Total Incentives"
          value={amountLoading ? "..." : formatCurrency(totalIncentiveAllZones)}
          icon="🎯"
        />
        <StatCard
          title="Total Advances"
          value={amountLoading ? "..." : formatCurrency(totalAdvanceAllZones)}
          icon="💰"
        />
      </div>

      <h2 className="text-xl font-bold mb-4">Revenue by Supervisor Zone</h2>
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

      <h2 className="text-xl font-bold mb-4">Eggs Distributed by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {zoneStatsLoading ? (
          <p className="text-gray-500 text-center py-10">Loading zone data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">{(zoneStats[zoneName]?.eggs ?? 0).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Damages by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {zoneStatsLoading ? (
          <p className="text-gray-500 text-center py-10">Loading zone data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">{(zoneStats[zoneName]?.damage ?? 0).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Incentive by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {amountLoading ? (
          <p className="text-gray-500 text-center py-10">Loading incentive data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">{formatCurrency(zoneIncentive[zoneName] ?? 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Advance by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {amountLoading ? (
          <p className="text-gray-500 text-center py-10">Loading advance data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">{formatCurrency(zoneAdvance[zoneName] ?? 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Food Allowance by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {amountLoading ? (
          <p className="text-gray-500 text-center py-10">Loading food allowance data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">{formatCurrency(zoneFoodAllowance[zoneName] ?? 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Closing Stock by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {zoneClosingLoading ? (
          <p className="text-gray-500 text-center py-10">Loading closing stock data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">{(zoneClosingStock[zoneName] ?? 0).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">Cash Payments by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {revenueLoading ? (
          <p className="text-gray-500 text-center py-10">Loading cash payment data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => (
              <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">
                  {formatCurrency(zoneRevenue[zoneName]?.cash ?? 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-4">NECC Rate by Supervisor Zone</h2>
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        {zoneStatsLoading || revenueLoading ? (
          <p className="text-gray-500 text-center py-10">Loading zone data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ZONES.map((zoneName) => {
              const eggsDistributed = Number(zoneStats[zoneName]?.eggs) || 0;
              const totalRevenue = Number(zoneRevenue[zoneName]?.total) || 0;
              const computedRate = eggsDistributed > 0 ? totalRevenue / eggsDistributed : 0;

              return (
                <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                  <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                  <div className="text-3xl font-bold text-orange-600">₹{computedRate.toFixed(2)}</div>
                </div>
              );
            })}
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
              <div key={zoneName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition text-center">
                <h3 className="font-semibold text-orange-600 mb-4">{zoneName}</h3>
                <div className="text-3xl font-bold text-orange-600">{zoneStats[zoneName]?.outlets ?? 0}</div>
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
