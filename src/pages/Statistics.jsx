import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDown,
  faArrowUp,
  faCircleExclamation,
  faEgg,
  faFileExport,
  faMinus,
  faMoneyBillWave,
  faRotateRight,
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

const formatWeekday = (iso) => {
  if (!iso) return "-";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { weekday: "long" });
};

const getRange = (type) => {
  const today = new Date();
  const to = toLocalIsoDate(today);

  if (type === "today") return { from: to, to };
  if (type === "week") return getThisWeekRange(today);
  if (type === "month") {
    return {
      from: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  if (type === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return { from: toLocalIsoDate(new Date(today.getFullYear(), quarterStartMonth, 1)), to };
  }

  return getThisWeekRange(today);
};

const getLastWeekRange = () => {
  const thisWeek = getThisWeekRange(new Date());
  const thisWeekStart = new Date(`${thisWeek.from}T00:00:00`);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);
  return { from: toLocalIsoDate(lastWeekStart), to: toLocalIsoDate(lastWeekEnd) };
};

const getWeekBeforeRange = (range) => {
  const end = new Date(`${range.from}T00:00:00`);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { from: toLocalIsoDate(start), to: toLocalIsoDate(end) };
};

const getPreviousWeekDate = (isoDate) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() - 7);
  return toLocalIsoDate(date);
};

const buildDailyTimeline = (items, range) => {
  const byDate = new Map((items || []).map((item) => [item.key, item]));
  const start = new Date(`${range.from}T00:00:00`);
  const end = new Date(`${range.to}T00:00:00`);
  const rows = [];

  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const key = toLocalIsoDate(day);
    rows.push(byDate.get(key) || { key, salesQty: 0, damages: 0, revenue: 0 });
  }
  return rows;
};

const buildComparableDailyRows = (currentItems, previousItems, range) => {
  const previousByDate = new Map((previousItems || []).map((item) => [item.key, item]));

  return buildDailyTimeline(currentItems, range).map((item) => {
    const previous = previousByDate.get(getPreviousWeekDate(item.key)) || {};
    return {
      ...item,
      weekday: formatWeekday(item.key),
      displayDate: formatLongDate(item.key),
      eggGrowth: getComparison(item.salesQty, previous.salesQty),
      damageGrowth: getComparison(item.damages, previous.damages, true),
      revenueGrowth: getComparison(item.revenue, previous.revenue),
    };
  });
};

const getAprilToTodayRange = () => {
  const today = new Date();
  const aprilYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    from: toLocalIsoDate(new Date(aprilYear, 3, 1)),
    to: toLocalIsoDate(today),
  };
};

const getWeekStartIso = (iso) => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setDate(date.getDate() - date.getDay());
  return toLocalIsoDate(date);
};

const formatShortDate = (date) => date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

const createEmptyBucket = (key, label) => ({
  key,
  label,
  salesQty: 0,
  revenue: 0,
  digitalPay: 0,
  cashPay: 0,
  totalReceived: 0,
  damages: 0,
  pending: 0,
  averageNeccRate: 0,
});

