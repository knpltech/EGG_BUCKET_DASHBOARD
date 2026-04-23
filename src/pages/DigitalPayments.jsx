import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
const API_URL = import.meta.env.VITE_API_URL;
import { getRoleFlags, zonesMatch } from "../utils/role";
import { getThisWeekRange } from "../utils/dateRange";

const STORAGE_KEY = "egg_outlets_v1";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatCurrencyTwoDecimals = (value) => {
  if (value == null || isNaN(value)) return "₹0.00";
  return "₹" + Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Smart formatter: preserves whole numbers, only shows decimals when needed
const formatSmart = (value, withRupee = true) => {
  if (value == null || value === "" || isNaN(Number(value))) return withRupee ? "₹0" : "0";
  const num = Number(value);
  const formatted = num % 1 === 0
    ? num.toLocaleString("en-IN")
    : num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withRupee ? `₹${formatted}` : formatted;
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

const BaseCalendar = ({ rows, selectedDate, onSelectDate, showDots }) => {
  const today = new Date();
  const initialDate = selectedDate ? new Date(selectedDate) : today;

  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    if (!Number.isNaN(d.getTime())) { setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }
  }, [selectedDate]);

  const hasEntryForDate = useCallback((iso) =>
    Array.isArray(rows) && rows.some((row) => row.date === iso), [rows]);

  const { weeks } = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const weeks = [];
    let day = 1 - firstDay;
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let i = 0; i < 7; i++, day++) week.push(day < 1 || day > daysInMonth ? null : day);
      weeks.push(week);
    }
    return { weeks };
  }, [viewYear, viewMonth]);

  const buildIso = useCallback((year, month, day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, []);

  const goPrevMonth = useCallback(() => setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; }), []);
  const goNextMonth = useCallback(() => setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; }), []);
  const yearOptions = useMemo(() => { const opts = []; for (let y = viewYear - 3; y <= viewYear + 3; y++) opts.push(y); return opts; }, [viewYear]);
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
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  const defaultWeekRange = useMemo(() => getThisWeekRange(), []);
  const showForms = isAdmin || isDataAgent;
  const showTable = isAdmin || isDataAgent || isSupervisor || isViewer;

  const entryCalendarRef = useRef(null);
  const filterFromRef = useRef(null);
  const filterToRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);

  const formOutlets = useMemo(() => {
    if (zone && Array.isArray(outlets)) {
      return outlets.filter(o => typeof o === 'object' && zonesMatch(o.zoneId, zone));
    }
    return outlets;
  }, [outlets, zone]);

  const displayedOutlets = isSupervisor ? formOutlets : outlets;

  const [filterFrom, setFilterFrom] = useState(defaultWeekRange.from);
  const [filterTo, setFilterTo] = useState(defaultWeekRange.to);
  const [entryDate, setEntryDate] = useState("");
  const [entryValues, setEntryValues] = useState({});
  const [isEntryCalendarOpen, setIsEntryCalendarOpen] = useState(false);
  const [isFilterFromOpen, setIsFilterFromOpen] = useState(false);
  const [isFilterToOpen, setIsFilterToOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (entryCalendarRef.current && !entryCalendarRef.current.contains(event.target)) setIsEntryCalendarOpen(false);
      if (filterFromRef.current && !filterFromRef.current.contains(event.target)) setIsFilterFromOpen(false);
      if (filterToRef.current && !filterToRef.current.contains(event.target)) setIsFilterToOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadOutlets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/outlets/all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setOutlets(data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } else setOutlets([]);
      }
    } catch (err) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { try { const p = JSON.parse(saved); if (Array.isArray(p) && p.length > 0) setOutlets(p); } catch {} }
      else setOutlets([]);
    }
  }, []);

  useEffect(() => { loadOutlets(); }, []);

  useEffect(() => {
    const handleOutletsUpdated = (e) => { if (e.detail && Array.isArray(e.detail)) { setOutlets(e.detail); localStorage.setItem(STORAGE_KEY, JSON.stringify(e.detail)); } };
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadOutlets(); };
    const handleStorage = (e) => { if (e.key === STORAGE_KEY && e.newValue) { try { const p = JSON.parse(e.newValue); if (Array.isArray(p) && p.length > 0) setOutlets(p); } catch {} } };
    window.addEventListener('egg:outlets-updated', handleOutletsUpdated);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('egg:outlets-updated', handleOutletsUpdated);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadOutlets]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await fetch(`${API_URL}/digital-payments/all`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data.map(d => ({ id: d.id || d._id, ...d })) : []);
      } catch { setRows([]); }
    };
    fetchPayments();
  }, []);

  const hasEntry = useMemo(() => {
    if (!entryDate) return false;
    const existing = rows.find((r) => r.date === entryDate);
    if (!existing) return false;
    return formOutlets.some((outlet) => {
      const area = outlet.area || outlet;
      return Number(existing.outlets?.[area] || 0) > 0;
    });
  }, [entryDate, rows, formOutlets]);

  useEffect(() => {
    if (!entryDate) { const reset = {}; formOutlets.forEach((o) => { reset[o.area || o] = ""; }); setEntryValues(reset); return; }
    const existing = rows.find((r) => r.date === entryDate);
    if (existing) {
      const vals = {};
      formOutlets.forEach((o) => { const area = o.area || o; vals[area] = existing.outlets?.[area] ?? ""; });
      setEntryValues(vals);
    } else {
      const reset = {};
      formOutlets.forEach((o) => { reset[o.area || o] = ""; });
      setEntryValues(reset);
    }
  }, [entryDate, rows, formOutlets]);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (filterFrom && filterTo) { const from = new Date(filterFrom); const to = new Date(filterTo); return sorted.filter(r => { const d = new Date(r.date); return d >= from && d <= to; }); }
    if (filterFrom) { const from = new Date(filterFrom); return sorted.filter(r => new Date(r.date) >= from); }
    if (filterTo) { const to = new Date(filterTo); return sorted.filter(r => new Date(r.date) <= to); }
    return sorted;
  }, [rows, filterFrom, filterTo]);

  // Recompute totals from outlets object (area-keyed) so edits reflect immediately
  const getRowOutletValue = useCallback((row, outlet) => {
    const area = outlet.area || outlet.name || outlet.id;
    return Number(row.outlets?.[area] || 0);
  }, []);

  const getRowTotal = useCallback((row) => {
    return displayedOutlets.reduce((s, o) => s + getRowOutletValue(row, o), 0);
  }, [displayedOutlets, getRowOutletValue]);

  const columnTotals = useMemo(() => {
    const totals = {};
    displayedOutlets.forEach((outlet) => {
      const area = outlet.area || outlet.name || outlet.id;
      totals[area] = filteredRows.reduce((sum, r) => sum + Number(r.outlets?.[area] || 0), 0);
    });
    totals.grandTotal = filteredRows.reduce((sum, r) => sum + getRowTotal(r), 0);
    return totals;
  }, [filteredRows, displayedOutlets, getRowTotal]);

  const handleQuickRange = useCallback((type) => {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    if (type === "thisMonth") { setFilterFrom(iso(new Date(today.getFullYear(), today.getMonth(), 1))); setFilterTo(iso(today)); }
    else if (type === "lastMonth") { setFilterFrom(iso(new Date(today.getFullYear(), today.getMonth() - 1, 1))); setFilterTo(iso(new Date(today.getFullYear(), today.getMonth(), 0))); }
    else if (type === "thisWeek") { const s = new Date(today); s.setDate(today.getDate() - today.getDay()); setFilterFrom(iso(s)); setFilterTo(iso(today)); }
    else if (type === "lastWeek") { const e = new Date(today); e.setDate(today.getDate() - today.getDay() - 1); const s = new Date(e); s.setDate(e.getDate() - 6); setFilterFrom(iso(s)); setFilterTo(iso(e)); }
  }, []);

  const handleEntryChange = useCallback((outlet, value) => {
    setEntryValues((prev) => ({ ...prev, [outlet]: value }));
  }, []);

  const handleSaveEntry = useCallback(async (e) => {
    e.preventDefault();
    if (isSaving || !entryDate || hasEntry) { if (hasEntry) alert("Already entered for your outlets on this date"); return; }
    const outletAmounts = {};
    formOutlets.forEach((o) => { const area = o.area || o; outletAmounts[area] = Number(entryValues[area]) || 0; });

    let user = null;
    try { user = JSON.parse(localStorage.getItem("user")); } catch {}
    const addedBy = user ? {
      username: user.username || user.uid || "Unknown",
      zone: user.zoneId || user.zone || "No Zone",
      role: user.role || "unknown",
      timestamp: new Date().toISOString(),
    } : null;

    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/digital-payments/add`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: entryDate, outlets: outletAmounts, addedBy }) });
      if (!response.ok) { alert('Failed to add payment'); return; }
      const res = await fetch(`${API_URL}/digital-payments/all`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map(d => ({ id: d.id || d._id, ...d })) : []);
      alert(`Saved digital payment entry for ${entryDate}`);
    } catch { alert('Error adding payment'); } finally { setIsSaving(false); }
  }, [entryDate, entryValues, formOutlets, hasEntry, isSaving]);

  const downloadExcel = useCallback(() => {
    if (!filteredRows?.length) { alert("No data available"); return; }
    const data = filteredRows.map((row) => {
      const obj = { Date: formatDateDMY(row.date) };
      outlets.forEach((o) => { const area = o.area || o; obj[area] = Number(row.outlets?.[area] ?? 0); });
      obj.Total = getRowTotal(row);
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Digital Payments");
    XLSX.writeFile(wb, "Digital_Payments_Report.xlsx");
  }, [filteredRows, outlets, getRowTotal]);

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">
      {showTable && (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Digital Payments</h1>
              <p className="mt-1 text-sm md:text-base text-gray-500">Track UPI and online collections per outlet.</p>
            </div>
            <button onClick={downloadExcel} className="inline-flex items-center rounded-full bg-[#ff7518] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90">Download Data</button>
          </div>

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
              {[["thisMonth","This Month"],["lastMonth","Last Month"],["thisWeek","This Week"],["lastWeek","Last Week"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => handleQuickRange(k)} className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">{l}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl bg-eggWhite shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold text-gray-500">
                    <th className="sticky left-0 bg-gray-50 z-10 min-w-[120px] px-4 py-3">Date</th>
                    {displayedOutlets.map((outlet) => {
                      const outletId = outlet.id;
                      const name = outlet.area || outlet.name || outletId;
                      const isActive = !outlet.status || outlet.status === "Active";
                      return (
                        <th key={outletId} className="min-w-[100px] px-4 py-3 whitespace-nowrap">
                          {name.toUpperCase()}
                          {!isActive && <span className="text-red-500 text-[10px] block">(Inactive)</span>}
                        </th>
                      );
                    })}
                    <th className="sticky right-0 bg-gray-50 z-10 px-4 py-3 whitespace-nowrap text-right">TOTAL AMOUNT</th>

                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={displayedOutlets.length + 2 + (isAdmin ? 1 : 0)} className="text-center py-6 text-gray-500">No data available</td></tr>
                  ) : (
                    <>
                      {filteredRows.map((row, idx) => {
                        // Recompute total from outlets (area-keyed) so edits reflect immediately
                        const rowTotal = displayedOutlets.reduce((s, o) => {
                          const area = o.area || o.name || o.id;
                          return s + Number(row.outlets?.[area] || 0);
                        }, 0);
                        return (
                          <tr key={row.id} className={`text-xs text-gray-700 md:text-sm ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                            <td className="sticky left-0 bg-inherit z-10 whitespace-nowrap px-4 py-3">{formatDisplayDate(row.date)}</td>
                            {displayedOutlets.map((outlet) => {
                              const area = outlet.area || outlet.name || outlet.id;
                              return <td key={outlet.id} className="whitespace-nowrap px-4 py-3">{formatSmart(row.outlets?.[area])}</td>;
                            })}
                            <td className="sticky right-0 bg-inherit z-10 whitespace-nowrap px-4 py-3 text-right font-semibold">
                              {formatSmart(rowTotal)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-orange-50 font-semibold text-orange-700 border-t-2 border-orange-200">
                        <td className="sticky left-0 bg-orange-50 z-10 whitespace-nowrap px-4 py-3">Grand Total</td>
                        {displayedOutlets.map((outlet) => {
                          const area = outlet.area || outlet.name || outlet.id;
                          return <td key={outlet.id} className="whitespace-nowrap px-4 py-3">{formatSmart(columnTotals[area])}</td>;
                        })}
                        <td className="sticky right-0 bg-orange-50 z-10 whitespace-nowrap px-4 py-3 text-right">{formatSmart(columnTotals.grandTotal)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
