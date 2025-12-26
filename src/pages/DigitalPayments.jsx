// src/pages/DigitalPayment.jsx
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

const DEFAULT_OUTLETS = [
  "AECS Layout",
  "Bandepalya",
  "Hosa Road",
  "Singasandra",
  "Kudlu Gate",
];

const STORAGE_KEY = "egg_outlets_v1";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatCurrencyTwoDecimals(value) {
  if (value == null || isNaN(value)) return "₹0.00";
  return (
    "₹" +
    Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// dd-mm-yyyy for field labels
function formatDateDMY(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// e.g. "Oct 24, 2023" for table
function formatDisplayDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/* ----------------- Icons ----------------- */
function CalendarIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="8.5" cy="14.5" r="1" />
      <circle cx="12" cy="14.5" r="1" />
      <circle cx="15.5" cy="14.5" r="1" />
    </svg>
  );
}

// Document + pencil style icon
function DigitalEntryIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="16" r="16" fill="#FFEFE0" />
      <rect x="9" y="8" width="10" height="14" rx="1.5" fill="#FF9D3A" />
      <path
        d="M19 10L16 10C15.45 10 15 9.55 15 9V6"
        stroke="#FFEFE0"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M18.2 18.2L22.5 13.9C22.8 13.6 23.3 13.6 23.6 13.9L24.6 14.9C24.9 15.2 24.9 15.7 24.6 16L20.3 20.3L18.2 18.2Z"
        fill="#FF7A1A"
      />
      <path
        d="M18 18.5L17.3 21.2C17.2 21.6 17.6 22 18 21.9L20.7 21.2"
        stroke="#FF7A1A"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
/* ----------------------------------------- */

/* -------- Base Calendar (with / without dots) -------- */
function BaseCalendar({ rows, selectedDate, onSelectDate, showDots }) {
  const today = new Date();
  const initialDate = selectedDate ? new Date(selectedDate) : today;

  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    if (!Number.isNaN(d.getTime())) {
      setViewMonth(d.getMonth());
      setViewYear(d.getFullYear());
    }
  }, [selectedDate]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const hasEntryForDate = (iso) =>
    Array.isArray(rows) && rows.some((row) => row.date === iso);

  const buildIso = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;

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

  const goPrevMonth = () => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const goNextMonth = () => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const yearOptions = [];
  for (let y = viewYear - 3; y <= viewYear + 3; y++) {
    yearOptions.push(y);
  }

  const selectedIso = selectedDate || "";

  return (
    <div className="w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
      {/* Header */}
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
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx}>
                {m.slice(0, 3)}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
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

      {/* Week days */}
      <div className="mt-1 grid grid-cols-7 gap-y-1 px-4 text-center text-[11px] font-medium text-gray-400">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      {/* Days */}
      <div className="mt-1 grid grid-cols-7 gap-y-1 px-3 pb-3 text-center text-xs">
        {weeks.map((week, wIdx) =>
          week.map((d, idx) => {
            if (!d) return <div key={`${wIdx}-${idx}`} />;

            const iso = buildIso(viewYear, viewMonth, d);
            const hasEntry = showDots && hasEntryForDate(iso);
            const isSelected = selectedIso === iso;
            const isToday =
              today.getFullYear() === viewYear &&
              today.getMonth() === viewMonth &&
              today.getDate() === d;

            const wrapperClass = showDots
              ? "flex flex-col items-center gap-1"
              : "flex h-8 items-center justify-center";

            return (
              <button
                key={`${wIdx}-${idx}`}
                type="button"
                onClick={() => onSelectDate(iso)}
                className={wrapperClass}
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
                {showDots && (
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      hasEntry ? "bg-green-500" : "bg-red-400"
                    }`}
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
/* ----------------------------------------------- */

function createInitialDigitalRows(outlets = DEFAULT_OUTLETS) {
  // Start with no seeded rows — data should be entered by the user
  return [];
} 

export default function DigitalPayment() {
  const [outlets, setOutlets] = useState(DEFAULT_OUTLETS);

  useEffect(() => {
    const loadOutletsFromLocal = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedOutlets = JSON.parse(saved);
        const outletAreas = savedOutlets.map((o) => o.area);
        const required = DEFAULT_OUTLETS;
        const hasAllRequired = required.every((r) => outletAreas.includes(r));
        setOutlets(hasAllRequired ? outletAreas : DEFAULT_OUTLETS);
      } else {
        setOutlets(DEFAULT_OUTLETS);
      }
    };

    loadOutletsFromLocal();

    const onUpdate = (e) => {
      const areas = (e && e.detail) || null;
      if (Array.isArray(areas)) {
        setOutlets(areas);
      } else {
        loadOutletsFromLocal();
      }
    };

    window.addEventListener('egg:outlets-updated', onUpdate);

    const onStorage = (evt) => {
      if (evt.key === STORAGE_KEY) onUpdate();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('egg:outlets-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const ROWS_STORAGE_KEY = "egg_digital_rows_v1";
  const [rows, setRows] = useState(() => {
    const saved = localStorage.getItem(ROWS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // persist rows
  useEffect(() => {
    localStorage.setItem(ROWS_STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  // If outlets change, remap existing rows so they include all current outlets (missing ones filled with 0) and totals recalculated
  useEffect(() => {
    setRows((prevRows) =>
      prevRows.map((r) => {
        const newOutlets = {};
        outlets.forEach((name) => {
          newOutlets[name] = (r.outlets && r.outlets[name]) || 0;
        });
        const totalAmount = Object.values(newOutlets).reduce((s, v) => s + (Number(v) || 0), 0);
        return { ...r, outlets: newOutlets, totalAmount };
      })
    );

    // Also update entry values if currently selected date exists in rows
    if (entryDate) {
      const existing = rows.find((r) => r.date === entryDate);
      if (!existing) {
        setEntryValues(() => {
          const reset = {};
          outlets.forEach((o) => (reset[o] = ""));
          return reset;
        });
      }
    }
  }, [outlets]);

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [entryDate, setEntryDate] = useState("");
  const [entryValues, setEntryValues] = useState(() => {
    const initial = {};
    outlets.forEach((o) => (initial[o] = ""));
    return initial;
  });

  // Whether the currently selected entry date already has a saved row
  const [hasEntry, setHasEntry] = useState(false);
  const [entryTotal, setEntryTotal] = useState(0);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Calendar open states
  const [isEntryCalendarOpen, setIsEntryCalendarOpen] = useState(false);
  const [isFilterFromOpen, setIsFilterFromOpen] = useState(false);
  const [isFilterToOpen, setIsFilterToOpen] = useState(false);

  // Load entry values and set locked status when entryDate or rows change
  useEffect(() => {
    if (!entryDate) {
      setHasEntry(false);
      setEntryValues(() => {
        const reset = {};
        outlets.forEach((o) => (reset[o] = ""));
        return reset;
      });
      setEntryTotal(0);
      return;
    }

    const existing = rows.find((r) => r.date === entryDate);
    if (existing) {
      setEntryValues(() => ({ ...existing.outlets }));
      setHasEntry(true);
      setEntryTotal(existing.totalAmount || 0);
    } else {
      setHasEntry(false);
      setEntryValues(() => {
        const reset = {};
        outlets.forEach((o) => (reset[o] = ""));
        return reset;
      });
      setEntryTotal(0);
    }
  }, [entryDate, rows, outlets]);
  const filteredRows = useMemo(() => {
    let from = filterFrom ? new Date(filterFrom) : null;
    let to = filterTo ? new Date(filterTo) : null;

    return rows.filter((row) => {
      const d = new Date(row.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [rows, filterFrom, filterTo]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const currentPageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const handleQuickRange = (type) => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    let fromDate;

    if (type === "lastWeek") {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().slice(0, 10);
    } else if (type === "lastMonth") {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      fromDate = d.toISOString().slice(0, 10);
    }

    setFilterFrom(fromDate || "");
    setFilterTo(to);
    setPage(1);
  };

  const handleEntryChange = (outlet, value) => {
    setEntryValues((prev) => ({
      ...prev,
      [outlet]: value,
    }));
  };

  const handleSaveEntry = (e) => {
    e.preventDefault();
    if (!entryDate) {
      alert("Please select a date.");
      return;
    }

    // Block if an entry for the date already exists
    if (rows.some((r) => r.date === entryDate)) {
      alert(`Entry for ${entryDate} already exists and cannot be modified.`);
      setHasEntry(true);
      return;
    }

    const outletAmounts = {};
    outlets.forEach((o) => {
      outletAmounts[o] = Number(entryValues[o]) || 0;
    });

    const totalAmount = Object.values(outletAmounts).reduce(
      (sum, v) => sum + v,
      0
    );

    // Check if entry for this date already exists
    const existingEntryIndex = rows.findIndex((row) => row.date === entryDate);

    if (existingEntryIndex !== -1) {
      // Update existing entry
      setRows((prev) => {
        const updated = [...prev];
        updated[existingEntryIndex] = {
          ...updated[existingEntryIndex],
          outlets: outletAmounts,
          totalAmount,
        };
        return updated;
      });
    } else {
      // Create new entry
      const newRow = {
        id: rows.length + 1,
        date: entryDate,
        outlets: outletAmounts,
        totalAmount,
      };
      setRows((prev) => [newRow, ...prev]);
    }

    setPage(1);

    setEntryDate("");
    setEntryValues(() => {
      const reset = {};
      outlets.forEach((o) => (reset[o] = ""));
      return reset;
    });
  };

  const totalRecordsLabel = `${currentPageRows.length} of ${rows.length} records`;

  const downloadExcel = () => {
    if (!filteredRows || filteredRows.length === 0) {
      alert("No data available for selected filters");
      return;
    }

    const data = filteredRows.map((row) => {
      const obj = { Date: row.date };
      outlets.forEach((o) => (obj[o] = row.outlets[o] ?? 0));
      obj.Total = row.totalAmount;
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Digital Payments");
    XLSX.writeFile(wb, "Digital_Payments_Report.xlsx");
  };

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
            Digital Payments
          </h1>
          <p className="mt-1 text-sm md:text-base text-gray-500">
            Track UPI and online collections per outlet.
          </p>
        </div>

        <button onClick={downloadExcel} className="inline-flex items-center rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
          Download Data
        </button>
      </div>

      {/* Filters row */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-3">
          {/* Date From */}
          <div className="flex items-center gap-2">
            <label className="text-xs md:text-sm font-medium text-gray-700">
              Date From
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsFilterFromOpen((o) => !o);
                  setIsFilterToOpen(false);
                }}
                className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
              >
                <span>
                  {filterFrom ? formatDateDMY(filterFrom) : "dd-mm-yyyy"}
                </span>
                <CalendarIcon className="h-4 w-4 text-gray-500" />
              </button>
              {isFilterFromOpen && (
                <div className="absolute left-0 top-full z-30 mt-2">
                  <BaseCalendar
                    rows={[]}
                    selectedDate={filterFrom}
                    onSelectDate={(iso) => {
                      setFilterFrom(iso);
                      setPage(1);
                      setIsFilterFromOpen(false);
                    }}
                    showDots={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Date To */}
          <div className="flex items-center gap-2">
            <label className="text-xs md:text-sm font-medium text-gray-700">
              Date To
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsFilterToOpen((o) => !o);
                  setIsFilterFromOpen(false);
                }}
                className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
              >
                <span>
                  {filterTo ? formatDateDMY(filterTo) : "dd-mm-yyyy"}
                </span>
                <CalendarIcon className="h-4 w-4 text-gray-500" />
              </button>
              {isFilterToOpen && (
                <div className="absolute left-0 top-full z-30 mt-2">
                  <BaseCalendar
                    rows={[]}
                    selectedDate={filterTo}
                    onSelectDate={(iso) => {
                      setFilterTo(iso);
                      setPage(1);
                      setIsFilterToOpen(false);
                    }}
                    showDots={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleQuickRange("lastWeek")}
            className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Last Week
          </button>
          <button
            type="button"
            onClick={() => handleQuickRange("lastMonth")}
            className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Last Month
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-eggWhite shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-500">
                <th className="min-w-[130px] px-4 py-3">Date</th>
                {outlets.map((outlet) => (
                  <th key={outlet} className="px-4 py-3 whitespace-nowrap">
                    {outlet.toUpperCase()}
                  </th>
                ))}
                <th className="px-4 py-3 whitespace-nowrap text-right">
                  TOTAL AMOUNT
                </th>
              </tr>
            </thead>
            <tbody>
              {currentPageRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`text-xs text-gray-700 md:text-sm ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDisplayDate(row.date)}
                  </td>
                  {outlets.map((outlet) => (
                    <td
                      key={outlet}
                      className="whitespace-nowrap px-4 py-3"
                    >
                      {formatCurrencyTwoDecimals(row.outlets[outlet])}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {formatCurrencyTwoDecimals(row.totalAmount)}
                  </td>
                </tr>
              ))}
              {/* Grand Total Row */}
              <tr className="bg-orange-50 font-semibold text-orange-700">
                <td className="whitespace-nowrap px-4 py-3">Grand Total</td>
                {outlets.map((outlet) => {
                  const total = rows.reduce((sum, r) => sum + (r.outlets && r.outlets[outlet] ? Number(r.outlets[outlet]) : 0), 0);
                  return (
                    <td key={outlet} className="whitespace-nowrap px-4 py-3">{formatCurrencyTwoDecimals(total)}</td>
                  );
                })}
                <td className="whitespace-nowrap px-4 py-3 text-right">{formatCurrencyTwoDecimals(rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer below table */}
        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs md:flex-row md:items-center md:justify-between">
          <p className="text-gray-500">Showing {totalRecordsLabel}</p>

          <div className="flex items-center justify-end gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium ${
                page <= 1
                  ? "border-gray-100 text-gray-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              ‹
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium ${
                page >= totalPages
                  ? "border-gray-100 text-gray-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Entry Card */}
      <div className="mt-8 rounded-2xl bg-eggWhite p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100">
            <DigitalEntryIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 md:text-lg">
              Digital Payment Entry
            </h2>
            <p className="text-xs text-gray-500 md:text-sm">
              Add new UPI/online collection amounts for each outlet.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveEntry} className="space-y-5">
          {/* Select Date with custom calendar (with dots) */}
          <div className="grid gap-4 md:grid-cols-[160px,1fr] md:items-center">
            <label className="text-xs font-medium text-gray-700 md:text-sm">
              Select Date
            </label>
            <div className="relative w-full">
              <button
                type="button"
                onClick={() =>
                  setIsEntryCalendarOpen((open) => !open)
                }
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
              >
                <span>
                  {entryDate ? formatDateDMY(entryDate) : "dd-mm-yyyy"}
                </span>
                <CalendarIcon className="h-4 w-4 text-gray-500" />
              </button>
              {hasEntry && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div className="text-xs font-medium text-green-700">Entry ( ₹ {entryTotal}) • Locked</div>
                </div>
              )}
              {isEntryCalendarOpen && (
                <div className="absolute right-0 bottom-full z-30 mb-2">
                  <BaseCalendar
                    rows={rows}
                    selectedDate={entryDate}
                    onSelectDate={(iso) => {
                      setEntryDate(iso);
                      // Auto-load existing entry data if it exists
                      const existingEntry = rows.find((row) => row.date === iso);
                      if (existingEntry) {
                        setEntryValues(existingEntry.outlets);
                      } else {
                        setEntryValues(() => {
                          const reset = {};
                          outlets.forEach((o) => (reset[o] = ""));
                          return reset;
                        });
                      }
                      setIsEntryCalendarOpen(false);
                    }}
                    showDots={true}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Amounts */}
          <div className="grid gap-3 md:grid-cols-5">
            {outlets.map((outlet) => (
              <div key={outlet} className="space-y-1">
                <p className="text-xs font-medium text-gray-600">
                  {outlet}
                </p>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entryValues[outlet]}
                    onChange={(e) =>
                      handleEntryChange(outlet, e.target.value)
                    }
                    disabled={hasEntry}
                    className={`w-full rounded-xl border border-gray-200 bg-eggBg pl-7 pr-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm ${hasEntry ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Save button + note */}
          <div className="flex flex-col items-center gap-2 pt-4">
            <button
              type="submit"
              disabled={hasEntry}
              className={`inline-flex items-center justify-center rounded-2xl px-6 py-2.5 text-sm font-semibold text-white shadow-md ${hasEntry ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
            >
              {hasEntry ? 'Locked' : 'Save Entry'}
            </button>
            <p className="text-center text-[11px] text-gray-500 md:text-xs">
              Values support decimals for exact UPI/online amounts.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
