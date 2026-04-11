const API_URL = import.meta.env.VITE_API_URL;

import { useState, useEffect, useMemo } from "react";
import Rateanalytics from "../components/Rateanalytics";
import Topbar from "../components/Topbar";
import { getRoleFlags } from "../utils/role";

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

const Neccrate = () => {
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();

  const [rawRows, setRawRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const url = isSupervisor && zone ? `${API_URL}/outlets/zone/${zone}` : `${API_URL}/outlets/all`;

    fetch(url, { headers })
      .then((r) => r.json())
      .then((d) => setOutlets(Array.isArray(d) ? d : []))
      .catch(() => setOutlets([]));
  }, [isSupervisor, zone]);

  const fetchRates = async () => {
    try {
      const res = await fetch(`${API_URL}/neccrate/all`);
      const data = await res.json();
      setRawRows(Array.isArray(data) ? data.map((d) => ({ id: d.id || d._id, ...d })) : []);
    } catch {
      setRawRows([]);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const filteredRawRows = useMemo(() => {
    if (!isSupervisor) return rawRows;
    try {
      const zoneKeys = new Set(outlets.map((o) => o.id || o.area || o.name));
      return rawRows.filter((doc) => {
        const outletKey = getOutletKey(doc);
        if (outletKey && zoneKeys.has(outletKey)) return true;
        if (doc.outlets && typeof doc.outlets === "object") {
          return Object.keys(doc.outlets).some((key) => zoneKeys.has(key));
        }
        return false;
      });
    } catch {
      return rawRows;
    }
  }, [rawRows, outlets, isSupervisor]);

  const getOutletName = (key) => {
    const found = outlets.find((o) => o.id === key || o.area === key || o.name === key);
    return found ? found.name || found.area || key : key;
  };

  const outletColumns = useMemo(() => {
    const keysInData = new Set();

    filteredRawRows.forEach((doc) => {
      const outletKey = getOutletKey(doc);
      if (outletKey) keysInData.add(outletKey);
      if (doc.outlets && typeof doc.outlets === "object") {
        Object.keys(doc.outlets).forEach((key) => keysInData.add(key));
      }
    });

    const ordered = [];
    outlets.forEach((o) => {
      const key = o.id || o.area || o.name;
      if (keysInData.has(key)) ordered.push(key);
    });
    keysInData.forEach((key) => {
      if (!ordered.includes(key)) ordered.push(key);
    });

    return ordered;
  }, [filteredRawRows, outlets]);

  const { pivotMap, sortedDates } = useMemo(() => {
    const nextPivotMap = {};

    filteredRawRows.forEach((doc) => {
      const date = normalizeDate(doc.date || doc.createdAt);
      const docId = doc.id;
      const outletKey = getOutletKey(doc);
      const parsedRate = parseRateValue(doc);

      if (!nextPivotMap[date]) nextPivotMap[date] = {};

      if (outletKey) {
        nextPivotMap[date][outletKey] = {
          rate: parsedRate,
          docId,
          remarks: doc.remarks || "",
        };
        return;
      }

      if (doc.outlets && typeof doc.outlets === "object") {
        Object.entries(doc.outlets).forEach(([key, rate]) => {
          const parsed = Number(rate);
          nextPivotMap[date][key] = {
            rate: Number.isFinite(parsed) ? parsed : null,
            docId,
            remarks: doc.remarks || "",
          };
        });
      }
    });

    const nextSortedDates = Object.keys(nextPivotMap).sort((a, b) => new Date(a) - new Date(b));
    return { pivotMap: nextPivotMap, sortedDates: nextSortedDates };
  }, [filteredRawRows]);

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
      values[key] = dateData[key]?.rate ?? "";
    });

    setEditRow({ date, dateData });
    setEditValues(values);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    const { date, dateData } = editRow;
    const docUpdates = {};

    outletColumns.forEach((outletKey) => {
      const existing = dateData[outletKey];
      const newRate = editValues[outletKey];

      if (existing?.docId) {
        docUpdates[existing.docId] = {
          outletId: outletKey,
          rate: Number(newRate),
          remarks: existing.remarks,
        };
      }
    });

    try {
      const tasks = Object.entries(docUpdates).map(([docId, payload]) =>
        fetch(`${API_URL}/neccrate/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, ...payload }),
        })
      );

      const results = await Promise.all(tasks);
      for (const result of results) {
        if (!result.ok) {
          alert("Failed to update one or more entries");
          return;
        }
      }

      await fetchRates();
      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    } catch (err) {
      alert(`Error updating entries: ${err.message}`);
    }
  };

  const totalCols = 1 + outletColumns.length + 1 + (isAdmin ? 1 : 0);

  return (
    <div className="bg-eggBg min-h-screen p-6">
      <Topbar />

      {(isAdmin || isViewer || isDataAgent || isSupervisor) && (
        <Rateanalytics rows={filteredRawRows} />
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
                ) : (
                  filteredDates.map((date) => {
                    const dateData = pivotMap[date] || {};
                    const rowTotal = outletColumns.reduce((sum, key) => sum + (Number(dateData[key]?.rate) || 0), 0);

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
                <div key={key} className="flex items-center gap-3">
                  <label className="w-36 text-xs font-medium text-gray-700 shrink-0 uppercase">
                    {getOutletName(key)}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editValues[key] ?? ""}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    disabled={!editRow.dateData?.[key]}
                    className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                      editRow.dateData?.[key]
                        ? "border-gray-900"
                        : "border-gray-200 bg-gray-50 cursor-not-allowed text-gray-400"
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditRow({});
                  setEditValues({});
                }}
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
