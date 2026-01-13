import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { getRoleFlags } from "../utils/role";
import * as XLSX from "xlsx";
import DailyTable from "../components/DailyTable";

const API_URL = import.meta.env.VITE_API_URL;

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
const formatCurrencyNoDecimals = (value) => {
  if (value == null || isNaN(value)) return "₹0";
  return "₹" + Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
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
    day: "2-digit",
    month: "2-digit",
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
    <circle cx="8.5" cy="18" r="1" />
    <circle cx="12" cy="18" r="1" />
    <circle cx="15.5" cy="18" r="1" />
  </svg>
);

/* ------------- Custom Calendar Component --------- */
const CashCalendar = ({ rows, selectedDate, onSelectDate, showDots = true }) => {
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
    rows.some((row) => row.date === iso),
    [rows]
  );

  const { weeks } = useMemo(() => {
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

    return { weeks };
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

export default function CashPayments() {
  const { isAdmin, isViewer, isDataAgent } = getRoleFlags();

  // Refs
  const calendarRef = useRef(null);
  const customFromRef = useRef(null);
  const customToRef = useRef(null);

  // State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});
  const [outlets, setOutlets] = useState([]);
  const [rows, setRows] = useState([]);
  const [rangeType, setRangeType] = useState("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [entryValues, setEntryValues] = useState(() => {
    const initial = {};
    DEFAULT_OUTLETS.forEach((area) => { initial[area] = ""; });
    return initial;
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCustomFromOpen, setIsCustomFromOpen] = useState(false);
  const [isCustomToOpen, setIsCustomToOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) setIsCalendarOpen(false);
      if (customFromRef.current && !customFromRef.current.contains(event.target)) setIsCustomFromOpen(false);
      if (customToRef.current && !customToRef.current.contains(event.target)) setIsCustomToOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load outlets
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
      const outletsList = (e?.detail && Array.isArray(e.detail)) ? e.detail : null;
      if (outletsList) {
        setOutlets(outletsList);
      } else {
        loadOutletsFromLocal();
      }
    };

    window.addEventListener('egg:outlets-updated', onUpdate);
    const onStorage = (evt) => { if (evt.key === STORAGE_KEY) onUpdate(); };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('egg:outlets-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Fetch payments
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await fetch(`${API_URL}/cash-payments/all`);
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

    const filtered = (!from || !to) ? rows : rows.filter((row) => {
      const d = new Date(row.date);
      return d >= from && d <= to;
    });

    return filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [rows, rangeType, customFrom, customTo]);

  // Totals with memoization
  const totals = useMemo(() => {
    const outletTotals = {};
    if (Array.isArray(outlets) && outlets.length > 0) {
      outlets.forEach((outletObj) => {
        const area = outletObj.area || outletObj;
        outletTotals[area] = filteredRows.reduce((sum, row) => 
          sum + (row.outlets[area] || 0), 0
        );
      });
    }

    const grandTotal = filteredRows.reduce((sum, row) => 
      sum + (row.totalAmount || 0), 0
    );

    return { outletTotals, grandTotal };
  }, [filteredRows, outlets]);

  // Handlers with useCallback
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
      const response = await fetch(`${API_URL}/cash-payments/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: entryDate, outlets: outletAmounts }),
      });

      if (!response.ok) {
        console.error('Failed to add payment');
        alert('Failed to add payment');
        return;
      }

      const res = await fetch(`${API_URL}/cash-payments/all`);
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
    setEditValues({ ...row.outlets });
    setEditModalOpen(true);
  }, [rows]);

  const handleEditSave = useCallback(async () => {
    if (isEditSaving) return; // Prevent double submission
    
    if (!editRow.id) {
      alert("No ID found for entry. Cannot update.");
      return;
    }

    const updatedOutlets = { ...editValues };
    const totalAmount = Object.values(updatedOutlets).reduce((s, v) => s + (Number(v) || 0), 0);

    setIsEditSaving(true);
    try {
      const response = await fetch(`${API_URL}/cash-payments/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editRow.date, outlets: updatedOutlets, totalAmount }),
      });

      if (!response.ok) {
        alert("Failed to update entry: " + response.status);
        return;
      }

      const res = await fetch(`${API_URL}/cash-payments/all`);
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
  }, [editRow, editValues, isEditSaving]);

  const downloadExcel = useCallback(() => {
    if (!filteredRows || filteredRows.length === 0) {
      alert("No data available");
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
  }, [filteredRows, outlets]);

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8">
      {(isAdmin || isViewer || isDataAgent) && (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Cash Payments</h1>
              <p className="mt-1 text-sm md:text-base text-gray-500">Manage and record daily cash collections across outlets.</p>
            </div>
            <button onClick={downloadExcel} className="inline-flex items-center rounded-full bg-[#ff7518] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90">
              Export Report
            </button>
          </div>

          {(isAdmin || isDataAgent) && (
            <div className="mb-6 rounded-2xl bg-eggWhite p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-lg text-orange-500">₹</div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 md:text-lg">Cash Payment Entry</h2>
                  <p className="text-xs text-gray-500 md:text-sm">Enter cash amounts collected for today.</p>
                </div>
              </div>

              <form onSubmit={handleSaveEntry} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-[160px,1fr] sm:items-center">
                  <label className="text-xs font-medium text-gray-700 md:text-sm">Collection Date</label>
                  <div className="relative w-full z-30" ref={calendarRef}>
                    <button type="button" onClick={() => setIsCalendarOpen((o) => !o)} className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                      <span>{entryDate ? formatDisplayDate(entryDate) : "Select date"}</span>
                      <CalendarIcon className="h-4 w-4 text-gray-500" />
                    </button>

                    {hasEntry && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="text-xs font-medium text-green-700">Entry ({formatCurrencyNoDecimals(entryTotal)}) • Locked</div>
                      </div>
                    )}

                    {isCalendarOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2">
                        <CashCalendar rows={rows} selectedDate={entryDate} onSelectDate={(iso) => { setEntryDate(iso); setIsCalendarOpen(false); }} />
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
                          <input type="number" min="0" step="1" value={entryValues[area] || ""} onChange={(e) => handleEntryChange(area, e.target.value)} disabled={hasEntry || !isActive} className={`w-full rounded-xl border border-gray-200 bg-eggBg pl-7 pr-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm ${(hasEntry || !isActive) ? 'bg-gray-50 cursor-not-allowed' : ''}`} />
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
                  <p className="text-center text-[11px] text-gray-500 md:text-xs">Note: Cash values must be whole numbers only. No decimals allowed.</p>
                </div>
              </form>
            </div>
          )}

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setRangeType("thisMonth")} className={`rounded-full px-4 py-2 text-xs md:text-sm font-medium border ${rangeType === "thisMonth" ? "bg-orange-500 text-white border-orange-500" : "bg-eggWhite text-gray-700 border-gray-200 hover:bg-gray-50"}`}>This Month</button>
              <button onClick={() => setRangeType("lastMonth")} className={`rounded-full px-4 py-2 text-xs md:text-sm font-medium border ${rangeType === "lastMonth" ? "bg-orange-500 text-white border-orange-500" : "bg-eggWhite text-gray-700 border-gray-200 hover:bg-gray-50"}`}>Last Month</button>
              <button onClick={() => setRangeType("custom")} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs md:text-sm font-medium border ${rangeType === "custom" ? "bg-orange-500 text-white border-orange-500" : "bg-eggWhite text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
                <span>Custom Range</span>
                <CalendarIcon className="h-4 w-4" />
              </button>
            </div>

            {rangeType === "custom" && (
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Date From</label>
                  <div className="relative z-30" ref={customFromRef}>
                    <button type="button" onClick={() => { setIsCustomFromOpen((o) => !o); setIsCustomToOpen(false); }} className="flex min-w-[140px] sm:min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                      <span>{customFrom ? formatDateDMY(customFrom) : "dd-mm-yyyy"}</span>
                      <CalendarIcon className="h-4 w-4 text-gray-500" />
                    </button>
                    {isCustomFromOpen && (
                      <div className="absolute left-0 top-full z-50 mt-2">
                        <CashCalendar rows={[]} selectedDate={customFrom} onSelectDate={(iso) => { setCustomFrom(iso); setIsCustomFromOpen(false); }} showDots={false} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Date To</label>
                  <div className="relative z-30" ref={customToRef}>
                    <button type="button" onClick={() => { setIsCustomToOpen((o) => !o); setIsCustomFromOpen(false); }} className="flex min-w-[140px] sm:min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                      <span>{customTo ? formatDateDMY(customTo) : "dd-mm-yyyy"}</span>
                      <CalendarIcon className="h-4 w-4 text-gray-500" />
                    </button>
                    {isCustomToOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2">
                        <CashCalendar rows={[]} selectedDate={customTo} onSelectDate={(iso) => { setCustomTo(iso); setIsCustomToOpen(false); }} showDots={false} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DailyTable rows={filteredRows} outlets={outlets} onEdit={handleEditClick} />

          {editModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
                <h2 className="text-base sm:text-lg font-semibold mb-4">Edit Cash Payment ({editRow.date})</h2>
                <div className="space-y-3">
                  {outlets.map((o) => {
                    const area = o.area || o;
                    return (
                      <div key={area} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="w-full sm:w-32 text-xs font-medium text-gray-700">{area}</label>
                        <input type="number" min="0" step="1" value={editValues[area] ?? 0} onChange={e => setEditValues((prev) => ({ ...prev, [area]: Number(e.target.value) }))} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400" />
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