const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";
import { getThisWeekRange } from "../utils/dateRange";
import * as XLSX from "xlsx";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";

const OUTLETS_KEY = "egg_outlets_v1";
const REMARKS_KEY = "egg_remarks_v1";

const RemarksPage = () => {
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  const defaultWeekRange = useMemo(() => getThisWeekRange(), []);
  const showTable = isAdmin || isViewer || isDataAgent || isSupervisor;
  const isReadOnly = isViewer;

  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [outletLoading, setOutletLoading] = useState(true);

  const formOutlets = useMemo(() => {
    let list = outlets;
    if (!isViewer && !isAdmin && zone && Array.isArray(list)) {
      list = list.filter((o) => typeof o === "object" && zonesMatch(o.zoneId, zone));
    }
    return list;
  }, [outlets, isAdmin, isViewer, zone]);

  const displayedOutlets = isSupervisor ? formOutlets : outlets;

  const [fromDate, setFromDate] = useState(defaultWeekRange.from);
  const [toDate, setToDate] = useState(defaultWeekRange.to);

  const fetchRemarks = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/remarks/all`);
      if (!res.ok) {
        setRows([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped = data.map((d) => ({ id: d.id, ...d }));
        setRows(mapped);
        localStorage.setItem(REMARKS_KEY, JSON.stringify(mapped));
      } else {
        setRows([]);
      }
    } catch (err) {
      console.error("Error fetching remarks:", err);
      const saved = localStorage.getItem(REMARKS_KEY);
      if (saved) {
        try {
          setRows(JSON.parse(saved));
        } catch {
          setRows([]);
        }
      } else {
        setRows([]);
      }
    }
  }, []);

  useEffect(() => {
    fetchRemarks();
    const interval = setInterval(fetchRemarks, 30000);
    return () => clearInterval(interval);
  }, [fetchRemarks]);

  const loadOutlets = useCallback(async () => {
    setOutletLoading(true);
    try {
      const res = await fetch(`${API_URL}/outlets/all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setOutlets(data);
          localStorage.setItem(OUTLETS_KEY, JSON.stringify(data));
        } else {
          throw new Error("Empty outlets response");
        }
      } else {
        throw new Error("Failed to fetch outlets");
      }
    } catch {
      const saved = localStorage.getItem(OUTLETS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setOutlets(parsed);
          else setOutlets([]);
        } catch {
          setOutlets([]);
        }
      } else {
        setOutlets([]);
      }
    } finally {
      setOutletLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (fromDate && toDate) {
      return sorted.filter((r) => {
        const d = new Date(r.date);
        return d >= new Date(fromDate) && d <= new Date(toDate);
      });
    }
    if (fromDate) return sorted.filter((r) => new Date(r.date) >= new Date(fromDate));
    if (toDate) return sorted.filter((r) => new Date(r.date) <= new Date(toDate));
    return sorted;
  }, [rows, fromDate, toDate]);

  const getOutletRemark = (row, outletId) => {
    const outletsObj = row?.outlets || {};
    const outletMeta = displayedOutlets.find((o) => (typeof o === "string" ? o : o.id) === outletId);
    const area = outletMeta?.area || outletMeta?.name || outletId;
    const value = outletsObj[outletId] ?? (area && outletsObj[area]);
    return String(value ?? "").trim();
  };

  const handleDownload = () => {
    if (!filteredRows.length) {
      alert("No data available");
      return;
    }

    const data = filteredRows.map((row) => {
      const obj = { Date: row.date };
      displayedOutlets.forEach((o) => {
        const area = o.area || o;
        obj[area] = String(row.outlets?.[area] ?? "");
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Remarks");
    XLSX.writeFile(wb, "Remarks_Report.xlsx");
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

        {showTable && (
          <>
            <Dailyheader
              title={"Remarks Entry"}
              subtitle={isReadOnly ? "View daily remarks entries." : "Manage and track daily remarks entries."}
              dailySalesData={filteredRows}
              fromDate={fromDate}
              toDate={toDate}
              setFromDate={setFromDate}
              setToDate={setToDate}
              allRows={rows}
              onExport={handleDownload}
            />

            {isReadOnly && (
              <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                Viewer access is read-only on this page. Editing remarks values is disabled.
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl bg-eggWhite shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold text-gray-500">
                    <th className="min-w-[130px] px-4 py-3">DATE</th>
                    {displayedOutlets.map((outlet) => {
                      const outletId = typeof outlet === "string" ? outlet : outlet.id;
                      const outletName = typeof outlet === "string" ? outlet : (outlet.area || outlet.name || outlet.id);
                      return (
                        <th key={outletId} className="px-4 py-3 whitespace-nowrap">
                          {String(outletName || outletId).toUpperCase()}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row, index) => (
                      <tr key={`${row.date || index}`} className={`text-xs text-gray-700 md:text-sm ${index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                        <td className="whitespace-nowrap px-4 py-3">{row.date}</td>
                        {displayedOutlets.map((outlet) => {
                          const outletId = typeof outlet === "string" ? outlet : outlet.id;
                          return (
                            <td key={outletId} className="whitespace-nowrap px-4 py-3">
                              {getOutletRemark(row, outletId) || "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={Math.max(displayedOutlets.length + 1, 2)} className="py-8 text-center text-gray-500 text-sm bg-white">
                        No remarks found for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RemarksPage;
