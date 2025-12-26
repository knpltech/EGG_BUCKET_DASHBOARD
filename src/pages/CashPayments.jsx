// src/pages/CashPayment.jsx
import { useState, useMemo, useEffect } from "react";
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

function formatCurrencyNoDecimals(value) {
  if (value == null || isNaN(value)) return "₹0";
  return (
    "₹" +
    Number(value).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
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

/* ----------------- Calendar Icon ----------------- */
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
      <circle cx="8.5" cy="18" r="1" />
      <circle cx="12" cy="18" r="1" />
      <circle cx="15.5" cy="18" r="1" />
    </svg>
  );
}
/* ------------------------------------------------ */

/* ------------- Custom Calendar Component --------- */
function CashCalendar({ rows, selectedDate, onSelectDate, showDots = true }) {
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
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun

  const hasEntryForDate = (iso) => rows.some((row) => row.date === iso);

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
      {/* Header: arrows + month/year (single line, centered vertically) */}
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

            const dotColor = hasEntry ? "bg-green-500" : "bg-red-400";

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
                  <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
/* ------------------------------------------------ */

function createInitialCashRows(outlets = DEFAULT_OUTLETS) {
  // Start with no seeded rows — data should be entered by the user
  return [];
}

export default function CashPayment() {
  const [outlets, setOutlets] = useState([]);

  useEffect(() => {
    const loadOutletsFromLocal = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedOutlets = JSON.parse(saved);
        setOutlets(Array.isArray(savedOutlets) ? savedOutlets : []);
      }
    };

    loadOutletsFromLocal();

    const onUpdate = (e) => {
      const outletsList = (e && e.detail && Array.isArray(e.detail)) ? e.detail : null;
      if (outletsList) {
        setOutlets(outletsList);
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

  const ROWS_STORAGE_KEY = "egg_cash_rows_v1";
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
    if (!Array.isArray(outlets) || outlets.length === 0) return;

    setRows((prevRows) =>
      prevRows.map((r) => {
        const newOutlets = {};
        outlets.forEach((outletObj) => {
          const area = outletObj.area || outletObj;
          newOutlets[area] = (r.outlets && r.outlets[area]) || 0;
        });
        const totalAmount = Object.values(newOutlets).reduce((s, v) => s + (Number(v) || 0), 0);
        return { ...r, outlets: newOutlets, totalAmount };
      })
    );

    // Also update entry values when outlets change
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

  const [rangeType, setRangeType] = useState("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [entryDate, setEntryDate] = useState("");
  const [entryValues, setEntryValues] = useState(() => {
    const initial = {};
    outlets.forEach((o) => (initial[o] = ""));
    return initial;
  });

  const [hasEntry, setHasEntry] = useState(false);
  const [entryTotal, setEntryTotal] = useState(0);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCustomFromOpen, setIsCustomFromOpen] = useState(false);
  const [isCustomToOpen, setIsCustomToOpen] = useState(false);

  // Load existing row for selected date
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

  // Filter rows based on selected range
  const filteredRows = useMemo(() => {
    const now = new Date();
    let from = null;
    let to = null;

    if (rangeType === "thisMonth") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (rangeType === "lastMonth") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      from = lastMonth;
      to = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    } else if (rangeType === "custom" && customFrom && customTo) {
      from = new Date(customFrom);
      to = new Date(customTo);
    }

    let filtered = (!from || !to)
      ? rows
      : rows.filter((row) => {
          const d = new Date(row.date);
          return d >= from && d <= to;
        });
    return filtered.sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending (oldest to newest)
  }, [rows, rangeType, customFrom, customTo]);

  // Totals by outlet and grand total
  const totals = useMemo(() => {
    const outletTotals = {};
    if (Array.isArray(outlets) && outlets.length > 0) {
      outlets.forEach((outletObj) => {
        const area = outletObj.area || outletObj;
        outletTotals[area] = 0;
      });
    }
    let grandTotal = 0;

    filteredRows.forEach((row) => {
      if (Array.isArray(outlets) && outlets.length > 0) {
        outlets.forEach((outletObj) => {
          const area = outletObj.area || outletObj;
          outletTotals[area] += row.outlets[area] || 0;
        });
      }
      grandTotal += row.totalAmount || 0;
    });

    return { outletTotals, grandTotal };
  }, [filteredRows, outlets]);

  const downloadExcel = () => {
    if (!filteredRows || filteredRows.length === 0) {
      alert("No data available for selected filters");
      return;
    }

    const data = filteredRows.map((row) => {
      const obj = { Date: row.date };
      if (Array.isArray(outlets) && outlets.length > 0) {
        outlets.forEach((outletObj) => {
          const area = outletObj.area || outletObj;
          obj[area] = row.outlets[area] ?? 0;
        });
      }
      obj.Total = row.totalAmount;
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cash Collections");
    XLSX.writeFile(wb, "Cash_Collections_Report.xlsx");
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
      alert("Please select a collection date.");
      return;
    }

    // Block duplicate
    if (rows.some((r) => r.date === entryDate)) {
      alert(`Entry for ${entryDate} already exists and cannot be modified.`);
      setHasEntry(true);
      return;
    }

    const outletAmounts = {};
    outlets.forEach((o) => {
      const num = Number(entryValues[o]) || 0;
      outletAmounts[o] = num;
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

    // mark locked
    setHasEntry(true);
    setEntryTotal(totalAmount);
  };

  const formatDisplayDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
            Cash Payments
          </h1>
          <p className="mt-1 text-sm md:text-base text-gray-500">
            Manage and record daily cash collections across outlets.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={downloadExcel} className="inline-flex items-center rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            Export Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRangeType("thisMonth")}
            className={`rounded-full px-4 py-2 text-xs md:text-sm font-medium border ${
              rangeType === "thisMonth"
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-eggWhite text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setRangeType("lastMonth")}
            className={`rounded-full px-4 py-2 text-xs md:text-sm font-medium border ${
              rangeType === "lastMonth"
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-eggWhite text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setRangeType("custom")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs md:text-sm font-medium border ${
              rangeType === "custom"
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-eggWhite text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>Custom Range</span>
            <CalendarIcon className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>

        {rangeType === "custom" && (
          <div className="flex flex-wrap gap-3">
            {/* Date From */}
            <div className="flex items-center gap-2 relative">
              <label className="text-xs md:text-sm font-medium text-gray-700">
                Date From
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomFromOpen((o) => !o);
                    setIsCustomToOpen(false);
                  }}
                  className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
                >
                  <span>
                    {customFrom ? formatDateDMY(customFrom) : "dd-mm-yyyy"}
                  </span>
                  <CalendarIcon className="h-4 w-4 text-gray-500" />
                </button>
                {isCustomFromOpen && (
                  <div className="absolute left-0 top-full z-50 mt-2">
                    <CashCalendar
                      rows={[]}
                      selectedDate={customFrom}
                      onSelectDate={(iso) => {
                        setCustomFrom(iso);
                        setIsCustomFromOpen(false);
                      }}
                      showDots={false}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Date To */}
            <div className="flex items-center gap-2 relative">
              <label className="text-xs md:text-sm font-medium text-gray-700">
                Date To
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomToOpen((o) => !o);
                    setIsCustomFromOpen(false);
                  }}
                  className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
                >
                  <span>
                    {customTo ? formatDateDMY(customTo) : "dd-mm-yyyy"}
                  </span>
                  <CalendarIcon className="h-4 w-4 text-gray-500" />
                </button>
                {isCustomToOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2">
                    <CashCalendar
                      rows={[]}
                      selectedDate={customTo}
                      onSelectDate={(iso) => {
                        setCustomTo(iso);
                        setIsCustomToOpen(false);
                      }}
                      showDots={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-eggWhite shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-500">
                <th className="min-w-[130px] px-4 py-3">Date</th>
                {outlets.map((outlet) => {
                  const area = outlet.area || outlet;
                  const isActive = !outlet.status || outlet.status === "Active";
                  return (
                    <th key={area} className="px-4 py-3 whitespace-nowrap">
                      {area.toUpperCase()}
                      {!isActive && <span className="text-red-500 text-[10px] block">(Inactive)</span>}
                    </th>
                  );
                })}
                <th className="px-4 py-3 whitespace-nowrap text-right">
                  TOTAL AMOUNT
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`text-xs text-gray-700 md:text-sm ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDisplayDate(row.date)}
                  </td>
                  {outlets.map((outlet) => {
                    const area = outlet.area || outlet;
                    return (
                      <td
                        key={area}
                        className="whitespace-nowrap px-4 py-3"
                      >
                        {formatCurrencyNoDecimals(row.outlets[area])}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {formatCurrencyNoDecimals(row.totalAmount)}
                  </td>
                </tr>
              ))}

              <tr className="border-t border-orange-100 bg-orange-50 text-xs font-semibold text-gray-900 md:text-sm">
                <td className="px-4 py-3">Total</td>
                {outlets.map((outlet) => {
                  const area = outlet.area || outlet;
                  return (
                    <td
                      key={area}
                      className="whitespace-nowrap px-4 py-3"
                    >
                      {formatCurrencyNoDecimals(totals.outletTotals[area] || 0)}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {formatCurrencyNoDecimals(totals.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry Card */}
      <div className="mt-8 rounded-2xl bg-eggWhite p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-lg text-orange-500">
            ₹
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 md:text-lg">
              Cash Payment Entry
            </h2>
            <p className="text-xs text-gray-500 md:text-sm">
              Enter cash amounts collected for today.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveEntry} className="space-y-5">
          {/* Collection date with custom calendar */}
          <div className="grid gap-4 md:grid-cols-[160px,1fr] md:items-center">
            <label className="text-xs font-medium text-gray-700 md:text-sm">
              Collection Date
            </label>
            <div className="relative w-full">
              <button
                type="button"
                onClick={() =>
                  setIsCalendarOpen((open) => !open)
                }
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
              >
                <span>
                  {entryDate
                    ? formatDisplayDate(entryDate)
                    : "Select date"}
                </span>
                <CalendarIcon className="h-4 w-4 text-gray-500" />
              </button>

              {hasEntry && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div className="text-xs font-medium text-green-700">Entry ( ₹ {entryTotal}) • Locked</div>
                </div>
              )}

              {isCalendarOpen && (
                <div className="absolute right-0 bottom-full z-20 mb-2">
                  <CashCalendar
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
                      setIsCalendarOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Amounts per outlet */}
          <div className="grid gap-3 md:grid-cols-5">
            {outlets.map((outlet) => {
              const area = outlet.area || outlet;
              const isActive = !outlet.status || outlet.status === "Active";
              return (
                <div key={area} className="space-y-1">
                  <p className="text-xs font-medium text-gray-600">
                    {area.toUpperCase()}
                    {!isActive && <span className="text-red-500 ml-1">(Inactive)</span>}
                  </p>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={entryValues[area]}
                      onChange={(e) =>
                        handleEntryChange(area, e.target.value)
                      }
                      disabled={hasEntry || !isActive}
                      className={`w-full rounded-xl border border-gray-200 bg-eggBg pl-7 pr-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm ${(hasEntry || !isActive) ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Centered button + note below */}
          <div className="flex flex-col items-center gap-2 pt-4">
            <button
              type="submit"
              disabled={hasEntry}
              className={`inline-flex items-center justify-center rounded-2xl px-6 py-2.5 text-sm font-semibold text-white shadow-md ${hasEntry ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
            >
              {hasEntry ? 'Locked' : 'Save Entry'}
            </button>
            <p className="text-center text-[11px] text-gray-500 md:text-xs">
              Note: Cash values must be whole numbers only. No decimals
              allowed.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}