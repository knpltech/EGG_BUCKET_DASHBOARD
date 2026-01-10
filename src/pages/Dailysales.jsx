const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect } from "react";
import { getRoleFlags } from "../utils/role";
import * as XLSX from "xlsx";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";
import Dailyentryform from "../components/Dailyentryform";
import Weeklytrend from "../components/Weeklytrend";

const DEFAULT_OUTLETS = [
  "AECS Layout",
  "Bandepalya",
  "Hosa Road",
  "Singasandra",
  "Kudlu Gate",
];

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
  const [outlets, setOutlets] = useState(DEFAULT_OUTLETS);
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
  useEffect(() => {
    const loadOutlets = () => {
      const saved = localStorage.getItem(OUTLETS_KEY);
      if (saved) {
        try {
          setOutlets(JSON.parse(saved));
        } catch {
          setOutlets(SAMPLE_OUTLETS);
        }
      } else {
        setOutlets(SAMPLE_OUTLETS);
      }
    };

    loadOutlets();
    window.addEventListener("egg:outlets-updated", loadOutlets);
    window.addEventListener("storage", loadOutlets);

    return () => {
      window.removeEventListener("egg:outlets-updated", loadOutlets);
      window.removeEventListener("storage", loadOutlets);
    };
  }, []);

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

    // No filter applied - show latest 7 entries
    return sortedRows.slice(-7);
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
            outlets={outlets}
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

        {/* ================= ENTRY FORM (ADMIN + DATA AGENT) ================= */}
        {!isViewer && (
          <div className="mt-10">
            <Dailyentryform
              addrow={addrow}
              blockeddates={rows.filter((r) => r.locked).map((r) => r.date)}
              rows={rows}
              outlets={outlets}
            />
          </div>
        )}

        {/* ================= WEEKLY TREND (ADMIN ONLY) ================= */}
        {isAdmin && (
          <div className="mt-10">
            <Weeklytrend />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dailysales;