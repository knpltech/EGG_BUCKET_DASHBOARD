import { useState, useEffect, useRef } from "react";

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

function formatDateDisplay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString('en-GB').replace(/\//g, '-');
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
                      "bg-green-500"
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

export default function NeccTableSection({
  rows,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  onEdit,
  showEditColumn
}) {
  const fromCalendarRef = useRef(null);
  const toCalendarRef = useRef(null);
  const [isFromCalendarOpen, setIsFromCalendarOpen] = useState(false);
  const [isToCalendarOpen, setIsToCalendarOpen] = useState(false);

  // Click outside to close calendars
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fromCalendarRef.current && !fromCalendarRef.current.contains(event.target)) {
        setIsFromCalendarOpen(false);
      }
      if (toCalendarRef.current && !toCalendarRef.current.contains(event.target)) {
        setIsToCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const downloadCSV = (data) => {
    if (data.length === 0) {
      alert("No data to download");
      return;
    }

    const header = ["Date", "Rate", "Remarks"];
    const csvRows = data.map(row => [
      row.date,
      row.rate,
      row.remarks
    ]);

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [header, ...csvRows].map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "necc_rate_data.csv");
    document.body.appendChild(link);
    link.click();
  };

  const setLastWeek = () => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    setFromDate(lastWeek.toISOString().split("T")[0]);
    setToDate(today.toISOString().split("T")[0]);
  };

  const setLastMonth = () => {
    const today = new Date();
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    setFromDate(lastMonthStart.toISOString().split("T")[0]);
    setToDate(today.toISOString().split("T")[0]);
  };

  return (
    <div className="pt-10"> 
      {/* 🟠 Title */}
      <h1 className="text-2xl font-bold mb-6">NECC Rate</h1>

      {/* 🟠 Filters */}
      <div className='flex justify-between items-center gap-3 mb-6'>
        <div className='flex gap-5 ml-4'>
          <div className="relative z-30" ref={fromCalendarRef}>
            <button
              type="button"
              onClick={() => {
                setIsFromCalendarOpen((o) => !o);
                setIsToCalendarOpen(false);
              }}
              className="flex min-w-[120px] items-center justify-between rounded-lg border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              <span>
                {fromDate ? formatDateDMY(fromDate) : "dd-mm-yyyy"}
              </span>
              <CalendarIcon className="h-4 w-4 text-gray-500 ml-2" />
            </button>
            {isFromCalendarOpen && (
              <div className="absolute left-0 top-full z-50 mt-2">
                <BaseCalendar
                  selectedDate={fromDate}
                  onSelectDate={(iso) => {
                    setFromDate(iso);
                    setIsFromCalendarOpen(false);
                  }}
                  showDots={false}
                />
              </div>
            )}
          </div>
          <div className="relative z-30" ref={toCalendarRef}>
            <button
              type="button"
              onClick={() => {
                setIsToCalendarOpen((o) => !o);
                setIsFromCalendarOpen(false);
              }}
              className="flex min-w-[120px] items-center justify-between rounded-lg border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              <span>
                {toDate ? formatDateDMY(toDate) : "dd-mm-yyyy"}
              </span>
              <CalendarIcon className="h-4 w-4 text-gray-500 ml-2" />
            </button>
            {isToCalendarOpen && (
              <div className="absolute left-0 top-full z-50 mt-2">
                <BaseCalendar
                  selectedDate={toDate}
                  onSelectDate={(iso) => {
                    setToDate(iso);
                    setIsToCalendarOpen(false);
                  }}
                  showDots={false}
                />
              </div>
            )}
          </div>
        </div>
        <div className='flex gap-5 mr-4'>
          <button className="border px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600" onClick={() => downloadCSV(rows)}>
            Download Data
          </button>

          <button onClick={setLastWeek} className="border px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600">
            Last week
          </button>

          <button onClick={setLastMonth} className="border px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600">
            Last month
          </button>
        </div>
      </div>

      {/* 🟠 Table with horizontal scroll */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl shadow min-w-max">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="py-3 px-4 sticky left-0 bg-gray-100 z-10 min-w-[120px]">Date</th>
              <th className="py-3 px-4 min-w-[150px]">NECC Rate</th>
              <th className="py-3 px-4 min-w-[200px]">Remarks</th>
              {showEditColumn && <th className="py-3 px-4 sticky right-0 bg-gray-100 z-10 min-w-[80px]">Edit</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showEditColumn ? 4 : 3} className="text-center py-6 text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition">
                  <td className="py-3 px-4 sticky left-0 bg-white z-10">{formatDateDisplay(row.date)}</td>
                  <td className="py-3 px-4">{row.rate}</td>
                  <td className="py-3 px-4">{row.remarks}</td>
                  {showEditColumn && typeof onEdit === 'function' && (
                    <td className="py-3 px-4 sticky right-0 bg-white z-10">
                      <button className="text-blue-600 hover:underline text-xs font-medium" onClick={() => onEdit(row)}>Edit</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}