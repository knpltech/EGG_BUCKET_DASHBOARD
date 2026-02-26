import React from "react";

function NeccMatrixTable({ rows, outlets }) {
  // Only show dates that have at least one NECC rate entry
  const dateSet = new Set();
  rows.forEach(r => {
    if (r.rate || r.rateValue) dateSet.add(r.date);
  });
  const allDates = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));
  const outletList = Array.isArray(outlets) ? outlets : [];

  // Build a lookup: {date: {outletId: rate}}
  const matrix = {};
  // Debug: log all rows
  console.log('NECC rows:', rows);
  rows.forEach(r => {
    if (!r.date || !r.outletId) return; // skip invalid entries or missing outletId
    if (!matrix[r.date]) matrix[r.date] = {};
    // Prefer numeric rateValue if present
    let value = r.rateValue;
    if (value === undefined || value === null || value === "") {
      // Try to extract number from r.rate string (e.g., '₹9.49 per egg')
      if (typeof r.rate === 'string') {
        const match = r.rate.match(/([0-9]+(\.[0-9]+)?)/);
        value = match ? match[1] : r.rate;
      } else {
        value = r.rate;
      }
    }
    matrix[r.date][r.outletId] = value;
  });

  return (
    <div className="overflow-x-auto rounded-2xl bg-eggWhite shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-semibold text-gray-500">
            <th className="min-w-[130px] px-4 py-3">Date</th>
            {outletList.map((outlet, i) => (
              <th key={outlet.id || i} className="px-4 py-3 whitespace-nowrap">{String(outlet.name).toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allDates.map(date => (
            <tr key={date} className="text-xs text-gray-700">
              <td className="whitespace-nowrap px-4 py-3">{new Date(date).toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" })}</td>
              {outletList.map((outlet, j) => {
                let value = matrix[date] && matrix[date][outlet.id] ? matrix[date][outlet.id] : "";
                return (
                  <td key={outlet.id || j} className="whitespace-nowrap px-4 py-3 text-center">
                    {value !== "" ? value : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const API_URL = import.meta.env.VITE_API_URL;

import { useState, useEffect, useRef, useMemo } from "react";
import Entryform from "../components/Entryform";;
import Rateanalytics from "../components/Rateanalytics";
import Table from "../components/Table";
import Topbar from "../components/Topbar";
import { getRoleFlags, zonesMatch } from "../utils/role";

const Neccrate = () => {
  // Add state for selected outlet tab
  const [selectedOutletId, setSelectedOutletId] = useState("");
  // all the props are mentioned here
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  // For supervisor, treat as data agent for form visibility
  const showForms = isAdmin || isDataAgent || isSupervisor;

  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);

  // formOutlets: zone-filtered for data entry
  const formOutlets = useMemo(() => {
    if (zone && Array.isArray(outlets)) {
      return outlets.filter(o => typeof o === 'object' && zonesMatch(o.zoneId, zone));
    }
    return outlets;
  }, [outlets, zone]);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load outlets from backend (zone-specific for any user with zone)
  useEffect(() => {
    const loadOutlets = async () => {
      try {
        // Always load all outlets for display
        const url = `${API_URL}/outlets/all`;
        console.log('Neccrate loadOutlets URL:', url);
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setOutlets(data);
            localStorage.setItem("egg_outlets_v1", JSON.stringify(data));
          } else {
            setOutlets([]);
          }
        } else {
          setOutlets([]);
        }
      } catch (err) {
        // fallback to localStorage
        const saved = localStorage.getItem("egg_outlets_v1");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setOutlets(parsed);
            } else {
              setOutlets([]);
            }
          } catch {
            setOutlets([]);
          }
        } else {
          setOutlets([]);
        }
      }
    };
    loadOutlets();
  }, []);

  const blockedDates = rows.map((row) => row.date);

  // Filter data based on date range or show latest 7 entries
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

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${API_URL}/neccrate/all`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data.map(d => ({ id: d.id, ...d })) : []);
      } catch {
        setRows([]);
      }
      setIsLoaded(true);
    };
    fetchRates();
  }, []);

  /* ================= EDIT HANDLERS (ADMIN ONLY) ================= */

  const handleEditClick = (row) => {
    if (!isAdmin) return;

    const fullRow = { ...row };
    if (!row.id) {
      const found = rows.find(r => r.date === row.date);
      if (found?.id) fullRow.id = found.id;
    }

    setEditRow(fullRow);
    setEditValues({ rate: row.rate, remarks: row.remarks });
    setEditModalOpen(true);
  };

  const handleEditValueChange = (name, value) => {
    setEditValues((prev) => ({ ...prev, [name]: value }));
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

    try {
      const response = await fetch(`${API_URL}/neccrate/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editRow.date,
          rate: editValues.rate,
          remarks: editValues.remarks,
        }),
      });

      if (!response.ok) {
        alert("Failed to update entry");
        return;
      }

      const res = await fetch(`${API_URL}/neccrate/all`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map(d => ({ id: d.id, ...d })) : []);

      handleEditCancel();
    } catch (err) {
      alert("Error updating entry: " + err.message);
    }
  };

  /* ================= ADD ENTRY ================= */

  const addRow = async (newRow) => {
    try {
      const response = await fetch(`${API_URL}/neccrate/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRow),
      });

      if (!response.ok) {
        alert("Failed to add entry");
        return;
      }

      // Refetch all data after adding
      const res = await fetch(`${API_URL}/neccrate/all`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map(d => ({ id: d.id, ...d })) : []);
    } catch (err) {
      console.error("Error adding NECC rate:", err);
      alert("Error adding entry");
    }
  };

  /* ================= UI ================= */

  return (
    <div className="bg-eggBg min-h-screen p-6">
      <Topbar />


      {/* ================= ENTRY FORM (ADMIN + DATA AGENT + SUPERVISOR) ================= */}
      {showForms && formOutlets.length > 0 && (
        <div className="mt-4 mb-8">
          {!isViewer && (
            <Entryform
              addRow={addRow}
              blockedDates={blockedDates}
              rows={rows}
              outlets={formOutlets}
            />
          )}

          {/* ================= ANALYTICS (ADMIN + VIEWER + DATA AGENT + SUPERVISOR) ================= */}
          {(isAdmin || isViewer || isDataAgent || isSupervisor) && <Rateanalytics rows={rows}/>}

          {/* ================= TABLE (ADMIN + VIEWER + DATA AGENT + SUPERVISOR) ================= */}
          {(isAdmin || isViewer || isDataAgent || isSupervisor) && outlets.length > 0 && (
            <div className="mt-8">
              <NeccMatrixTable rows={filteredRows} outlets={outlets} />
            </div>
          )}

          {/* ================= EDIT MODAL (ADMIN ONLY) ================= */}
          {isAdmin && editModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-xl shadow-lg p-6 min-w-[320px]">
                <h2 className="text-lg font-semibold mb-4">
                  Edit NECC Rate ({editRow.date})
                </h2>

                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <label className="w-24 text-xs font-medium">Outlet</label>
                    <select
                      value={editValues.outletId || ""}
                      onChange={e => handleEditValueChange("outletId", e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2 text-xs"
                    >
                      <option value="">Select outlet</option>
                      {formOutlets.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-24 text-xs font-medium">Rate</label>
                    <input
                      type="text"
                      value={editValues.rate || ""}
                      onChange={(e) =>
                        handleEditValueChange("rate", e.target.value)
                      }
                      className="flex-1 border rounded-lg px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex gap-2 items-center">
                    <label className="w-24 text-xs font-medium">Remarks</label>
                    <input
                      type="text"
                      value={editValues.remarks || ""}
                      onChange={(e) =>
                        handleEditValueChange("remarks", e.target.value)
                      }
                      className="flex-1 border rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={handleEditCancel}
                    className="px-4 py-2 bg-gray-200 rounded-lg text-xs hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No outlets warning */}
      {showForms && formOutlets.length === 0 && (
        <div className="mt-4 mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-sm text-yellow-800">No outlets available. Please add outlets first.</p>
        </div>
      )}
    </div>
  );
};

export default Neccrate;