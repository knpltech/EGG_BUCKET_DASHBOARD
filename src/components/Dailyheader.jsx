import React, { useState, useEffect, useRef } from "react";

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
      <circle cx="8.5" cy="14.5" r="1" />
      <circle cx="12" cy="14.5" r="1" />
      <circle cx="15.5" cy="14.5" r="1" />
    </svg>
  );
}

/* ---------- CALENDAR ---------- */

function BaseCalendar({ selectedDate, onSelectDate, rows = [] }) {
  const today = new Date();
  const initial = selectedDate ? new Date(selectedDate) : today;
  const [month, setMonth] = useState(initial.getMonth());
  const [year, setYear] = useState(initial.getFullYear());

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    if (!Number.isNaN(d.getTime())) {
      setMonth(d.getMonth());
      setYear(d.getFullYear());
    }
  }, [selectedDate]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const buildISO = (d) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const goPrevMonth = () => {
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const goNextMonth = () => {
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const yearOptions = [];
  for (let y = year - 3; y <= year + 3; y++) {
    yearOptions.push(y);
  }

  const weeks = [];
  let day = 1 - firstDay;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++, day++) {
      if (day < 1 || day > daysInMonth) {
        week.push(null);
      } else {
        week.push(day);
      }
    }
    weeks.push(week);
  }

  return (
    <div className="w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={goPrevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          ‹
        </button>

        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx}>
                {m.slice(0, 3)}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={goNextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          ›
        </button>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-4 text-center text-[11px] font-medium text-gray-400">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-3 pb-3 text-center text-xs">
        {weeks.map((week, wIdx) =>
          week.map((d, idx) => {
            if (!d) return <div key={`${wIdx}-${idx}`} />;

            const iso = buildISO(d);
            const isSelected = selectedDate === iso;
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === d;

            return (
              <button
                key={`${wIdx}-${idx}`}
                type="button"
                onClick={() => onSelectDate(iso)}
                className="flex h-8 items-center justify-center"
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    isSelected
                      ? "bg-green-500 text-white"
                      : isToday
                      ? "border border-green-500 text-green-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {d}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

const Dailyheader = ({ dailySalesData = [], fromDate, toDate, setFromDate, setToDate, allRows = [] }) => {
  const fromCalendarRef = useRef(null);
  const toCalendarRef = useRef(null);
  const [openCal, setOpenCal] = useState(null); // "from" | "to" | null

  // Click outside to close calendars
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fromCalendarRef.current && !fromCalendarRef.current.contains(event.target)) {
        if (openCal === "from") setOpenCal(null);
      }
      if (toCalendarRef.current && !toCalendarRef.current.contains(event.target)) {
        if (openCal === "to") setOpenCal(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openCal]);

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

  /* ---------- DOWNLOAD ---------- */

  const handleDownload = () => {
    downloadCSV(dailySalesData);
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
        <div className="relative z-30" ref={fromCalendarRef}>
          <button
            onClick={() => {
              setOpenCal(openCal === "from" ? null : "from");
            }}
            className="border px-3 py-2 rounded-lg text-sm flex gap-2 items-center"
          >
            {fromDate ? formatDateDMY(fromDate) : "From Date"}
            <CalendarIcon className="h-4 w-4" />
          </button>
          {openCal === "from" && (
            <div className="absolute z-50 mt-2 left-0 top-full">
              <BaseCalendar
                selectedDate={fromDate}
                onSelectDate={(d) => {
                  setFromDate(d);
                  setOpenCal(null);
                }}
                rows={allRows}
              />
            </div>
          )}
        </div>

        {/* TO DATE */}
        <div className="relative z-30" ref={toCalendarRef}>
          <button
            onClick={() => {
              setOpenCal(openCal === "to" ? null : "to");
            }}
            className="border px-3 py-2 rounded-lg text-sm flex gap-2 items-center"
          >
            {toDate ? formatDateDMY(toDate) : "To Date"}
            <CalendarIcon className="h-4 w-4" />
          </button>
          {openCal === "to" && (
            <div className="absolute z-50 mt-2 left-0 top-full">
              <BaseCalendar
                selectedDate={toDate}
                onSelectDate={(d) => {
                  setToDate(d);
                  setOpenCal(null);
                }}
                rows={allRows}
              />
            </div>
          )}
        </div>

        {/* QUICK BUTTONS */}
        <button className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50" onClick={() => handleQuickRange("lastWeek")}>
          Last Week
        </button>

        <button className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50" onClick={() => handleQuickRange("lastMonth")}>
          Last Month
        </button>

        {/* DOWNLOAD */}
        <button
          onClick={handleDownload}
          className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default Dailyheader;