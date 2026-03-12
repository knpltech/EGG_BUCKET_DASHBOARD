const API_URL = import.meta.env.VITE_API_URL;
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDamage } from "../context/DamageContext";
import * as XLSX from "xlsx";
import { getRoleFlags, zonesMatch } from "../utils/role";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// One distinct color per outlet (up to 10 outlets)
const OUTLET_COLORS = [
  "#ff7518", "#3b82f6", "#10b981", "#8b5cf6",
  "#f59e0b", "#ef4444", "#06b6d4", "#ec4899",
  "#84cc16", "#a855f7",
];

function formatDateDMY(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatDateDisplay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString('en-GB').replace(/\//g, '-');
}

// Short label for chart X-axis: DD/MM
function formatDateShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function CalendarIcon({ className = "" }) {
  return (
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
}

function DamageEntryIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#FFEFE0" />
      <path d="M10 12C10 10.8954 10.8954 10 12 10H20C21.1046 10 22 10.8954 22 12V20C22 21.1046 21.1046 22 20 22H12C10.8954 22 10 21.1046 10 20V12Z" fill="#FF9D3A" />
      <path d="M15 14L17 16M17 14L15 16" stroke="#FFEFE0" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M18.2 18.2L22.5 13.9C22.8 13.6 23.3 13.6 23.6 13.9L24.6 14.9C24.9 15.2 24.9 15.7 24.6 16L20.3 20.3L18.2 18.2Z" fill="#FF7A1A" />
      <path d="M18 18.5L17.3 21.2C17.2 21.6 17.6 22 18 21.9L20.7 21.2" stroke="#FF7A1A" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BaseCalendar({ rows, selectedDate, onSelectDate, showDots }) {
  const today = new Date();
  const initialDate = selectedDate ? new Date(selectedDate) : today;
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [viewYear,  setViewYear]  = useState(initialDate.getFullYear());

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    if (!Number.isNaN(d.getTime())) { setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }
  }, [selectedDate]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();

  const hasEntryForDate = (iso) => Array.isArray(rows) && rows.some((row) => row.date === iso);
  const buildIso = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const weeks = [];
  let day = 1 - firstDay;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++, day++) week.push(day < 1 || day > daysInMonth ? null : day);
    weeks.push(week);
  }

  const goPrevMonth = () => setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; });
  const goNextMonth = () => setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; });
  const yearOptions = [];
  for (let y = viewYear - 3; y <= viewYear + 3; y++) yearOptions.push(y);
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
            const iso      = buildIso(viewYear, viewMonth, d);
            const hasEntry = showDots && hasEntryForDate(iso);
            const isSelected = selectedIso === iso;
            const isToday  = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;
            const wrapperClass = showDots ? "flex flex-col items-center gap-1" : "flex h-8 items-center justify-center";
            return (
              <button key={`${wIdx}-${idx}`} type="button" onClick={() => onSelectDate(iso)} className={wrapperClass}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isSelected ? "bg-green-500 text-white" : isToday ? "border border-green-500 text-green-600" : "text-gray-700 hover:bg-gray-100"}`}>{d}</div>
                {showDots && <div className={`h-1.5 w-1.5 rounded-full ${hasEntry ? "bg-green-500" : "bg-red-400"}`} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   DAMAGE ANALYTICS GRAPH — inserted below the table
   Props:
     filteredData : same filtered+sorted array the table renders
     outlets      : full outlets array from state
   ===================================================================== */
function DamageAnalytics({ filteredData, outlets }) {
  const [chartType, setChartType] = useState("bar"); // "line" | "bar"

  // Build stable outlet metadata (key, display name, color)
  const outletMeta = useMemo(() =>
    outlets.map((o, i) => ({
      key:   typeof o === "string" ? o : o.area,
      name:  typeof o === "string" ? o : (o.area || o.id || o.name || String(o)),
      color: OUTLET_COLORS[i % OUTLET_COLORS.length],
    })),
    [outlets]
  );

  // All outlets start active; toggling hides/shows individual lines
  const [activeKeys, setActiveKeys] = useState(() => new Set(outletMeta.map(o => o.key)));

  // Re-sync when outlets list changes
  useEffect(() => {
    setActiveKeys(new Set(outletMeta.map(o => o.key)));
  }, [outletMeta]);

  const toggleOutlet = (key) => {
    setActiveKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); } // keep at least one
      else next.add(key);
      return next;
    });
  };

  // One data point per date
  const chartData = useMemo(() =>
    filteredData.map(row => {
      const point = { date: formatDateShort(row.date) };
      outletMeta.forEach(({ key, name }) => { point[name] = Number(row[key] || 0); });
      return point;
    }),
    [filteredData, outletMeta]
  );

  // Nothing to render if no data or outlets
  if (filteredData.length === 0 || outlets.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[150px]">
        <p className="font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4 mt-0.5">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span style={{ color: p.color }} className="font-medium">{p.name}</span>
            </span>
            <span className="font-semibold text-gray-800">{Number(p.value).toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-8">

      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Damage Trend Analysis</h2>
          <p className="text-xs text-gray-500 mt-0.5">Visualise egg damage trends per outlet for the selected date range</p>
        </div>
        {/* Line / Bar toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 self-start">
          <button
            onClick={() => setChartType("line")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${chartType === "line" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >Line</button>
          <button
            onClick={() => setChartType("bar")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${chartType === "bar" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >Bar</button>
        </div>
      </div>

      {/* Outlet toggle pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {outletMeta.map(({ key, name, color }) => {
          const active = activeKeys.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleOutlet(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active ? "bg-white border-gray-200 text-gray-700 shadow-sm" : "bg-gray-50 border-gray-100 text-gray-400"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, opacity: active ? 1 : 0.3 }} />
              {name}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString("en-IN")} width={48} />
              <Tooltip content={<CustomTooltip />} />
              {outletMeta.map(({ key, name, color }) =>
                activeKeys.has(key) ? (
                  <Line key={key} type="monotone" dataKey={name} stroke={color} strokeWidth={2}
                    dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} isAnimationActive />
                ) : null
              )}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString("en-IN")} width={48} />
              <Tooltip content={<CustomTooltip />} />
              {outletMeta.map(({ key, name, color }) =>
                activeKeys.has(key) ? (
                  <Bar key={key} dataKey={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive />
                ) : null
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* =====================================================================
   MAIN PAGE — identical to original; only addition is <DamageAnalytics>
   ===================================================================== */
export default function DailyDamages() {
  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  console.log('DailyDamages - isSupervisor:', isSupervisor, '| zone:', zone);

  const showForms = isAdmin || isDataAgent;
  const { damages, setDamages, addDamage } = useDamage();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow,       setEditRow]       = useState({});
  const [editValues,    setEditValues]    = useState({});

  const fromCalendarRef = useRef(null);
  const toCalendarRef   = useRef(null);

  const [isFromCalendarOpen, setIsFromCalendarOpen] = useState(false);
  const [isToCalendarOpen,   setIsToCalendarOpen]   = useState(false);

  const STORAGE_KEY = "egg_outlets_v1";
  const [outlets, setOutlets] = useState([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fromCalendarRef.current  && !fromCalendarRef.current.contains(event.target))  setIsFromCalendarOpen(false);
      if (toCalendarRef.current    && !toCalendarRef.current.contains(event.target))    setIsToCalendarOpen(false);
      if (entryCalendarRef.current && !entryCalendarRef.current.contains(event.target)) setIsEntryCalendarOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fromCalendarRef, toCalendarRef]);

  useEffect(() => {
    const fetchDamages = async () => {
      try {
        const res  = await fetch(`${API_URL}/daily-damage/all`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setDamages(data.map(d => ({
            id: d.id, date: d.date,
            ...((d.damages && typeof d.damages === 'object') ? d.damages : {}),
            total: d.total || 0,
          })));
        }
      } catch (err) {}
    };
    fetchDamages();
  }, [setDamages]);

  const loadOutlets = useCallback(async () => {
    try {
      const url = `${API_URL}/outlets/all`;
      console.log('DailyDamages loadOutlets URL:', url);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) { setOutlets(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
        else setOutlets([]);
      }
    } catch (err) {
      console.error("Error fetching outlets:", err);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) setOutlets(parsed); }
        catch (parseErr) { console.error("Error parsing saved outlets:", parseErr); setOutlets([]); }
      } else setOutlets([]);
    }
  }, []);

  useEffect(() => { loadOutlets(); }, [loadOutlets]);

  const formOutlets = useMemo(() => {
    if (isViewer) return outlets;
    if (zone) {
      return outlets.filter((outlet) => {
        const outletZone = typeof outlet === 'string' ? null : outlet.zoneId;
        return zonesMatch(outletZone, zone);
      });
    }
    return outlets;
  }, [outlets, zone, isViewer]);

  console.log('DailyDamages - outlets count:', outlets.length, '| formOutlets count:', formOutlets.length);

  const displayedOutlets = (isSupervisor ? formOutlets : outlets).map(o => typeof o === 'string' ? o : o.id);
  const displayedOutletObjects = isSupervisor ? formOutlets : outlets;

  const getAreaFromDisplayedOutlet = (outletId) => {
    const outletObj = displayedOutletObjects.find(o => (typeof o === 'string' ? o : o.id) === outletId);
    return outletObj ? (typeof outletObj === 'string' ? outletObj : outletObj.area) : outletId;
  };

  useEffect(() => {
    const handleOutletsUpdated = (event) => {
      if (event.detail && Array.isArray(event.detail)) { setOutlets(event.detail); localStorage.setItem(STORAGE_KEY, JSON.stringify(event.detail)); }
    };
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') loadOutlets(); };
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { const parsed = JSON.parse(e.newValue); if (Array.isArray(parsed) && parsed.length > 0) setOutlets(parsed); }
        catch (err) { console.error("Error parsing storage event:", err); }
      }
    };
    window.addEventListener('egg:outlets-updated', handleOutletsUpdated);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('egg:outlets-updated', handleOutletsUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadOutlets]);



  const handleEditClick = (row) => {
    const fullRow = { ...row };
    if (!row.id) { const found = damages.find(d => d.date === row.date); if (found && found.id) fullRow.id = found.id; }
    setEditRow(fullRow);
    const vals = {};
    outlets.forEach((outlet) => { const area = typeof outlet === 'string' ? outlet : outlet.area; vals[area] = row[area] ?? 0; });
    setEditValues(vals);
    setEditModalOpen(true);
  };

  const handleEditValueChange = (name, value) => setEditValues((prev) => ({ ...prev, [name]: Math.round(Number(value) || 0) }));
  const handleEditCancel = () => { setEditModalOpen(false); setEditRow({}); setEditValues({}); };

  const handleEditSave = async () => {
    if (!editRow.id) { alert("No ID found for entry. Cannot update."); return; }
    // Force all values to whole integers
    const updatedDamages = {};
    outlets.forEach((outlet) => {
      const area = typeof outlet === 'string' ? outlet : outlet.area;
      updatedDamages[area] = Math.round(Number(editValues[area] || 0));
    });
    const total = Object.values(updatedDamages).reduce((s, v) => s + v, 0);
    try {
      const response = await fetch(`${API_URL}/daily-damage/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editRow.date, damages: updatedDamages, total }),
      });
      if (!response.ok) { alert("Failed to update entry: " + response.status); return; }
      const res  = await fetch(`${API_URL}/daily-damage/all`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setDamages(data.map(d => ({
          id: d.id,
          date: d.date,
          // Spread outlet values from damages object so each outlet column updates
          ...((d.damages && typeof d.damages === 'object') ? d.damages : {}),
          // Recalculate total from damages to guarantee consistency
          total: d.damages
            ? Object.values(d.damages).reduce((s, v) => s + Math.round(Number(v) || 0), 0)
            : (d.total || 0),
        })));
      }
      setEditModalOpen(false); setEditRow({}); setEditValues({});
    } catch (err) { alert("Error updating entry: " + err.message); }
  };



  const getFilteredData = () => {
    const sortedUnique = Array.from(
      new Map([...damages].sort((a, b) => new Date(a.date) - new Date(b.date)).map(d => [d.date, d])).values()
    );
    if (!fromDate && !toDate) return sortedUnique;
    let filtered = sortedUnique;
    if (fromDate) filtered = filtered.filter(d => new Date(d.date) >= new Date(fromDate));
    if (toDate)   filtered = filtered.filter(d => new Date(d.date) <= new Date(toDate));
    return filtered;
  };

  const filteredData = getFilteredData();

  const downloadExcel = () => {
    if (filteredData.length === 0) { alert("No data available for selected dates"); return; }
    const data = filteredData.map((row) => {
      const obj = { Date: formatDateDMY(row.date) };
      displayedOutletObjects.forEach((o) => {
        const area = typeof o === 'string' ? o : o.area;
        obj[area] = Number(row[area] ?? 0);
      });
      obj.Total = displayedOutletObjects.reduce((s, o) => s + Number(row[(typeof o === 'string' ? o : o.area)] || 0), 0);
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Damages");
    XLSX.writeFile(wb, "Daily_Damages_Report.xlsx");
  };

  const handleQuickRange = (type) => {
    const today = new Date();
    const iso   = (d) => d.toISOString().slice(0, 10);
    if (type === "thisMonth") { setFromDate(iso(new Date(today.getFullYear(), today.getMonth(), 1)));      setToDate(iso(today)); return; }
    if (type === "lastMonth") { setFromDate(iso(new Date(today.getFullYear(), today.getMonth() - 1, 1))); setToDate(iso(new Date(today.getFullYear(), today.getMonth(), 0))); return; }
    if (type === "thisWeek")  { const s = new Date(today); s.setDate(today.getDate() - today.getDay());   setFromDate(iso(s)); setToDate(iso(today)); return; }
    if (type === "lastWeek")  {
      const e = new Date(today); e.setDate(today.getDate() - today.getDay() - 1);
      const s = new Date(e);    s.setDate(e.getDate() - 6);
      setFromDate(iso(s)); setToDate(iso(e)); return;
    }
    setFromDate(""); setToDate("");
  };

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">
      {(isAdmin || isViewer || isDataAgent || isSupervisor) && (
        <>
          {/* Page header */}
          <div className="max-w-7xl mx-auto w-full mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Daily Damages Report</h1>
              <p className="mt-1 text-sm md:text-base text-gray-500">Track egg damages per outlet and date.</p>
            </div>
            <button onClick={downloadExcel} className="inline-flex items-center rounded-full bg-[#ff7518] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90">
              Download Excel
            </button>
          </div>

          {/* Date filters + quick range buttons */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-gray-700">Date From</label>
                <div className="relative z-30" ref={fromCalendarRef}>
                  <button type="button" onClick={() => setIsFromCalendarOpen((o) => !o)} className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                    <span>{fromDate ? formatDateDMY(fromDate) : "dd-mm-yyyy"}</span>
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  {isFromCalendarOpen && (
                    <div className="absolute left-0 top-full mt-2 z-50">
                      <BaseCalendar rows={damages} selectedDate={fromDate} onSelectDate={(iso) => { setFromDate(iso); setIsFromCalendarOpen(false); }} showDots={false} />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-gray-700">Date To</label>
                <div className="relative z-30" ref={toCalendarRef}>
                  <button type="button" onClick={() => setIsToCalendarOpen((o) => !o)} className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                    <span>{toDate ? formatDateDMY(toDate) : "dd-mm-yyyy"}</span>
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  {isToCalendarOpen && (
                    <div className="absolute left-0 top-full mt-2 z-50">
                      <BaseCalendar rows={damages} selectedDate={toDate} onSelectDate={(iso) => { setToDate(iso); setIsToCalendarOpen(false); }} showDots={false} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "thisMonth", label: "This Month" },
                { key: "lastMonth", label: "Last Month" },
                { key: "thisWeek",  label: "This Week"  },
                { key: "lastWeek",  label: "Last Week"  },
              ].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => handleQuickRange(key)}
                  className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white p-6 rounded-xl shadow mb-8">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-max">
                <thead>
                  <tr className="bg-orange-100 text-sm">
                    <th className="p-3 text-left w-40 sticky left-0 bg-orange-100 z-10">Date</th>
                    {displayedOutlets.map((outlet) => {
                      const outletObj = outlets.find(o => (typeof o === 'string' ? o : o.id) === outlet);
                      const name      = typeof outletObj === 'string' ? outletObj : outletObj?.area || outlet;
                      const isActive  = typeof outletObj === 'string' || !outletObj?.status || outletObj?.status === "Active";
                      return (
                        <th key={outlet} className="p-3 text-center min-w-[120px]">
                          {name}
                          {!isActive && <span className="text-red-500 text-[10px] block">(Inactive)</span>}
                        </th>
                      );
                    })}
                    <th className="p-3 text-center font-semibold min-w-[100px] sticky right-0 bg-orange-100 z-10">Total</th>
                    {isAdmin && <th className="p-3 text-center min-w-[80px]">Edit</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((d, i) => {
                    // Always recompute total from area keys so edits reflect immediately
                    const rowTotal = displayedOutletObjects.reduce((sum, outlet) => {
                      const area = typeof outlet === 'string' ? outlet : outlet.area;
                      return sum + Math.round(Number(d[area] || 0));
                    }, 0);
                    return (
                      <tr key={i} className="border-t text-sm hover:bg-gray-50 transition">
                        <td className="p-3 text-left sticky left-0 bg-white z-10">{formatDateDisplay(d.date)}</td>
                        {displayedOutlets.map((outletId) => {
                          // displayedOutlets contains IDs — resolve to area key for data lookup
                          const area = getAreaFromDisplayedOutlet(outletId);
                          return (
                            <td key={outletId} className="p-3 text-center">{Math.round(Number(d[area] || 0))}</td>
                          );
                        })}
                        <td className="p-3 text-center font-bold text-orange-600 sticky right-0 bg-white z-10">
                          {rowTotal}
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-center">
                            <button className="text-blue-600 hover:underline text-xs font-medium" onClick={() => handleEditClick(d)}>Edit</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {/* Grand Total row */}
                  <tr className="bg-orange-50 font-semibold text-orange-700">
                    <td className="p-3 text-left sticky left-0 bg-orange-50 z-10">Grand Total</td>
                    {displayedOutlets.map((outletId) => {
                      const area = getAreaFromDisplayedOutlet(outletId);
                      const total = filteredData.reduce((sum, d) => sum + Math.round(Number(d[area] || 0)), 0);
                      return <td key={outletId} className="p-3 text-center">{total}</td>;
                    })}
                    <td className="p-3 text-center sticky right-0 bg-orange-50 z-10">
                      {filteredData.reduce((sum, d) => {
                        return sum + displayedOutletObjects.reduce((s, outlet) => {
                          const area = typeof outlet === 'string' ? outlet : outlet.area;
                          return s + Math.round(Number(d[area] || 0));
                        }, 0);
                      }, 0)}
                    </td>
                    {isAdmin && <td className="p-3"></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── GRAPH ANALYSIS (reads same filteredData + outlets) ── */}
          <DamageAnalytics filteredData={filteredData} outlets={displayedOutletObjects} />

          {/* Edit Modal */}
          {editModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-xl shadow-lg p-6 min-w-[320px] max-w-full max-h-[80vh] overflow-y-auto">
                <h2 className="text-lg font-semibold mb-4">Edit Daily Damage ({formatDateDisplay(editRow.date)})</h2>
                <div className="space-y-3">
                  {outlets.map((outlet) => {
                    const area = typeof outlet === 'string' ? outlet : outlet.area;
                    const name = typeof outlet === 'string' ? outlet : (outlet.area || outlet.name || outlet.id || area);
                    return (
                      <div key={area} className="flex items-center gap-2">
                        <label className="w-32 text-xs font-medium text-gray-700">{name}</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editValues[area] ?? 0}
                          onChange={e => handleEditValueChange(area, e.target.value)}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={handleEditCancel} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300">Cancel</button>
                  <button onClick={handleEditSave}   className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600">Save</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}