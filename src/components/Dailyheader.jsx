import React, { useState, useEffect } from "react";

/* ---------- CONSTANTS ---------- */

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

/* ---------- HELPERS ---------- */

function formatDateDMY(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}

/* CSV DOWNLOAD */
function downloadCSV(data) {
  if (!data.length) {
    alert("No data found for selected range");
    return;
  }

  const headers = Object.keys(data[0]).join(",");
  // Ensure all values are primitives (string/number) for CSV
  const rows = data.map(r => Object.values(r).map(v => (typeof v === 'object' ? JSON.stringify(v) : v)).join(","));
  const csv = [headers, ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "daily-sales.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- ICON ---------- */

function CalendarIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/* ---------- CALENDAR ---------- */

function BaseCalendar({ selectedDate, onSelectDate }) {
  const today = new Date();
  const initial = selectedDate ? new Date(selectedDate) : today;
  const [month, setMonth] = useState(initial.getMonth());
  const [year, setYear] = useState(initial.getFullYear());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const buildISO = (d) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div className="w-72 rounded-2xl border bg-white shadow-xl p-3">
      <div className="flex justify-between mb-2">
        <button onClick={() => setMonth(m => m === 0 ? 11 : m - 1)}>‹</button>
        <div className="text-sm font-medium">{MONTHS[month]} {year}</div>
        <button onClick={() => setMonth(m => m === 11 ? 0 : m + 1)}>›</button>
      </div>

      <div className="grid grid-cols-7 text-xs text-center">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d}>{d}</div>)}
        {days.map((d, i) =>
          d ? (
            <button
              key={i}
              onClick={() => onSelectDate(buildISO(d))}
              className={`p-1 rounded ${
                selectedDate === buildISO(d)
                  ? "bg-green-500 text-white"
                  : "hover:bg-gray-100"
              }`}
            >
              {d}
            </button>
          ) : <div key={i} />
        )}
      </div>
    </div>
  );
}



const Dailyheader = ({ dailySalesData = [] }) => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openCal, setOpenCal] = useState(null); // "from" | "to" | null

  /* ---------- QUICK RANGES ---------- */

  const handleQuickRange = (type) => {
    const today = new Date();

    if (type === "lastWeek") {
      const from = new Date();
      from.setDate(today.getDate() - 7);
      setFromDate(from.toISOString().slice(0,10));
      setToDate(today.toISOString().slice(0,10));
    }

    if (type === "lastMonth") {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(from.toISOString().slice(0,10));
      setToDate(to.toISOString().slice(0,10));
    }
  };

  /* ---------- FILTER & DOWNLOAD ---------- */

  const handleDownload = () => {
    const filtered = dailySalesData.filter(row => {
      const d = new Date(row.date);
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate && d > new Date(toDate)) return false;
      return true;
    });
    downloadCSV(filtered);
  };

  return (
    <div className="mb-4 pt-6 px-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">

      {/* TITLE */}
      <div>
        <h1 className="text-2xl font-bold">Daily Sales</h1>
        <p className="text-gray-600 text-sm">
          Manage and track daily egg sales across all outlets.
        </p>
      </div>

      {/* ACTIONS */}
      <div className="flex flex-wrap items-center gap-3">

        {/* FROM DATE */}
        <div className="relative">
          <button
            onClick={() => setOpenCal(openCal === "from" ? null : "from")}
            className="border px-3 py-2 rounded-lg text-sm flex gap-2 items-center"
          >
            {fromDate ? formatDateDMY(fromDate) : "From Date"}
            <CalendarIcon className="h-4 w-4" />
          </button>
          {openCal === "from" && (
            <div className="absolute z-30 mt-2">
              <BaseCalendar
                selectedDate={fromDate}
                onSelectDate={(d) => {
                  setFromDate(d);
                  setOpenCal(null);
                }}
              />
            </div>
          )}
        </div>

        {/* TO DATE */}
        <div className="relative">
          <button
            onClick={() => setOpenCal(openCal === "to" ? null : "to")}
            className="border px-3 py-2 rounded-lg text-sm flex gap-2 items-center"
          >
            {toDate ? formatDateDMY(toDate) : "To Date"}
            <CalendarIcon className="h-4 w-4" />
          </button>
          {openCal === "to" && (
            <div className="absolute z-30 mt-2">
              <BaseCalendar
                selectedDate={toDate}
                onSelectDate={(d) => {
                  setToDate(d);
                  setOpenCal(null);
                }}
              />
            </div>
          )}
        </div>

        {/* QUICK BUTTONS */}
        <button className="border px-4 py-2 rounded-lg text-sm" onClick={() => handleQuickRange("lastWeek")}>
          Last Week
        </button>

        <button className="border px-4 py-2 rounded-lg text-sm" onClick={() => handleQuickRange("lastMonth")}>
          Last Month
        </button>

        {/* DOWNLOAD */}
        <button
          onClick={handleDownload}
          className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-semibold"
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default Dailyheader;
