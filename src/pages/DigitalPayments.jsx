import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
const API_URL = import.meta.env.VITE_API_URL;
import { getRoleFlags } from "../utils/role";

const DEFAULT_OUTLETS = [
  "AECS Layout",
  "Bandepalya",
  "Hosa Road",
  "Singasandra",
  "Kudlu Gate",
];

const STORAGE_KEY = "egg_outlets_v1";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Memoized utility functions
const formatCurrencyTwoDecimals = (value) => {
  if (value == null || isNaN(value)) return "₹0.00";
  return "₹" + Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateDMY = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatDisplayDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

/* ----------------- Icons ----------------- */
const CalendarIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <circle cx="8.5" cy="14.5" r="1" />
    <circle cx="12" cy="14.5" r="1" />
    <circle cx="15.5" cy="14.5" r="1" />
  </svg>
);

const DigitalEntryIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#FFEFE0" />
    <rect x="9" y="8" width="10" height="14" rx="1.5" fill="#FF9D3A" />
    <path d="M19 10L16 10C15.45 10 15 9.55 15 9V6" stroke="#FFEFE0" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M18.2 18.2L22.5 13.9C22.8 13.6 23.3 13.6 23.6 13.9L24.6 14.9C24.9 15.2 24.9 15.7 24.6 16L20.3 20.3L18.2 18.2Z" fill="#FF7A1A" />
    <path d="M18 18.5L17.3 21.2C17.2 21.6 17.6 22 18 21.9L20.7 21.2" stroke="#FF7A1A" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* -------- Base Calendar -------- */
