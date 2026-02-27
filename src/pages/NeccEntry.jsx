import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* ================= CALENDAR ICON ================= */
const CalendarIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <circle cx="8.5" cy="14.5" r="1" /><circle cx="12" cy="14.5" r="1" /><circle cx="15.5" cy="14.5" r="1" />
    <circle cx="8.5" cy="18" r="1" /><circle cx="12" cy="18" r="1" /><circle cx="15.5" cy="18" r="1" />
  </svg>
);

/* ================= CALENDAR (with per-outlet dots) ================= */
const NeccCalendar = ({ enteredDates, selectedDate, onSelectDate }) => {
  const today = new Date();
  const initial = selectedDate ? new Date(selectedDate) : today;
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [viewYear,  setViewYear]  = useState(initial.getFullYear());

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    if (!isNaN(d.getTime())) { setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }
  }, [selectedDate]);

  const weeks = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const w = []; let day = 1 - firstDay;
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let i = 0; i < 7; i++, day++) row.push(day < 1 || day > daysInMonth ? null : day);
      w.push(row);
    }
    return w;
  }, [viewYear, viewMonth]);

  const buildIso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const prevMonth = () => setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; });
  const nextMonth = () => setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; });

  const yearOptions = useMemo(() => { const o = []; for (let y = viewYear - 3; y <= viewYear + 3; y++) o.push(y); return o; }, [viewYear]);
  const selectedIso = selectedDate || "";

  return (
    <div className="w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button type="button" onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">‹</button>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400" value={viewMonth} onChange={e => setViewMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m.slice(0, 3)}</option>)}
          </select>
          <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400" value={viewYear} onChange={e => setViewYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">›</button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 pb-1">
        <div className="flex items-center gap-1 text-[10px] text-gray-500"><div className="h-2 w-2 rounded-full bg-green-500" /> Entered</div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500"><div className="h-2 w-2 rounded-full bg-red-400 opacity-50" /> Not entered</div>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-4 text-center text-[11px] font-medium text-gray-400">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-3 pb-3 text-center text-xs">
        {weeks.map((week, wIdx) =>
          week.map((d, idx) => {
            if (!d) return <div key={`${wIdx}-${idx}`} />;
            const iso = buildIso(viewYear, viewMonth, d);
            const hasEntry = enteredDates.has(iso);
            const isSelected = selectedIso === iso;
            const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;
            return (
              <button key={`${wIdx}-${idx}`} type="button" onClick={() => onSelectDate(iso)} className="flex flex-col items-center gap-1">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isSelected ? "bg-green-500 text-white" : isToday ? "border border-green-500 text-green-600" : "text-gray-700 hover:bg-gray-100"}`}>{d}</div>
                <div className={`h-1.5 w-1.5 rounded-full ${hasEntry ? "bg-green-500" : "bg-red-400 opacity-40"}`} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

const formatDisplayDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/* ================= MAIN ================= */
export default function NeccEntry() {
  const navigate = useNavigate();
  const calendarRef = useRef(null);

  const [outlets,    setOutlets]    = useState([]);
  const [outlet,     setOutlet]     = useState("");
  const [date,       setDate]       = useState("");
  const [rate,       setRate]       = useState("");
  const [remarks,    setRemarks]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [isCalOpen,  setIsCalOpen]  = useState(false);

  // All existing necc records — used to compute per-outlet dots & lock
  const [allNecc, setAllNecc] = useState([]);

  /* ---- click outside ---- */
  useEffect(() => {
    const h = (e) => { if (calendarRef.current && !calendarRef.current.contains(e.target)) setIsCalOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ---- load outlets ---- */
  useEffect(() => {
    fetch(`${API_URL}/outlets/all`).then(r => r.json()).then(d => setOutlets(Array.isArray(d) ? d : [])).catch(() => setOutlets([]));
  }, []);

  /* ---- load all necc records ---- */
  const loadNecc = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/neccrate/all`);
      const data = await res.json();
      setAllNecc(Array.isArray(data) ? data : []);
    } catch { setAllNecc([]); }
  }, []);

  useEffect(() => { loadNecc(); }, [loadNecc]);

  /* ---- calendar dots: dates where THIS outlet already has a rate ---- */
  const enteredDates = useMemo(() => {
    if (!outlet) return new Set();
    const s = new Set();
    allNecc.forEach(doc => {
      const docDate = (doc.date || doc.createdAt || "").slice(0, 10);
      // per-outlet record
      if (doc.outlet === outlet) s.add(docDate);
      // outlets map structure
      if (doc.outlets && doc.outlets[outlet] !== undefined) s.add(docDate);
    });
    return s;
  }, [allNecc, outlet]);

  /* ---- is this outlet+date already locked? ---- */
  const isLocked = useMemo(() => {
    if (!outlet || !date) return false;
    return enteredDates.has(date);
  }, [outlet, date, enteredDates]);

  /* ---- pre-fill rate if locked ---- */
  useEffect(() => {
    if (!outlet || !date) { setRate(""); setRemarks(""); return; }
    if (isLocked) {
      const found = allNecc.find(doc => {
        const docDate = (doc.date || doc.createdAt || "").slice(0, 10);
        return docDate === date && (doc.outlet === outlet || (doc.outlets && doc.outlets[outlet] !== undefined));
      });
      if (found) {
        setRate(found.outlets ? (found.outlets[outlet] ?? found.rate ?? "") : (found.rate ?? ""));
        setRemarks(found.remarks || "");
      }
    } else {
      setRate(""); setRemarks("");
    }
  }, [outlet, date, isLocked, allNecc]);

  /* ---- submit ---- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!outlet) { alert("Please select an outlet"); return; }
    if (!date)   { alert("Please select a date"); return; }
    if (!rate)   { alert("Please enter a rate"); return; }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/neccrate/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, outlet, rate: Number(rate), remarks }),
      });

      if (!response.ok) { alert("Failed to save NECC rate"); return; }

      alert("NECC Rate added successfully ✅");
      await loadNecc();
      navigate("/admin/neccrate");
    } catch (err) {
      console.error(err); alert("Error saving entry");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (locked) => [
    "w-full border p-3 rounded-xl text-sm text-gray-800 md:text-base transition-colors",
    locked ? "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-400" : "border-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400",
  ].join(" ");

  return (
    <div className="min-h-screen bg-eggBg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-6 text-gray-900">NECC Rate Entry</h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ---- Outlet ---- */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Outlet</label>
            <select
              value={outlet}
              onChange={e => { setOutlet(e.target.value); setDate(""); }}
              className="w-full border border-gray-900 bg-white p-3 rounded-xl text-sm text-gray-800 md:text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">Select Outlet</option>
              {outlets.map(o => {
                const name = o.name || o.area || o.id;
                const status = o.status || "Active";
                return <option key={o.id || name} value={o.id || name}>{name} ({status})</option>;
              })}
            </select>
          </div>

          {/* ---- Date ---- */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Date</label>
            <div className="relative z-30" ref={calendarRef}>
              <button
                type="button"
                disabled={!outlet}
                onClick={() => outlet && setIsCalOpen(o => !o)}
                className={[
                  "flex w-full items-center justify-between border p-3 rounded-xl text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-orange-400",
                  !outlet ? "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-400" : "border-gray-900 bg-white text-gray-800",
                ].join(" ")}
              >
                <span className={date ? "text-gray-800" : "text-gray-400"}>
                  {!outlet ? "Select an outlet first" : date ? formatDisplayDate(date) : "Select date"}
                </span>
                <CalendarIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
              </button>

              {isCalOpen && outlet && (
                <div className="absolute right-0 top-full z-50 mt-2">
                  <NeccCalendar
                    enteredDates={enteredDates}
                    selectedDate={date}
                    onSelectDate={iso => { setDate(iso); setIsCalOpen(false); }}
                  />
                </div>
              )}
            </div>
            {!outlet && <p className="text-xs text-orange-500 mt-1">Select an outlet to enable date selection.</p>}
          </div>

          {/* ---- Locked banner ---- */}
          {isLocked && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-2">
              <span className="text-green-600 text-lg">✅</span>
              <div>
                <p className="text-sm font-semibold text-green-700">Already submitted</p>
                <p className="text-xs text-green-600">NECC rate for this outlet and date is already saved. Fields are locked.</p>
              </div>
            </div>
          )}

          {/* ---- Rate ---- */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Rate</label>
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={e => setRate(e.target.value)}
              disabled={isLocked}
              placeholder="Enter NECC rate"
              className={inputCls(isLocked)}
            />
          </div>

          {/* ---- Remarks ---- */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Remarks <span className="text-xs text-gray-400 font-normal">(Optional)</span></label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              disabled={isLocked}
              rows="3"
              placeholder="Any remarks..."
              className={inputCls(isLocked) + " resize-none"}
            />
          </div>

          {/* ---- Buttons ---- */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/admin/neccrate")}
              className="px-5 py-2.5 rounded-2xl border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 md:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isLocked}
              className={[
                "px-6 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-md md:text-base inline-flex items-center gap-2",
                loading || isLocked ? "bg-gray-300 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600",
              ].join(" ")}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : isLocked ? "Already Saved" : "Save Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}