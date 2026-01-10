import { useEffect, useState, useRef } from "react";

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

/* ---------------- ENTRY FORM ---------------- */

const Entryform = ({ addRow, blockedDates, rows }) => {
  const [date, setDate] = useState("");
  const [rate, setRate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [open, setOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const calendarRef = useRef(null);

  // Click outside to close calendar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (!date) {
      setIsLocked(false);
      return;
    }
    setIsLocked(blockedDates.includes(date));
  }, [date, blockedDates]);

  const handleSubmit = () => {
    if (!date || !rate) {
      alert("Date and Rate are required");
      return;
    }
    if (isLocked) {
      alert("Data for this date already exists!");
      return;
    }
    addRow({
      date,
      rate: `₹${rate} per egg`,
      remarks: remarks || "—",
    });
    setDate("");
    setRate("");
    setRemarks("");
    setOpen(false);
  };

  return (
    <div className="mt-10 pb-10">
      <h1 className="text-2xl font-bold mb-6">NECC Rate Entry Form</h1>

      <div className="bg-white shadow rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          {/* DATE (CUSTOM CALENDAR) */}
          <div className="relative z-30" ref={calendarRef}>
            <p className="mb-2 text-xs font-medium text-gray-700">Date</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-eggBg px-3 py-2 pr-10 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
              >
                <span>
                  {date ? formatDateDMY(date) : "dd-mm-yyyy"}
                </span>
              </button>
              <CalendarIcon className="h-4 w-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Calendar opens upwards */}
            {open && (
              <div className="absolute left-0 right-0 bottom-full mb-2 z-50">
                <BaseCalendar
                  rows={rows}
                  selectedDate={date}
                  onSelectDate={(iso) => {
                    setDate(iso);
                    setOpen(false);
                  }}
                  showDots={true}
                />
              </div>
            )}
          </div>

          {/* RATE */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-700">NECC Rate (₹)</p>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 6.50"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              disabled={isLocked}
            />
          </div>

          {/* REMARKS */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-700">Remarks (optional)</p>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any note..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              disabled={isLocked}
            />
          </div>

          {/* SAVE BUTTON */}
          <div className="md:ml-auto flex items-end h-full">
            <button
              onClick={handleSubmit}
              className={`w-full md:w-auto inline-flex items-center justify-center rounded-2xl px-8 py-2.5 text-sm font-semibold text-white shadow-md transition-colors ${
                isLocked
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
              disabled={isLocked}
            >
              {isLocked ? "Locked" : "Save Data"}
            </button>
          </div>
        </div>
        {/* Status message below */}
        {date && (
          <p className={`mt-2 text-xs font-medium ${
            isLocked ? "text-red-600" : "text-green-600"
          }`}>
            {isLocked ? "Entry Locked for this date" : "✓ Date available"}
          </p>
        )}
      </div>
    </div>
  );
};

export default Entryform;