const BaseCalendar = ({ rows, selectedDate, onSelectDate, showDots }) => {
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

  const hasEntryForDate = useCallback((iso) => 
    Array.isArray(rows) && rows.some((row) => row.date === iso),
    [rows]
  );

  const { daysInMonth, firstDay, weeks } = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    
    const weeks = [];
    let day = 1 - firstDay;

    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let i = 0; i < 7; i++, day++) {
        week.push(day < 1 || day > daysInMonth ? null : day);
      }
      weeks.push(week);
    }

    return { daysInMonth, firstDay, weeks };
  }, [viewYear, viewMonth]);

  const buildIso = useCallback((year, month, day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    []
  );

  const goPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const yearOptions = useMemo(() => {
    const options = [];
    for (let y = viewYear - 3; y <= viewYear + 3; y++) {
      options.push(y);
    }
    return options;
  }, [viewYear]);

  const selectedIso = selectedDate || "";

  return (
    <div className="w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button type="button" onClick={goPrevMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">‹</button>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400" value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))}>
            {MONTHS.map((m, idx) => <option key={m} value={idx}>{m.slice(0, 3)}</option>)}
          </select>
          <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400" value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" onClick={goNextMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">›</button>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-4 text-center text-[11px] font-medium text-gray-400">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-3 pb-3 text-center text-xs">
        {weeks.map((week, wIdx) =>
          week.map((d, idx) => {
            if (!d) return <div key={`${wIdx}-${idx}`} />;

            const iso = buildIso(viewYear, viewMonth, d);
            const hasEntry = showDots && hasEntryForDate(iso);
            const isSelected = selectedIso === iso;
            const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

            return (
              <button key={`${wIdx}-${idx}`} type="button" onClick={() => onSelectDate(iso)} className={showDots ? "flex flex-col items-center gap-1" : "flex h-8 items-center justify-center"}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isSelected ? "bg-green-500 text-white" : isToday ? "border border-green-500 text-green-600" : "text-gray-700 hover:bg-gray-100"}`}>{d}</div>
                {showDots && <div className={`h-1.5 w-1.5 rounded-full ${hasEntry ? "bg-green-500" : "bg-red-400"}`} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default function DigitalPayments() {
  const { isAdmin, isViewer, isDataAgent } = getRoleFlags();

  // Refs
  const entryCalendarRef = useRef(null);
  const filterFromRef = useRef(null);
  const filterToRef = useRef(null);

  // State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});
  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState(DEFAULT_OUTLETS);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [entryValues, setEntryValues] = useState(() => {
    const initial = {};
    DEFAULT_OUTLETS.forEach((area) => { initial[area] = ""; });
    return initial;
  });
  const [isEntryCalendarOpen, setIsEntryCalendarOpen] = useState(false);
  const [isFilterFromOpen, setIsFilterFromOpen] = useState(false);
  const [isFilterToOpen, setIsFilterToOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (entryCalendarRef.current && !entryCalendarRef.current.contains(event.target)) setIsEntryCalendarOpen(false);
      if (filterFromRef.current && !filterFromRef.current.contains(event.target)) setIsFilterFromOpen(false);
      if (filterToRef.current && !filterToRef.current.contains(event.target)) setIsFilterToOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load outlets
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const savedOutlets = JSON.parse(saved);
      setOutlets(Array.isArray(savedOutlets) && savedOutlets.length > 0 ? savedOutlets : DEFAULT_OUTLETS);
    }
  }, []);

  // Fetch payments
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await fetch(`${API_URL}/digital-payments/all`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data.map(d => ({ id: d.id || d._id, ...d })) : []);
      } catch (err) {
        console.error("Error fetching payments:", err);
        setRows([]);
      }
    };
    fetchPayments();
  }, []);

  // Check if entry exists
  const hasEntry = useMemo(() => 
    entryDate && rows.some((r) => r.date === entryDate),
    [entryDate, rows]
  );

  const entryTotal = useMemo(() => {
    if (!entryDate) return 0;
    const existing = rows.find((r) => r.date === entryDate);
    return existing?.totalAmount || Object.values(entryValues || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [entryDate, rows, entryValues]);

  // Load entry values when date changes
  useEffect(() => {
    if (!entryDate) {
      const reset = {};
      outlets.forEach((o) => { reset[o.area || o] = ""; });
      setEntryValues(reset);
      return;
    }

    const existing = rows.find((r) => r.date === entryDate);
    if (existing) {
      setEntryValues({ ...existing.outlets });
    } else {
      const reset = {};
      outlets.forEach((o) => { reset[o.area || o] = ""; });
      setEntryValues(reset);
    }
  }, [entryDate, rows, outlets]);

  // Filtered rows with memoization
  const filteredRows = useMemo(() => {
    const sortedRows = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filterFrom && filterTo) {
      const from = new Date(filterFrom);
      const to = new Date(filterTo);
      return sortedRows.filter((row) => {
        const rowDate = new Date(row.date);
        return rowDate >= from && rowDate <= to;
      });
    }

    if (filterFrom) {
      const from = new Date(filterFrom);
      return sortedRows.filter((row) => new Date(row.date) >= from);
    }

    if (filterTo) {
      const to = new Date(filterTo);
      return sortedRows.filter((row) => new Date(row.date) <= to);
    }

    return sortedRows;
  }, [rows, filterFrom, filterTo]);

  // Column totals with memoization
  const columnTotals = useMemo(() => {
    const totals = {};
    outlets.forEach((outlet) => {
      const area = outlet.area || outlet;
      totals[area] = filteredRows.reduce((sum, r) => sum + (r.outlets?.[area] ? Number(r.outlets[area]) : 0), 0);
    });
    totals.grandTotal = filteredRows.reduce((sum, r) => 
      sum + (typeof r.totalAmount === 'number' ? r.totalAmount : Object.values(r.outlets || {}).reduce((s, v) => s + (Number(v) || 0), 0)),
      0
    );
    return totals;
  }, [filteredRows, outlets]);

  // Handlers with useCallback
  const handleQuickRange = useCallback((type) => {
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
  }, []);

  const handleEntryChange = useCallback((outlet, value) => {
    setEntryValues((prev) => ({ ...prev, [outlet]: value }));
  }, []);

  const handleSaveEntry = useCallback(async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSaving) return;
    
    if (!entryDate || rows.some((r) => r.date === entryDate)) return;

    const outletAmounts = {};
    outlets.forEach((o) => {
      const area = o.area || o;
      outletAmounts[area] = Number(entryValues[area]) || 0;
    });

    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/digital-payments/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: entryDate, outlets: outletAmounts }),
      });

      if (!response.ok) {
        alert('Failed to add payment');
        return;
      }

      const res = await fetch(`${API_URL}/digital-payments/all`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map(d => ({ id: d.id || d._id, ...d })) : []);

      setEntryDate("");
      const reset = {};
      outlets.forEach((o) => { reset[o.area || o] = ""; });
      setEntryValues(reset);
    } catch (err) {
      console.error('Error adding payment:', err);
      alert('Error adding payment');
    } finally {
      setIsSaving(false);
    }
  }, [entryDate, entryValues, outlets, rows, isSaving]);

  const handleEditClick = useCallback((row) => {
    const fullRow = { ...row };
    if (!row.id) {
      const found = rows.find(r => r.date === row.date);
      if (found?.id) fullRow.id = found.id;
    }
    setEditRow(fullRow);
    setEditValues({ ...(row.outlets || {}) });
    setEditModalOpen(true);
  }, [rows]);

  const handleEditSave = useCallback(async () => {
    if (isEditSaving) return; // Prevent double submission
    
    if (!editRow.id) {
      alert("No ID found. Cannot update.");
      return;
    }
    const updatedOutlets = {};
    outlets.forEach((o) => {
      const area = o.area || o;
      updatedOutlets[area] = Number(editValues[area]) || 0;
    });

    setIsEditSaving(true);
    try {
      const response = await fetch(`${API_URL}/digital-payments/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editRow.date, outlets: updatedOutlets }),
      });

      if (!response.ok) {
        alert("Failed to update entry");
        return;
      }

      const res = await fetch(`${API_URL}/digital-payments/all`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map(d => ({ id: d.id || d._id, ...d })) : []);
      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    } catch (err) {
      alert("Error updating entry: " + err.message);
    } finally {
      setIsEditSaving(false);
    }
  }, [editRow, editValues, outlets, isEditSaving]);

  const downloadExcel = useCallback(() => {
    if (!filteredRows || filteredRows.length === 0) {
      alert("No data available");
      return;
    }

    const data = filteredRows.map((row) => {
      const obj = { Date: row.date };
      outlets.forEach((o) => {
        const area = o.area || o;
        obj[area] = row.outlets[area] ?? 0;
      });
      obj.Total = row.totalAmount;
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Digital Payments");
    XLSX.writeFile(wb, "Digital_Payments_Report.xlsx");
  }, [filteredRows, outlets]);

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">
      {(isAdmin || isViewer || isDataAgent) && (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Digital Payments</h1>
              <p className="mt-1 text-sm md:text-base text-gray-500">Track UPI and online collections per outlet.</p>
            </div>
            <button onClick={downloadExcel} className="inline-flex items-center rounded-full bg-[#ff7518] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90">
              Download Data
            </button>
          </div>

          {(isAdmin || isDataAgent) && (
            <div className="mb-6 rounded-2xl bg-eggWhite p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100">
                  <DigitalEntryIcon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 md:text-lg">Digital Payment Entry</h2>
                  <p className="text-xs text-gray-500 md:text-sm">Add new UPI/online collection amounts for each outlet.</p>
                </div>
              </div>

              <form onSubmit={handleSaveEntry} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-[160px,1fr] sm:items-center">
                  <label className="text-xs font-medium text-gray-700 md:text-sm">Select Date</label>
                  <div className="relative w-full z-30" ref={entryCalendarRef}>
                    <button type="button" onClick={() => setIsEntryCalendarOpen((o) => !o)} className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                      <span>{entryDate ? formatDateDMY(entryDate) : "dd-mm-yyyy"}</span>
                      <CalendarIcon className="h-4 w-4 text-gray-500" />
                    </button>
                    {hasEntry && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="text-xs font-medium text-green-700">Entry ({formatCurrencyTwoDecimals(entryTotal)}) • Locked</div>
                      </div>
                    )}
                    {isEntryCalendarOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2">
                        <BaseCalendar rows={rows} selectedDate={entryDate} onSelectDate={(iso) => { setEntryDate(iso); setIsEntryCalendarOpen(false); }} showDots={true} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                          <input type="number" min="0" step="0.01" value={entryValues[area] || ""} onChange={(e) => handleEntryChange(area, e.target.value)} disabled={hasEntry || !isActive} className={`w-full rounded-xl border border-gray-200 bg-eggBg pl-7 pr-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm ${(hasEntry || !isActive) ? 'bg-gray-50 cursor-not-allowed' : ''}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col items-center gap-2 pt-4">
                  <button type="submit" disabled={hasEntry || isSaving} className={`inline-flex items-center justify-center rounded-2xl px-6 py-2.5 text-sm font-semibold text-white shadow-md ${hasEntry || isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}>
                    {isSaving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : hasEntry ? 'Locked' : 'Save Entry'}
                  </button>
                  <p className="text-center text-[11px] text-gray-500 md:text-xs">Values support decimals for exact UPI/online amounts.</p>
                </div>
              </form>
            </div>
          )}

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-gray-700">Date From</label>
                <div className="relative z-30" ref={filterFromRef}>
                  <button type="button" onClick={() => { setIsFilterFromOpen((o) => !o); setIsFilterToOpen(false); }} className="flex min-w-[140px] sm:min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                    <span>{filterFrom ? formatDateDMY(filterFrom) : "dd-mm-yyyy"}</span>
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  {isFilterFromOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2">
                      <BaseCalendar rows={[]} selectedDate={filterFrom} onSelectDate={(iso) => { setFilterFrom(iso); setIsFilterFromOpen(false); }} showDots={false} />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-gray-700">Date To</label>
                <div className="relative z-30" ref={filterToRef}>
                  <button type="button" onClick={() => { setIsFilterToOpen((o) => !o); setIsFilterFromOpen(false); }} className="flex min-w-[140px] sm:min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                    <span>{filterTo ? formatDateDMY(filterTo) : "dd-mm-yyyy"}</span>
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  {isFilterToOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2">
                      <BaseCalendar rows={[]} selectedDate={filterTo} onSelectDate={(iso) => { setFilterTo(iso); setIsFilterToOpen(false); }} showDots={false} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleQuickRange("lastWeek")} className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Last Week</button>
              <button type="button" onClick={() => handleQuickRange("lastMonth")} className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Last Month</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-eggWhite shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold text-gray-500">
                    <th className="sticky left-0 bg-gray-50 z-10 min-w-[120px] px-4 py-3">Date</th>
                    {outlets.map((outlet) => {
                      const area = outlet.area || outlet;
                      const isActive = !outlet.status || outlet.status === "Active";
                      return (
                        <th key={area} className="min-w-[100px] px-4 py-3 whitespace-nowrap">
                          {area.toUpperCase()}
                          {!isActive && <span className="text-red-500 text-[10px] block">(Inactive)</span>}
                        </th>
                      );
                    })}
                    <th className="sticky right-0 bg-gray-50 z-10 px-4 py-3 whitespace-nowrap text-right">TOTAL AMOUNT</th>
                    {isAdmin && <th className="sticky right-0 bg-gray-50 z-10 px-4 py-3 whitespace-nowrap text-right">Edit</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={outlets.length + 2 + (isAdmin ? 1 : 0)} className="text-center py-6 text-gray-500">No data available</td>
                    </tr>
                  ) : (
                    <>
                      {filteredRows.map((row, idx) => (
                        <tr key={row.id} className={`text-xs text-gray-700 md:text-sm ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                          <td className="sticky left-0 bg-inherit z-10 whitespace-nowrap px-4 py-3">{formatDisplayDate(row.date)}</td>
                          {outlets.map((outlet) => {
                            const area = outlet.area || outlet;
                            return <td key={area} className="whitespace-nowrap px-4 py-3">{formatCurrencyTwoDecimals(row.outlets[area])}</td>;
                          })}
                          <td className="sticky right-0 bg-inherit z-10 whitespace-nowrap px-4 py-3 text-right font-semibold">
                            {formatCurrencyTwoDecimals(typeof row.totalAmount === 'number' ? row.totalAmount : Object.values(row.outlets || {}).reduce((sum, v) => sum + (Number(v) || 0), 0))}
                          </td>
                          {isAdmin && (
                            <td className="sticky right-0 bg-inherit z-10 whitespace-nowrap px-4 py-3 text-right">
                              <button className="text-blue-600 hover:underline text-xs font-medium" onClick={() => handleEditClick(row)}>Edit</button>
                            </td>
                          )}
                        </tr>
                      ))}
                      <tr className="bg-orange-50 font-semibold text-orange-700 border-t-2 border-orange-200">
                        <td className="sticky left-0 bg-orange-50 z-10 whitespace-nowrap px-4 py-3">Grand Total</td>
                        {outlets.map((outlet) => {
                          const area = outlet.area || outlet;
                          return <td key={area} className="whitespace-nowrap px-4 py-3">{formatCurrencyTwoDecimals(columnTotals[area])}</td>;
                        })}
                        <td className="sticky right-0 bg-orange-50 z-10 whitespace-nowrap px-4 py-3 text-right">{formatCurrencyTwoDecimals(columnTotals.grandTotal)}</td>
                        {isAdmin && <td className="sticky right-0 bg-orange-50 z-10 whitespace-nowrap px-4 py-3"></td>}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {editModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
                <h2 className="text-base sm:text-lg font-semibold mb-4">Edit Digital Payment ({formatDisplayDate(editRow.date)})</h2>
                <div className="space-y-3">
                  {outlets.map((outlet) => {
                    const area = outlet.area || outlet;
                    return (
                      <div key={area} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="w-full sm:w-32 text-xs font-medium text-gray-700">{area.toUpperCase()}</label>
                        <input type="number" min="0" step="0.01" value={editValues[area] || ""} onChange={e => setEditValues((prev) => ({ ...prev, [area]: e.target.value }))} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={() => { setEditModalOpen(false); setEditRow({}); setEditValues({}); }} disabled={isEditSaving} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                  <button onClick={handleEditSave} disabled={isEditSaving} className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center">
                    {isEditSaving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}