import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { getRoleFlags } from "../utils/role";

const API = import.meta.env.VITE_API_URL;

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
    <circle cx="8.5" cy="14.5" r="1" />
    <circle cx="12" cy="14.5" r="1" />
    <circle cx="15.5" cy="14.5" r="1" />
    <circle cx="8.5" cy="18" r="1" />
    <circle cx="12" cy="18" r="1" />
    <circle cx="15.5" cy="18" r="1" />
  </svg>
);

/* ================= DATA CALENDAR ================= */
const DataCalendar = ({ completedDates, selectedDate, onSelectDate }) => {
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

  const buildIso = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const goPrevMonth = () => {
    setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; });
  };
  const goNextMonth = () => {
    setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; });
  };

  const yearOptions = useMemo(() => {
    const opts = [];
    for (let y = viewYear - 3; y <= viewYear + 3; y++) opts.push(y);
    return opts;
  }, [viewYear]);

  const selectedIso = selectedDate || "";

  return (
    <div className="w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button type="button" onClick={goPrevMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">‹</button>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400"
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, idx) => <option key={m} value={idx}>{m.slice(0, 3)}</option>)}
          </select>
          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" onClick={goNextMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">›</button>
      </div>

      <div className="flex items-center gap-3 px-4 pb-1">
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <div className="h-2 w-2 rounded-full bg-green-500" /> Complete
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <div className="h-2 w-2 rounded-full bg-red-400" /> Incomplete
        </div>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-4 text-center text-[11px] font-medium text-gray-400">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-3 pb-3 text-center text-xs">
        {weeks.map((week, wIdx) =>
          week.map((d, idx) => {
            if (!d) return <div key={`${wIdx}-${idx}`} />;
            const iso = buildIso(viewYear, viewMonth, d);
            const isComplete = completedDates.has(iso);
            const isSelected = selectedIso === iso;
            const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

            return (
              <button
                key={`${wIdx}-${idx}`}
                type="button"
                onClick={() => onSelectDate(iso)}
                className="flex flex-col items-center gap-1"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs
                  ${isSelected ? "bg-green-500 text-white" : isToday ? "border border-green-500 text-green-600" : "text-gray-700 hover:bg-gray-100"}`}>
                  {d}
                </div>
                <div className={`h-1.5 w-1.5 rounded-full ${isComplete ? "bg-green-500" : "bg-red-400 opacity-50"}`} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ================= FORMAT HELPERS ================= */
const formatDisplayDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const normalizeDate = (d) => {
  try {
    const n = new Date(d);
    if (!isNaN(n.getTime())) return n.toISOString().slice(0, 10);
  } catch (e) {}
  return String(d).slice(0, 10);
};

/* ================= MAIN COMPONENT ================= */
export default function DataEntry() {
  const calendarRef = useRef(null);

  const [outlets, setOutlets] = useState([]);
  // FIX: outlet state now stores the AREA name (o.area || o.name || o.id)
  // because all display pages (DailyDamages, DigitalPayments, CashPayments)
  // key their data by outlet.area. Using o.id here caused the key mismatch.
  const [outlet, setOutlet] = useState("");        // outlet AREA key
  const [outletInactiveMsg, setOutletInactiveMsg] = useState("");
  const [outletInactive, setOutletInactive] = useState(false);
  const [date, setDate] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Raw data from all 5 APIs — used for calendar dot computation
  const [allSalesData,   setAllSalesData]   = useState([]);
  const [allCashData,    setAllCashData]    = useState([]);
  const [allDigitalData, setAllDigitalData] = useState([]);
  const [allDamagesData, setAllDamagesData] = useState([]);
  const [allNeccData,    setAllNeccData]    = useState([]);
  const [allIncentiveData, setAllIncentiveData] = useState([]);
  const [incentive,setIncentive] = useState("");

  // Per-field values & locks
  const [neccrate,       setNeccrate]       = useState("");
  const [neccrateLocked, setNeccrateLocked] = useState(false);
  const [sales,          setSales]          = useState("");
  const [salesLocked,    setSalesLocked]    = useState(false);
  const [damages,        setDamages]        = useState("");
  const [damagesLocked,  setDamagesLocked]  = useState(false);
  const [cash,           setCash]           = useState("");
  const [cashLocked,     setCashLocked]     = useState(false);
  const [digital,        setDigital]        = useState("");
  const [digitalLocked,  setDigitalLocked]  = useState(false);
  const [incentiveLocked,setIncentiveLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---- click outside calendar ---- */
  useEffect(() => {
    const handler = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) setIsCalendarOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ================= LOAD OUTLETS ================= */
  useEffect(() => {
    const { isSupervisor, zone } = getRoleFlags();
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const url = (isSupervisor && zone) ? `${API}/outlets/zone/${zone}` : `${API}/outlets/all`;
    fetch(url, { headers })
      .then(r => r.json())
      .then(data => setOutlets(Array.isArray(data) ? data : []))
      .catch(() => setOutlets([]));
  }, []);

  /* ================= LOAD ALL COLLECTIONS ================= */
  const loadAllData = useCallback(async () => {
    try {

      const [sRes, cRes, dRes, dmRes, nRes, iRes] = await Promise.all([
        fetch(`${API}/dailysales/all`),
        fetch(`${API}/cash-payments/all`),
        fetch(`${API}/digital-payments/all`),
        fetch(`${API}/daily-damage/all`),
        fetch(`${API}/neccrate/all`),
        fetch(`${API}/incentive/all`)
      ]);

      const [sData, cData, dData, dmData, nData, iData] = await Promise.all([
        sRes.ok ? sRes.json() : [],
        cRes.ok ? cRes.json() : [],
        dRes.ok ? dRes.json() : [],
        dmRes.ok ? dmRes.json() : [],
        nRes.ok ? nRes.json() : [],
        iRes.ok ? iRes.json() : []
      ]);

      setAllSalesData(Array.isArray(sData) ? sData : []);
      setAllCashData(Array.isArray(cData) ? cData : []);
      setAllDigitalData(Array.isArray(dData) ? dData : []);
      setAllDamagesData(Array.isArray(dmData) ? dmData : []);
      setAllNeccData(Array.isArray(nData) ? nData : []);
      setAllIncentiveData(Array.isArray(iData) ? iData : []);

    } catch (err) {
      console.error("Error loading all data:", err);
    }
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  /* ================= CALENDAR DOT COMPUTATION ================= */
  // FIX: All checks now use `outlet` as the AREA key — matching how backend
  // stores data when submitted from the individual data entry pages.
  const { completedDates } = useMemo(() => {
    if (!outlet) return { completedDates: new Set() };

    // FIX: sales/cash/digital use outlets[area], damages uses damages[area]
    const hasInSales   = (date) => allSalesData.some(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.outlets && doc.outlets[outlet] !== undefined
    );
    const hasInCash    = (date) => allCashData.some(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.outlets && doc.outlets[outlet] !== undefined
    );
    const hasInDigital = (date) => allDigitalData.some(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.outlets && doc.outlets[outlet] !== undefined
    );
    const hasInDamages = (date) => allDamagesData.some(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.damages && doc.damages[outlet] !== undefined
    );
    const hasInNecc = (date) => allNeccData.some(doc => {
      const docDate = normalizeDate(doc.date || doc.createdAt);

      return (
        docDate === date &&
        doc.outletId === outlet
      );
    });
    
    const hasInIncentive = (date) => allIncentiveData.some(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.outlets && doc.outlets[outlet] !== undefined
    );

    // Collect all dates that appear for this outlet across all 5 collections
    const allDates = new Set();
    allSalesData.forEach(doc => {
      if (doc.outlets && doc.outlets[outlet] !== undefined)
        allDates.add(normalizeDate(doc.date || doc.createdAt));
    });
    allCashData.forEach(doc => {
      if (doc.outlets && doc.outlets[outlet] !== undefined)
        allDates.add(normalizeDate(doc.date || doc.createdAt));
    });
    allDigitalData.forEach(doc => {
      if (doc.outlets && doc.outlets[outlet] !== undefined)
        allDates.add(normalizeDate(doc.date || doc.createdAt));
    });
    allDamagesData.forEach(doc => {
      if (doc.damages && doc.damages[outlet] !== undefined)
        allDates.add(normalizeDate(doc.date || doc.createdAt));
    });
    allNeccData.forEach(doc => {
      const d = normalizeDate(doc.date || doc.createdAt);
      if (hasInNecc(d)) allDates.add(d);
    });

    const completed = new Set();
    allDates.forEach(date => {
      const checks = [hasInSales(date), hasInCash(date), hasInDigital(date), hasInDamages(date), hasInNecc(date),hasInIncentive(date)];
      if (checks.every(Boolean)) completed.add(date);
    });

    return { completedDates: completed };
  }, [outlet, date, allSalesData, allCashData, allDigitalData, allDamagesData, allNeccData, allIncentiveData]);

  /* ================= LOCK CHECK WHEN OUTLET + DATE CHANGE ================= */
  useEffect(() => {
    if (!outlet || !date) {
      setNeccrate(""); setNeccrateLocked(false);
      setSales(""); setSalesLocked(false);
      setDamages(""); setDamagesLocked(false);
      setCash(""); setCashLocked(false);
      setDigital(""); setDigitalLocked(false);
      return;
    }

    // FIX: All lookups now use `outlet` (the area key) consistently.
    // This matches how data is stored: outlets[area] / damages[area].

    // Daily Sales — stored under doc.outlets[area]
    const foundSales = allSalesData.find(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.outlets && doc.outlets[outlet] !== undefined
    );
    if (foundSales) { setSales(foundSales.outlets[outlet]); setSalesLocked(true); }
    else { setSales(""); setSalesLocked(false); }

    // Cash — stored under doc.outlets[area]
    const foundCash = allCashData.find(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.outlets && doc.outlets[outlet] !== undefined
    );
    if (foundCash) { setCash(foundCash.outlets[outlet]); setCashLocked(true); }
    else { setCash(""); setCashLocked(false); }

    // Digital — stored under doc.outlets[area]
    const foundDigital = allDigitalData.find(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.outlets && doc.outlets[outlet] !== undefined
    );
    if (foundDigital) { setDigital(foundDigital.outlets[outlet]); setDigitalLocked(true); }
    else { setDigital(""); setDigitalLocked(false); }

    // Damages — stored under doc.damages[area]
    const foundDamages = allDamagesData.find(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.damages && doc.damages[outlet] !== undefined
    );
    if (foundDamages) { setDamages(foundDamages.damages[outlet]); setDamagesLocked(true); }
    else { setDamages(""); setDamagesLocked(false); }

    // NECC Rate — per outlet
    // NECC Rate — per outlet
    const foundNecc = allNeccData.find(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.outletId === outlet
    );

    if (foundNecc) {
      setNeccrate(foundNecc.rateValue ?? "");
      setNeccrateLocked(true);
    } else {
      setNeccrate("");
      setNeccrateLocked(false);
    }

    // Incentive — stored under doc.outlets[area]
    const foundIncentive = allIncentiveData.find(doc =>
      normalizeDate(doc.date || doc.createdAt) === date &&
      doc.outlets && doc.outlets[outlet] !== undefined
    );

    if (foundIncentive) {
      setIncentive(foundIncentive.outlets[outlet]);
      setIncentiveLocked(true);
    } else {
      setIncentive("");
      setIncentiveLocked(false);
    }
    

  }, [outlet, date, allSalesData, allCashData, allDigitalData, allDamagesData, allNeccData, allIncentiveData]);

  /* ================= RESET ================= */
  const handleReset = () => {
    if (!neccrateLocked) setNeccrate("");
    if (!salesLocked)    setSales("");
    if (!damagesLocked)  setDamages("");
    if (!cashLocked)     setCash("");
    if (!digitalLocked)  setDigital("");
    if (!incentiveLocked) setIncentive("");
  };

  /* ================= SUBMIT ================= */
  // FIX: All API calls now use `outlet` (the area name) as the key.
  // This is the same key used by DailyDamages, DigitalPayments, and CashPayments
  // to read data from the backend — so data entered here will immediately
  // show up correctly in those tables.
  const handleSubmit = async () => {
    if (!outlet || !date) { alert("Please select an outlet and date first."); return; }

    const allAlreadyLocked =
      neccrateLocked &&
      salesLocked &&
      damagesLocked &&
      cashLocked &&
      digitalLocked &&
      incentiveLocked;
    if (allAlreadyLocked) {
      alert("All data for this outlet and date is already submitted. No changes to save.");
      return;
    }

    const missingFields = [];
    if (!neccrateLocked && neccrate === "") missingFields.push("NECC Rate");
    if (!salesLocked    && sales === "")    missingFields.push("Daily Sales");
    if (!damagesLocked  && damages === "")  missingFields.push("Daily Damages");
    if (!cashLocked     && cash === "")     missingFields.push("Cash Payment");
    if (!digitalLocked  && digital === "")  missingFields.push("Digital Payment");
    if (!incentiveLocked && incentive === "") missingFields.push("Daily Incentive");

    if (missingFields.length > 0) {
      alert(`Please fill in all fields before submitting:\n• ${missingFields.join("\n• ")}`);
      return;
    }


    setIsSubmitting(true);
    const tasks = [];
    try {
      // NECC Rate — keyed by outlet area name
      if (!neccrateLocked && neccrate !== "") {
        tasks.push(fetch(`${API}/neccrate/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // FIX: send outlet (area) not raw id
          body: JSON.stringify({ date, outletId: outlet, rate: Number(neccrate) }),
        }));
      }

      // Daily Sales — outlets[area]
      if (!salesLocked && sales !== "") {
        tasks.push(fetch(`${API}/dailysales/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, outlets: { [outlet]: Number(sales) }, total: Number(sales) }),
        }));
      }

      // Daily Damages — damages[area] (matches DailyDamages spread pattern)
      if (!damagesLocked && damages !== "") {
        tasks.push(fetch(`${API}/daily-damage/add-daily-damage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, damages: { [outlet]: Number(damages) }, total: Number(damages) }),
        }));
      }

      if (!incentiveLocked && incentive !== "") {

        tasks.push(
          fetch(`${API}/incentive/add`,{
            method:"POST",
            headers:{
              "Content-Type":"application/json"
            },
            body:JSON.stringify({
              date,
              outlet,
              value:Number(incentive)
            })
          })
        );

      }

      // Cash Payments — outlets[area]
      if (!cashLocked && cash !== "") {
        tasks.push(fetch(`${API}/cash-payments/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, outlets: { [outlet]: Number(cash) } }),
        }));
      }

      // Digital Payments — outlets[area]
      if (!digitalLocked && digital !== "") {
        tasks.push(fetch(`${API}/digital-payments/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, outlets: { [outlet]: Number(digital) } }),
        }));
      }

      if (!incentiveLocked && incentive === "") missingFields.push("Daily Incentive");

      const results = await Promise.all(tasks);
      for (const r of results) {
        if (!r.ok) { const txt = await r.text(); throw new Error(txt || "Failed to save one of the entries"); }
      }

      alert("Data saved successfully ✅");

      // Lock all just-submitted fields
      if (!neccrateLocked && neccrate !== "") setNeccrateLocked(true);
      if (!salesLocked    && sales !== "")    setSalesLocked(true);
      if (!damagesLocked  && damages !== "")  setDamagesLocked(true);
      if (!cashLocked     && cash !== "")     setCashLocked(true);
      if (!digitalLocked  && digital !== "")  setDigitalLocked(true);
      if (!incentiveLocked && incentive !== "")
  setIncentiveLocked(true);

      // Refresh all data so calendar dots and lock states update immediately
      await loadAllData();

    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to submit data");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= DERIVED VALUES ================= */
  const salesNum   = Number(sales)    || 0;
  const neccNum    = Number(neccrate) || 0;
  const digitalNum = Number(digital)  || 0;
  const cashNum    = Number(cash)     || 0;
  const damagesNum = Number(damages)  || 0;

  const totalAmount    = useMemo(() => +(salesNum * neccNum).toFixed(2), [salesNum, neccNum]);
  const totalRecv      = useMemo(() => +(digitalNum + cashNum), [digitalNum, cashNum]);
  const closingBalance = useMemo(() => +(totalRecv - totalAmount), [totalRecv, totalAmount]);

  const formatCurrency = (v) => `₹${Number(v || 0).toLocaleString()}`;

  const hasUnlockedValue =
    (!neccrateLocked && neccrate !== "") ||
    (!salesLocked    && sales !== "")    ||
    (!damagesLocked  && damages !== "")  ||
    (!cashLocked     && cash !== "")     ||
    (!digitalLocked  && digital !== "");

  const allAlreadyLocked =
    neccrateLocked &&
    salesLocked &&
    damagesLocked &&
    cashLocked &&
    digitalLocked &&
    incentiveLocked;
  const allUnlockedFilled =
    (neccrateLocked || neccrate !== "") &&
    (salesLocked || sales !== "") &&
    (damagesLocked || damages !== "") &&
    (cashLocked || cash !== "") &&
    (digitalLocked || digital !== "") &&
    (incentiveLocked || incentive !== "");
  const canSubmit = !allAlreadyLocked && allUnlockedFilled;

  const inputCls = (locked) => [
    "w-full border p-3 rounded-xl text-sm text-gray-800 md:text-base transition-colors",
    locked || outletInactive
      ? "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-400"
      : "border-gray-900 bg-eggWhite focus:outline-none focus:ring-2 focus:ring-orange-400",
  ].join(" ");

  return (
    <div className="min-h-screen bg-eggBg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl bg-white p-6 rounded-xl shadow">

        <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center text-gray-900">
          Common Data Entry
        </h2>

        {/* ---- Outlet Dropdown ---- */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Outlets</label>
          <select
            className={[
              "w-full border p-3 rounded-xl text-sm text-gray-800 md:text-base focus:outline-none focus:ring-2 focus:ring-orange-400",
              outletInactive ? "border-gray-200 bg-gray-100" : "border-gray-900 bg-eggWhite",
            ].join(" ")}
            value={outlet}
            onChange={e => {
              const val = e.target.value;
              // FIX: find the outlet by area key (val IS the area now)
              const selected = outlets.find(o => (o.area || o.name || o.id) === val);
              if (selected && selected.status === "Inactive") {
                setOutlet(val);
                setOutletInactive(true);
                setOutletInactiveMsg("Selected outlet is inactive — all fields are disabled");
                return;
              }
              setOutletInactive(false);
              setOutletInactiveMsg("");
              setOutlet(val);
              setDate(""); // reset date when outlet changes
            }}
          >
            <option value="">Select Outlet</option>
            {outlets.map(o => {
              // FIX: use area as BOTH the option value AND display name.
              // area is the key used across ALL pages (DailyDamages, DigitalPayments,
              // CashPayments) to store and read outlet data.
              const area   = o.area || o.name || o.id;
              const status = o.status || "Active";
              return (
                <option key={o.id || area} value={area}>
                  {area} ({status})
                </option>
              );
            })}
          </select>
          {outletInactiveMsg && (
            <div className="text-xs text-red-600 mt-1">{outletInactiveMsg}</div>
          )}
        </div>

        {/* ---- Date — DataCalendar picker ---- */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Date</label>
          <div className="relative w-full z-30" ref={calendarRef}>
            <button
              type="button"
              disabled={outletInactive || !outlet}
              onClick={() => (outlet && !outletInactive) && setIsCalendarOpen(o => !o)}
              className={[
                "flex w-full items-center justify-between border p-3 rounded-xl text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-orange-400",
                outletInactive || !outlet
                  ? "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-400"
                  : "border-gray-900 bg-eggWhite text-gray-800",
              ].join(" ")}
            >
              <span className={date ? "text-gray-800" : "text-gray-400"}>
                {!outlet ? "Select an outlet first" : date ? formatDisplayDate(date) : "Select date"}
              </span>
              <CalendarIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
            </button>

            {isCalendarOpen && outlet && (
              <div className="absolute right-0 top-full z-50 mt-2">
                <DataCalendar
                  completedDates={completedDates}
                  selectedDate={date}
                  onSelectDate={(iso) => { setDate(iso); setIsCalendarOpen(false); }}
                />
              </div>
            )}
          </div>
          {!outlet && (
            <p className="text-xs text-orange-500 mt-1">Please select an outlet to enable date selection.</p>
          )}
        </div>

        {/* ---- Fields (only show once outlet + date are selected) ---- */}
        {outlet && date && (
          <>
            {allAlreadyLocked && (
              <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-2">
                <div className="text-green-600 text-lg">✅</div>
                <div>
                  <p className="text-sm font-semibold text-green-700">All data submitted</p>
                  <p className="text-xs text-green-600">All 5 fields for this outlet and date are already saved. No further edits allowed.</p>
                </div>
              </div>
            )}

            {/* ---- NECC Rate ---- */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">
                NECC Rate
                <span className="ml-1 text-xs text-gray-400 font-normal">(per outlet)</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="NECC Rate for this outlet"
                className={inputCls(neccrateLocked)}
                value={neccrate}
                disabled={neccrateLocked || outletInactive}
                onChange={e => setNeccrate(e.target.value)}
              />
              {neccrateLocked && <div className="text-xs text-green-700 mt-1">✓ Already entered</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Incentive
              </label>

              <input
              type="number"
              placeholder="Daily Incentive"
              className={inputCls(incentiveLocked)}
              value={incentive}
              disabled={incentiveLocked}
              onChange={(e)=>setIncentive(e.target.value)}
              />

              {incentiveLocked &&
              <div className="text-xs text-green-700 mt-1">
              ✓ Already entered
              </div>
              }

              </div>

            {/* ---- 2-col grid ---- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Daily Sales</label>
                <input type="number" placeholder="Daily Sales" className={inputCls(salesLocked)}
                  value={sales} disabled={salesLocked || outletInactive} onChange={e => setSales(e.target.value)} />
                {salesLocked && <div className="text-xs text-green-700 mt-1">✓ Already entered</div>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Daily Damages</label>
                <input type="number" placeholder="Daily Damages" className={inputCls(damagesLocked)}
                  value={damages} disabled={damagesLocked || outletInactive} onChange={e => setDamages(e.target.value)} />
                {damagesLocked && <div className="text-xs text-green-700 mt-1">✓ Already entered</div>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Digital Payment</label>
                <input type="number" placeholder="Digital Payment" className={inputCls(digitalLocked)}
                  value={digital} disabled={digitalLocked || outletInactive} onChange={e => setDigital(e.target.value)} />
                {digitalLocked && <div className="text-xs text-green-700 mt-1">✓ Already entered</div>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 md:text-base">Cash Payment</label>
                <input type="number" placeholder="Cash Payment" className={inputCls(cashLocked)}
                  value={cash} disabled={cashLocked || outletInactive} onChange={e => setCash(e.target.value)} />
                {cashLocked && <div className="text-xs text-green-700 mt-1">✓ Already entered</div>}
              </div>
            </div>

            {/* ---- Summary Card ---- */}
            <div className="mt-5">
              <div className="bg-eggWhite p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">Total Amount</div>
                    <div className="text-base font-semibold text-gray-800 md:text-lg">{formatCurrency(totalAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Received</div>
                    <div className="text-base font-semibold text-gray-800 md:text-lg">{formatCurrency(totalRecv)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Closing Balance</div>
                    <div className={`text-base font-semibold md:text-lg ${closingBalance < 0 ? "text-red-600" : "text-green-600"}`}>
                      {closingBalance < 0 ? "- " : ""}{formatCurrency(Math.abs(closingBalance))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex justify-center items-center gap-4">
                  <div className="w-24 h-24 flex items-center justify-center">
                    <svg viewBox="0 0 32 32" className="w-16 h-16">
                      <circle r="16" cx="16" cy="16" fill="#fff4e6" />
                      {(digitalNum + cashNum) > 0 ? (
                        <g>
                          <path d={(() => {
                            const total = digitalNum + cashNum;
                            const angle = (digitalNum / total) * 2 * Math.PI;
                            const x = 16 + 16 * Math.cos(-Math.PI / 2 + angle);
                            const y = 16 + 16 * Math.sin(-Math.PI / 2 + angle);
                            const large = angle > Math.PI ? 1 : 0;
                            return `M16 0 A16 16 0 ${large} 1 ${x} ${y} L16 16 Z`;
                          })()} fill="#ffb88c" />
                          <path d={(() => {
                            const total = digitalNum + cashNum;
                            const angle = (digitalNum / total) * 2 * Math.PI;
                            const x = 16 + 16 * Math.cos(-Math.PI / 2 + angle);
                            const y = 16 + 16 * Math.sin(-Math.PI / 2 + angle);
                            return `M${x} ${y} A16 16 0 0 1 16 0 L16 16 Z`;
                          })()} fill="#ff7518" opacity="0.95" />
                        </g>
                      ) : (
                        <circle r="10" cx="16" cy="16" fill="#fff4e6" />
                      )}
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-700">Digital: <span className="font-semibold">{formatCurrency(digitalNum)}</span></div>
                    <div className="text-sm text-gray-700">Cash: <span className="font-semibold">{formatCurrency(cashNum)}</span></div>
                    <div className="text-sm text-gray-700">Damages: <span className="font-semibold text-red-600">{damagesNum}</span></div>
                  </div>
                </div>
              </div>

              {/* ---- Action Buttons ---- */}
              {!allAlreadyLocked && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleReset}
                    disabled={!hasUnlockedValue || outletInactive}
                    className={[
                      "flex-1 py-2.5 rounded-2xl text-sm font-semibold border transition-colors md:text-base",
                      !hasUnlockedValue || outletInactive
                        ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                        : "border-orange-400 text-orange-600 bg-white hover:bg-orange-50",
                    ].join(" ")}
                  >
                    Reset
                  </button>

                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || outletInactive || isSubmitting}
                    className={[
                      "flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-md transition-colors md:text-base inline-flex items-center justify-center gap-2",
                      !canSubmit || outletInactive || isSubmitting
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-orange-500 hover:bg-orange-600",
                    ].join(" ")}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Saving...
                      </>
                    ) : outletInactive ? "Outlet Inactive" : "Submit"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Placeholder when outlet/date not selected */}
        {(!outlet || !date) && (
          <div className="mt-6 rounded-xl border-2 border-dashed border-gray-200 py-10 text-center text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm md:text-base">Select an outlet and date to begin data entry</p>
          </div>
        )}

      </div>
    </div>
  );
}