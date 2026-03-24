const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";
import * as XLSX from "xlsx";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";
import Weeklytrend from "../components/Weeklytrend";

const OUTLETS_KEY = "egg_outlets_v1";

const formatDateDMY = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
};

function DailySalesAnalytics({ rows }) {
  const chartData = useMemo(() => {
    return rows.map((row) => ({
      date: formatDateDMY(row.date),
      total: Number(row.total) || 0,
    }));
  }, [rows]);

  if (!chartData.length) return null;

  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow-md">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Daily Sales Trend by Date
      </h2>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => Number(value).toLocaleString("en-IN")} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#f97316"
              strokeWidth={3}
              dot={{ r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const Dailysales = () => {
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
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

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});
  const [isEditSaving, setIsEditSaving] = useState(false);

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

  const handleEditClick = (row) => {
    if (!isAdmin || isReadOnly) return;

    const fullRow = { ...row };
    if (!row.id) {
      const found = rows.find((r) => r.date === row.date);
      if (found?.id) fullRow.id = found.id;
    }

    setEditRow(fullRow);

    const values = {};
    outlets.forEach((outletRef) => {
      const editKey = getOutletEditKey(fullRow, outletRef);
      values[editKey] = String(getOutletSaleValue(fullRow, outletRef) ?? 0);
    });

    setEditValues(values);
    setEditModalOpen(true);
  };

  const handleEditCancel = () => {
    setEditModalOpen(false);
    setEditRow({});
    setEditValues({});
    setIsEditSaving(false);
  };

  const editTotal = useMemo(() => {
    return Object.values(editValues).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }, [editValues]);

  const handleEditSave = async () => {
    if (!isAdmin || isReadOnly) return;
    if (isEditSaving) return;
    if (!editRow.id) {
      alert("No ID found. Cannot update.");
      return;
    }

    const updatedOutlets = { ...(editRow.outlets || {}) };
    Object.entries(editValues).forEach(([key, value]) => {
      const num = value === "" || value == null ? 0 : Number(value);
      updatedOutlets[key] = Number.isNaN(num) ? 0 : num;
    });
    const total = Object.values(updatedOutlets).reduce((sum, value) => sum + (Number(value) || 0), 0);

    setIsEditSaving(true);
    try {
      const response = await fetch(`${API_URL}/dailysales/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editRow.date, outlets: updatedOutlets, total }),
      });

      if (!response.ok) {
        alert("Failed to update entry");
        return;
      }

      await fetchSales();
      handleEditCancel();
    } catch (err) {
      alert("Error updating entry: " + err.message);
    } finally {
      setIsEditSaving(false);
    }
  };

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
            onEdit={isAdmin && !isReadOnly ? handleEditClick : null}
          />
        )}

        {isAdmin && !isReadOnly && editModalOpen && outlets.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
              <h2 className="font-semibold mb-4 text-lg">Edit Daily Sales ({editRow.date})</h2>
              <div className="space-y-3">
                {outlets.map((outletRef) => {
                  const area = typeof outletRef === "string" ? outletRef : (outletRef.area || outletRef.id);
                  const name = typeof outletRef === "string" ? outletRef : (outletRef.area || outletRef.name || outletRef.id);
                  const editKey = getOutletEditKey(editRow, outletRef);

                  return (
                    <div key={area} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label className="w-full sm:w-32 text-xs font-medium text-gray-700">{name}</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editValues[editKey] ?? ""}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [editKey]: e.target.value }))}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-xs font-semibold text-gray-600">Total</span>
                <span className="text-sm font-bold text-orange-600">
                  {editTotal.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={handleEditCancel}
                  disabled={isEditSaving}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={isEditSaving}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                >
                  {isEditSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {(isAdmin || isSupervisor || isViewer) && outlets.length > 0 && (
          <div className="mt-10">
            <Weeklytrend rows={scopedRows} outlets={visibleOutlets} />
            <DailySalesAnalytics rows={scopedRows} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dailysales;
