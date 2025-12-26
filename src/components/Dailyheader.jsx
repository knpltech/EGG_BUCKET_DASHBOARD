import React, { useState, useEffect } from 'react';

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

function BaseCalendar({ selectedDate, onSelectDate, showDots = false }) {
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
                      "bg-red-400"
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

const Dailyheader = ({ onDownload }) => {
  const [filterDate, setFilterDate] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleDateSelect = (iso) => {
    setFilterDate(iso);
    setIsCalendarOpen(false);
  };

  const handleQuickRange = (type) => {
    const today = new Date();
    let fromDate;

    if (type === "lastWeek") {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().slice(0, 10);
    } else if (type === "lastMonth") {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      fromDate = d.toISOString().slice(0, 10);
    }

    setFilterDate(fromDate || "");
  };

  return (
    <div className="mb-4 pt-6 px-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold">Daily Sales</h1>
        <p className="text-gray-600 text-sm">
          Manage and track daily egg sales across all outlets.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs md:text-sm font-medium text-gray-700">
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsCalendarOpen((o) => !o);
              }}
              className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
            >
              <span>
                {filterDate ? formatDateDMY(filterDate) : "dd-mm-yyyy"}
              </span>
              <CalendarIcon className="h-4 w-4 text-gray-500" />
            </button>
            {isCalendarOpen && (
              <div className="absolute left-0 top-full z-30 mt-2">
                <BaseCalendar
                  selectedDate={filterDate}
                  onSelectDate={handleDateSelect}
                  showDots={false}
                />
              </div>
            )}
          </div>
        </div>

        <button className="border px-4 py-2 rounded-lg text-sm" onClick={() => handleQuickRange("lastWeek")}>
          Last Week
        </button>

        <button className="border px-4 py-2 rounded-lg text-sm" onClick={() => handleQuickRange("lastMonth")}>
          Last Month
        </button>

        <button
          className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-semibold"
          onClick={onDownload}
        >
          Download
        </button>

      </div>
    </div>
  );
};

export default Dailyheader;