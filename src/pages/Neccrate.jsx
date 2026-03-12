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

/** Parse a rate value that may be a number, "₹34.00 per egg" string, or anything else */
const parseRate = (doc) => {
  // If rate is already a plain number, it's the most recent value (set directly by edit)
  if (typeof doc.rate === "number" && !isNaN(doc.rate)) return doc.rate;
  // If rateValue is a valid number, use it (set on add)
  if (typeof doc.rateValue === "number" && !isNaN(doc.rateValue)) return doc.rateValue;
  // Fallback: parse formatted string like "₹34.00 per egg"
  const val = doc.rate ?? doc.rateValue;
  if (val == null) return 0;
  const n = Number(val);
  if (!isNaN(n)) return n;
  const m = String(val).match(/[\d.]+/);
  return m ? Number(m[0]) || 0 : 0;
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
    console.log('Neccrate - fetching outlets from:', url, '| isSupervisor:', isSupervisor, '| zone:', zone);
    fetch(url, { headers })
      .then(r => {
        if (!r.ok) {
          console.warn('Neccrate - outlets fetch failed:', r.status, r.statusText);
          // Fallback to all outlets if zone-specific fetch fails
          if (isSupervisor && zone) {
            return fetch(`${API_URL}/outlets/all`, { headers }).then(r2 => r2.json());
          }
        }
        return r.json();
      })
      .then(d => {
        console.log('Neccrate - outlets loaded:', Array.isArray(d) ? d.length : 0);
        setOutlets(Array.isArray(d) ? d : []);
      })
      .catch(err => {
        console.error('Neccrate - outlets fetch error:', err);
        setOutlets([]);
      });
  }, [isSupervisor, zone]);

  /* ---- fetch NECC rates ---- */
  const fetchRates = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res  = await fetch(`${API_URL}/neccrate/all`, { headers });
      const data = await res.json();
      console.log('Neccrate - rates loaded:', Array.isArray(data) ? data.length : 0);
      setRawRows(Array.isArray(data) ? data.map(d => ({ id: d.id || d._id, ...d })) : []);
    } catch (err) {
      console.error('Neccrate - rates fetch error:', err);
      setRawRows([]);
    }
  };

  useEffect(() => { fetchRates(); }, []);

  /* ---- for supervisors: filter raw rows to only include outlets in their zone ---- */
  const filteredRawRows = useMemo(() => {
    if (!isSupervisor) return rawRows;
    // If outlets not loaded yet or empty, show all rates to avoid blank display
    if (!outlets || outlets.length === 0) return rawRows;
    try {
      // Build a set of ALL possible outlet identifiers (id, name, area) for matching
      const zoneKeys = new Set();
      outlets.forEach(o => {
        if (o.id) zoneKeys.add(o.id);
        if (o.name) zoneKeys.add(o.name);
        if (o.area) zoneKeys.add(o.area);
        // Also add lowercase versions for case-insensitive matching
        if (o.name) zoneKeys.add(o.name.toUpperCase());
        if (o.area) zoneKeys.add(o.area.toUpperCase());
      });
      console.log('Neccrate - zoneKeys for filtering:', [...zoneKeys]);
      return rawRows.filter(doc => {
        // Check outlet field with case-insensitive matching
        if (doc.outlet) {
          const outletUpper = doc.outlet.toUpperCase?.() || doc.outlet;
          if (zoneKeys.has(doc.outlet) || zoneKeys.has(outletUpper)) return true;
        }
        if (doc.outlets && typeof doc.outlets === 'object') {
          return Object.keys(doc.outlets).some(k => {
            const keyUpper = k.toUpperCase?.() || k;
            return zoneKeys.has(k) || zoneKeys.has(keyUpper);
          });
        }
        return false;
      });
    } catch (e) { return rawRows; }
  }, [rawRows, outlets, isSupervisor]);

  /* ---- outlet display name helper ----
     Outlets are stored by id/area/name. We try to match to the outlets list
     and return the human-readable name. Fallback: use the key as-is (already a name). */
  const getOutletName = (key) => {
    if (!key) return key;
    const keyUpper = key.toUpperCase?.() || key;
    const keyLower = key.toLowerCase?.() || key;
    const found = outlets.find(o =>
      o.id === key || o.id === keyUpper || o.id === keyLower ||
      o.area === key || o.area?.toUpperCase() === keyUpper ||
      o.name === key || o.name?.toUpperCase() === keyUpper
    );
    return found ? (found.name || found.area || key) : key;
  };

  /* ---- derive ordered outlet columns from outlet list ONLY ----
     Use the outlets list as the source of truth. Only show outlets that currently exist.
     Use NAME as canonical key since NECC rates store outlet by name */
  const outletColumns = useMemo(() => {
    const ordered = [];
    const seen = new Set();
    
    outlets.forEach(o => {
      // Use name as canonical key (uppercased for consistency) since NECC rates store by name
      const canonicalKey = (o.name || o.area || o.id).toUpperCase();
      if (!seen.has(canonicalKey)) {
        seen.add(canonicalKey);
        ordered.push(canonicalKey);
      }
    });
    
    return ordered;
  }, [outlets]);

  /* ---- Build a map to normalize any outlet identifier to canonical key ---- */
  const outletKeyMap = useMemo(() => {
    const map = new Map();
    outlets.forEach(o => {
      // Use name as canonical key (uppercased for consistency)
      const canonicalKey = (o.name || o.area || o.id).toUpperCase();
      // Map all variations (case-insensitive) to the canonical key
      if (o.id) {
        map.set(o.id, canonicalKey);
        map.set(o.id.toUpperCase(), canonicalKey);
      }
      if (o.area) {
        map.set(o.area, canonicalKey);
        map.set(o.area.toUpperCase(), canonicalKey);
        map.set(o.area.toLowerCase(), canonicalKey);
      }
      if (o.name) {
        map.set(o.name, canonicalKey);
        map.set(o.name.toUpperCase(), canonicalKey);
        map.set(o.name.toLowerCase(), canonicalKey);
      }
    });
    return map;
  }, [outlets]);

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
        // Normalize the outlet key - try multiple case variations
        let normalizedKey = outletKeyMap.get(doc.outlet);
        if (!normalizedKey && doc.outlet.toUpperCase) {
          normalizedKey = outletKeyMap.get(doc.outlet.toUpperCase()) || 
                          outletKeyMap.get(doc.outlet.toLowerCase());
        }
        normalizedKey = normalizedKey || doc.outlet.toUpperCase?.() || doc.outlet;
        pivotMap[date][normalizedKey] = {
          rate: parseRate(doc),
          docId,
          remarks: doc.remarks || ""
        };
      } else if (doc.outlets && typeof doc.outlets === "object") {
        // outlets-map format: { date, outlets: { A: rate, B: rate } }
        Object.entries(doc.outlets).forEach(([outletKey, rate]) => {
          let normalizedKey = outletKeyMap.get(outletKey);
          if (!normalizedKey && outletKey.toUpperCase) {
            normalizedKey = outletKeyMap.get(outletKey.toUpperCase()) ||
                            outletKeyMap.get(outletKey.toLowerCase());
          }
          normalizedKey = normalizedKey || outletKey.toUpperCase?.() || outletKey;
          pivotMap[date][normalizedKey] = { rate: parseRate({ rate }), docId, remarks: doc.remarks || "" };
        });
      }
    });

    const sortedDates = Object.keys(pivotMap).sort((a, b) => new Date(a) - new Date(b));
    return { pivotMap, sortedDates };
  }, [filteredRawRows, outletKeyMap]);

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
      const r = dateData[key]?.rate;
      vals[key] = (r != null && !isNaN(r) && r !== 0) ? r : "";
    });
    setEditValues(vals);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    const { date, dateData } = editRow;
    const token = localStorage.getItem('token');
    const authHeaders = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const patchTasks = [];  // update existing records
    const postTasks  = [];  // create new records

    outletColumns.forEach(outletKey => {
      const rawVal = editValues[outletKey];
      // Skip empty or invalid values
      if (rawVal === "" || rawVal === undefined || rawVal === null) return;
      const numRate = Number(rawVal);
      if (isNaN(numRate)) return;

      const existing = dateData[outletKey];
      if (existing && existing.docId) {
        // PATCH existing record
        patchTasks.push(
          fetch(`${API_URL}/neccrate/${existing.docId}`, {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify({ date, outlet: outletKey, rate: numRate, remarks: existing.remarks || "" }),
          })
        );
      } else {
        // POST new record for this outlet+date
        postTasks.push(
          fetch(`${API_URL}/neccrate/add`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ date, outlet: outletKey, rate: numRate, remarks: "" }),
          })
        );
      }
    });

    try {
      const results = await Promise.all([...patchTasks, ...postTasks]);
      for (const r of results) {
        if (!r.ok) { alert("Failed to save one or more entries"); return; }
      }
      await fetchRates();
      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    } catch (err) {
      alert("Error saving entries: " + err.message);
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
                          {(() => {
                            const val = Number(dateData[key]?.rate ?? 0);
                            return val.toLocaleString("en-IN");
                          })()}
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
                    className="flex-1 border border-gray-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
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