const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";
import * as XLSX from "xlsx";
import {
  CartesianGrid,
  Bar,
  BarChart,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";
import Weeklytrend from "../components/Weeklytrend";
import { getThisWeekRange } from "../utils/dateRange";

const OUTLETS_KEY = "egg_outlets_v1";

const OUTLET_COLORS = [
  "#ff7518", "#3b82f6", "#10b981", "#8b5cf6",
  "#f59e0b", "#ef4444", "#06b6d4", "#ec4899",
  "#84cc16", "#a855f7",
];

const formatDateDMY = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
};

// Short label for chart X-axis: DD/MM
const formatDateShort = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function DailySalesAnalytics({ rows, outlets = [] }) {
  const [chartType, setChartType] = useState("bar"); // "line" | "bar"

  // Build stable outlet metadata (key, display name, color)
  const outletMeta = useMemo(() => {
    const metas = outlets.map((o, i) => ({
      key: typeof o === "string" ? o : o.id || o.area || o.name,
      name: typeof o === "string" ? o : (o.area || o.name || o.id || String(o)),
      color: OUTLET_COLORS[i % OUTLET_COLORS.length],
    }));
    metas.push({ key: "__TOTAL", name: "Total", color: "#111827" });
    return metas;
  }, [outlets]);

  // All outlets start active; toggling hides/shows individual lines
  const [activeKeys, setActiveKeys] = useState(() => new Set(outletMeta.map(o => o.key)));

  // Re-sync when outlets list changes
  useEffect(() => {
    setActiveKeys(new Set(outletMeta.map(o => o.key)));
  }, [outletMeta]);

  const toggleOutlet = (key) => {
    setActiveKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); } // keep at least one
      else next.add(key);
      return next;
    });
  };

  // One data point per date
  const chartData = useMemo(() =>
    rows.map(row => {
      const point = { date: formatDateShort(row.date) };
      // compute values for each outlet meta; compute total separately
      let runningTotal = 0;
      outletMeta.forEach(({ key, name }) => {
        if (key === "__TOTAL") return;
        const outletValues = row?.outlets || {};
        const val = Number(outletValues[key] ?? 0);
        runningTotal += val;
        point[name] = val;
      });
      // append Total value
      const totalMeta = outletMeta.find(m => m.key === "__TOTAL");
      if (totalMeta) point[totalMeta.name] = runningTotal;
      return point;
    }),
    [rows, outletMeta]
  );

  // Nothing to render if no data or outlets
  if (chartData.length === 0 || outlets.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[150px]">
        <p className="font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4 mt-0.5">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span style={{ color: p.color }} className="font-medium">{p.name}</span>
            </span>
            <span className="font-semibold text-gray-800">{Number(p.value).toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-8">

      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sales Trend Analysis</h2>
          <p className="text-xs text-gray-500 mt-0.5">Visualise daily sales trends per outlet for the selected date range</p>
        </div>
        {/* Line / Bar toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 self-start">
          <button
            onClick={() => setChartType("line")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${chartType === "line" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >Line</button>
          <button
            onClick={() => setChartType("bar")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${chartType === "bar" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >Bar</button>
        </div>
      </div>

      {/* Outlet toggle pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {outletMeta.map(({ key, name, color }) => {
          const active = activeKeys.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleOutlet(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active ? "bg-white border-gray-200 text-gray-700 shadow-sm" : "bg-gray-50 border-gray-100 text-gray-400"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, opacity: active ? 1 : 0.3 }} />
              {name}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString("en-IN")} width={48} />
              <Tooltip content={<CustomTooltip />} />
              {outletMeta.map(({ key, name, color }) =>
                activeKeys.has(key) ? (
                  <Line key={key} type="monotone" dataKey={name} stroke={color} strokeWidth={2}
                    dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} isAnimationActive />
                ) : null
              )}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString("en-IN")} width={48} />
              <Tooltip content={<CustomTooltip />} />
              {outletMeta.map(({ key, name, color }) =>
                activeKeys.has(key) ? (
                  <Bar key={key} dataKey={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive />
                ) : null
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const Dailysales = () => {
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  const defaultWeekRange = useMemo(() => getThisWeekRange(), []);
  const showForms = isAdmin || isDataAgent;
  const isReadOnly = isViewer;

  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [outletLoading, setOutletLoading] = useState(true);

  const formOutlets = useMemo(() => {
    let list = outlets;
    if (!isViewer && !isAdmin && zone && Array.isArray(list)) {
      list = list.filter((o) => typeof o === "object" && zonesMatch(o.zoneId, zone));
    }
    if (isDataAgent && Array.isArray(list) && list.length > 0) {
      list = list.filter((o) => {
        if (typeof o === "string") return true;
        if (typeof o === "object" && o.status) return o.status === "Active";
        return true;
      });
    }
    return list;
  }, [outlets, isAdmin, isDataAgent, zone, isViewer]);

  const [fromDate, setFromDate] = useState(defaultWeekRange.from);
  const [toDate, setToDate] = useState(defaultWeekRange.to);

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dailysales/all`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRows(data.map((d) => ({ id: d.id || d._id, ...d })));
      } else if (data.success && Array.isArray(data.data)) {
        setRows(data.data.map((d) => ({ id: d.id || d._id, ...d })));
      } else {
        setRows([]);
      }
    } catch (err) {
      console.error("Error fetching sales:", err);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    fetchSales();
    const salesInterval = setInterval(fetchSales, 30000);
    return () => clearInterval(salesInterval);
  }, [fetchSales]);

  const loadOutlets = useCallback(async () => {
    setOutletLoading(true);
    try {
      const res = await fetch(`${API_URL}/outlets/all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setOutlets(data);
          localStorage.setItem(OUTLETS_KEY, JSON.stringify(data));
        } else {
          throw new Error("Empty outlets response");
        }
      } else {
        throw new Error("Failed to fetch outlets");
      }
    } catch {
      const saved = localStorage.getItem(OUTLETS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setOutlets(parsed);
          else setOutlets([]);
        } catch {
          setOutlets([]);
        }
      } else {
        setOutlets([]);
      }
    } finally {
      setOutletLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  useEffect(() => {
    const handleOutletsUpdated = (e) => {
      if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setOutlets(e.detail);
        localStorage.setItem(OUTLETS_KEY, JSON.stringify(e.detail));
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadOutlets();
    };
    const handleStorage = (e) => {
      if (e.key === OUTLETS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) setOutlets(parsed);
        } catch {}
      }
    };

    window.addEventListener("egg:outlets-updated", handleOutletsUpdated);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("egg:outlets-updated", handleOutletsUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadOutlets]);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (fromDate && toDate) {
      return sorted.filter((r) => {
        const date = new Date(r.date);
        return date >= new Date(fromDate) && date <= new Date(toDate);
      });
    }
    if (fromDate) return sorted.filter((r) => new Date(r.date) >= new Date(fromDate));
    if (toDate) return sorted.filter((r) => new Date(r.date) <= new Date(toDate));
    return sorted;
  }, [rows, fromDate, toDate]);

  const visibleOutlets = useMemo(() => (isSupervisor ? formOutlets : outlets), [isSupervisor, formOutlets, outlets]);

  const getOutletSaleValue = useCallback((row, outletRef) => {
    const outletObj = typeof outletRef === "object" ? outletRef : null;
    const outletId = outletObj?.id || outletRef;
    const outletArea = outletObj?.area || outletObj?.name;
    const values = row?.outlets || {};
    if (values[outletId] !== undefined) return Number(values[outletId]) || 0;
    if (outletArea && values[outletArea] !== undefined) return Number(values[outletArea]) || 0;
    return 0;
  }, []);

  const getOutletEditKey = useCallback((row, outletRef) => {
    const outletObj = typeof outletRef === "object" ? outletRef : null;
    const outletId = outletObj?.id || outletRef;
    const outletArea = outletObj?.area || outletObj?.name || outletId;
    const values = row?.outlets || {};

    if (values[outletId] !== undefined) return outletId;
    if (outletArea && values[outletArea] !== undefined) return outletArea;
    return outletArea || outletId;
  }, []);

  const scopedRows = useMemo(() => {
    if (!Array.isArray(filteredRows)) return [];
    const refs = Array.isArray(visibleOutlets) ? visibleOutlets : [];

    return filteredRows.map((row) => {
      const scopedOutlets = {};
      refs.forEach((outletRef) => {
        const outletObj = typeof outletRef === "object" ? outletRef : null;
        const outletId = outletObj?.id || outletRef;
        scopedOutlets[outletId] = getOutletSaleValue(row, outletRef);
      });

      const scopedTotal = Object.values(scopedOutlets).reduce((sum, value) => sum + (Number(value) || 0), 0);
      return { ...row, outlets: scopedOutlets, total: scopedTotal };
    });
  }, [filteredRows, visibleOutlets, getOutletSaleValue]);



  const addrow = async (newrow) => {
    let user = null;
    try { user = JSON.parse(localStorage.getItem("user")); } catch {}
    const addedBy = user ? {
      username: user.username || user.uid || "Unknown",
      zone: user.zoneId || user.zone || "No Zone",
      role: user.role || "unknown",
      timestamp: new Date().toISOString(),
    } : null;

    try {
      const response = await fetch(`${API_URL}/dailysales/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newrow, addedBy }),
      });
      if (!response.ok) {
        alert("Failed to add entry");
        return;
      }
      await fetchSales();
    } catch (err) {
      console.error("Error adding sale:", err);
      alert("Error adding entry");
    }
  };

  const handleDownload = () => {
    const fmt = (iso) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso;
      return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
    };

    const data = filteredRows.map((row) => {
      const obj = { Date: fmt(row.date) };
      outlets.forEach((o) => {
        const area = o.area || o;
        obj[area] = Number(row.outlets?.[area] ?? 0);
      });
      obj.Total = Number(row.total ?? outlets.reduce((sum, o) => sum + Number(row.outlets?.[(o.area || o)] || 0), 0));
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Sales");
    XLSX.writeFile(wb, "Daily_Sales_Report.xlsx");
  };

  if (outletLoading) {
    return (
      <div className="flex">
        <div className="bg-eggBg min-h-screen p-6 w-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff7518] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading outlets...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="bg-eggBg min-h-screen p-6 w-full">
        <Topbar />

        {showForms && outlets.length === 0 && (
          <div className="mt-4 mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-800">No outlets available. Please add outlets first.</p>
          </div>
        )}

        {(isAdmin || isViewer || isDataAgent || isSupervisor) && outlets.length > 0 && (
          <Dailyheader
            title={"Daily Sales Entry"}
            subtitle={isReadOnly ? "View daily sales entries." : "Manage and track daily sales entries."}
            dailySalesData={scopedRows}
            fromDate={fromDate}
            toDate={toDate}
            setFromDate={setFromDate}
            setToDate={setToDate}
            allRows={rows}
            onExport={handleDownload}
          />
        )}

        {(isAdmin || isViewer || isDataAgent || isSupervisor) && outlets.length > 0 && (
          <DailyTable
            rows={scopedRows}
            outlets={visibleOutlets.map((o) => (typeof o === "string" ? o : o.id))}
            allOutlets={visibleOutlets}
          />
        )}



        {(isAdmin || isSupervisor || isViewer) && outlets.length > 0 && (
          <div className="mt-10">
            <DailySalesAnalytics rows={scopedRows} outlets={visibleOutlets} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dailysales;
