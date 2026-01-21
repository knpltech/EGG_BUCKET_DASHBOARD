const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback } from "react";
import { getRoleFlags } from "../utils/role";
import * as XLSX from "xlsx";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";
import Dailyentryform from "../components/Dailyentryform";
import Weeklytrend from "../components/Weeklytrend";

const SAMPLE_OUTLETS = [
  { area: "AECS Layout" },
  { area: "Bandepalya" },
  { area: "Hosa Road" },
  { area: "Singasandra" },
  { area: "Kudlu Gate" },
];

const OUTLETS_KEY = "egg_outlets_v1";

const Dailysales = () => {
  const { isAdmin, isViewer, isDataAgent } = getRoleFlags();

  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  
  // Filtered outlets for Data Agent: only show active
  const filteredOutlets = isDataAgent && Array.isArray(outlets)
    ? outlets.filter(o => {
        if (typeof o === 'string') return true;
        if (typeof o === 'object' && o.status) return o.status === 'Active';
        return true;
      })
    : outlets;
    
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});

  /* ================= FETCH SALES ================= */
  useEffect(() => {
    const fetchSales = async () => {
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
    };
    fetchSales();
  }, []);

  /* ================= OUTLETS ================= */
  const loadOutlets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/outlets/all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setOutlets(data);
          localStorage.setItem(OUTLETS_KEY, JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("Error fetching outlets:", err);
      // Fallback to localStorage if fetch fails
      const saved = localStorage.getItem(OUTLETS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setOutlets(parsed);
          } else {
            setOutlets(SAMPLE_OUTLETS);
          }
        } catch (parseErr) {
          console.error("Error parsing saved outlets:", parseErr);
          setOutlets(SAMPLE_OUTLETS);
        }
      } else {
        setOutlets(SAMPLE_OUTLETS);
      }
    }
  }, []);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  useEffect(() => {
    const handleOutletsUpdated = (event) => {
      if (event.detail && Array.isArray(event.detail)) {
        // Immediately update outlets from the event
        setOutlets(event.detail);
        localStorage.setItem(OUTLETS_KEY, JSON.stringify(event.detail));
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadOutlets();
      }
    };

    // Also listen for storage events from other tabs
    const handleStorageChange = (e) => {
      if (e.key === OUTLETS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setOutlets(parsed);
          }
        } catch (err) {
          console.error("Error parsing storage event:", err);
        }
      }
    };

    window.addEventListener('egg:outlets-updated', handleOutletsUpdated);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('egg:outlets-updated', handleOutletsUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadOutlets]);

  /* ================= FILTER LOGIC ================= */
  const getFilteredRows = () => {
    const sortedRows = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));

    // If both dates are selected, filter by range
    if (fromDate && toDate) {
      return sortedRows.filter(row => {
        const rowDate = new Date(row.date);
        return rowDate >= new Date(fromDate) && rowDate <= new Date(toDate);
      });
    }

    // If only fromDate is selected
    if (fromDate) {
      return sortedRows.filter(row => new Date(row.date) >= new Date(fromDate));
    }

    // If only toDate is selected
    if (toDate) {
      return sortedRows.filter(row => new Date(row.date) <= new Date(toDate));
    }

    // No filter applied - show all data
    return sortedRows;
  };

  const filteredRows = getFilteredRows();

  /* ================= EDIT (ADMIN ONLY) ================= */
  const handleEditClick = (row) => {
    if (!isAdmin) return;
    
    const fullRow = { ...row };
    if (!row.id) {
      const found = rows.find(r => r.date === row.date);
      if (found?.id) fullRow.id = found.id;
    }
    
    setEditRow(fullRow);
    setEditValues({ ...row.outlets });
    setEditModalOpen(true);
  };

  const handleEditCancel = () => {
    setEditModalOpen(false);
    setEditRow({});
    setEditValues({});
  };

  const handleEditSave = async () => {
    if (!editRow.id) {
      alert("No ID found. Cannot update.");
      return;
    }

    const updatedOutlets = { ...editValues };
    const total = Object.values(updatedOutlets).reduce(
      (s, v) => s + (Number(v) || 0),
      0
    );

    try {
      const response = await fetch(`${API_URL}/dailysales/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editRow.date,
          outlets: updatedOutlets,
          total,
        }),
      });

      if (!response.ok) {
        alert("Failed to update entry");
        return;
      }

      // Refetch all data
      const res = await fetch(`${API_URL}/dailysales/all`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRows(data.map(d => ({ id: d.id || d._id, ...d })));
      } else if (data.success && Array.isArray(data.data)) {
        setRows(data.data.map(d => ({ id: d.id || d._id, ...d })));
      }

      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    } catch (err) {
      alert("Error updating entry: " + err.message);
    }
  };

  /* ================= ADD ROW ================= */
  const addrow = async (newrow) => {
    try {
      const response = await fetch(`${API_URL}/dailysales/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newrow),
      });

      if (!response.ok) {
        alert("Failed to add entry");
        return;
      }

      // Refetch all data after adding
      const res = await fetch(`${API_URL}/dailysales/all`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRows(data.map(d => ({ id: d.id || d._id, ...d })));
      } else if (data.success && Array.isArray(data.data)) {
        setRows(data.data.map(d => ({ id: d.id || d._id, ...d })));
      }
    } catch (err) {
      console.error("Error adding sale:", err);
      alert("Error adding entry");
    }
  };

  /* ================= DOWNLOAD ================= */
  const handleDownload = () => {
    const data = filteredRows.map((row) => {
      const obj = { Date: row.date };
      outlets.forEach((o) => {
        const area = o.area || o;
        obj[area] = row.outlets?.[area] ?? 0;
      });
      obj.Total = row.total || 0;
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Sales");
    XLSX.writeFile(wb, "Daily_Sales_Report.xlsx");
  };

  return (
    <div className="flex">
      <div className="bg-eggBg min-h-screen p-6 w-full">
        <Topbar />

        {/* ================= ENTRY FORM (ADMIN + DATA AGENT) ================= */}
        {!isViewer && (
          <div className="mt-4 mb-8">
            <Dailyentryform
              addrow={addrow}
              blockeddates={rows.filter((r) => r.locked).map((r) => r.date)}
              rows={rows}
              outlets={filteredOutlets}
            />
          </div>
        )}

        {/* ================= HEADER ================= */}
        {(isAdmin || isViewer || isDataAgent) && (
          <Dailyheader 
            dailySalesData={filteredRows}
            fromDate={fromDate}
            toDate={toDate}
            setFromDate={setFromDate}
            setToDate={setToDate}
            allRows={rows}
          />
        )}

        {/* ================= TABLE (ADMIN + VIEWER + DATA AGENT) ================= */}
        {(isAdmin || isViewer || isDataAgent) && (
          <DailyTable
            rows={filteredRows}
            outlets={filteredOutlets}
            onEdit={isAdmin ? handleEditClick : null}
          />
        )}

        {/* ================= EDIT MODAL (ADMIN ONLY) ================= */}
        {isAdmin && editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-xl p-6 min-w-[320px] max-w-full max-h-[80vh] overflow-y-auto">
              <h2 className="font-semibold mb-4 text-lg">
                Edit Daily Sales ({editRow.date})
              </h2>

              <div className="space-y-3">
                {outlets.map((o) => {
                  const area = o.area || o;
                  return (
                    <div key={area} className="flex items-center gap-2">
                      <label className="w-32 text-xs font-medium text-gray-700">{area}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editValues[area] ?? 0}
                        onChange={(e) =>
                          setEditValues((p) => ({
                            ...p,
                            [area]: Number(e.target.value),
                          }))
                        }
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={handleEditCancel}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= WEEKLY TREND (ADMIN ONLY) ================= */}
        {isAdmin && (
          <div className="mt-10">
            <Weeklytrend rows={rows} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dailysales;