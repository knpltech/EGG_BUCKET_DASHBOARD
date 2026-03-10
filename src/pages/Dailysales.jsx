const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";
import * as XLSX from "xlsx";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";
import Weeklytrend from "../components/Weeklytrend";

const OUTLETS_KEY = "egg_outlets_v1";

const Dailysales = () => {
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  const showForms = isAdmin || isDataAgent;

  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [outletLoading, setOutletLoading] = useState(true);

  const formOutlets = useMemo(() => {
    let list = outlets;
    // Admin and Viewer see all outlets; others filter by zone
    if (!isViewer && !isAdmin && zone && Array.isArray(list)) {
      list = list.filter(o => typeof o === 'object' && zonesMatch(o.zoneId, zone));
    }
    if (isDataAgent && Array.isArray(list) && list.length > 0) {
      list = list.filter(o => {
        if (typeof o === 'string') return true;
        if (typeof o === 'object' && o.status) return o.status === 'Active';
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

  /* ================= FETCH SALES ================= */
  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dailysales/all`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRows(data.map(d => ({ id: d.id || d._id, ...d })));
      } else if (data.success && Array.isArray(data.data)) {
        setRows(data.data.map(d => ({ id: d.id || d._id, ...d })));
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

  /* ================= OUTLETS ================= */
  const loadOutlets = useCallback(async () => {
    setOutletLoading(true);
    try {
      const res = await fetch(`${API_URL}/outlets/all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setOutlets(data);
          localStorage.setItem(OUTLETS_KEY, JSON.stringify(data));
        } else throw new Error('Empty outlets response');
      } else throw new Error('Failed to fetch outlets');
    } catch (err) {
      const saved = localStorage.getItem(OUTLETS_KEY);
      if (saved) {
        try { const p = JSON.parse(saved); if (Array.isArray(p) && p.length > 0) setOutlets(p); else setOutlets([]); }
        catch { setOutlets([]); }
      } else setOutlets([]);
    } finally {
      setOutletLoading(false);
    }
  }, []);

  useEffect(() => { loadOutlets(); }, []);

  useEffect(() => {
    const handleOutletsUpdated = (e) => { if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) { setOutlets(e.detail); localStorage.setItem(OUTLETS_KEY, JSON.stringify(e.detail)); } };
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadOutlets(); };
    const handleStorage = (e) => { if (e.key === OUTLETS_KEY && e.newValue) { try { const p = JSON.parse(e.newValue); if (Array.isArray(p) && p.length > 0) setOutlets(p); } catch {} } };
    window.addEventListener('egg:outlets-updated', handleOutletsUpdated);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('egg:outlets-updated', handleOutletsUpdated);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadOutlets]);

  /* ================= FILTER LOGIC ================= */
  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (fromDate && toDate) return sorted.filter(r => { const d = new Date(r.date); return d >= new Date(fromDate) && d <= new Date(toDate); });
    if (fromDate) return sorted.filter(r => new Date(r.date) >= new Date(fromDate));
    if (toDate) return sorted.filter(r => new Date(r.date) <= new Date(toDate));
    return sorted;
  }, [rows, fromDate, toDate]);

  /* ================= EDIT (ADMIN ONLY) ================= */
  const handleEditClick = (row) => {
    if (!isAdmin) return;
    const fullRow = { ...row };
    if (!row.id) { const found = rows.find(r => r.date === row.date); if (found?.id) fullRow.id = found.id; }
    setEditRow(fullRow);
    // Key editValues by area — preserve whatever is stored
    const vals = {};
    outlets.forEach((o) => {
      const area = o.area || o;
      vals[area] = row.outlets?.[area] ?? "";
    });
    setEditValues(vals);
    setEditModalOpen(true);
  };

  const handleEditCancel = () => { setEditModalOpen(false); setEditRow({}); setEditValues({}); };

  const handleEditSave = async () => {
    if (!editRow.id) { alert("No ID found. Cannot update."); return; }

    // Preserve user's numbers exactly; only convert to Number for backend
    const numericOutlets = {};
    Object.entries(editValues).forEach(([k, v]) => {
      const num = v === "" || v == null ? 0 : Number(v);
      numericOutlets[k] = isNaN(num) ? 0 : num;
    });
    const total = Object.values(numericOutlets).reduce((s, v) => s + (Number(v) || 0), 0);

    try {
      const response = await fetch(`${API_URL}/dailysales/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editRow.date, outlets: numericOutlets, total }),
      });
      if (!response.ok) { alert("Failed to update entry"); return; }

      // Optimistic update: reflect outlet and total changes immediately in the table
      setRows(prev => prev.map(r => {
        if (r.id !== editRow.id) return r;
        return {
          ...r,
          outlets: { ...(r.outlets || {}), ...numericOutlets },
          total,
        };
      }));
      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    } catch (err) { alert("Error updating entry: " + err.message); }
  };

  /* ================= ADD ROW ================= */
  const addrow = async (newrow) => {
    try {
      const response = await fetch(`${API_URL}/dailysales/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newrow),
      });
      if (!response.ok) { alert("Failed to add entry"); return; }
      await fetchSales();
    } catch (err) { console.error("Error adding sale:", err); alert("Error adding entry"); }
  };

  /* ================= DOWNLOAD ================= */
  const handleDownload = () => {
    const fmt = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    };
    const data = filteredRows.map((row) => {
      const obj = { Date: fmt(row.date) };
      outlets.forEach((o) => { const area = o.area || o; obj[area] = Number(row.outlets?.[area] ?? 0); });
      obj.Total = Number(row.total ?? outlets.reduce((s, o) => s + Number(row.outlets?.[(o.area || o)] || 0), 0));
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
            title={"Daily Sales Quantity"}
            subtitle={"Manage and track daily egg sales across all outlets."}
            dailySalesData={filteredRows}
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
            rows={filteredRows}
            outlets={(isSupervisor ? formOutlets : outlets).map(o => typeof o === 'string' ? o : o.id)}
            allOutlets={outlets}
            onEdit={isAdmin ? handleEditClick : null}
          />
        )}

        {/* Edit Modal — labels by area name, step="any" preserves user's numbers */}
        {isAdmin && editModalOpen && outlets.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-xl p-6 min-w-[320px] max-w-full max-h-[80vh] overflow-y-auto">
              <h2 className="font-semibold mb-4 text-lg">Edit Daily Sales ({editRow.date})</h2>
              <div className="space-y-3">
                {outlets.map((o) => {
                  const area = o.area || o;
                  const name = typeof o === 'string' ? o : (o.area || o.name || area);
                  return (
                    <div key={area} className="flex items-center gap-2">
                      <label className="w-32 text-xs font-medium text-gray-700">{name}</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editValues[area] ?? ""}
                        onChange={(e) => setEditValues((p) => ({ ...p, [area]: e.target.value }))}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={handleEditCancel} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300">Cancel</button>
                <button onClick={handleEditSave} className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600">Save</button>
              </div>
            </div>
          </div>
        )}

        {(isAdmin || isSupervisor || isViewer) && outlets.length > 0 && (
          <div className="mt-10">
            <Weeklytrend rows={rows} outlets={formOutlets} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dailysales;