const API_URL = import.meta.env.VITE_API_URL;
import { useState, useEffect, useRef } from "react";
import { useDamage } from "../context/DamageContext";
import * as XLSX from "xlsx";
import { getRoleFlags } from "../utils/role";

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
  return d.toLocaleDateString('en-GB').replace(/\//g, '-'); // dd-mm-yyyy
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

function DamageEntryIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="16" r="16" fill="#FFEFE0" />
      <path
        d="M10 12C10 10.8954 10.8954 10 12 10H20C21.1046 10 22 10.8954 22 12V20C22 21.1046 21.1046 22 20 22H12C10.8954 22 10 21.1046 10 20V12Z"
        fill="#FF9D3A"
      />
      <path
        d="M15 14L17 16M17 14L15 16"
        stroke="#FFEFE0"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M18.2 18.2L22.5 13.9C22.8 13.6 23.3 13.6 23.6 13.9L24.6 14.9C24.9 15.2 24.9 15.7 24.6 16L20.3 20.3L18.2 18.2Z"
        fill="#FF7A1A"
      />
      <path
        d="M18 18.5L17.3 21.2C17.2 21.6 17.6 22 18 21.9L20.7 21.2"
        stroke="#FF7A1A"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

export default function DailyDamages() {
  const {isAdmin, isViewer, isDataAgent}= getRoleFlags();
  const { damages, setDamages, addDamage } = useDamage();

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});

  // Refs for click outside detection
  const fromCalendarRef = useRef(null);
  const toCalendarRef = useRef(null);
  const entryCalendarRef = useRef(null);

  const [isFromCalendarOpen, setIsFromCalendarOpen] = useState(false);
  const [isToCalendarOpen, setIsToCalendarOpen] = useState(false);
  const [isEntryCalendarOpen, setIsEntryCalendarOpen] = useState(false);

  const DEFAULT_OUTLETS = ["AECS Layout", "Bandepalya", "Hosa Road", "Singasandra", "Kudlu Gate"];
  const STORAGE_KEY = "egg_outlets_v1";

  const [outlets, setOutlets] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_OUTLETS;
    try {
      const parsed = JSON.parse(saved);
      const areas = parsed.map((o) => o.area);
      const hasAll = DEFAULT_OUTLETS.every((d) => areas.includes(d));
      return areas.length > 0 ? (hasAll ? areas : DEFAULT_OUTLETS) : DEFAULT_OUTLETS;
    } catch {
      return DEFAULT_OUTLETS;
    }
  });

  const initialForm = outlets.reduce((acc, name) => {
    acc[name] = 0;
    return acc;
  }, {});

  const [form, setForm] = useState(initialForm);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [hasEntry, setHasEntry] = useState(false);
  const [entryTotal, setEntryTotal] = useState(0);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fromCalendarRef.current && !fromCalendarRef.current.contains(event.target)) {
        setIsFromCalendarOpen(false);
      }
      if (toCalendarRef.current && !toCalendarRef.current.contains(event.target)) {
        setIsToCalendarOpen(false);
      }
      if (entryCalendarRef.current && !entryCalendarRef.current.contains(event.target)) {
        setIsEntryCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch damages from backend on mount
  useEffect(() => {
    const fetchDamages = async () => {
      try {
        const res = await fetch(`${API_URL}/daily-damage/all`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setDamages(data.map(d => ({
            id: d.id,
            date: d.date,
            ...((d.damages && typeof d.damages === 'object') ? d.damages : {}),
            total: d.total || 0
          })));
        }
      } catch (err) {
        // ignore fetch error
      }
    };
    fetchDamages();
  }, [setDamages]);

  useEffect(() => {
    setForm(() => {
      const f = {};
      outlets.forEach((o) => (f[o] = 0));
      return f;
    });
  }, [outlets]);

  useEffect(() => {
    const handler = (e) => {
      const areas = (e && e.detail) || null;
      if (Array.isArray(areas)) {
        setOutlets(areas);
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const areasFromStorage = parsed.map((o) => o.area);
            setOutlets(areasFromStorage);
          } catch {}
        }
      }
    };
    window.addEventListener('egg:outlets-updated', handler);
    const onStorage = (evt) => {
      if (evt.key === STORAGE_KEY) handler();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('egg:outlets-updated', handler);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    const existing = damages.find((d) => d.date === entryDate);
    if (existing) {
      const loaded = {};
      outlets.forEach((name) => {
        loaded[name] = existing[name] ?? 0;
      });
      setForm(loaded);
      setHasEntry(true);
      setEntryTotal(existing.total ?? 0);
    } else {
      setForm(initialForm);
      setHasEntry(false);
      setEntryTotal(0);
    }
  }, [entryDate, damages, outlets]);

  const handleEntryDateSelect = (iso) => {
    setEntryDate(iso);
    const existingEntry = damages.find((d) => d.date === iso);
    if (existingEntry) {
      const loaded = {};
      outlets.forEach((name) => {
        loaded[name] = existingEntry[name] ?? 0;
      });
      setForm(loaded);
      setHasEntry(true);
      setEntryTotal(existingEntry.total ?? 0);
    } else {
      const reset = {};
      outlets.forEach((o) => (reset[o] = 0));
      setForm(reset);
      setHasEntry(false);
      setEntryTotal(0);
    }
    setIsEntryCalendarOpen(false);
  };

  const handleEditClick = (row) => {
    const fullRow = { ...row };
    if (!row.id) {
      const found = damages.find(d => d.date === row.date);
      if (found && found.id) fullRow.id = found.id;
    }
    setEditRow(fullRow);
    const vals = {};
    outlets.forEach((name) => {
      vals[name] = row[name] ?? 0;
    });
    setEditValues(vals);
    setEditModalOpen(true);
  };

  const handleEditValueChange = (name, value) => {
    setEditValues((prev) => ({ ...prev, [name]: Number(value) }));
  };

  const handleEditCancel = () => {
    setEditModalOpen(false);
    setEditRow({});
    setEditValues({});
  };

  const handleEditSave = async () => {
    if (!editRow.id) {
      alert("No ID found for entry. Cannot update.");
      return;
    }
    const updatedDamages = { ...editValues };
    const total = outlets.reduce((s, name) => s + Number(updatedDamages[name] || 0), 0);
    try {
      const response = await fetch(`${API_URL}/daily-damage/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editRow.date, damages: updatedDamages, total }),
      });
      if (!response.ok) {
        alert("Failed to update entry: " + response.status);
        return;
      }
      const res = await fetch(`${API_URL}/daily-damage/all`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setDamages(data.map(d => ({
          id: d.id,
          date: d.date,
          ...((d.damages && typeof d.damages === 'object') ? d.damages : {}),
          total: d.total || 0
        })));
      }
      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    } catch (err) {
      alert("Error updating entry: " + err.message);
    }
  };

  const save = async () => {
    const total = outlets.reduce((s, name) => s + Number(form[name] || 0), 0);
    const success = addDamage({
      date: entryDate,
      ...form,
      total,
    });
    if (!success) {
      alert(`Entry for ${entryDate} already exists and cannot be modified.`);
      return;
    }
    try {
      await fetch(`${API_URL}/daily-damage/add-daily-damage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: entryDate, damages: { ...form }, total }),
      });
    } catch (err) {
      // Ignore backend error
    }
    alert(`Saved entry for ${entryDate}`);
    setHasEntry(true);
    setEntryTotal(total);
  };

  // Filter data based on date range
  const getFilteredData = () => {
    const sortedUnique = Array.from(
      new Map([...damages].sort((a, b) => new Date(a.date) - new Date(b.date)).map(d => [d.date, d])).values()
    );

    if (!fromDate && !toDate) {
      // Show all data if no filter
      return sortedUnique;
    }

    let filtered = sortedUnique;

    if (fromDate) {
      filtered = filtered.filter(d => new Date(d.date) >= new Date(fromDate));
    }

    if (toDate) {
      filtered = filtered.filter(d => new Date(d.date) <= new Date(toDate));
    }

    return filtered;
  };

  const filteredData = getFilteredData();

  const downloadExcel = () => {
    if (filteredData.length === 0) {
      alert("No data available for selected dates");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Damages");
    XLSX.writeFile(wb, "Daily_Damages_Report.xlsx");
  };

  const handleQuickRange = (type) => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    let fromDateVal;
    if (type === "lastWeek") {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      fromDateVal = d.toISOString().slice(0, 10);
    } else if (type === "lastMonth") {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      fromDateVal = d.toISOString().slice(0, 10);
    }
    setFromDate(fromDateVal || "");
    setToDate(to);
  };

  return (
    
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">
      {(isAdmin || isViewer || isDataAgent) && (
        <>
          <div className="max-w-7xl mx-auto w-full mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
                Daily Damages Report
              </h1>
              <p className="mt-1 text-sm md:text-base text-gray-500">
                Track egg damages per outlet and date.
              </p>
            </div>
            <button
              onClick={downloadExcel}
              className="inline-flex items-center rounded-full bg-[#ff7518] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >
              Download Excel
            </button>
          </div>
          {/* Entry Section - moved to top */}
          {(isAdmin || isDataAgent) && (
            <div className="mb-8 rounded-2xl bg-eggWhite p-5 shadow-sm md:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100">
                  <DamageEntryIcon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 md:text-lg">
                    Daily Damages Entry
                  </h2>
                  <p className="text-xs text-gray-500 md:text-sm">
                    Add new egg damage amounts for each outlet.
                  </p>
                </div>
              </div>
              <div className="space-y-5">
                {/* Select Date */}
                <div className="grid gap-4 md:grid-cols-[160px,1fr] md:items-center">
                  <label className="text-xs font-medium text-gray-700 md:text-sm">
                    Select Date
                  </label>
                  <div className="relative w-full" ref={entryCalendarRef}>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsEntryCalendarOpen((open) => !open)}
                        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
                      >
                        <span>
                          {entryDate ? formatDateDMY(entryDate) : "dd-mm-yyyy"}
                        </span>
                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                    {hasEntry && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="text-xs font-medium text-green-700">
                          Entry ({entryTotal}) • Locked
                        </div>
                      </div>
                    )}
                    {isEntryCalendarOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2">
                        <BaseCalendar
                          rows={damages}
                          selectedDate={entryDate}
                          onSelectDate={handleEntryDateSelect}
                          showDots={true}
                        />
                      </div>
                    )}
                  </div>
                </div>
                {/* Outlet inputs */}
                <div className="grid gap-3 md:grid-cols-5">
                  {outlets.map((outlet) => (
                    <div key={outlet} className="space-y-1">
                      <p className="text-xs font-medium text-gray-600">
                        {outlet}
                      </p>
                      <div className="relative">
                        <input
                          type="number"
                          value={form[outlet] ?? 0}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              [outlet]: Number(e.target.value),
                            }))
                          }
                          disabled={hasEntry}
                          className={`w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm ${
                            hasEntry ? "bg-gray-50 cursor-not-allowed" : ""
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Save button */}
                <div className="flex flex-col items-center gap-2 pt-4">
                  <button
                    type="button"
                    onClick={save}
                    disabled={hasEntry}
                    className={`inline-flex items-center justify-center rounded-2xl px-6 py-2.5 text-sm font-semibold text-white shadow-md ${
                      hasEntry
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-orange-500 hover:bg-orange-600"
                    }`}
                  >
                    {hasEntry ? "Locked" : "Save Entry"}
                  </button>
                  <p className="text-center text-[11px] text-gray-500 md:text-xs">
                    Values support decimals for exact amounts.
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* ...existing code... (Report, Table, Modal) */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-gray-700">
                  Date From
                </label>
                <div className="relative z-30" ref={fromCalendarRef}>
                  <button
                    type="button"
                    onClick={() => setIsFromCalendarOpen((o) => !o)}
                    className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
                  >
                    <span>
                      {fromDate ? formatDateDMY(fromDate) : "dd-mm-yyyy"}
                    </span>
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  {isFromCalendarOpen && (
                    <div className="absolute left-0 top-full mt-2 z-50">
                      <BaseCalendar
                        rows={damages}
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
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-gray-700">
                  Date To
                </label>
                <div className="relative z-30" ref={toCalendarRef}>
                  <button
                    type="button"
                    onClick={() => setIsToCalendarOpen((o) => !o)}
                    className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
                  >
                    <span>
                      {toDate ? formatDateDMY(toDate) : "dd-mm-yyyy"}
                    </span>
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  {isToCalendarOpen && (
                    <div className="absolute left-0 top-full mt-2 z-50">
                      <BaseCalendar
                        rows={damages}
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
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickRange("lastWeek")}
                className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Last Week
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange("lastMonth")}
                className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Last Month
              </button>
            </div>
          </div>
          {/* Data Table with Horizontal Scroll */}
          <div className="bg-white p-6 rounded-xl shadow mb-8">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-max">
                <thead>
                  <tr className="bg-orange-100 text-sm">
                    <th className="p-3 text-left w-40 sticky left-0 bg-orange-100 z-10">Date</th>
                    {outlets.map((name) => (
                      <th key={name} className="p-3 text-center min-w-[120px]">{name}</th>
                    ))}
                    <th className="p-3 text-center font-semibold min-w-[100px] sticky right-0 bg-orange-100 z-10">Total</th>
                    {isAdmin && <th className="p-3 text-center min-w-[80px]">Edit</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((d, i) => {
                    const rowTotal = outlets.reduce((sum, name) => sum + Number(d[name] || 0), 0);
                    return (
                      <tr
                        key={i}
                        className="border-t text-sm hover:bg-gray-50 transition"
                      >
                        <td className="p-3 text-left sticky left-0 bg-white z-10">{formatDateDisplay(d.date)}</td>
                        {outlets.map((name) => (
                          <td key={name} className="p-3 text-center">{d[name] ?? 0}</td>
                        ))}
                        <td className="p-3 text-center font-bold text-orange-600 sticky right-0 bg-white z-10">
                          {typeof d.total === 'number' ? d.total : rowTotal}
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-center">
                            <button
                              className="text-blue-600 hover:underline text-xs font-medium"
                              onClick={() => handleEditClick(d)}
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {/* Grand Total Row */}
                  <tr className="bg-orange-50 font-semibold text-orange-700">
                    <td className="p-3 text-left sticky left-0 bg-orange-50 z-10">Grand Total</td>
                    {outlets.map((name) => {
                      const total = filteredData.reduce((sum, d) => sum + Number(d[name] || 0), 0);
                      return (
                        <td key={name} className="p-3 text-center">{total}</td>
                      );
                    })}
                    <td className="p-3 text-center sticky right-0 bg-orange-50 z-10">
                      {filteredData.reduce((sum, d) => sum + (typeof d.total === 'number' ? d.total : outlets.reduce((s, name) => s + Number(d[name] || 0), 0)), 0)}
                    </td>
                    {isAdmin && <td className="p-3"></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {/* Edit Modal */}
          {editModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-xl shadow-lg p-6 min-w-[320px] max-w-full max-h-[80vh] overflow-y-auto">
                <h2 className="text-lg font-semibold mb-4">Edit Daily Damage ({formatDateDisplay(editRow.date)})</h2>
                <div className="space-y-3">
                  {outlets.map((name) => (
                    <div key={name} className="flex items-center gap-2">
                      <label className="w-32 text-xs font-medium text-gray-700">{name}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editValues[name] ?? 0}
                        onChange={e => handleEditValueChange(name, e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={handleEditCancel}
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300"
                  >Cancel</button>
                  <button
                    onClick={handleEditSave}
                    className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600"
                  >Save</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}