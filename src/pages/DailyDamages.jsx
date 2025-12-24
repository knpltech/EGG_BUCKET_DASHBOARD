import { useState, useEffect, useRef } from "react";
import { useDamage } from "../context/DamageContext";
import * as XLSX from "xlsx";

export default function DailyDamages() {
  const { damages, addDamage, remapDamagesForOutlets } = useDamage();

  // Outlets (load from Outlets management localStorage so all pages reflect changes)
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

  // When outlets change (from Outlets page), reset form and ensure displayed entries align
  useEffect(() => {
    setForm(() => {
      const f = {};
      outlets.forEach((o) => (f[o] = 0));
      return f;
    });

    // Remap existing damages to match new outlets
    remapDamagesForOutlets(outlets);
  }, [outlets]);

  // Listen for outlet changes from Outlets page (same-tab via custom event, cross-tab via storage event)
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

  // Entry date for the damage record (defaults to today)
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Calendar popover state for date picker in the Date field
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarRef = useRef(null);

  const prevMonth = () => {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
    );
  };

  const getMonthGrid = (monthDate = calendarMonth) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth(); // 0-indexed
    const monthStart = new Date(year, month, 1);
    const startDay = monthStart.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
    const grid = [];

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startDay + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        grid.push(null);
      } else {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
          dayNum
        ).padStart(2, "0")}`;
        const hasEntry = damages.some((d) => d.date === dateStr);
        grid.push({ day: dayNum, dateStr, hasEntry });
      }
    }

    return grid;
  };

  // close popover on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);





  // load existing data for selected date into form and set status
  const [hasEntry, setHasEntry] = useState(false);
  const [entryTotal, setEntryTotal] = useState(0);

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

    // set calendar month to currently selected date's month so popover shows the selected date
    const [y, m] = entryDate.split('-');
    setCalendarMonth(new Date(Number(y), Number(m) - 1, 1));
  }, [entryDate, damages]);

  const save = () => {
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

    alert(`Saved entry for ${entryDate}`);
    setHasEntry(true);
    setEntryTotal(total);
  }; 

  const filteredData = damages.filter((d) => {
    if (!fromDate || !toDate) return true;
    return d.date >= fromDate && d.date <= toDate;
  });

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

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">


      {/* Damage Entry */}
      <div className="max-w-7xl mx-auto w-full">
      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Enter Daily Damages</h2>



        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date</label>
            <div className="flex items-center gap-3">
              <div className="relative" ref={calendarRef}>
                <input
                  type="text"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  onFocus={() => setShowCalendar(true)}
                  onClick={() => setShowCalendar(true)}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />

                {/* small status indicator */}
                <div className="flex items-center gap-2 absolute right-0 top-1/2 -translate-y-1/2 mr-3">
                  <div className={`w-3 h-3 rounded-full ${hasEntry ? 'bg-green-400' : 'bg-red-500'}`}></div>
                  {hasEntry ? (
                    <span className="text-sm text-green-700 font-medium">Entry ({entryTotal}) • Locked</span>
                  ) : (
                    <span className="text-sm text-red-600">No</span>
                  )}
                </div>

                {showCalendar && (
                  <div className="absolute z-50 mt-2 p-3 bg-white rounded-lg shadow-lg w-64">
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={(e)=>{e.stopPropagation(); prevMonth();}} className="px-2 py-1 rounded bg-gray-100">◀</button>
                      <div className="font-medium">{calendarMonth.toLocaleString("default", { month: "short" })} {calendarMonth.getFullYear()}</div>
                      <button onClick={(e)=>{e.stopPropagation(); nextMonth();}} className="px-2 py-1 rounded bg-gray-100">▶</button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-sm mb-2">
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                        <div key={d} className="text-center font-medium text-xs text-gray-600">{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-sm">
                      {getMonthGrid().map((cell, idx) => (
                        cell ? (
                          <div key={idx} onClick={(e)=>{e.stopPropagation(); setEntryDate(cell.dateStr); setShowCalendar(false); }} className={`p-2 rounded text-center cursor-pointer select-none ${entryDate === cell.dateStr ? 'ring-2 ring-orange-400' : ''}`}>
                            <div className="text-sm">{cell.day}</div>
                            <div className={`h-2 w-2 rounded-full mx-auto mt-2 ${cell.hasEntry ? 'bg-green-400' : 'bg-red-500'}`}></div>
                          </div>
                        ) : (
                          <div key={idx} className="p-2"></div>
                        )
                      ))}
                    </div>

                  </div>
                )}
              </div>
            </div>            </div>
          {outlets.map((name) => (
            <div key={name}>
              <label className="block text-sm text-gray-600 mb-1">{name}</label>
              <input
                type="number"
                value={form[name] ?? 0}
                onChange={(e) => setForm({ ...form, [name]: Number(e.target.value) })}
                disabled={hasEntry}
                className={`w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 ${hasEntry ? 'bg-gray-50 cursor-not-allowed' : ''}`}
              />
            </div>
          ))}
        </div>

        <button
          onClick={save}
          disabled={hasEntry}
          className={`bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium ${hasEntry ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {hasEntry ? 'Locked' : 'Save'}
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white p-6 rounded-xl shadow overflow-x-auto mb-8">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-orange-100 text-sm">
              <th className="p-3 text-left w-40">Date</th>
              {outlets.map((name) => (
                <th key={name} className="p-3 text-center">{name}</th>
              ))}
              <th className="p-3 text-center font-semibold">Total</th>
            </tr>
          </thead>

          <tbody>
            {filteredData.map((d, i) => (
              <tr
                key={i}
                className="border-t text-sm hover:bg-gray-50 transition"
              >
                <td className="p-3 text-left">{d.date}</td>
                {outlets.map((name) => (
                  <td key={name} className="p-3 text-center">{d[name] ?? 0}</td>
                ))}
                <td className="p-3 text-center font-bold text-orange-600">
                  {d.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Download Report */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">Download Report</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <button
            onClick={downloadExcel}
            className="h-[42px] bg-green-600 hover:bg-green-700 text-white px-6 rounded-lg font-medium"
          >
            Download Excel
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
