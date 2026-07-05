import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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

const currency = (value) => `Rs. ${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
const number = (value) => Math.round(Number(value) || 0).toLocaleString("en-IN");

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

const getComparison = (current, previous, inverse = false) => {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;

  if (!previousValue && !currentValue) return { type: "flat", text: "0%" };
  if (!previousValue) return { type: inverse ? "down" : "up", text: "New" };

  const percent = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  const isFlat = Math.abs(percent) < 0.01;
  if (isFlat) return { type: "flat", text: "0%" };
  const isUp = percent > 0;
  return {
    type: inverse ? (isUp ? "down" : "up") : (isUp ? "up" : "down"),
    text: `${Math.abs(percent).toFixed(1)}%`,
  };
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
  const [stats, setStats] = useState(null);
  const [comparisonStats, setComparisonStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPerformance = async () => {
      setLoading(true);
      setError("");

      try {
        const zoneFilter = isSupervisor ? zone : "";
        const comparisonRange = getAprilToTodayRange();
        const [rangeData, comparisonData] = await Promise.all([
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
        ]);

        setStats(rangeData);
        setComparisonStats(comparisonData);
      } catch {
        setError("Failed to load outlet performance data");
        setStats(null);
        setComparisonStats(null);
      } finally {
        setLoading(false);
      }
    };

    loadPerformance();
  }, [dateRange, isSupervisor, zone]);

  const totals = stats?.totals || {};
  const outletRows = useMemo(() => stats?.outletBreakdown || [], [stats]);
  const monthlyRows = useMemo(() => {
    const rows = comparisonStats?.monthly || [];
    return rows.map((item, index) => {
      const previous = rows[index - 1] || {};
      return {
        ...item,
        eggGrowth: getComparison(item.salesQty, previous.salesQty),
        costGrowth: getComparison(item.totalCost, previous.totalCost, true),
        closingGrowth: getComparison(item.closingAmount, previous.closingAmount),
      };
    });
  }, [comparisonStats]);

  const costBreakdown = useMemo(() => ([
    { name: "Egg Cost", value: Number(totals.revenue) || 0, color: "#f97316" },
    { name: "Damage Cost", value: Number(totals.damageCost) || 0, color: "#ef4444" },
    { name: "Incentive", value: Number(totals.incentive) || 0, color: "#22c55e" },
    { name: "Food Allowance", value: Number(totals.foodAllowance) || 0, color: "#0ea5e9" },
  ]), [totals]);

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
      ["Outlet", "Total Eggs", "Damage", "Incentive", "Food Allowance", "Total Cost", "Status"],
      ...outletRows.map((item) => [
        item.label,
        item.salesQty,
        item.damages,
        item.incentive,
        item.foodAllowance,
        item.totalCost,
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
    { label: "Egg Delivered", value: number(totals.salesQty), icon: faEgg, tone: "orange" },
    { label: "Egg Cost", value: currency(totals.revenue), icon: faMoneyBillWave, tone: "green" },
    { label: "Damage", value: number(totals.damages), icon: faCircleExclamation, tone: "red" },
    { label: "Damage Cost", value: currency(totals.damageCost), icon: faCircleExclamation, tone: "red" },
    { label: "Incentive", value: currency(totals.incentive), icon: faChartLine, tone: "blue" },
    { label: "Food Allowance", value: currency(totals.foodAllowance), icon: faUtensils, tone: "blue" },
    { label: "Closing Amount", value: currency(totals.closingAmount), icon: faWallet, tone: Number(totals.closingAmount) < 0 ? "red" : "green" },
    { label: "Avg NECC Rate", value: `Rs. ${Number(totals.averageNeccRate || 0).toFixed(2)}`, icon: faEgg, tone: "orange" },
    { label: "Active Outlets", value: number(totals.outletCount), icon: faStore, tone: "gray" },
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
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {kpis.map((item) => <KpiCard key={item.label} item={item} />)}
          </div>

          <section className="mb-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader title="Performance Breakdown" subtitle="Outlet-wise totals for the selected period" />
            <div className="mt-4 max-h-[430px] overflow-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Outlet</th>
                    <th className="px-4 py-3 text-right">Total Eggs</th>
                    <th className="px-4 py-3 text-right">Damage</th>
                    <th className="px-4 py-3 text-right">Incentive</th>
                    <th className="px-4 py-3 text-right">Food Allow</th>
                    <th className="px-4 py-3 text-right">Total Cost</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outletRows.length ? outletRows.map((item) => {
                    const status = getOutletStatus(item);
                    return (
                      <tr key={item.key} className="border-t border-gray-100 text-gray-700">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{item.label}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{number(item.salesQty)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{number(item.damages)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.incentive)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{currency(item.foodAllowance)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{currency(item.totalCost)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${status.className}`}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="7"><EmptyState /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader title="Outlet Overall Performance" subtitle="Top outlets by total eggs and total cost" />
            <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div>
                <ChartTitle title="Eggs Delivered by Outlet" />
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={outletRows.slice(0, 12)} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval={0} angle={-20} height={70} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={52} />
                    <Tooltip formatter={(value) => `${number(value)} eggs`} />
                    <Bar dataKey="salesQty" name="Eggs Delivered" fill="#f97316" radius={[5, 5, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <ChartTitle title="Total Cost by Outlet" />
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={outletRows.slice(0, 12)} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval={0} angle={-20} height={70} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={58} />
                    <Tooltip formatter={(value) => currency(value)} />
                    <Bar dataKey="totalCost" name="Total Cost" fill="#0ea5e9" radius={[5, 5, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mb-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader title="Monthly Comparison" subtitle="April to today comparison" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {monthlyRows.length ? monthlyRows.map((item) => (
                <div key={item.key} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.label}</h3>
                      <p className="text-xs text-gray-500">Monthly outlet performance</p>
                    </div>
                    <GrowthPill comparison={item.eggGrowth} />
                  </div>
                  <MetricRow label="Total Eggs" value={number(item.salesQty)} />
                  <MetricRow label="Total Cost" value={currency(item.totalCost)} />
                  <MetricRow label="Closing Amount" value={currency(item.closingAmount)} />
                </div>
              )) : <EmptyState />}
            </div>
          </section>

          <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader title="Cost Breakdown" subtitle="Egg cost, damage cost, incentive, and food allowance" />
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
                    <span className="font-bold text-gray-900">{currency(totals.totalCost)}</span>
                  </div>
                </div>
              </div>
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

const ChartTitle = ({ title }) => <div className="mb-2 text-sm font-semibold text-gray-900">{title}</div>;

const GrowthPill = ({ comparison }) => {
  const styles = {
    up: "bg-emerald-50 text-emerald-700",
    down: "bg-red-50 text-red-600",
    flat: "bg-gray-100 text-gray-600",
  };

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold ${styles[comparison.type]}`}>
      {comparison.text}
    </span>
  );
};

const MetricRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 border-t border-gray-200 py-3 text-sm first:border-t-0">
    <span className="text-gray-500">{label}</span>
    <span className="font-bold text-gray-900">{value}</span>
  </div>
);

const EmptyState = () => <div className="px-5 py-8 text-center text-sm text-gray-500">No data found.</div>;

export default OutletPerformance;
