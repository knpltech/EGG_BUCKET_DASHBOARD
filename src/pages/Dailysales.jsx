const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";
import * as XLSX from "xlsx";
import {
  CartesianGrid,
  Bar,
  BarChart,
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

const formatDateDMY = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
};

function DailySalesAnalytics({ rows, outlets = [] }) {
  const colors = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#f59e0b"];

  const outletKeys = useMemo(() => {
    return Array.isArray(outlets)
      ? outlets
          .map((outlet) => (typeof outlet === "string" ? outlet : outlet?.id || outlet?.area || outlet?.name))
          .filter(Boolean)
      : [];
  }, [outlets]);

  const outletNames = useMemo(() => {
    return new Map(
      (Array.isArray(outlets) ? outlets : []).map((outlet) => {
        const key = typeof outlet === "string" ? outlet : outlet?.id || outlet?.area || outlet?.name;
        const label = typeof outlet === "string" ? outlet : outlet?.area || outlet?.name || key;
        return [key, label];
      }).filter(([key]) => Boolean(key))
    );
  }, [outlets]);

  const chartData = useMemo(() => {
    return rows.map((row) => {
      const dataPoint = {
        date: formatDateDMY(row.date),
      };

      outletKeys.forEach((outletKey) => {
        const outletValues = row?.outlets || {};
        if (outletValues[outletKey] !== undefined) {
          dataPoint[outletKey] = Number(outletValues[outletKey]) || 0;
        } else {
          dataPoint[outletKey] = 0;
        }
      });

      return dataPoint;
    });
  }, [rows, outletKeys]);

  if (!chartData.length) return null;

  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow-md">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Daily Sales Trend by Date
      </h2>
      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickMargin={10} />
            <YAxis width={42} />
            <Tooltip
              formatter={(value, name) => [Number(value).toLocaleString("en-IN"), outletNames.get(name) || name]}
            />
            <Legend formatter={(value) => outletNames.get(value) || value} />
            {outletKeys.map((outletKey, index) => (
              <Bar key={outletKey} dataKey={outletKey} fill={colors[index % colors.length]} radius={[8, 8, 0, 0]} />
            ))}
          </BarChart>
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
