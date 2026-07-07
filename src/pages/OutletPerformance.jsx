import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  faChartLine,
  faCircleExclamation,
  faEgg,
  faFileExport,
  faMoneyBillWave,
  faRotateRight,
  faStore,
  faUtensils,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import { fetchStatisticsData } from "../context/reportsApi";
import { getRoleFlags } from "../utils/role";
import { getThisWeekRange, toLocalIsoDate } from "../utils/dateRange";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const currency = (value) => `Rs. ${(Number(value) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value) => Math.round(Number(value) || 0).toLocaleString("en-IN");
const percent = (value) => `${(Number(value) || 0).toFixed(2)}%`;

const toNumber = (value) => Number(value) || 0;

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
  if (type === "week") return getThisWeekRange(today);
  if (type === "month") return { from: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  if (type === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return { from: toLocalIsoDate(new Date(today.getFullYear(), quarterStartMonth, 1)), to };
  }

  return getThisWeekRange(today);
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

const getMonthlySalaryValue = (entry) => {
  const total = toNumber(entry?.total);
  if (total > 0) return total;

  const outlets = entry?.outlets && typeof entry.outlets === "object" ? entry.outlets : {};
  return Object.values(outlets).reduce((sum, value) => sum + toNumber(value), 0);
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
  const [comparisonStats, setComparisonStats] = useState(null);
  const [stats, setStats] = useState(null);
  const [salaryEntries, setSalaryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPerformance = async () => {
      setLoading(true);
      setError("");

      try {
        const zoneFilter = isSupervisor ? zone : "";
        const monthKeys = getMonthKeysInRange(dateRange.from, dateRange.to);
        const comparisonRange = getAprilToTodayRange();
        const comparisonMonthKeys = getMonthKeysInRange(comparisonRange.from, comparisonRange.to);
        const yearList = Array.from(new Set([
          ...monthKeys,
          ...comparisonMonthKeys,
        ].map((key) => Number(key.slice(0, 4))).filter((year) => Number.isFinite(year))));

        const [rangeData, comparisonData, ...salaryData] = await Promise.all([
          fetchStatisticsData({
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            zone: zoneFilter,
          }),
          fetchStatisticsData({
            dateFrom: comparisonRange.from,
            dateTo: comparisonRange.to,
            zone: zoneFilter,
          }),
          ...yearList.map((year) => fetchOutletSalaryEntries(year)),
        ]);

        setStats(rangeData);
        setComparisonStats(comparisonData);
        setSalaryEntries(salaryData.flat());
      } catch {
        setError("Failed to load outlet performance data");
        setStats(null);
        setComparisonStats(null);
        setSalaryEntries([]);
      } finally {
        setLoading(false);
      }
    };

    loadPerformance();
  }, [dateRange, isSupervisor, zone]);

  const totals = stats?.totals || {};
  const outletRows = useMemo(() => stats?.outletBreakdown || [], [stats]);
  const comparisonRange = useMemo(() => getAprilToTodayRange(), []);
  const selectedMonthKeys = useMemo(() => new Set(getMonthKeysInRange(dateRange.from, dateRange.to)), [dateRange.from, dateRange.to]);
  const comparisonMonthKeys = useMemo(() => new Set(getMonthKeysInRange(comparisonRange.from, comparisonRange.to)), [comparisonRange.from, comparisonRange.to]);
  const salaryByOutlet = useMemo(() => {
    const map = new Map();

    salaryEntries.forEach((entry) => {
      const entryKey = `${entry.year}-${String(entry.month).padStart(2, "0")}`;
      if (!selectedMonthKeys.has(entryKey)) return;

      const entryOutlets = entry?.outlets && typeof entry.outlets === "object" ? entry.outlets : {};
      Object.entries(entryOutlets).forEach(([outletId, value]) => {
        map.set(outletId, (map.get(outletId) || 0) + toNumber(value));
      });
    });

    return map;
  }, [salaryEntries, selectedMonthKeys]);

  const monthlySalaryByKey = useMemo(() => {
    const map = new Map();

    salaryEntries.forEach((entry) => {
      const entryKey = getSalaryEntryMonthKey(entry);
      if (!comparisonMonthKeys.has(entryKey)) return;

      const monthSalary = getMonthlySalaryValue(entry);

      map.set(entryKey, (map.get(entryKey) || 0) + monthSalary);
    });

    return map;
  }, [salaryEntries, comparisonMonthKeys]);

  const performanceRows = useMemo(() => outletRows.map((item) => {
    const salary = salaryByOutlet.get(item.key) || 0;
    const damageCost = toNumber(item.damages) * 5;
    const incentive = toNumber(item.incentive);
    const foodAllowance = toNumber(item.foodAllowance);
    const totalEggs = toNumber(item.salesQty);
    const totalCost = salary + damageCost + incentive + foodAllowance;
    const costPerEgg = totalEggs > 0 ? totalCost / totalEggs : 0;
    const totalReceived = toNumber(item.totalReceived);
    const closingAmount = totalReceived - totalCost;

    return {
      ...item,
      salary,
      damageCost,
      totalCost,
      costPerEgg,
      closingAmount,
    };
  }), [outletRows, salaryByOutlet]);

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

  const costBreakdown = useMemo(() => ([
    { name: "Salary", value: derivedTotals.salary, color: "#f97316" },
    { name: "Damage Cost", value: derivedTotals.damageCost, color: "#ef4444" },
    { name: "Incentive", value: derivedTotals.incentive, color: "#22c55e" },
    { name: "Food Allowance", value: derivedTotals.foodAllowance, color: "#0ea5e9" },
  ]), [derivedTotals]);

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
    if (type !== "custom") setDateRange(getRange(type));
  };

  const handleDateChange = (field, value) => {
    setRangeType("custom");
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const handleExport = () => {
    const rows = [
      ["Outlet", "Salary", "Total Eggs", "Damage", "Damage Cost", "Incentive", "Food Allowance", "Total Cost", "Cost/Egg", "Status"],
      ...performanceRows.map((item) => [
        item.label,
        item.salary,
        item.salesQty,
        item.damages,
        item.damageCost,
        item.incentive,
        item.foodAllowance,
        item.totalCost,
        item.costPerEgg,
        getOutletStatus(item).label,
      ]),
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
            ["week", "This Week"],
            ["month", "This Month"],
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
            <SectionHeader title="Performance Breakdown" subtitle="Outlet-wise totals for the selected period" />
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
              Damage Cost = Damage x 5. Total Cost = Salary + Damage Cost + Incentive + Food Allowance. Cost per Egg = Total Cost / Total Eggs.
            </div>
            <div className="mt-4 max-h-[430px] overflow-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Outlet</th>
                    <th className="px-4 py-3 text-right">Salary</th>
                    <th className="px-4 py-3 text-right">Total Eggs</th>
                    <th className="px-4 py-3 text-right">Damage</th>
                    <th className="px-4 py-3 text-right">Damage Cost</th>
                    <th className="px-4 py-3 text-right">Incentive</th>
                    <th className="px-4 py-3 text-right">Food Allow</th>
                    <th className="px-4 py-3 text-right">Total Cost</th>
                    <th className="px-4 py-3 text-right">Cost/Egg</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceRows.length ? performanceRows.map((item) => {
                    const status = getOutletStatus(item);
                    return (
                      <tr key={item.key} className="border-t border-gray-100 text-gray-700">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{item.label}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.salary)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{number(item.salesQty)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{number(item.damages)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.damageCost)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.incentive)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.foodAllowance)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{currency(item.totalCost)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.costPerEgg)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${status.className}`}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="9"><EmptyState /></td></tr>
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
                      <MetricTile label="Per Egg Cost" value={currency(item.costPerEgg)} accent="text-black" />
                      <MetricTile label="Damage %" value={percent(damagePercent)} accent="text-red-600" />
                      <MetricTile label="Outlet Cost" value={currency(item.totalCost)} accent="text-black" />
                      <MetricTile label="Damage Cost" value={currency(item.damageCost)} accent="text-red-600" />
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
                    <div className="grid gap-3 sm:grid-cols-3 md:min-w-[420px]">
                      <div className="rounded-xl border border-orange-100 bg-white px-4 py-3 text-center shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total Costs</div>
                        <div className="mt-1 text-lg font-bold text-gray-900">{currency(derivedTotals.totalCost)}</div>
                      </div>
                      <div className="rounded-xl border border-orange-100 bg-white px-4 py-3 text-center shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total Eggs Sales Count</div>
                        <div className="mt-1 text-lg font-bold text-gray-900">{number(derivedTotals.salesQty)}</div>
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-500 px-4 py-3 text-center text-white shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-orange-100">Per Egg Cost</div>
                        <div className="mt-1 text-2xl font-extrabold">{currency(derivedTotals.salesQty ? derivedTotals.totalCost / derivedTotals.salesQty : 0)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                      <td className="whitespace-nowrap px-4 py-3 text-right">{number(item.salesQty)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.costPerEgg)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{percent(item.damagePercent)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.driverSalary)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.damageCost)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.incentive)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.foodAllowance)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{currency(item.totalCost)}</td>
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

const MetricTile = ({ label, value, accent }) => (
  <div className="bg-white px-4 py-4">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    <div className={`mt-2 text-lg font-bold ${accent}`}>{value}</div>
  </div>
);

const EmptyState = () => <div className="px-5 py-8 text-center text-sm text-gray-500">No data found.</div>;

export default OutletPerformance;
