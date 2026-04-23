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
    </div>
  );
};

export default Neccrate;
