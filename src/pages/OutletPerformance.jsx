import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  faChartLine,
  faCaretDown,
  faCaretUp,
  faArrowDown,
  faArrowUp,
  faCircleExclamation,
  faEgg,
  faFileExport,
  faMoneyBillWave,
  faMinus,
  faRotateRight,
  faUtensils,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import { fetchReportsData, fetchStatisticsData, STATISTICS_INVALIDATED_EVENT } from "../context/reportsApi";
import { getRoleFlags } from "../utils/role";
import { getThisWeekRange, toLocalIsoDate } from "../utils/dateRange";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const currency = (value) => `Rs. ${(Number(value) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const wholeCurrency = (value) => `Rs. ${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
const number = (value) => Math.round(Number(value) || 0).toLocaleString("en-IN");
const percent = (value) => `${(Number(value) || 0).toFixed(2)}%`;

const getGrowthComparison = (current, previous, inverse = false) => {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (!currentValue && !previousValue) return { type: "flat", text: "0%" };
  if (!previousValue) return { type: inverse ? "down" : "up", text: "New" };

  const percentChange = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  if (Math.abs(percentChange) < 0.01) return { type: "flat", text: "0%" };
  const increased = percentChange > 0;
  return {
    type: inverse ? (increased ? "down" : "up") : (increased ? "up" : "down"),
    text: `${Math.abs(percentChange).toFixed(1)}%`,
  };
};

const getMetricTrend = (current, previous, inverse = false) => {
  const delta = (Number(current) || 0) - (Number(previous) || 0);
  if (Math.abs(delta) < 0.005) return { type: "flat", value: 0 };
  const increased = delta > 0;
  return {
    type: inverse ? (increased ? "down" : "up") : (increased ? "up" : "down"),
    value: Math.abs(delta),
  };
};

const toNumber = (value) => Number(value) || 0;
const roundToTwoDecimals = (value) => Math.round((Number(value) || 0) * 100) / 100;

const fetchReportClosingBalances = async (outlets, range) => {
  const balances = await Promise.all((outlets || []).map(async (outlet) => {
    try {
      const report = await fetchReportsData(outlet.label || outlet.key, {
        dateFrom: range.from,
        dateTo: range.to,
      });
      return [String(outlet.key), toNumber(report?.totalDifference)];
    } catch {
      return [String(outlet.key), 0];
    }
  }));

  return new Map(balances);
};

const formatLongDate = (iso) => {
  if (!iso) return "-";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const getRange = (type) => {
  const today = new Date();
  const to = toLocalIsoDate(today);

  if (type === "today") return { from: to, to };
  if (type === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayIso = toLocalIsoDate(yesterday);
    return { from: yesterdayIso, to: yesterdayIso };
  }
  if (type === "week") return getThisWeekRange(today);
  if (type === "lastWeek") {
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
    return { from: toLocalIsoDate(lastWeekStart), to: toLocalIsoDate(lastWeekEnd) };
  }
  if (type === "month") {
    return {
      from: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to,
    };
  }
  if (type === "lastMonth") {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toLocalIsoDate(firstDay), to: toLocalIsoDate(lastDay) };
  }
  if (type === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return { from: toLocalIsoDate(new Date(today.getFullYear(), quarterStartMonth, 1)), to };
  }

  return getThisWeekRange(today);
};

// The comparison period is always the immediately preceding period with the
// same number of days. This keeps a partial week/month useful as well.
const getPreviousRange = ({ from, to }) => {
  if (!from || !to) return { from: "", to: "" };
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return { from: "", to: "" };

  const dayCount = Math.floor((end - start) / 86400000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (dayCount - 1));
  return { from: toLocalIsoDate(previousStart), to: toLocalIsoDate(previousEnd) };
};

const getAprilToTodayRange = () => {
  const today = new Date();
  const aprilYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;

  return {
    from: toLocalIsoDate(new Date(aprilYear, 3, 1)),
    to: toLocalIsoDate(today),
  };
};

const formatMonthLabel = (monthKey) => {
  if (!monthKey) return "-";
  const date = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

const getMonthKeysInRange = (from, to) => {
  if (!from || !to) return [];

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const keys = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endCursor) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    keys.push(`${year}-${month}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
};

const getDateKeysInRange = (from, to) => {
  if (!from || !to) return [];

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dates = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    dates.push(toLocalIsoDate(day));
  }
  return dates;
};

const getDailyRateForDate = (rates, outletId, isoDate) => rates
  .filter((rate) => String(rate.outletId) === String(outletId)
    && rate.effectiveFrom <= isoDate
    && (!rate.effectiveTo || rate.effectiveTo >= isoDate))
  .sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)))
  .pop();

const salesDayKey = (outletId, isoDate) => `${String(outletId)}::${isoDate}`;

const hasDailyRateInRange = (rates, outletId, from, to) => rates.some((rate) => (
  String(rate.outletId) === String(outletId)
  && String(rate.effectiveFrom) <= to
  && (!rate.effectiveTo || String(rate.effectiveTo) >= from)
));

const getProvisionalSalaryForRange = (rates, salesDayKeys, outletId, from, to, finalizedMonths) => {
  if (!from || !to) return 0;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDay = end > today ? today : end;
  let total = 0;
  for (const day = new Date(start); day <= lastDay; day.setDate(day.getDate() + 1)) {
    const iso = toLocalIsoDate(day);
    if (finalizedMonths.has(iso.slice(0, 7))) continue;
    if (!salesDayKeys.has(salesDayKey(outletId, iso))) continue;
    total += toNumber(getDailyRateForDate(rates, outletId, iso)?.dailyRate);
  }
  return total;
};

const getFinalizedSalaryForRange = (entry, outletId, from, to) => {
  const monthlySalary = toNumber(entry?.outlets?.[outletId]);
  const year = Number(entry?.year);
  const month = Number(entry?.month);
  if (!monthlySalary || !year || month < 1 || month > 12 || !from || !to) return 0;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const rangeStart = new Date(`${from}T00:00:00`);
  const rangeEnd = new Date(`${to}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = rangeStart > monthStart ? rangeStart : monthStart;
  const end = [rangeEnd, monthEnd, today].reduce((earliest, date) => date < earliest ? date : earliest);
  if (start > end) return 0;

  const selectedDays = Math.floor((end - start) / 86400000) + 1;
  const monthDays = monthEnd.getDate();
  return (monthlySalary / monthDays) * selectedDays;
};

const createEmptyMonthlyBucket = (key, label) => ({
  key,
  label,
  salesQty: 0,
  revenue: 0,
  digitalPay: 0,
  cashPay: 0,
  totalReceived: 0,
  damages: 0,
  damageCost: 0,
  incentive: 0,
  foodAllowance: 0,
  totalCost: 0,
  closingAmount: 0,
  pending: 0,
  averageNeccRate: 0,
});

const buildMonthlyTimeline = (months, from, to) => {
  if (!from || !to) return months;

  const byKey = new Map(months.map((month) => [month.key, month]));
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00`);
  const end = new Date(`${to.slice(0, 7)}-01T00:00:00`);
  const rows = [];

  while (!Number.isNaN(cursor.getTime()) && cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const label = cursor.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    rows.push(byKey.get(key) || createEmptyMonthlyBucket(key, label));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return rows;
};

const getSalaryEntryMonthKey = (entry) => {
  const year = Number(entry?.year);
  const month = Number(entry?.month);

  if (Number.isFinite(year) && month >= 1 && month <= 12) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  const monthIndex = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].findIndex((label) => String(entry?.monthName || "").trim().toLowerCase().startsWith(label));

  if (Number.isFinite(year) && monthIndex >= 0) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  }

  return "";
};

const fetchOutletSalaryEntries = async (year) => {
  try {
    const response = await fetch(`${API_URL}/outlet-salary/all?year=${year}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const fetchDailySalaryRates = async () => {
  try {
    const response = await fetch(`${API_URL}/outlet-salary/daily-rates`);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const fetchOutletSalesDays = async (from, to) => {
  try {
    const response = await fetch(`${API_URL}/outlet-salary/sales-days?from=${from}&to=${to}`);
    if (!response.ok) return new Set();
    const data = await response.json();
    return new Set((Array.isArray(data) ? data : []).map((item) => salesDayKey(item.outletId, item.date)));
  } catch {
    return new Set();
  }
};

const getOutletStatus = (item) => {
  const damageRate = item.salesQty ? (Number(item.damages || 0) / Number(item.salesQty || 1)) * 100 : 0;
  if (Number(item.salesQty || 0) <= 0) return { label: "No Sales", className: "bg-gray-100 text-gray-600" };
  if (damageRate > 3 || Number(item.closingAmount || 0) < 0) return { label: "Needs Review", className: "bg-red-50 text-red-600" };
  return { label: "Healthy", className: "bg-emerald-50 text-emerald-700" };
};

const OutletPerformance = () => {
  const { isSupervisor, zone } = getRoleFlags();
  const [rangeType, setRangeType] = useState("week");
  const [dateRange, setDateRange] = useState(() => getRange("week"));
  const [previousStats, setPreviousStats] = useState(null);
  const [comparisonStats, setComparisonStats] = useState(null);
  const [stats, setStats] = useState(null);
  const [reportClosingBalances, setReportClosingBalances] = useState(() => new Map());
  const [previousReportClosingBalances, setPreviousReportClosingBalances] = useState(() => new Map());
  const [salaryEntries, setSalaryEntries] = useState([]);
  const [dailySalaryRates, setDailySalaryRates] = useState([]);
  const [salesDayKeys, setSalesDayKeys] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [todayRate, setTodayRate] = useState("");
  const [profitRate, setProfitRate] = useState(null);
  const [profitCalculatorError, setProfitCalculatorError] = useState("");
  const [statisticsVersion, setStatisticsVersion] = useState(0);

  useEffect(() => {
    const refreshPerformance = () => setStatisticsVersion((version) => version + 1);
    window.addEventListener(STATISTICS_INVALIDATED_EVENT, refreshPerformance);
    return () => window.removeEventListener(STATISTICS_INVALIDATED_EVENT, refreshPerformance);
  }, []);

  useEffect(() => {
    const loadPerformance = async () => {
      setLoading(true);
      setError("");

      try {
        const zoneFilter = isSupervisor ? zone : "";
        const monthKeys = getMonthKeysInRange(dateRange.from, dateRange.to);
        const previousRange = getPreviousRange(dateRange);
        const previousMonthKeys = getMonthKeysInRange(previousRange.from, previousRange.to);
        const comparisonRange = getAprilToTodayRange();
        const salesDaysFrom = [dateRange.from, previousRange.from, comparisonRange.from].filter(Boolean).sort()[0];
        const salesDaysTo = [dateRange.to, comparisonRange.to].sort().at(-1);
        const comparisonMonthKeys = getMonthKeysInRange(comparisonRange.from, comparisonRange.to);
        const yearList = Array.from(new Set([
          ...monthKeys,
          ...previousMonthKeys,
          ...comparisonMonthKeys,
        ].map((key) => Number(key.slice(0, 4))).filter((year) => Number.isFinite(year))));

        const [rangeData, previousData, comparisonData, dailyRates, salesDays, ...salaryData] = await Promise.all([
          fetchStatisticsData({
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            zone: zoneFilter,
          }),
          fetchStatisticsData({
            dateFrom: previousRange.from,
            dateTo: previousRange.to,
            zone: zoneFilter,
          }),
          fetchStatisticsData({
            dateFrom: comparisonRange.from,
            dateTo: comparisonRange.to,
            zone: zoneFilter,
          }),
          fetchDailySalaryRates(),
          fetchOutletSalesDays(salesDaysFrom, salesDaysTo),
          ...yearList.map((year) => fetchOutletSalaryEntries(year)),
        ]);

        const [currentClosingBalances, previousClosingBalances] = await Promise.all([
          fetchReportClosingBalances(rangeData?.outletBreakdown, dateRange),
          fetchReportClosingBalances(previousData?.outletBreakdown, previousRange),
        ]);

        setStats(rangeData);
        setPreviousStats(previousData);
        setComparisonStats(comparisonData);
        setReportClosingBalances(currentClosingBalances);
        setPreviousReportClosingBalances(previousClosingBalances);
        setSalaryEntries(salaryData.flat());
        setDailySalaryRates(dailyRates);
        setSalesDayKeys(salesDays);
      } catch {
        setError("Failed to load outlet performance data");
        setStats(null);
        setPreviousStats(null);
        setComparisonStats(null);
        setReportClosingBalances(new Map());
        setPreviousReportClosingBalances(new Map());
        setSalaryEntries([]);
        setDailySalaryRates([]);
        setSalesDayKeys(new Set());
      } finally {
        setLoading(false);
      }
    };

    loadPerformance();
  }, [dateRange, isSupervisor, zone, statisticsVersion]);

  const outletRows = useMemo(() => stats?.outletBreakdown || [], [stats]);
  const previousOutletRows = useMemo(() => previousStats?.outletBreakdown || [], [previousStats]);
  const comparisonRange = useMemo(() => getAprilToTodayRange(), []);
  const selectedMonthKeys = useMemo(() => new Set(getMonthKeysInRange(dateRange.from, dateRange.to)), [dateRange.from, dateRange.to]);
  const previousRange = useMemo(() => getPreviousRange(dateRange), [dateRange]);
  const previousMonthKeys = useMemo(() => new Set(getMonthKeysInRange(previousRange.from, previousRange.to)), [previousRange.from, previousRange.to]);
  const comparisonMonthKeys = useMemo(() => new Set(getMonthKeysInRange(comparisonRange.from, comparisonRange.to)), [comparisonRange.from, comparisonRange.to]);
  const salaryByOutlet = useMemo(() => {
    const map = new Map();
    const finalizedMonths = new Set();

    salaryEntries.forEach((entry) => {
      const entryKey = `${entry.year}-${String(entry.month).padStart(2, "0")}`;
      if (!selectedMonthKeys.has(entryKey)) return;
      finalizedMonths.add(entryKey);

      const entryOutlets = entry?.outlets && typeof entry.outlets === "object" ? entry.outlets : {};
      Object.keys(entryOutlets).forEach((outletId) => {
        const rangeSalary = getFinalizedSalaryForRange(entry, outletId, dateRange.from, dateRange.to);
        map.set(outletId, (map.get(outletId) || 0) + rangeSalary);
      });
    });

    outletRows.forEach((outlet) => {
      // A daily rule is authoritative.  A manually saved monthly value is
      // retained only for legacy outlets that have no daily rule in range.
      if (!hasDailyRateInRange(dailySalaryRates, outlet.key, dateRange.from, dateRange.to)) return;
      const provisional = getProvisionalSalaryForRange(
        dailySalaryRates,
        salesDayKeys,
        outlet.key,
        dateRange.from,
        dateRange.to,
        new Set(),
      );
      map.set(outlet.key, provisional);
    });

    return map;
  }, [dailySalaryRates, dateRange.from, dateRange.to, outletRows, salaryEntries, salesDayKeys, selectedMonthKeys]);

  const previousSalaryByOutlet = useMemo(() => {
    const map = new Map();

    salaryEntries.forEach((entry) => {
      const entryKey = `${entry.year}-${String(entry.month).padStart(2, "0")}`;
      if (!previousMonthKeys.has(entryKey)) return;
      const entryOutlets = entry?.outlets && typeof entry.outlets === "object" ? entry.outlets : {};
      Object.keys(entryOutlets).forEach((outletId) => {
        const rangeSalary = getFinalizedSalaryForRange(entry, outletId, previousRange.from, previousRange.to);
        map.set(outletId, (map.get(outletId) || 0) + rangeSalary);
      });
    });

    previousOutletRows.forEach((outlet) => {
      if (!hasDailyRateInRange(dailySalaryRates, outlet.key, previousRange.from, previousRange.to)) return;
      map.set(outlet.key, getProvisionalSalaryForRange(
        dailySalaryRates,
        salesDayKeys,
        outlet.key,
        previousRange.from,
        previousRange.to,
        new Set(),
      ));
    });

    return map;
  }, [dailySalaryRates, previousMonthKeys, previousOutletRows, previousRange.from, previousRange.to, salaryEntries, salesDayKeys]);

  const monthlySalaryByKey = useMemo(() => {
    const map = new Map();
    const salaryEntryByMonth = new Map();

    salaryEntries.forEach((entry) => {
      const entryKey = getSalaryEntryMonthKey(entry);
      if (!comparisonMonthKeys.has(entryKey)) return;
      salaryEntryByMonth.set(entryKey, entry);
    });

    // Apply the daily rule per outlet.  A saved monthly amount is only a
    // fallback for an outlet with no daily rule for that particular month.
    const comparisonOutlets = comparisonStats?.outletBreakdown || [];
    comparisonMonthKeys.forEach((monthKey) => {
      const [year, month] = monthKey.split("-").map(Number);
      const monthEnd = toLocalIsoDate(new Date(year, month, 0));
      const savedEntry = salaryEntryByMonth.get(monthKey);
      const monthSalary = comparisonOutlets.reduce((sum, outlet) => {
        if (hasDailyRateInRange(dailySalaryRates, outlet.key, `${monthKey}-01`, monthEnd)) {
          return sum + getProvisionalSalaryForRange(
            dailySalaryRates,
            salesDayKeys,
            outlet.key,
            `${monthKey}-01`,
            monthEnd,
            new Set(),
          );
        }
        return sum + getFinalizedSalaryForRange(savedEntry, outlet.key, `${monthKey}-01`, monthEnd);
      }, 0);
      map.set(monthKey, monthSalary);
    });

    return map;
  }, [comparisonMonthKeys, comparisonStats, dailySalaryRates, salaryEntries, salesDayKeys]);

  const performanceRows = useMemo(() => outletRows.map((item) => {
    const salary = salaryByOutlet.get(item.key) || 0;
    const damageCost = toNumber(item.damageCost);
    const incentive = toNumber(item.incentive);
    const foodAllowance = toNumber(item.foodAllowance);
    const totalEggs = toNumber(item.salesQty);
    const totalCost = salary + damageCost + incentive + foodAllowance;
    const costPerEgg = totalEggs > 0 ? totalCost / totalEggs : 0;
    const totalReceived = toNumber(item.totalReceived);
    const averageRevenuePerEgg = totalEggs > 0 ? totalReceived / totalEggs : 0;
    const closingAmount = reportClosingBalances.get(String(item.key)) ?? 0;

    return {
      ...item,
      salary,
      damageCost,
      totalCost,
      costPerEgg,
      averageRevenuePerEgg,
      closingAmount,
    };
  }), [outletRows, reportClosingBalances, salaryByOutlet]);

  const previousPerformanceByOutlet = useMemo(() => new Map(previousOutletRows.map((item) => {
    const totalCost = (previousSalaryByOutlet.get(item.key) || 0)
      + toNumber(item.damageCost)
      + toNumber(item.incentive)
      + toNumber(item.foodAllowance);
    return [String(item.key), {
      damages: toNumber(item.damages),
      salesQty: toNumber(item.salesQty),
      revenue: toNumber(item.revenue),
      costPerEgg: toNumber(item.salesQty) > 0 ? totalCost / toNumber(item.salesQty) : 0,
      damagePercent: toNumber(item.salesQty) > 0 ? (toNumber(item.damages) / toNumber(item.salesQty)) * 100 : 0,
      totalCost,
      damageCost: toNumber(item.damageCost),
      averageNeccRate: toNumber(item.averageNeccRate),
      closingAmount: previousReportClosingBalances.get(String(item.key)) ?? 0,
    }];
  })), [previousOutletRows, previousReportClosingBalances, previousSalaryByOutlet]);

  const derivedTotals = useMemo(() => performanceRows.reduce((acc, item) => ({
    salesQty: acc.salesQty + toNumber(item.salesQty),
    salary: acc.salary + toNumber(item.salary),
    damages: acc.damages + toNumber(item.damages),
    damageCost: acc.damageCost + toNumber(item.damageCost),
    incentive: acc.incentive + toNumber(item.incentive),
    foodAllowance: acc.foodAllowance + toNumber(item.foodAllowance),
    totalCost: acc.totalCost + toNumber(item.totalCost),
    closingAmount: acc.closingAmount + toNumber(item.closingAmount),
    totalReceived: acc.totalReceived + toNumber(item.totalReceived),
    revenue: acc.revenue + toNumber(item.revenue),
  }), {
    salesQty: 0,
    salary: 0,
    damages: 0,
    damageCost: 0,
    incentive: 0,
    foodAllowance: 0,
    totalCost: 0,
    closingAmount: 0,
    totalReceived: 0,
    revenue: 0,
  }), [performanceRows]);

  const averageNeccRate = derivedTotals.salesQty ? derivedTotals.revenue / derivedTotals.salesQty : 0;
  const perEggCost = derivedTotals.salesQty ? derivedTotals.totalCost / derivedTotals.salesQty : 0;
  const profitScore = profitRate === null ? null : roundToTwoDecimals(averageNeccRate - profitRate - perEggCost);
  const profit = profitScore === null ? null : profitScore * derivedTotals.salesQty;

  const costBreakdown = useMemo(() => ([
    { name: "Salary", value: derivedTotals.salary, color: "#f97316" },
    { name: "Damage Cost", value: derivedTotals.damageCost, color: "#ef4444" },
    { name: "Incentive", value: derivedTotals.incentive, color: "#22c55e" },
    { name: "Food Allowance", value: derivedTotals.foodAllowance, color: "#0ea5e9" },
  ]), [derivedTotals]);

  const dailyCostTrend = useMemo(() => {
    const salaryEntryByMonth = new Map(
      salaryEntries.map((entry) => [getSalaryEntryMonthKey(entry), entry]),
    );
    const dailyStatsByDate = new Map((stats?.daily || []).map((item) => [item.key, item]));

    return getDateKeysInRange(dateRange.from, dateRange.to).map((isoDate) => {
      const item = dailyStatsByDate.get(isoDate);
      if (!item) return { date: formatLongDate(isoDate), perEggCost: null };

      const monthKey = String(isoDate || "").slice(0, 7);
      const savedSalaryEntry = salaryEntryByMonth.get(monthKey);
      const driverSalary = outletRows.reduce((total, outlet) => {
        const dailyRate = getDailyRateForDate(dailySalaryRates, outlet.key, isoDate);
        if (dailyRate) return total + (salesDayKeys.has(salesDayKey(outlet.key, isoDate)) ? toNumber(dailyRate.dailyRate) : 0);
        return total + getFinalizedSalaryForRange(savedSalaryEntry, outlet.key, isoDate, isoDate);
      }, 0);
      const totalCost = driverSalary
        + toNumber(item.damageCost)
        + toNumber(item.incentive)
        + toNumber(item.foodAllowance);
      const eggsDelivered = toNumber(item.salesQty);

      return {
        date: formatLongDate(isoDate),
        perEggCost: eggsDelivered > 0 ? Number((totalCost / eggsDelivered).toFixed(3)) : null,
      };
    });
  }, [dailySalaryRates, dateRange.from, dateRange.to, outletRows, salaryEntries, salesDayKeys, stats]);

  const monthlyComparisonRows = useMemo(() => buildMonthlyTimeline(comparisonStats?.monthly || [], comparisonRange.from, comparisonRange.to).map((item) => {
    const driverSalary = monthlySalaryByKey.get(item.key) || 0;
    const damageCost = toNumber(item.damageCost);
    const incentive = toNumber(item.incentive);
    const foodAllowance = toNumber(item.foodAllowance);
    const totalCost = driverSalary + damageCost + incentive + foodAllowance;
    const costPerEgg = item.salesQty > 0 ? totalCost / item.salesQty : 0;
    const damagePercent = item.salesQty > 0 ? (item.damages / item.salesQty) * 100 : 0;

    return {
      ...item,
      driverSalary,
      totalCost,
      costPerEgg,
      damagePercent,
    };
  }).map((item, index, rows) => {
    const previous = rows[index - 1] || {};
    return {
      ...item,
      eggGrowth: getGrowthComparison(item.salesQty, previous.salesQty),
      costPerEggGrowth: getGrowthComparison(item.costPerEgg, previous.costPerEgg),
      damageGrowth: getGrowthComparison(item.damagePercent, previous.damagePercent),
      salaryGrowth: getGrowthComparison(item.driverSalary, previous.driverSalary),
      damageCostGrowth: getGrowthComparison(item.damageCost, previous.damageCost),
      incentiveGrowth: getGrowthComparison(item.incentive, previous.incentive),
      foodAllowanceGrowth: getGrowthComparison(item.foodAllowance, previous.foodAllowance),
      totalCostGrowth: getGrowthComparison(item.totalCost, previous.totalCost),
    };
  }), [comparisonRange.from, comparisonRange.to, comparisonStats, monthlySalaryByKey]);

  const monthlyComparisonTotals = useMemo(() => monthlyComparisonRows.reduce((acc, item) => ({
    salesQty: acc.salesQty + toNumber(item.salesQty),
    driverSalary: acc.driverSalary + toNumber(item.driverSalary),
    damages: acc.damages + toNumber(item.damages),
    damageCost: acc.damageCost + toNumber(item.damageCost),
    incentive: acc.incentive + toNumber(item.incentive),
    foodAllowance: acc.foodAllowance + toNumber(item.foodAllowance),
    totalCost: acc.totalCost + toNumber(item.totalCost),
  }), {
    salesQty: 0,
    driverSalary: 0,
    damages: 0,
    damageCost: 0,
    incentive: 0,
    foodAllowance: 0,
    totalCost: 0,
  }), [monthlyComparisonRows]);

  const monthlyComparisonSummary = {
    ...monthlyComparisonTotals,
    costPerEgg: monthlyComparisonTotals.salesQty > 0 ? monthlyComparisonTotals.totalCost / monthlyComparisonTotals.salesQty : 0,
    damagePercent: monthlyComparisonTotals.salesQty > 0 ? (monthlyComparisonTotals.damages / monthlyComparisonTotals.salesQty) * 100 : 0,
  };

  const handleQuickRange = (type) => {
    setRangeType(type);
    setProfitRate(null);
    if (type !== "custom") setDateRange(getRange(type));
  };

  const handleDateChange = (field, value) => {
    setRangeType("custom");
    setProfitRate(null);
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const handleTodayRateChange = (value) => {
    setTodayRate(value);
    setProfitRate(null);
    setProfitCalculatorError("");
  };

  const handleCalculateProfit = () => {
    const rate = Number(todayRate);
    if (todayRate === "" || !Number.isFinite(rate) || rate < 0) {
      setProfitRate(null);
      setProfitCalculatorError("Enter a valid Today’s Rate to calculate profit scores.");
      return;
    }

    setProfitCalculatorError("");
    setProfitRate(rate);
  };

  const handleExport = () => {
    const rows = [
      ["Outlet", "Salary", "Total Eggs", "Total Received", "Revenue", "Avg Revenue/Egg", "Damage", "Damage Cost", "Incentive", "Food Allowance", "Total Cost", "Cost/Egg", "Avg NECC", "Profit Score", "Profit", "Status"],
      ...performanceRows.map((item) => {
        const itemProfitScore = profitRate === null ? null : roundToTwoDecimals(toNumber(item.averageNeccRate) - profitRate - toNumber(item.costPerEgg));
        const itemProfit = itemProfitScore === null ? null : itemProfitScore * toNumber(item.salesQty);
        return [
          item.label,
          item.salary,
          item.salesQty,
          item.totalReceived,
          item.revenue,
          item.averageRevenuePerEgg,
          item.damages,
          item.damageCost,
          item.incentive,
          item.foodAllowance,
          item.totalCost,
          item.costPerEgg,
          item.averageNeccRate,
          itemProfitScore ?? "",
          itemProfit ?? "",
          getOutletStatus(item).label,
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `outlet_performance_${dateRange.from || "all"}_${dateRange.to || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: "Egg Delivered", value: number(derivedTotals.salesQty), icon: faEgg, tone: "orange" },
    { label: "Total Received", value: currency(derivedTotals.totalReceived), icon: faWallet, tone: "green" },
    { label: "Avg NECC", value: currency(averageNeccRate), icon: faChartLine, tone: "green" },
    { label: "Egg Cost", value: currency(derivedTotals.salesQty ? derivedTotals.totalCost / derivedTotals.salesQty : 0), icon: faMoneyBillWave, tone: "green" },
    { label: "Damage", value: number(derivedTotals.damages), icon: faCircleExclamation, tone: "red" },
    { label: "Damage Cost", value: currency(derivedTotals.damageCost), icon: faCircleExclamation, tone: "red" },
    { label: "Incentive", value: currency(derivedTotals.incentive), icon: faChartLine, tone: "blue" },
    { label: "Food Allowance", value: currency(derivedTotals.foodAllowance), icon: faUtensils, tone: "blue" },
  ];

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Outlet Performance</h1>
          <p className="mt-1 text-sm text-gray-600">
            Outlet cost, damage, allowance, and closing amount from {formatLongDate(dateRange.from)} to {formatLongDate(dateRange.to)}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={dateRange.from || ""} onChange={(event) => handleDateChange("from", event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
          <input type="date" value={dateRange.to || ""} onChange={(event) => handleDateChange("to", event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
          {[
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["lastWeek", "Last Week"],
            ["week", "This Week"],
            ["month", "This Month"],
            ["lastMonth", "Last Month"],
            ["quarter", "This Quarter"],
          ].map(([key, label]) => (
            <button key={key} type="button" onClick={() => handleQuickRange(key)} className={`h-10 rounded-lg border px-3 text-xs font-semibold shadow-sm transition ${rangeType === key ? "border-orange-500 bg-orange-500 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => handleQuickRange(rangeType === "custom" ? "week" : rangeType)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50" title="Refresh">
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
          <button type="button" onClick={handleExport} disabled={!outletRows.length} className="flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
            <FontAwesomeIcon icon={faFileExport} />
            Export
          </button>
        </div>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>}

      {loading ? (
        <div className="flex h-[55vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
            <p className="text-sm text-gray-600">Loading outlet performance...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {kpis.map((item) => <KpiCard key={item.label} item={item} />)}
          </div>

          <section className="mb-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <SectionHeader title="Performance Breakdown" subtitle="Outlet-wise totals for the selected period" />
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="today-rate">Enter Today’s Rate</label>
                <input
                  id="today-rate"
                  type="number"
                  min="0"
                  step="0.001"
                  inputMode="decimal"
                  value={todayRate}
                  onChange={(event) => handleTodayRateChange(event.target.value)}
                  placeholder="Enter Today’s Rate"
                  className="h-10 w-44 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
                <button type="button" onClick={handleCalculateProfit} className="h-10 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600">
                  Calculate
                </button>
              </div>
            </div>
            {profitCalculatorError && <p className="mt-2 text-xs font-medium text-red-600">{profitCalculatorError}</p>}
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
              Damage Cost is sourced from the backend reports aggregate for the selected range. Total Cost = Salary + Damage Cost + Incentive + Food Allowance. Cost per Egg = Total Cost / Total Eggs.
            </div>
            <div className="mt-4 max-h-[430px] overflow-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Outlet</th>
                    <th className="px-4 py-3 text-right">Salary</th>
                    <th className="px-4 py-3 text-right">Total Eggs</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Damage</th>
                    <th className="px-4 py-3 text-right">Damage Cost</th>
                    <th className="px-4 py-3 text-right">Incentive</th>
                    <th className="px-4 py-3 text-right">Food Allow</th>
                    <th className="px-4 py-3 text-right">Total Cost</th>
                    <th className="px-4 py-3 text-right">Cost/Egg</th>
                    <th className="px-4 py-3 text-right">Avg NECC</th>
                    <th className="px-4 py-3 text-right">Profit Score</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceRows.length ? (
                    <>
                      {performanceRows.map((item) => {
                        const status = getOutletStatus(item);
                        const itemProfitScore = profitRate === null ? null : roundToTwoDecimals(toNumber(item.averageNeccRate) - profitRate - toNumber(item.costPerEgg));
                        const itemProfit = itemProfitScore === null ? null : itemProfitScore * toNumber(item.salesQty);
                        return (
                          <tr key={item.key} className="border-t border-gray-100 text-gray-700">
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{item.label}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.salary)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{number(item.salesQty)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{wholeCurrency(item.revenue)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{number(item.damages)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.damageCost)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.incentive)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.foodAllowance)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{currency(item.totalCost)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.costPerEgg)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.averageNeccRate)}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${profitRate === null ? "text-gray-400" : "text-gray-900"}`}>
                              {itemProfitScore === null ? "—" : currency(itemProfitScore)}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${profitRate === null ? "text-gray-400" : "text-gray-900"}`}>
                              {itemProfit === null ? "—" : currency(itemProfit)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${status.className}`}>{status.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-gray-900">
                        <td className="whitespace-nowrap px-4 py-3">Total</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(performanceRows.reduce((acc, curr) => acc + toNumber(curr.salary), 0))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{number(performanceRows.reduce((acc, curr) => acc + toNumber(curr.salesQty), 0))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{wholeCurrency(performanceRows.reduce((acc, curr) => acc + toNumber(curr.revenue), 0))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{number(performanceRows.reduce((acc, curr) => acc + toNumber(curr.damages), 0))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(performanceRows.reduce((acc, curr) => acc + toNumber(curr.damageCost), 0))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(performanceRows.reduce((acc, curr) => acc + toNumber(curr.incentive), 0))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(performanceRows.reduce((acc, curr) => acc + toNumber(curr.foodAllowance), 0))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(performanceRows.reduce((acc, curr) => acc + toNumber(curr.totalCost), 0))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">—</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">—</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">—</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right ${profitRate === null ? "text-gray-400" : "text-gray-900"}`}>
                          {profitRate === null ? "—" : currency(performanceRows.reduce((acc, curr) => {
                            const itemProfitScore = roundToTwoDecimals(toNumber(curr.averageNeccRate) - profitRate - toNumber(curr.costPerEgg));
                            return acc + (itemProfitScore * toNumber(curr.salesQty));
                          }, 0))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right"></td>
                      </tr>
                    </>
                  ) : (
                    <tr><td colSpan="14"><EmptyState /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader title="Outlet Overall Performance" subtitle="Each outlet shows eggs delivered, per egg cost, damage %, outlet cost, damage cost, and average NECC" />
            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {performanceRows.length ? performanceRows.map((item) => {
                const status = getOutletStatus(item);
                const eggsDelivered = toNumber(item.salesQty);
                const damagePercent = eggsDelivered > 0 ? (toNumber(item.damages) / eggsDelivered) * 100 : 0;
                const previous = previousPerformanceByOutlet.get(String(item.key)) || {};

                return (
                  <article key={item.key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-5 py-4">
                      <div>
                        <h3 className="text-lg font-bold text-black">{item.label}</h3>
                        <p className="mt-1 text-xs text-gray-500">Outlet performance for the selected range</p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${status.label === "Healthy" ? "bg-green-50 text-green-700" : status.label === "Needs Review" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-700"}`}>{status.label}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-px bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
                      <MetricTile label="Eggs Delivered" value={number(item.salesQty)} accent="text-black" />
                      <MetricTile label="Damage Count" value={number(item.damages)} accent="text-red-600" />
                      <MetricTile label="Closing Balance" value={wholeCurrency(item.closingAmount)} accent={item.closingAmount < 0 ? "text-red-600" : "text-green-600"} />
                      <MetricTile label="Revenue" value={wholeCurrency(item.revenue)} accent="text-green-600" />
                      <MetricTile label="Per Egg Cost" value={currency(item.costPerEgg)} accent="text-black" trend={getMetricTrend(item.costPerEgg, previous.costPerEgg, true)} trendValue={currency} />
                      <MetricTile label="Damage %" value={percent(damagePercent)} accent="text-red-600" trend={getMetricTrend(damagePercent, previous.damagePercent, true)} trendValue={percent} />
                      <MetricTile label="Outlet Cost" value={wholeCurrency(item.totalCost)} accent="text-black" />
                      <MetricTile label="Damage Cost" value={wholeCurrency(item.damageCost)} accent="text-red-600" />
                      <MetricTile label="Average NECC" value={currency(item.averageNeccRate)} accent="text-green-600" />
                    </div>
                  </article>
                );
              }) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm text-gray-500">
                  No outlet performance data found.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader title="Cost Breakdown" subtitle="Salary, damage cost, incentive, food allowance, and per egg cost for the selected range" />
            <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-12">
              <div className="xl:col-span-5">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={costBreakdown} dataKey="value" nameKey="name" innerRadius={68} outerRadius={112} paddingAngle={2}>
                      {costBreakdown.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => currency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Profit Score</div>
                      <div className="mt-1 text-2xl font-extrabold text-emerald-800">
                        {profitScore === null ? "—" : currency(profitScore)}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Profit</div>
                        <div className="mt-1 text-2xl font-extrabold text-emerald-800">
                          {profit === null ? "-" : currency(profit)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                      <label className="sr-only" htmlFor="cost-today-rate">Today&apos;s Price</label>
                      <input
                        id="cost-today-rate"
                        type="number"
                        min="0"
                        step="0.001"
                        inputMode="decimal"
                        value={todayRate}
                        onChange={(event) => handleTodayRateChange(event.target.value)}
                        placeholder="Today&apos;s Price"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                      <button type="button" onClick={handleCalculateProfit} className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                        Calculate
                      </button>
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-emerald-700">
                    Average NECC Rate − Today&apos;s Price − Per Egg Cost
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">Profit = Profit Score × Total Eggs</p>
                  {profitScore === null && <p className="mt-1 text-xs text-gray-500">Enter Today&apos;s Price to calculate.</p>}
                </div>
              </div>
              <div className="xl:col-span-7">
                <div className="rounded-lg border border-gray-100">
                  {costBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-4 text-sm first:border-t-0">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-gray-800">{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{currency(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-4 text-sm">
                    <span className="font-bold text-gray-900">Total Cost</span>
                    <span className="font-bold text-gray-900">{currency(derivedTotals.totalCost)}</span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 via-amber-50 to-white px-5 py-4 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 md:min-w-[420px]">
                      <div className="rounded-xl border border-orange-100 bg-white px-4 py-3 text-center shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total Costs</div>
                        <div className="mt-1 text-lg font-bold text-gray-900">{currency(derivedTotals.totalCost)}</div>
                      </div>
                      <div className="rounded-xl border border-orange-100 bg-white px-4 py-3 text-center shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total Eggs Sales Count</div>
                        <div className="mt-1 text-lg font-bold text-gray-900">{number(derivedTotals.salesQty)}</div>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Average NECC Rate</div>
                        <div className="mt-1 text-lg font-bold text-emerald-800">{currency(averageNeccRate)}</div>
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-500 px-4 py-3 text-center text-white shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-orange-100">Per Egg Cost</div>
                        <div className="mt-1 text-2xl font-extrabold">{currency(perEggCost)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader
              title="Daily Egg Delivery Cost"
              subtitle="Per egg cost by day — use the trend to see whether daily delivery costs are improving."
            />
            <div className="mt-5 h-[320px]">
              {dailyCostTrend.some((item) => item.perEggCost !== null) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyCostTrend} margin={{ top: 12, right: 24, left: 8, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      tickFormatter={(value) => `Rs. ${Number(value).toFixed(2)}`}
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <Tooltip
                      formatter={(value) => [currency(value), "Per Egg Cost"]}
                      contentStyle={{ borderRadius: "8px", borderColor: "#fed7aa" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="perEggCost"
                      name="Per Egg Cost"
                      stroke="#f97316"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#f97316", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  No daily egg delivery cost data found for the selected range.
                </div>
              )}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader title="Monthly Comparison" subtitle={`Monthly totals from ${formatMonthLabel(comparisonRange.from?.slice(0, 7))} to ${formatMonthLabel(comparisonRange.to?.slice(0, 7))}`} />
            <div className="mt-4 overflow-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Month</th>
                    <th className="px-4 py-3 text-right">Eggs Delivered</th>
                    <th className="px-4 py-3 text-right">Delivery Cost Per Egg</th>
                    <th className="px-4 py-3 text-right">Damage %</th>
                    <th className="px-4 py-3 text-right">Driver Salary</th>
                    <th className="px-4 py-3 text-right">Damage Cost</th>
                    <th className="px-4 py-3 text-right">Incentives</th>
                    <th className="px-4 py-3 text-right">Food Allowance</th>
                    <th className="px-4 py-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyComparisonRows.length ? monthlyComparisonRows.map((item, index) => (
                    <tr key={item.key} className={`border-t border-gray-100 ${index === 0 ? "bg-amber-50" : "bg-white"}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{item.label || formatMonthLabel(item.key)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right"><MetricWithGrowth value={number(item.salesQty)} comparison={item.eggGrowth} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right"><MetricWithGrowth value={currency(item.costPerEgg)} comparison={item.costPerEggGrowth} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right"><MetricWithGrowth value={percent(item.damagePercent)} comparison={item.damageGrowth} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right"><MetricWithGrowth value={currency(item.driverSalary)} comparison={item.salaryGrowth} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right"><MetricWithGrowth value={currency(item.damageCost)} comparison={item.damageCostGrowth} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right"><MetricWithGrowth value={currency(item.incentive)} comparison={item.incentiveGrowth} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right"><MetricWithGrowth value={currency(item.foodAllowance)} comparison={item.foodAllowanceGrowth} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold"><MetricWithGrowth value={currency(item.totalCost)} comparison={item.totalCostGrowth} /></td>
                    </tr>
                  )) : (
                    <tr><td colSpan="9"><EmptyState /></td></tr>
                  )}
                </tbody>
                  {monthlyComparisonRows.length ? (
                  <tfoot className="border-t border-gray-200 bg-gray-50">
                    <tr className="text-sm font-bold text-gray-900">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right">{number(monthlyComparisonSummary.salesQty)}</td>
                      <td className="px-4 py-3 text-right">{currency(monthlyComparisonSummary.costPerEgg)}</td>
                      <td className="px-4 py-3 text-right">{percent(monthlyComparisonSummary.damagePercent)}</td>
                      <td className="px-4 py-3 text-right">{currency(monthlyComparisonSummary.driverSalary)}</td>
                      <td className="px-4 py-3 text-right">{currency(monthlyComparisonSummary.damageCost)}</td>
                      <td className="px-4 py-3 text-right">{currency(monthlyComparisonSummary.incentive)}</td>
                      <td className="px-4 py-3 text-right">{currency(monthlyComparisonSummary.foodAllowance)}</td>
                      <td className="px-4 py-3 text-right">{currency(monthlyComparisonSummary.totalCost)}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const toneClass = {
  orange: "bg-orange-50 text-orange-500",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-500",
  blue: "bg-sky-50 text-sky-600",
  gray: "bg-gray-100 text-gray-600",
};

const KpiCard = ({ item }) => (
  <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClass[item.tone]}`}>
        <FontAwesomeIcon icon={item.icon} />
      </div>
      <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">{item.label}</span>
    </div>
    <div className="text-2xl font-bold text-gray-900">{item.value}</div>
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  </div>
);

const MetricTile = ({ label, value, accent, trend, trendValue }) => (
  <div className="bg-white px-4 py-4">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    <div className={`mt-2 text-lg font-bold ${accent}`}>{value}</div>
    {trend && (
      <div className={`mt-1 inline-flex items-center gap-1 text-base font-extrabold leading-none ${trend.type === "up" ? "text-emerald-500" : trend.type === "down" ? "text-red-500" : "text-gray-400"}`} aria-label={`Change from the preceding period: ${trendValue(trend.value)}`}>
        <span>{trendValue(trend.value)}</span>
        {trend.type === "up" ? <FontAwesomeIcon icon={faCaretUp} /> : trend.type === "down" ? <FontAwesomeIcon icon={faCaretDown} /> : <FontAwesomeIcon icon={faMinus} className="text-xs" />}
      </div>
    )}
  </div>
);

const MetricWithGrowth = ({ value, comparison }) => {
  const styles = {
    up: "bg-emerald-50 text-emerald-700",
    down: "bg-red-50 text-red-600",
    flat: "bg-orange-50 text-orange-600",
  };
  const icons = { up: faArrowUp, down: faArrowDown, flat: faMinus };
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span>{value}</span>
      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${styles[comparison.type]}`}>
        <FontAwesomeIcon icon={icons[comparison.type]} />
        {comparison.text}
      </span>
    </div>
  );
};

const EmptyState = () => <div className="px-5 py-8 text-center text-sm text-gray-500">No data found.</div>;

export default OutletPerformance;
