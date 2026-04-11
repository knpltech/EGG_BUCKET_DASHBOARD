const API_URL = import.meta.env.VITE_API_URL;

import { useState, useEffect, useMemo } from "react";
import Rateanalytics from "../components/Rateanalytics";
import Topbar from "../components/Topbar";
import { getRoleFlags } from "../utils/role";
import { getThisWeekRange } from "../utils/dateRange";

const normalizeDate = (d) => {
  try {
    const n = new Date(d);
    if (!Number.isNaN(n.getTime())) return n.toISOString().slice(0, 10);
  } catch {}
  return String(d || "").slice(0, 10);
};

const formatDisplayDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const getOutletKey = (doc) => doc?.outlet || doc?.outletId || "";

const parseRateValue = (doc) => {
  if (typeof doc?.rateValue === "number" && Number.isFinite(doc.rateValue)) return doc.rateValue;
  if (typeof doc?.rate === "number" && Number.isFinite(doc.rate)) return doc.rate;
  if (typeof doc?.rate === "string") {
    const parsed = Number(doc.rate.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeTextKey = (value) => String(value || "").trim().toUpperCase();

const Neccrate = () => {
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  const defaultWeekRange = useMemo(() => getThisWeekRange(), []);

  const [rawRows, setRawRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [fromDate, setFromDate] = useState(defaultWeekRange.from);
  const [toDate, setToDate] = useState(defaultWeekRange.to);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const url = isSupervisor && zone ? `${API_URL}/outlets/zone/${zone}` : `${API_URL}/outlets/all`;

    fetch(url, { headers })
      .then((r) => {
        if (!r.ok && isSupervisor && zone) {
          return fetch(`${API_URL}/outlets/all`, { headers }).then((fallback) => fallback.json());
        }
        return r.json();
      })
      .then((d) => setOutlets(Array.isArray(d) ? d : []))
      .catch(() => setOutlets([]));
  }, [isSupervisor, zone]);

  const fetchRates = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`${API_URL}/neccrate/all`, { headers });
      const data = await res.json();
      setRawRows(Array.isArray(data) ? data.map((d) => ({ id: d.id || d._id, ...d })) : []);
    } catch {
      setRawRows([]);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const outletKeyMap = useMemo(() => {
    const map = new Map();

    outlets.forEach((o) => {
      const canonicalKey = normalizeTextKey(o.name || o.area || o.id);
      if (!canonicalKey) return;

      [o.id, o.area, o.name].forEach((value) => {
        const normalized = normalizeTextKey(value);
        if (normalized) map.set(normalized, canonicalKey);
      });
    });

    return map;
  }, [outlets]);

  const filteredRawRows = useMemo(() => {
    if (!isSupervisor || outlets.length === 0) return rawRows;

    try {
      const zoneKeys = new Set();
      outlets.forEach((o) => {
        [o.id, o.area, o.name].forEach((value) => {
          const normalized = normalizeTextKey(value);
          if (normalized) zoneKeys.add(normalized);
        });
      });

      return rawRows.filter((doc) => {
        const outletKey = normalizeTextKey(getOutletKey(doc));
        if (outletKey && zoneKeys.has(outletKey)) return true;

        if (doc.outlets && typeof doc.outlets === "object") {
          return Object.keys(doc.outlets).some((key) => zoneKeys.has(normalizeTextKey(key)));
        }

        return false;
      });
    } catch {
      return rawRows;
    }
  }, [rawRows, outlets, isSupervisor]);

  const getOutletName = (key) => {
    const normalizedKey = normalizeTextKey(key);
    const found = outlets.find((o) =>
      [o.id, o.area, o.name].some((value) => normalizeTextKey(value) === normalizedKey)
    );
    return found ? found.name || found.area || key : key;
  };

  const outletColumns = useMemo(() => {
    const ordered = [];
    const seen = new Set();

    outlets.forEach((o) => {
      const canonicalKey = normalizeTextKey(o.name || o.area || o.id);
      if (canonicalKey && !seen.has(canonicalKey)) {
        seen.add(canonicalKey);
        ordered.push(canonicalKey);
      }
    });

    filteredRawRows.forEach((doc) => {
      const outletKey = outletKeyMap.get(normalizeTextKey(getOutletKey(doc))) || normalizeTextKey(getOutletKey(doc));
      if (outletKey && !seen.has(outletKey)) {
        seen.add(outletKey);
        ordered.push(outletKey);
      }
      if (doc.outlets && typeof doc.outlets === "object") {
        Object.keys(doc.outlets).forEach((key) => {
          const normalizedKey = outletKeyMap.get(normalizeTextKey(key)) || normalizeTextKey(key);
          if (normalizedKey && !seen.has(normalizedKey)) {
            seen.add(normalizedKey);
            ordered.push(normalizedKey);
          }
        });
      }
    });

    return ordered;
  }, [outlets, filteredRawRows, outletKeyMap]);

  const { pivotMap, sortedDates } = useMemo(() => {
    const nextPivotMap = {};

    filteredRawRows.forEach((doc) => {
      const date = normalizeDate(doc.date || doc.createdAt);
      const docId = doc.id;
      const outletKey = getOutletKey(doc);
      const parsedRate = parseRateValue(doc);

      if (!nextPivotMap[date]) nextPivotMap[date] = {};

      if (outletKey) {
        const normalizedKey = outletKeyMap.get(normalizeTextKey(outletKey)) || normalizeTextKey(outletKey);
        nextPivotMap[date][normalizedKey] = {
          rate: parsedRate,
          docId,
          remarks: doc.remarks || "",
        };
        return;
      }

      if (doc.outlets && typeof doc.outlets === "object") {
        Object.entries(doc.outlets).forEach(([key, rate]) => {
          const parsed = Number(rate);
          const normalizedKey = outletKeyMap.get(normalizeTextKey(key)) || normalizeTextKey(key);
          nextPivotMap[date][normalizedKey] = {
            rate: Number.isFinite(parsed) ? parsed : null,
            docId,
            remarks: doc.remarks || "",
          };
        });
      }
    });

    const nextSortedDates = Object.keys(nextPivotMap).sort((a, b) => new Date(a) - new Date(b));
    return { pivotMap: nextPivotMap, sortedDates: nextSortedDates };
  }, [filteredRawRows, outletKeyMap]);

  const filteredDates = useMemo(() => {
    return sortedDates.filter((date) => {
      const d = new Date(date);
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate && d > new Date(toDate)) return false;
      return true;
    });
  }, [sortedDates, fromDate, toDate]);

  const handleEditClick = (date) => {
    if (!isAdmin) return;

    const dateData = pivotMap[date] || {};
    const values = {};
    outletColumns.forEach((key) => {
      const value = dateData[key]?.rate;
      values[key] = value !== null && value !== undefined ? value : "";
    });

    setEditRow({ date, dateData });
    setEditValues(values);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (isEditSaving) return;

    const { date, dateData } = editRow;
    const token = localStorage.getItem("token");
    const authHeaders = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const patchTasks = [];
    const postTasks = [];

    outletColumns.forEach((outletKey) => {
      const rawValue = editValues[outletKey];
      if (rawValue === "" || rawValue === undefined || rawValue === null) return;

      const numericRate = Number(rawValue);
      if (!Number.isFinite(numericRate)) return;

      const existing = dateData[outletKey];
      if (existing?.docId) {
        patchTasks.push(
          fetch(`${API_URL}/neccrate/${existing.docId}`, {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify({
              date,
              outletId: outletKey,
              rate: numericRate,
              remarks: existing.remarks || "",
            }),
          })
        );
      } else {
        postTasks.push(
          fetch(`${API_URL}/neccrate/add`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              date,
              outletId: outletKey,
              rate: numericRate,
              remarks: "",
            }),
          })
        );
      }
    });

    setIsEditSaving(true);
    try {
      const results = await Promise.all([...patchTasks, ...postTasks]);
      for (const result of results) {
        if (!result.ok) {
          alert("Failed to save one or more entries");
          return;
        }
      }

      await fetchRates();
      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    } catch (err) {
      alert(`Error saving entries: ${err.message}`);
    } finally {
      setIsEditSaving(false);
    }
  };

  const editTotal = useMemo(() => {
    return Object.values(editValues).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }, [editValues]);

  const totalCols = 1 + outletColumns.length + (isAdmin ? 1 : 0);

  return (
    <div className="bg-eggBg min-h-screen p-6">
      <Topbar />

      {(isAdmin || isViewer || isDataAgent || isSupervisor) && (
        <Rateanalytics rows={filteredRawRows} outlets={outlets} />
      )}

      {(isAdmin || isViewer || isDataAgent || isSupervisor) && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800 flex-1">NECC Rates</h2>

            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500 md:text-sm">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
              />
            </div>

            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500 md:text-sm">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
              />
            </div>

            {(fromDate || toDate) && (
              <button
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 md:text-sm"
              >
                Clear
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-5 py-3 font-semibold text-gray-700 whitespace-nowrap">Date</th>
                  {outletColumns.map((key) => (
                    <th key={key} className="px-5 py-3 font-semibold text-gray-700 whitespace-nowrap uppercase">
                      {getOutletName(key)}
                    </th>
                  ))}
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
                ) : (
                  filteredDates.map((date) => {
                    const dateData = pivotMap[date] || {};

                    return (
                      <tr key={date} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-5 py-4 text-gray-700 font-medium whitespace-nowrap">
                          {formatDisplayDate(date)}
                        </td>
                        {outletColumns.map((key) => (
                          <td key={key} className="px-5 py-4 text-gray-700 whitespace-nowrap">
                            {dateData[key]?.rate !== null && dateData[key]?.rate !== undefined
                              ? Number(dateData[key].rate).toLocaleString("en-IN")
                              : <span className="text-gray-300">—</span>}
                          </td>
                        ))}
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
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {filteredDates.length} date{filteredDates.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {isAdmin && editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h2 className="text-base font-semibold mb-1 text-gray-900">Edit NECC Rates</h2>
            <p className="text-xs text-gray-500 mb-4">{formatDisplayDate(editRow.date)}</p>

            <div className="space-y-3">
              {outletColumns.map((key) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="w-full sm:w-36 text-xs font-medium text-gray-700 shrink-0 uppercase">
                    {getOutletName(key)}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editValues[key] ?? ""}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 border border-gray-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-xs font-semibold text-gray-600">Total</span>
              <span className="text-sm font-bold text-orange-600">
                {editTotal.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: editTotal % 1 ? 2 : 0,
                })}
              </span>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditRow({});
                  setEditValues({});
                  setIsEditSaving(false);
                }}
                disabled={isEditSaving}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={isEditSaving}
                className="px-5 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
              >
                {isEditSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Neccrate;