const buildWeeklyTimeline = (weeks, from, to) => {
  if (!from || !to) return weeks;

  const byKey = new Map(weeks.map((week) => [week.key, week]));
  const cursor = new Date(`${getWeekStartIso(from)}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const rows = [];

  while (!Number.isNaN(cursor.getTime()) && cursor <= end) {
    const key = toLocalIsoDate(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(cursor.getDate() + 6);
    rows.push(byKey.get(key) || createEmptyBucket(key, `${formatShortDate(cursor)} - ${formatShortDate(weekEnd)}`));
    cursor.setDate(cursor.getDate() + 7);
  }

  return rows;
};

const buildMonthlyTimeline = (months, from, to) => {
  if (!from || !to) return months;

  const byKey = new Map(months.map((month) => [month.key, month]));
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00`);
  const end = new Date(`${to.slice(0, 7)}-01T00:00:00`);
  const rows = [];

  while (!Number.isNaN(cursor.getTime()) && cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const label = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    rows.push(byKey.get(key) || createEmptyBucket(key, label));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return rows;
};

const getComparison = (current, previous, inverse = false) => {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;

  if (!previousValue && !currentValue) return { type: "flat", percent: 0, text: "0%" };
  if (!previousValue) return { type: inverse ? "down" : "up", percent: 100, text: "New" };

  const percent = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  const isUp = percent > 0;
  const isFlat = Math.abs(percent) < 0.01;
  const type = isFlat ? "flat" : inverse ? (isUp ? "down" : "up") : (isUp ? "up" : "down");

  return {
    type,
    percent,
    text: `${Math.abs(percent).toFixed(1)}%`,
  };
};

const Statistics = () => {
  const { isSupervisor, zone } = getRoleFlags();
  const [rangeType, setRangeType] = useState("week");
  const [dateRange, setDateRange] = useState(() => getRange("week"));
  const [dailyStats, setDailyStats] = useState(null);
  const [comparisonStats, setComparisonStats] = useState(null);
  const [thisWeekStats, setThisWeekStats] = useState(null);
  const [lastWeekStats, setLastWeekStats] = useState(null);
  const [previousWeekStats, setPreviousWeekStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStatistics = async () => {
      setLoading(true);
      setError("");

      try {
        const zoneFilter = isSupervisor ? zone : "";
        const comparisonRangeRequest = getAprilToTodayRange();
        const thisWeekRange = getRange("week");
        const lastWeekRange = getLastWeekRange();
        const previousWeekRange = getWeekBeforeRange(lastWeekRange);
        const [dailyData, comparisonData, thisWeekData, lastWeekData, previousWeekData] = await Promise.all([
          fetchStatisticsData({
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            zone: zoneFilter,
          }),
          fetchStatisticsData({
            dateFrom: comparisonRangeRequest.from,
            dateTo: comparisonRangeRequest.to,
            zone: zoneFilter,
          }),
          fetchStatisticsData({ ...thisWeekRange, zone: zoneFilter }),
          fetchStatisticsData({ ...lastWeekRange, zone: zoneFilter }),
          fetchStatisticsData({ ...previousWeekRange, zone: zoneFilter }),
        ]);

        setDailyStats(dailyData);
        setComparisonStats(comparisonData);
        setThisWeekStats(thisWeekData);
        setLastWeekStats(lastWeekData);
        setPreviousWeekStats(previousWeekData);
      } catch {
        setError("Failed to load statistics data");
        setDailyStats(null);
        setComparisonStats(null);
        setThisWeekStats(null);
        setLastWeekStats(null);
        setPreviousWeekStats(null);
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, [dateRange, isSupervisor, zone]);

  const totals = dailyStats?.totals || {};
  const daily = useMemo(() => dailyStats?.daily || [], [dailyStats]);
  const comparisonRange = comparisonStats?.filters || getAprilToTodayRange();
  const comparisonFrom = comparisonRange.dateFrom || comparisonRange.from;
  const comparisonTo = comparisonRange.dateTo || comparisonRange.to;
  const weekly = buildWeeklyTimeline(
    comparisonStats?.weekly || [],
    comparisonFrom,
    comparisonTo,
  );
  const monthly = useMemo(
    () => buildMonthlyTimeline(comparisonStats?.monthly || [], comparisonFrom, comparisonTo),
    [comparisonStats, comparisonFrom, comparisonTo],
  );

  const dailyRows = useMemo(() => daily.map((item) => ({
    ...item,
    weekday: formatWeekday(item.key),
    displayDate: formatLongDate(item.key),
  })), [daily]);
  const thisWeekRows = useMemo(
    () => buildComparableDailyRows(thisWeekStats?.daily, lastWeekStats?.daily, getRange("week")),
    [thisWeekStats, lastWeekStats],
  );
  const lastWeekRows = useMemo(
    () => buildComparableDailyRows(lastWeekStats?.daily, previousWeekStats?.daily, getLastWeekRange()),
    [lastWeekStats, previousWeekStats],
  );

  const weeklyRows = useMemo(() => weekly.map((item, index, rows) => {
    const previous = rows[index - 1] || {};
    return {
      ...item,
      weekName: `Week ${index + 1}`,
      eggGrowth: getComparison(item.salesQty, previous.salesQty),
      revenueGrowth: getComparison(item.revenue, previous.revenue),
      damageGrowth: getComparison(item.damages, previous.damages, true),
      neccGrowth: getComparison(item.averageNeccRate, previous.averageNeccRate),
    };
  }), [weekly]);

  const monthlyRows = useMemo(() => monthly.map((item, index, rows) => {
    const previous = rows[index - 1] || {};
    return {
      ...item,
      eggGrowth: getComparison(item.salesQty, previous.salesQty),
      revenueGrowth: getComparison(item.revenue, previous.revenue),
      damageGrowth: getComparison(item.damages, previous.damages, true),
      neccGrowth: getComparison(item.averageNeccRate, previous.averageNeccRate),
    };
  }), [monthly]);

  const handleQuickRange = (type) => {
    setRangeType(type);
    if (type !== "custom") setDateRange(getRange(type));
  };

  const handleDateChange = (field, value) => {
    setRangeType("custom");
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const handleExport = () => {
    if (!dailyStats) return;
    const rows = [
      ["Date", "Weekday", "Sales Qty", "Revenue", "Digital", "Cash", "Received", "Damages", "Pending", "Avg NECC"],
      ...dailyRows.map((item) => [
        item.key,
        item.weekday,
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
    link.download = `statistics_daily_${dateRange.from || "all"}_${dateRange.to || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: "Egg Sales", value: number(totals.salesQty), sub: `${number(totals.daysCount)} selected days`, icon: faEgg, tone: "orange" },
    { label: "Revenue", value: currency(totals.revenue), sub: `Avg/day ${currency(totals.averageDailyRevenue)}`, icon: faMoneyBillWave, tone: "green" },
    { label: "Damages", value: number(totals.damages), sub: `${totals.damageRate || 0}% damage rate`, icon: faCircleExclamation, tone: "red" },
  ];

  const toneClass = {
    orange: "bg-orange-50 text-orange-500",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-500",
  };

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Statistics</h1>
          <p className="mt-1 text-sm text-gray-600">Daily data follows the selected dates. Weekly and monthly comparisons run from April to today.</p>
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
            disabled={!dailyRows.length}
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
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
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

          <section className="mb-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader
              title="Daily Data"
              subtitle={<span className="font-bold text-gray-700">Weekday-to-Weekday Comparison (e.g., Monday vs Last Monday, Tuesday vs Last Tuesday)</span>}
            />
            <div className="mt-4 space-y-5">
              <DailyDataTable title="This Week" range={getRange("week")} rows={thisWeekRows} />
              <DailyDataTable title="Last Week" range={getLastWeekRange()} rows={lastWeekRows} />
            </div>
          </section>

          <section className="mb-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader
              title="Weekly Data"
              subtitle={`Fixed comparison: ${formatLongDate(comparisonFrom)} to ${formatLongDate(comparisonTo)}`}
            />
            <div className="mt-4">
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full table-fixed text-xs sm:text-sm">
                    <thead className="bg-gray-50 text-[10px] font-semibold uppercase text-gray-500 sm:text-xs">
                      <tr>
                        <th className="w-[14%] px-1.5 py-3 text-left sm:px-2">Week</th>
                        <th className="w-[20%] px-1.5 py-3 text-right sm:px-2">Egg Count</th>
                        <th className="w-[25%] px-1.5 py-3 text-right sm:px-2">Revenue</th>
                        <th className="w-[14%] px-1.5 py-3 text-right sm:px-2">Damages</th>
                        <th className="w-[27%] px-1.5 py-3 text-right sm:px-2">Avg NECC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyRows.length ? weeklyRows.map((item) => (
                        <tr key={item.key} className="border-t border-gray-100 text-gray-700">
                          <td className="break-words px-1.5 py-3 sm:px-2">
                            <div className="font-semibold text-gray-900">{item.weekName}</div>
                            <div className="text-xs text-gray-500">{item.label}</div>
                          </td>
                          <td className="px-1.5 py-3 sm:px-2">
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              <span className="font-semibold">{number(item.salesQty)}</span>
                              <GrowthPill label="Egg" comparison={item.eggGrowth} compact />
                            </div>
                          </td>
                          <td className="px-1.5 py-3 sm:px-2">
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              <span>{currency(item.revenue)}</span>
                              <GrowthPill label="Rev" comparison={item.revenueGrowth} compact />
                            </div>
                          </td>
                          <td className="break-words px-1.5 py-3 text-right sm:px-2">{number(item.damages)}</td>
                          <td className="px-1.5 py-3 sm:px-2">
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              <span>Rs. {Number(item.averageNeccRate || 0).toFixed(3)}</span>
                              <GrowthPill label="NECC" comparison={item.neccGrowth} compact />
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="5"><EmptyState /></td>
                        </tr>
                      )}
                    </tbody>
                </table>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div>
                  <ChartTitle title="Weekly Egg Count" />
                  <ResponsiveContainer width="100%" height={210}>
                    <LineChart data={weeklyRows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="weekName" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={48} />
                      <Tooltip formatter={(value) => `${number(value)} eggs`} />
                      <Line type="monotone" dataKey="salesQty" name="Egg Count" stroke="#f97316" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <ChartTitle title="Weekly Revenue" />
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={weeklyRows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="weekName" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={54} />
                      <Tooltip formatter={(value) => currency(value)} />
                      <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[5, 5, 0, 0]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader title="Monthly Data" subtitle="Egg count, revenue, damage, and average NECC comparison" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {monthlyRows.length ? monthlyRows.map((item) => (
                <div key={item.key} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.label}</h3>
                      <p className="text-xs text-gray-500">Monthly comparison</p>
                    </div>
                    <GrowthPill label="Egg" comparison={item.eggGrowth} />
                  </div>
                  <MetricRow label="Egg Count" value={number(item.salesQty)} comparison={item.eggGrowth} />
                  <MetricRow label="Revenue" value={currency(item.revenue)} comparison={item.revenueGrowth} />
                  <MetricRow label="Damages" value={number(item.damages)} comparison={item.damageGrowth} />
                  <MetricRow label="Average NECC" value={`Rs. ${Number(item.averageNeccRate || 0).toFixed(3)}`} comparison={item.neccGrowth} />
                </div>
              )) : <EmptyState />}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const SectionHeader = ({ title, subtitle }) => (
  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  </div>
);

const ChartTitle = ({ title }) => (
  <div className="mb-2 text-sm font-semibold text-gray-900">{title}</div>
);

const GrowthPill = ({ label, comparison, compact = false }) => {
  const styles = {
    up: "bg-emerald-50 text-emerald-700",
    down: "bg-red-50 text-red-600",
    flat: "bg-orange-50 text-orange-600",
  };
  const icons = {
    up: faArrowUp,
    down: faArrowDown,
    flat: faMinus,
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-bold ${compact ? "text-[9px] sm:text-[10px]" : "text-[11px]"} ${styles[comparison.type]}`}>
      <FontAwesomeIcon icon={icons[comparison.type]} />
      {label ? `${label} ` : ""}{comparison.text}
    </span>
  );
};

const MetricRow = ({ label, value, comparison }) => (
  <div className="flex items-center justify-between gap-3 border-t border-gray-200 py-3 text-sm first:border-t-0">
    <span className="text-gray-500">{label}</span>
    <div className="flex items-center gap-2 text-right">
      <span className="font-bold text-gray-900">{value}</span>
      <GrowthPill label="" comparison={comparison} />
    </div>
  </div>
);

const DailyDataTable = ({ title, range, rows }) => (
  <div className="overflow-hidden rounded-lg border border-gray-100">
    <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      <p className="mt-0.5 text-xs text-gray-500">{formatLongDate(range.from)} to {formatLongDate(range.to)}</p>
    </div>
    <div>
      <table className="min-w-full text-sm">
        <thead className="bg-white text-xs font-semibold uppercase text-gray-500 shadow-sm">
          <tr>
            <th className="px-4 py-3 text-left">Weekday</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right">Egg Count</th>
            <th className="px-4 py-3 text-right">Damage Count</th>
            <th className="px-4 py-3 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((item) => (
            <tr key={item.key} className="border-t border-gray-100 text-gray-700">
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{item.weekday}</td>
              <td className="whitespace-nowrap px-4 py-3">{item.displayDate}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                  <span className="font-semibold">{number(item.salesQty)}</span>
                  <GrowthPill label="" comparison={item.eggGrowth} compact />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                  <span>{number(item.damages)}</span>
                  <GrowthPill label="" comparison={item.damageGrowth} compact />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                  <span>{currency(item.revenue)}</span>
                  <GrowthPill label="" comparison={item.revenueGrowth} compact />
                </div>
              </td>
            </tr>
          )) : <tr><td colSpan="5"><EmptyState /></td></tr>}
        </tbody>
      </table>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="px-5 py-8 text-center text-sm text-gray-500">No data found.</div>
);

export default Statistics;
