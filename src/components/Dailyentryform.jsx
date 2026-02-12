import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function formatDateDMY(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

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

/* ================= DAILY ENTRY FORM ================= */

const Dailyentryform = ({ addrow, blockeddates, rows, outlets = [] }) => {
  const [date, setDate] = useState("");
  const [openCal, setOpenCal] = useState(false);
  const calendarRef = useRef(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Click outside to close calendar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setOpenCal(false);
      }
    };

    if (openCal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openCal]);

  // Build outlet names from objects - only once when outlets change
  const outletNames = useMemo(() => {
    if (!Array.isArray(outlets) || outlets.length === 0) {
      return [];
    }
    return outlets
      .map(o => {
        if (typeof o === 'string') return o;
        return o.area || o.name || null;
      })
      .filter(name => name !== null);
  }, [outlets]);

  // Initialize entry values based on outlet names
  const initializeEntryValues = useCallback(() => {
    const initial = {};
    outletNames.forEach((o) => (initial[o] = ""));
    return initial;
  }, [outletNames]);

  const [entryValues, setEntryValues] = useState(initializeEntryValues());
  const [hasEntry, setHasEntry] = useState(false);
  const [entryTotal, setEntryTotal] = useState(0);

  // Reset entry values when outlets change
  useEffect(() => {
    setEntryValues(initializeEntryValues());
    setDate("");
  }, [outletNames, initializeEntryValues]);

  // Update entry state when date changes
  useEffect(() => {
    if (!date) {
      setHasEntry(false);
      setEntryTotal(0);
      setEntryValues(initializeEntryValues());
      return;
    }
    
    const found = Array.isArray(rows) ? rows.find(r => r.date === date) : null;
    if (found) {
      // Check if user's outlets have data > 0
      let hasDataForMyOutlets = false;
      const vals = {};
      outletNames.forEach(o => {
        const value = found.outlets && found.outlets[o] !== undefined 
          ? found.outlets[o] 
          : "";
        vals[o] = value;
        if (Number(value) > 0) hasDataForMyOutlets = true;
      });
      setEntryValues(vals);
      // Only lock if user's outlets already have data
      setHasEntry(hasDataForMyOutlets);
      // Calculate total only for user's outlets
      const myTotal = outletNames.reduce((sum, o) => {
        return sum + (Number(found.outlets?.[o]) || 0);
      }, 0);
      setEntryTotal(myTotal);
    } else {
      setHasEntry(false);
      setEntryTotal(0);
      const vals = {};
      outletNames.forEach(o => (vals[o] = ""));
      setEntryValues(vals);
    }
  }, [date, rows, outletNames, initializeEntryValues]);

  const handleEntryChange = useCallback((outlet, value) => {
    setEntryValues((prev) => ({
      ...prev,
      [outlet]: value,
    }));
  }, []);

  // Check if outlet is active
  const isOutletActive = useCallback((outletName) => {
    if (!Array.isArray(outlets) || outlets.length === 0) return true;
    
    const outletObj = outlets.find(o => {
      const area = typeof o === 'string' ? o : (o.area || o.name);
      return area === outletName;
    });
    
    if (!outletObj) return true;
    if (typeof outletObj === 'string') return true;
    
    return !outletObj.status || outletObj.status === "Active";
  }, [outlets]);

  const handleSubmit = useCallback(async () => {
    if (!date) return alert("Date is required");
    if (hasEntry) return alert("You have already entered data for your outlets on this date");

    if (outletNames.length === 0) {
      return alert("No outlets available");
    }

    // Get active outlets
    const activeOutlets = outletNames.filter((outletName) => isOutletActive(outletName));
    
    // Check if all active outlets are filled
    const allActiveFilled = activeOutlets.every((outlet) => {
      const value = entryValues[outlet];
      return value !== "" && value !== null && value !== undefined;
    });
    
    if (!allActiveFilled) {
      return alert("All active outlets must have values");
    }

    // Calculate total from active outlets only
    const total = activeOutlets.reduce((sum, outlet) => {
      return sum + (Number(entryValues[outlet]) || 0);
    }, 0);

    // Store all outlets, with inactive ones as 0
    const finalValues = {};
    outletNames.forEach(outlet => {
      finalValues[outlet] = Number(entryValues[outlet]) || 0;
    });

    setSubmitLoading(true);
    try {
      await addrow({
        date,
        outlets: finalValues,
        total,
      });

      // Lock the form after successful submission (like DailyDamages)
      alert(`Saved entry for ${date}`);
      setHasEntry(true);
      setEntryTotal(total);
    } catch (err) {
      console.error('Error submitting entry:', err);
    } finally {
      setSubmitLoading(false);
    }
  }, [date, hasEntry, outletNames, entryValues, addrow, initializeEntryValues, isOutletActive]);

  if (outletNames.length === 0) {
    return (
      <div className="bg-white shadow rounded-xl p-6 m-6">
        <h1 className="text-xl font-bold mb-2">Daily Sales Entry</h1>
        <p className="text-gray-500 mb-6">Add new daily sales amounts for each outlet.</p>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-sm text-yellow-800">No outlets available. Please wait for outlets to load or add outlets first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-xl p-6 m-6">
      <h1 className="text-xl font-bold mb-2">Daily Sales Entry</h1>
      <p className="text-gray-500 mb-6">Add new daily sales amounts for each outlet.</p>

      {/* DATE PICKER */}
      <div className="relative mb-6 z-30" ref={calendarRef}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Date
        </label>
        <button
          type="button"
          onClick={() => setOpenCal(prev => !prev)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-eggBg px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 transition hover:bg-gray-50"
        >
          <span className="font-medium">
            {date ? formatDateDMY(date) : "dd-mm-yyyy"}
          </span>
          <CalendarIcon className="h-5 w-5 text-gray-500" />
        </button>
        {hasEntry && (
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="text-xs font-medium text-green-700">
              Entry ( ₹ {entryTotal.toLocaleString()}) • Locked
            </div>
          </div>
        )}
        {openCal && (
          <div className="absolute right-0 top-full mt-2 z-50">
            <BaseCalendar
              rows={rows}
              selectedDate={date}
              onSelectDate={(iso) => {
                setDate(iso);
                setOpenCal(false);
              }}
              showDots={true}
            />
          </div>
        )}
      </div>

      {/* Outlet Inputs - Dynamic based on outlets */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        {outletNames.map((outlet) => {
          const isActive = isOutletActive(outlet);
          return (
            <div key={outlet} className="space-y-1">
              <p className="text-xs font-medium text-gray-600">
                {outlet}
                {!isActive && <span className="text-red-500 ml-1">(Inactive)</span>}
              </p>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400"></span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={entryValues[outlet] || ""}
                  onChange={(e) => handleEntryChange(outlet, e.target.value)}
                  disabled={hasEntry || !isActive || submitLoading}
                  placeholder="0.00"
                  className={`w-full rounded-xl border border-gray-200 bg-eggBg pl-8 pr-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 transition ${(hasEntry || !isActive || submitLoading) ? "bg-gray-50 cursor-not-allowed opacity-50" : ""}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={hasEntry || submitLoading}
          className={`inline-flex items-center justify-center rounded-2xl px-8 py-3 text-base font-semibold text-white shadow-lg transition-all ${(hasEntry || submitLoading) ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 active:scale-95'}`}
        >
          {submitLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : hasEntry ? (
            'Locked'
          ) : (
            'Save Entry'
          )}
        </button>
      </div>
    </div>
  );
};

export default Dailyentryform;