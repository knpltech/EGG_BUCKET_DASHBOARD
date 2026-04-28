const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";
import { getThisWeekRange } from "../utils/dateRange";
import * as XLSX from "xlsx";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";

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
        setRows(data.map((d) => ({ id: d.id, ...d })));
      } else {
        setRows([]);
      }
    } catch (err) {
      console.error("Error fetching remarks:", err);
      setRows([]);
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
      const data = await res.json();
      if (Array.isArray(data)) setOutlets(data);
      else setOutlets([]);
    } catch (err) {
      setOutlets([]);
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

            <DailyTable
              rows={filteredRows}
              outlets={displayedOutlets.map((o) => (typeof o === "string" ? o : o.id))}
              allOutlets={outlets}
              showRupee={false}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default RemarksPage;
