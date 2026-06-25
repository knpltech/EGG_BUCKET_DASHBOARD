import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
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
  faReceipt,
  faRotateRight,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import { fetchStatisticsData } from "../context/reportsApi";
import { getRoleFlags } from "../utils/role";
import { getThisWeekRange, toLocalIsoDate } from "../utils/dateRange";

const currency = (value) => `Rs. ${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
const number = (value) => Math.round(Number(value) || 0).toLocaleString("en-IN");

const formatDate = (iso) => {
  if (!iso) return "-";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
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

const Statistics = () => {
  const { isSupervisor, zone } = getRoleFlags();
  const [rangeType, setRangeType] = useState("week");
  const [dateRange, setDateRange] = useState(() => getRange("week"));
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStatistics = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await fetchStatisticsData({
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          zone: isSupervisor ? zone : "",
        });
        setStats(data);
      } catch (err) {
        setError("Failed to load statistics data");
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, [dateRange, isSupervisor, zone]);

  const totals = stats?.totals || {};
  const daily = stats?.daily || [];
  const weekly = stats?.weekly || [];
  const monthly = stats?.monthly || [];
  const outlets = stats?.outletBreakdown || [];
  const highlights = stats?.highlights || {};

  const paymentData = useMemo(() => [
    { name: "Digital", value: Number(totals.digitalPay) || 0 },
    { name: "Cash", value: Number(totals.cashPay) || 0 },
  ], [totals.digitalPay, totals.cashPay]);

  const dailyChartData = useMemo(() => daily.map((item) => ({
    ...item,
    label: formatDate(item.key),
  })), [daily]);

  const monthlyChartData = useMemo(() => monthly.map((item) => ({
    ...item,
    shortLabel: item.label?.split(" ")?.[0] || item.label,
  })), [monthly]);

  const topOutlets = outlets.slice(0, 6);
  const recentWeekly = weekly.slice(-6);

  const handleQuickRange = (type) => {
    setRangeType(type);
    if (type !== "custom") setDateRange(getRange(type));
  };

  const handleDateChange = (field, value) => {
    setRangeType("custom");
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const handleExport = () => {
    if (!stats) return;
    const rows = [
      ["Date", "Sales Qty", "Revenue", "Digital", "Cash", "Received", "Damages", "Pending", "Avg NECC"],
      ...daily.map((item) => [
        item.key,
        item.salesQty,
        item.revenue,
        item.digitalPay,
        item.cashPay,
        item.totalReceived,
        item.damages,
        item.pending,
        item.averageNeccRate,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `statistics_${dateRange.from || "all"}_${dateRange.to || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: "Total Egg Sales", value: number(totals.salesQty), sub: `${number(totals.daysCount)} active days`, icon: faEgg, tone: "orange" },
    { label: "Total Revenue", value: currency(totals.revenue), sub: `Avg/day ${currency(totals.averageDailyRevenue)}`, icon: faMoneyBillWave, tone: "green" },
    { label: "Payments Received", value: currency(totals.totalReceived), sub: `${currency(totals.digitalPay)} digital`, icon: faWallet, tone: "blue" },
    { label: "Total Damages", value: number(totals.damages), sub: `${totals.damageRate || 0}% damage rate`, icon: faCircleExclamation, tone: "red" },
  ];

  const toneClass = {
    orange: "bg-orange-50 text-orange-500",
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-500",
  };

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Statistics</h1>
          <p className="mt-1 text-sm text-gray-600">Live overview of sales, revenue, damages, payments, and rates.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateRange.from || ""}
            onChange={(event) => handleDateChange("from", event.target.value)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          <input
            type="date"
            value={dateRange.to || ""}
            onChange={(event) => handleDateChange("to", event.target.value)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          {[
            ["today", "Today"],
            ["week", "This Week"],
            ["month", "This Month"],
            ["quarter", "This Quarter"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleQuickRange(key)}
              className={`h-10 rounded-lg border px-3 text-xs font-semibold shadow-sm transition ${
                rangeType === key ? "border-orange-500 bg-orange-500 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleQuickRange(rangeType === "custom" ? "week" : rangeType)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
            title="Refresh"
          >
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!daily.length}
            className="flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faFileExport} />
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-[55vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
            <p className="text-sm text-gray-600">Loading live statistics...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((item) => (
              <div key={item.label} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClass[item.tone]}`}>
                    <FontAwesomeIcon icon={item.icon} />
                  </div>
                  <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">{item.label}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                <div className="mt-1 text-xs text-gray-500">{item.sub}</div>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
            <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm xl:col-span-8">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Sales and Revenue Trend</h2>
                  <p className="mt-1 text-xs text-gray-500">Daily quantity with revenue overlay</p>
                </div>
                <FontAwesomeIcon icon={faChartLine} className="text-orange-500" />
              </div>
              <ResponsiveContainer width="100%" height={330}>
                <ComposedChart data={dailyChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={46} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={54} />
                  <Tooltip formatter={(value, name) => (name === "Revenue" ? currency(value) : number(value))} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="salesQty" name="Sales Qty" fill="#ff8a2a" radius={[5, 5, 0, 0]} maxBarSize={42} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </section>

            <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm xl:col-span-4">
              <h2 className="text-base font-semibold text-gray-900">Payment Split</h2>
              <p className="mt-1 text-xs text-gray-500">Cash vs digital collection</p>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                    <Cell fill="#2563eb" />
                    <Cell fill="#f97316" />
                  </Pie>
                  <Tooltip formatter={(value) => currency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="text-xs font-semibold text-blue-600">Digital</div>
                  <div className="mt-1 font-bold text-gray-900">{currency(totals.digitalPay)}</div>
                </div>
                <div className="rounded-lg bg-orange-50 p-3">
                  <div className="text-xs font-semibold text-orange-600">Cash</div>
                  <div className="mt-1 font-bold text-gray-900">{currency(totals.cashPay)}</div>
                </div>
              </div>
            </section>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Damages</h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dailyChartData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip formatter={(value) => `${number(value)} eggs`} />
                  <Area type="monotone" dataKey="damages" name="Damages" stroke="#ef4444" fill="#fee2e2" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </section>

            <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">NECC Rate</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={dailyChartData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip formatter={(value) => `Rs. ${Number(value || 0).toFixed(2)}`} />
                  <Line type="monotone" dataKey="averageNeccRate" name="Avg NECC" stroke="#7c3aed" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </section>

            <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Performance Notes</h2>
              <div className="mt-4 space-y-3">
                <Insight icon={faEgg} label="Best sales day" value={highlights.bestSalesDay ? `${formatDate(highlights.bestSalesDay.key)} - ${number(highlights.bestSalesDay.salesQty)}` : "-"} />
                <Insight icon={faMoneyBillWave} label="Best revenue day" value={highlights.bestRevenueDay ? `${formatDate(highlights.bestRevenueDay.key)} - ${currency(highlights.bestRevenueDay.revenue)}` : "-"} />
                <Insight icon={faCircleExclamation} label="Highest damages" value={highlights.highestDamageDay ? `${formatDate(highlights.highestDamageDay.key)} - ${number(highlights.highestDamageDay.damages)}` : "-"} />
                <Insight icon={faReceipt} label="Pending balance" value={currency(totals.pending)} />
              </div>
            </section>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Outlet Ranking</h2>
              <div className="mt-4 space-y-3">
                {topOutlets.length ? topOutlets.map((item, index) => (
                  <div key={item.key} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 text-sm">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-orange-600">{index + 1}</div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-800">{item.label}</div>
                      <div className="text-xs text-gray-500">{number(item.salesQty)} eggs</div>
                    </div>
                    <div className="text-right font-bold text-gray-900">{currency(item.revenue)}</div>
                  </div>
                )) : <EmptyState />}
              </div>
            </section>

            <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Monthly Sales Analytics</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyChartData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(value, name) => (name === "Revenue" ? currency(value) : number(value))} />
                  <Legend />
                  <Bar dataKey="salesQty" name="Sales Qty" fill="#2563eb" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="revenue" name="Revenue" fill="#f97316" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <section className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Weekly Summary</h2>
              <span className="text-xs font-medium text-gray-500">{recentWeekly.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3 text-left">Week</th>
                    <th className="px-5 py-3 text-right">Sales</th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                    <th className="px-5 py-3 text-right">Received</th>
                    <th className="px-5 py-3 text-right">Damages</th>
                    <th className="px-5 py-3 text-right">Avg NECC</th>
                  </tr>
                </thead>
                <tbody>
                  {recentWeekly.length ? recentWeekly.map((item) => (
                    <tr key={item.key} className="border-t border-gray-100 text-gray-700">
                      <td className="whitespace-nowrap px-5 py-3 font-medium">{item.label}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">{number(item.salesQty)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-semibold">{currency(item.revenue)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">{currency(item.totalReceived)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">{number(item.damages)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">Rs. {Number(item.averageNeccRate || 0).toFixed(2)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="6"><EmptyState /></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const Insight = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-orange-500">
      <FontAwesomeIcon icon={icon} />
    </div>
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="truncate text-sm font-bold text-gray-900">{value}</div>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="px-5 py-8 text-center text-sm text-gray-500">No data found for the selected range.</div>
);

export default Statistics;
