const API_URL = import.meta.env.VITE_API_URL;

import { useState, useEffect, useMemo } from "react";
import Rateanalytics from "../components/Rateanalytics";
import Topbar from "../components/Topbar";
import { getRoleFlags } from "../utils/role";

/* ================= helpers ================= */
const normalizeDate = (d) => {
  try {
    const n = new Date(d);
    if (!isNaN(n.getTime())) return n.toISOString().slice(0, 10);
  } catch (e) {}
  return String(d || "").slice(0, 10);
};

const formatDisplayDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/* ================= Neccrate page ================= */
const Neccrate = () => {
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();

  const [rawRows,       setRawRows]       = useState([]);
  const [outlets,       setOutlets]       = useState([]); // full outlet list with names
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow,       setEditRow]       = useState({});  // { date, outletKey, rate, remarks, docId }
  const [editValues,    setEditValues]    = useState({});
  const [fromDate,      setFromDate]      = useState("");
  const [toDate,        setToDate]        = useState("");

  /* ---- fetch outlets (to get display names) ---- */
  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const url = (isSupervisor && zone) ? `${API_URL}/outlets/zone/${zone}` : `${API_URL}/outlets/all`;
    fetch(url, { headers })
      .then(r => r.json())
      .then(d => setOutlets(Array.isArray(d) ? d : []))
      .catch(() => setOutlets([]));
  }, [isSupervisor, zone]);

  /* ---- fetch NECC rates ---- */
  const fetchRates = async () => {
    try {
      const res  = await fetch(`${API_URL}/neccrate/all`);
      const data = await res.json();
      setRawRows(Array.isArray(data) ? data.map(d => ({ id: d.id || d._id, ...d })) : []);
    } catch {
      setRawRows([]);
    }
  };

  useEffect(() => { fetchRates(); }, []);

  /* ---- for supervisors: filter raw rows to only include outlets in their zone ---- */
  const filteredRawRows = useMemo(() => {
    if (!isSupervisor) return rawRows;
    try {
      const zoneKeys = new Set(outlets.map(o => o.id || o.area || o.name));
      return rawRows.filter(doc => {
        if (doc.outlet && zoneKeys.has(doc.outlet)) return true;
        if (doc.outlets && typeof doc.outlets === 'object') {
          return Object.keys(doc.outlets).some(k => zoneKeys.has(k));
        }
        return false;
      });
    } catch (e) { return rawRows; }
  }, [rawRows, outlets, isSupervisor]);

  /* ---- outlet display name helper ----
     Outlets are stored by id/area/name. We try to match to the outlets list
     and return the human-readable name. Fallback: use the key as-is (already a name). */
  const getOutletName = (key) => {
    const found = outlets.find(o =>
      o.id === key || o.area === key || o.name === key
    );
    return found ? (found.name || found.area || key) : key;
  };

  /* ---- derive ordered outlet columns from data + outlet list ----
     Use the outlets list order if available, then append any extra keys from the data. */
  const outletColumns = useMemo(() => {
    // All outlet keys that appear in the filtered raw data
    const keysInData = new Set();
    filteredRawRows.forEach(doc => {
      if (doc.outlet) keysInData.add(doc.outlet);
      if (doc.outlets && typeof doc.outlets === "object")
        Object.keys(doc.outlets).forEach(k => keysInData.add(k));
    });

    // Order: follow the outlets list, then append any keys not in the list
    const ordered = [];
    outlets.forEach(o => {
      const key = o.id || o.area || o.name;
      if (keysInData.has(key)) ordered.push(key);
    });
    keysInData.forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
    return ordered;
  }, [filteredRawRows, outlets]);

  /* ---- pivot: one row per date with rates per outlet column ----
     pivotMap[date][outletKey] = { rate, docId, remarks } */
  const { pivotMap, sortedDates } = useMemo(() => {
    const pivotMap = {};

    filteredRawRows.forEach(doc => {
      const date  = normalizeDate(doc.date || doc.createdAt);
      const docId = doc.id;

      if (!pivotMap[date]) pivotMap[date] = {};

      if (doc.outlet) {
        // per-outlet format: { date, outlet, rate, rateValue, remarks }
        pivotMap[date][doc.outlet] = {
          rate: doc.rateValue ?? Number(doc.rate) ?? 0,
          docId,
          remarks: doc.remarks || ""
        };
      } else if (doc.outlets && typeof doc.outlets === "object") {
        // outlets-map format: { date, outlets: { A: rate, B: rate } }
        Object.entries(doc.outlets).forEach(([outletKey, rate]) => {
          pivotMap[date][outletKey] = { rate: Number(rate) ?? 0, docId, remarks: doc.remarks || "" };
        });
      }
    });

    const sortedDates = Object.keys(pivotMap).sort((a, b) => new Date(a) - new Date(b));
    return { pivotMap, sortedDates };
  }, [filteredRawRows]);

  /* ---- date-range filter ---- */
  const filteredDates = useMemo(() => {
    return sortedDates.filter(date => {
      const d = new Date(date);
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate   && d > new Date(toDate))   return false;
      return true;
    });
  }, [sortedDates, fromDate, toDate]);

  /* ---- edit: open modal for a specific date+outlet cell ---- */
  const handleEditClick = (date) => {
    if (!isAdmin) return;
    // Collect all outlet rates for this date so admin can edit all at once
    const dateData = pivotMap[date] || {};
    setEditRow({ date, dateData });
    // editValues: { outletKey: rate, ... }
    const vals = {};
    outletColumns.forEach(key => {
      vals[key] = dateData[key]?.rate ?? "";
    });
    setEditValues(vals);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    const { date, dateData } = editRow;

    // For each outlet that already has a docId, patch it; new ones would need a POST
    // Group by docId since multiple outlets can share the same document
    const docUpdates = {}; // docId -> { outlet, rate, remarks }

    outletColumns.forEach(outletKey => {
      const existing = dateData[outletKey];
      const newRate  = editValues[outletKey];
      if (existing && existing.docId) {
        if (!docUpdates[existing.docId]) {
          docUpdates[existing.docId] = { outlet: outletKey, rate: Number(newRate), remarks: existing.remarks };
        }
      }
    });

    try {
      const tasks = Object.entries(docUpdates).map(([docId, payload]) =>
        fetch(`${API_URL}/neccrate/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, ...payload, rate: Number(payload.rate) }),
        })
      );
      const results = await Promise.all(tasks);
      for (const r of results) {
        if (!r.ok) { alert("Failed to update one or more entries"); return; }
      }
      await fetchRates();
      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    } catch (err) {
      alert("Error updating entries: " + err.message);
    }
  };

  const totalCols = 1 + outletColumns.length + 1 + (isAdmin ? 1 : 0); // Date + outlets + Total + Edit

  /* ---- UI ---- */
  return (
    <div className="bg-eggBg min-h-screen p-6">
      <Topbar />

      {/* ================= ANALYTICS ================= */}
      {(isAdmin || isViewer || isDataAgent || isSupervisor) && (
        <Rateanalytics rows={filteredRawRows} />
      )}

      {/* ================= TABLE ================= */}
      {(isAdmin || isViewer || isDataAgent || isSupervisor) && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden">

          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800 flex-1">NECC Rates</h2>

            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500 md:text-sm">From</label>
              <input
                type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
              />
            </div>

            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500 md:text-sm">To</label>
              <input
                type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
              />
            </div>

            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(""); setToDate(""); }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 md:text-sm"
              >
                Clear
              </button>
            )}
          </div>

          {/* Pivoted Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-5 py-3 font-semibold text-gray-700 whitespace-nowrap">Date</th>
                  {outletColumns.map(key => (
                    <th key={key} className="px-5 py-3 font-semibold text-gray-700 whitespace-nowrap uppercase">
                      {getOutletName(key)}
                    </th>
                  ))}
                  <th className="px-5 py-3 font-semibold text-orange-500 whitespace-nowrap">Total</th>
                  {isAdmin && <th className="px-5 py-3 font-semibold text-orange-500 whitespace-nowrap">Edit</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDates.length === 0 ? (
                  <tr>
                    <td colSpan={totalCols} className="px-5 py-10 text-center text-gray-400">
                      No records found
                    </td>
                  </tr>
                ) : filteredDates.map(date => {
                  const dateData = pivotMap[date] || {};
                  const rowTotal = outletColumns.reduce((sum, key) => sum + (Number(dateData[key]?.rate) || 0), 0);

                  return (
                    <tr key={date} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-5 py-4 text-gray-700 font-medium whitespace-nowrap">
                        {formatDisplayDate(date)}
                      </td>
                      {outletColumns.map(key => (
                        <td key={key} className="px-5 py-4 text-gray-700 whitespace-nowrap">
                          {dateData[key] !== undefined ? Number(dateData[key].rate).toLocaleString("en-IN") : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-5 py-4 font-semibold text-orange-500 whitespace-nowrap">
                        {rowTotal.toLocaleString("en-IN")}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleEditClick(date)}
                            className="text-orange-500 font-semibold hover:text-orange-700 text-xs md:text-sm"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {filteredDates.length} date{filteredDates.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* ================= EDIT MODAL ================= */}
      {isAdmin && editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h2 className="text-base font-semibold mb-1 text-gray-900">Edit NECC Rates</h2>
            <p className="text-xs text-gray-500 mb-4">{formatDisplayDate(editRow.date)}</p>

            <div className="space-y-3">
              {outletColumns.map(key => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-36 text-xs font-medium text-gray-700 shrink-0 uppercase">
                    {getOutletName(key)}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editValues[key] ?? ""}
                    onChange={e => setEditValues(p => ({ ...p, [key]: e.target.value }))}
                    disabled={!editRow.dateData?.[key]} // only editable if record exists
                    className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                      editRow.dateData?.[key] ? "border-gray-900" : "border-gray-200 bg-gray-50 cursor-not-allowed text-gray-400"
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setEditModalOpen(false); setEditRow({}); setEditValues({}); }}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="px-5 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Neccrate;