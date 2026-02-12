const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";
import * as XLSX from "xlsx";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";
import Dailyentryform from "../components/Dailyentryform";
import Weeklytrend from "../components/Weeklytrend";

const OUTLETS_KEY = "egg_outlets_v1";

const Dailysales = () => {
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  // For supervisor, treat as data agent for form visibility
  const showForms = isAdmin || isDataAgent || isSupervisor;

  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [outletLoading, setOutletLoading] = useState(true);
  
  // formOutlets: zone-filtered for data entry, filter active only for data agent
  const formOutlets = useMemo(() => {
    let list = outlets;
    // Filter by zone for any user with zone
    if (zone && Array.isArray(list)) {
      list = list.filter(o => typeof o === 'object' && zonesMatch(o.zoneId, zone));
    }
    // Filter active only for data agent
    if (isDataAgent && Array.isArray(list) && list.length > 0) {
      list = list.filter(o => {
        if (typeof o === 'string') return true;
        if (typeof o === 'object' && o.status) return o.status === 'Active';
        return true;
      });
    }
    return list;
  }, [outlets, isDataAgent, zone]);
    
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});

  /* ================= FETCH SALES ================= */
  const fetchSales = useCallback(async () => {
    try {
      console.log('Fetching sales data...');
      const res = await fetch(`${API_URL}/dailysales/all`);
      const data = await res.json();

      if (Array.isArray(data)) {
        setRows(data.map(d => ({ id: d.id || d._id, ...d })));
      } else if (data.success && Array.isArray(data.data)) {
        setRows(data.data.map(d => ({ id: d.id || d._id, ...d })));
      } else {
        setRows([]);
      }
      console.log('Sales data updated:', Array.isArray(data) ? data.length : data.data?.length || 0);
    } catch (err) {
      console.error("Error fetching sales:", err);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    fetchSales();
    // Auto-refresh sales every 30 seconds
    const salesInterval = setInterval(fetchSales, 30000);
    return () => clearInterval(salesInterval);
  }, [fetchSales]);

  /* ================= OUTLETS - LOAD ONCE ON MOUNT ================= */
  const loadOutlets = useCallback(async () => {
    setOutletLoading(true);
    try {
      console.log('Loading outlets...');
      // Always load all outlets for display
      const url = `${API_URL}/outlets/all`;
      console.log('Dailysales loadOutlets URL:', url);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log('Outlets loaded from backend:', data.length);
          setOutlets(data);
          localStorage.setItem(OUTLETS_KEY, JSON.stringify(data));
        } else {
          throw new Error('Empty outlets response');
        }
      } else {
        throw new Error('Failed to fetch outlets');
      }
    } catch (err) {
      console.error("Error fetching outlets:", err);
      // Try localStorage as fallback
      const saved = localStorage.getItem(OUTLETS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('Using cached outlets from localStorage');
            setOutlets(parsed);
          } else {
            setOutlets([]);
          }
        } catch (parseErr) {
          console.error("Error parsing saved outlets:", parseErr);
          setOutlets([]);
        }
      } else {
        setOutlets([]);
      }
    } finally {
      setOutletLoading(false);
    }
  }, []);

  // Load outlets only on component mount
  useEffect(() => {
    loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= OUTLET SYNC - LISTEN FOR UPDATES ================= */
  useEffect(() => {
    const handleOutletsUpdated = (event) => {
      console.log('Outlets updated event received');
      if (event.detail && Array.isArray(event.detail) && event.detail.length > 0) {
        setOutlets(event.detail);
        localStorage.setItem(OUTLETS_KEY, JSON.stringify(event.detail));
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page visible, reloading outlets');
        loadOutlets();
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === OUTLETS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('Outlets updated from storage event');
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

    if (fromDate && toDate) {
      return sortedRows.filter(row => {
        const rowDate = new Date(row.date);
        return rowDate >= new Date(fromDate) && rowDate <= new Date(toDate);
      });
    }

    if (fromDate) {
      return sortedRows.filter(row => new Date(row.date) >= new Date(fromDate));
    }

    if (toDate) {
      return sortedRows.filter(row => new Date(row.date) <= new Date(toDate));
    }

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

      // Refetch all data after successful update
      await fetchSales();
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

      // Refetch all data after successful add
      await fetchSales();
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

  // Show loading state while outlets are loading
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

        {/* ================= ENTRY FORM (ADMIN + DATA AGENT + SUPERVISOR) ================= */}
        {showForms && outlets.length > 0 && (
          <div className="mt-4 mb-8">
            <Dailyentryform
              addrow={addrow}
              blockeddates={rows.filter((r) => r.locked).map((r) => r.date)}
              rows={rows}
              outlets={formOutlets}
            />
          </div>
        )}

        {/* No outlets warning */}
        {showForms && outlets.length === 0 && (
          <div className="mt-4 mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-800">No outlets available. Please add outlets first.</p>
          </div>
        )}

        {/* ================= HEADER ================= */}
        {(isAdmin || isViewer || isDataAgent || isSupervisor) && outlets.length > 0 && (
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
        {(isAdmin || isViewer || isDataAgent || isSupervisor) && outlets.length > 0 && (
          <DailyTable
            rows={filteredRows}
            outlets={outlets}
            onEdit={isAdmin ? handleEditClick : null}
          />
        )}

        {/* ================= EDIT MODAL (ADMIN ONLY) ================= */}
        {isAdmin && editModalOpen && outlets.length > 0 && (
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
        {isAdmin && outlets.length > 0 && (
          <div className="mt-10">
            <Weeklytrend rows={rows} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dailysales;