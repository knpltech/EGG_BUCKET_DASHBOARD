import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

const monthLabel = (month) => MONTHS.find((item) => item.value === month)?.label || "";

const toNumber = (value) => {
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatCurrency = (value) => `Rs ${toNumber(value).toLocaleString("en-IN")}`;

const formatNumber = (value) => toNumber(value).toLocaleString("en-IN");

const toIsoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getProvisionalSalary = (dailyRates, outletId, year, month) => {
  const start = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = monthEnd > today ? today : monthEnd;
  const rate = dailyRates.find((item) => String(item.outletId) === String(outletId));
  if (!rate || start > end) return 0;

  const effectiveFrom = new Date(`${rate.effectiveFrom}T00:00:00`);
  const firstDay = start > effectiveFrom ? start : effectiveFrom;
  if (firstDay > end) return 0;
  const days = Math.floor((end - firstDay) / 86400000) + 1;
  return days * toNumber(rate.dailyRate);
};

const getOutletLabel = (outlet) => String(outlet?.area || outlet?.name || outlet?.id || "").trim();

const buildYearOptions = () => {
  const nowYear = new Date().getFullYear();
  const options = [];
  for (let offset = -2; offset <= 3; offset += 1) {
    options.push(nowYear + offset);
  }
  return options;
};

export default function OutletSalary() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearOptions] = useState(buildYearOptions);
  const [outlets, setOutlets] = useState([]);
  const [entries, setEntries] = useState([]);
  const [dailyRates, setDailyRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [salaryInputs, setSalaryInputs] = useState({});
  const [isDailyRateModalOpen, setIsDailyRateModalOpen] = useState(false);
  const [dailyRateOutlet, setDailyRateOutlet] = useState("");
  const [dailyRateAmount, setDailyRateAmount] = useState("");
  const [dailyRateDate, setDailyRateDate] = useState(() => toIsoDate(new Date()));
  const [editingDailyRate, setEditingDailyRate] = useState(false);

  const sortedOutlets = useMemo(() => {
    const rows = Array.isArray(outlets) ? outlets : [];
    return [...rows].sort((a, b) => getOutletLabel(a).localeCompare(getOutletLabel(b)));
  }, [outlets]);

  const entryByMonth = useMemo(() => {
    const map = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      map.set(Number(entry.month), entry);
    });
    return map;
  }, [entries]);

  const tableRows = useMemo(() => {
    const finalByMonth = new Map((Array.isArray(entries) ? entries : []).map((entry) => [Number(entry.month), entry]));
    return MONTHS.map(({ value: month }) => {
      const finalEntry = finalByMonth.get(month);
      const provisionalOutlets = Object.fromEntries(sortedOutlets.map((outlet) => [
        outlet.id,
        getProvisionalSalary(dailyRates, outlet.id, selectedYear, month),
      ]));
      const provisionalTotal = Object.values(provisionalOutlets).reduce((sum, amount) => sum + toNumber(amount), 0);
      if (!finalEntry && !provisionalTotal) return null;
      return {
        ...(finalEntry || {}),
        year: selectedYear,
        month,
        monthName: monthLabel(month),
        outlets: finalEntry?.outlets || provisionalOutlets,
        total: finalEntry ? toNumber(finalEntry.total) : provisionalTotal,
        isProvisional: !finalEntry,
      };
    }).filter(Boolean);
  }, [dailyRates, entries, selectedYear, sortedOutlets]);

  const ytdTotal = useMemo(() => {
    return tableRows.reduce((sum, row) => sum + toNumber(row.total), 0);
  }, [tableRows]);

  const grandTotals = useMemo(() => {
    const outletTotals = {};
    sortedOutlets.forEach((outlet) => {
      outletTotals[outlet.id] = 0;
    });

    tableRows.forEach((row) => {
      const rowOutlets = row?.outlets && typeof row.outlets === "object" ? row.outlets : {};
      sortedOutlets.forEach((outlet) => {
        outletTotals[outlet.id] += toNumber(rowOutlets[outlet.id]);
      });
    });

    const allTotal = Object.values(outletTotals).reduce((sum, value) => sum + toNumber(value), 0);
    return { outletTotals, allTotal };
  }, [tableRows, sortedOutlets]);

  const resetForm = useCallback(() => {
    setSelectedMonth("");
    setSalaryInputs({});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [outletResponse, salaryResponse, dailyRateResponse] = await Promise.all([
        fetch(`${API_URL}/outlets/all`),
        fetch(`${API_URL}/outlet-salary/all?year=${selectedYear}`),
        fetch(`${API_URL}/outlet-salary/daily-rates`),
      ]);

      if (!outletResponse.ok) {
        throw new Error("Failed to load outlets");
      }
      if (!salaryResponse.ok || !dailyRateResponse.ok) {
        throw new Error("Failed to load outlet salary entries");
      }

      const outletData = await outletResponse.json();
      const salaryData = await salaryResponse.json();
      const dailyRateData = await dailyRateResponse.json();

      setOutlets(Array.isArray(outletData) ? outletData : []);
      setEntries(Array.isArray(salaryData) ? salaryData : []);
      setDailyRates(Array.isArray(dailyRateData) ? dailyRateData : []);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load page data");
      setOutlets([]);
      setEntries([]);
      setDailyRates([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openNewEntryModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openDailyRateModal = (rate = null) => {
    setDailyRateOutlet(rate?.outletId || sortedOutlets[0]?.id || "");
    setDailyRateAmount(rate?.dailyRate ? String(rate.dailyRate) : "");
    setDailyRateDate(rate?.effectiveFrom || toIsoDate(new Date()));
    setEditingDailyRate(Boolean(rate));
    setIsDailyRateModalOpen(true);
  };

  const openEditModal = (month) => {
    const monthValue = Number(month);
    if (!monthValue) return;

    const existing = entryByMonth.get(monthValue);
    const nextInputs = {};

    sortedOutlets.forEach((outlet) => {
      const amount = toNumber(existing?.outlets?.[outlet.id] ?? getProvisionalSalary(dailyRates, outlet.id, selectedYear, monthValue));
      nextInputs[outlet.id] = amount ? String(amount) : "";
    });

    setSelectedMonth(String(monthValue));
    setSalaryInputs(nextInputs);
    setIsModalOpen(true);
  };

  const onMonthChange = (value) => {
    setSelectedMonth(value);
    const monthValue = Number(value);

    if (!monthValue) {
      setSalaryInputs({});
      return;
    }

    const existing = entryByMonth.get(monthValue);
    const nextInputs = {};

    sortedOutlets.forEach((outlet) => {
      const amount = toNumber(existing?.outlets?.[outlet.id] ?? getProvisionalSalary(dailyRates, outlet.id, selectedYear, monthValue));
      nextInputs[outlet.id] = amount ? String(amount) : "";
    });

    setSalaryInputs(nextInputs);
  };

  const saveDailyRate = async (event) => {
    event.preventDefault();
    if (!dailyRateOutlet || toNumber(dailyRateAmount) <= 0 || !dailyRateDate) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/outlet-salary/daily-rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ outletId: dailyRateOutlet, dailyRate: toNumber(dailyRateAmount), effectiveFrom: dailyRateDate }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to save daily salary");
      }
      const saved = await response.json();
      setDailyRates((current) => [...current.filter((item) => item.id !== saved.id), saved]);
      setIsDailyRateModalOpen(false);
    } catch (saveError) {
      alert(saveError?.message || "Failed to save daily salary");
    } finally {
      setSaving(false);
    }
  };

  const onSalaryChange = (outletId, value) => {
    if (!/^\d*$/.test(value)) return;
    setSalaryInputs((current) => ({ ...current, [outletId]: value }));
  };

  const saveEntry = async (event) => {
    event.preventDefault();

    const month = Number(selectedMonth);
    if (!month) {
      alert("Please select a month.");
      return;
    }

    const outletsPayload = {};
    sortedOutlets.forEach((outlet) => {
      outletsPayload[outlet.id] = toNumber(salaryInputs[outlet.id]);
    });

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const response = await fetch(`${API_URL}/outlet-salary/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          year: Number(selectedYear),
          month,
          outlets: outletsPayload,
          addedBy: {
            username: user?.username || user?.uid || "admin",
            role: user?.role || "Admin",
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || "Failed to save salary entry");
      }

      const saved = await response.json();
      setEntries((current) => {
        const next = (Array.isArray(current) ? current : []).filter(
          (item) => !(Number(item.year) === Number(saved.year) && Number(item.month) === Number(saved.month))
        );
        next.push(saved);
        return next;
      });
      setIsModalOpen(false);
      resetForm();
    } catch (saveError) {
      alert(saveError?.message || "Failed to save salary entry");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const headers = ["Month", ...sortedOutlets.map((outlet) => getOutletLabel(outlet)), "Total"];
    const rows = tableRows.map((row) => {
      const values = [monthLabel(Number(row.month)) || row.monthName || ""];
      sortedOutlets.forEach((outlet) => {
        values.push(toNumber(row?.outlets?.[outlet.id]));
      });
      values.push(toNumber(row.total));
      return values;
    });

    const grandRow = ["Grand Total"];
    sortedOutlets.forEach((outlet) => {
      grandRow.push(toNumber(grandTotals.outletTotals[outlet.id]));
    });
    grandRow.push(toNumber(grandTotals.allTotal));

    const allRows = [headers, ...rows, grandRow];
    const csvContent = allRows
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `outlet-salary-${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const modalExistingEntry = selectedMonth ? entryByMonth.get(Number(selectedMonth)) : null;

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8">
      <div className="mx-auto w-full max-w-[1400px] rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Outlet Salary</h1>
            <p className="mt-1 text-sm text-gray-500">Monthly salary overview by outlets</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => openDailyRateModal()}
              className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
            >
              Add Per Day Salary
            </button>
            <button
              type="button"
              onClick={openNewEntryModal}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Add Salary Entry
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
            <p className="text-xs font-semibold text-gray-600">Total Salary (YTD)</p>
            <p className="mt-1 text-3xl font-bold text-orange-600">{formatCurrency(ytdTotal)}</p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
          >
            Export
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-orange-800">Per Day Salary Rules</h2>
              <p className="text-xs text-orange-700">Automatically accrued for every calendar day, including outlet-closed days.</p>
            </div>
            <span className="text-xs font-semibold text-orange-700">{dailyRates.length} active</span>
          </div>
          {dailyRates.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {dailyRates.map((rate) => {
                const outlet = sortedOutlets.find((item) => String(item.id) === String(rate.outletId));
                return (
                  <div key={rate.id} className="flex items-center justify-between gap-3 rounded-lg border border-orange-100 bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{getOutletLabel(outlet) || rate.outletId}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(rate.dailyRate)}/day · from {rate.effectiveFrom}</p>
                    </div>
                    <button type="button" onClick={() => openDailyRateModal(rate)} className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Edit</button>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-3 text-sm text-orange-700">No daily salary rules added yet.</p>}
        </section>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F9F4ED] text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Month</th>
                {sortedOutlets.map((outlet) => (
                  <th key={outlet.id} className="px-4 py-3 text-right font-semibold uppercase tracking-wide">
                    {getOutletLabel(outlet)}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && tableRows.length === 0 && (
                <tr>
                  <td colSpan={sortedOutlets.length + 3} className="px-4 py-8 text-center text-gray-500">
                    No salary entries for {selectedYear}.
                  </td>
                </tr>
              )}

              {tableRows.map((row) => (
                <tr key={`${row.year}-${row.month}`} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {monthLabel(Number(row.month)) || row.monthName}
                    {row.isProvisional && <span className="ml-2 text-xs font-semibold text-orange-600">Provisional</span>}
                  </td>
                  {sortedOutlets.map((outlet) => (
                    <td key={outlet.id} className={`px-4 py-3 text-right ${row.isProvisional ? "font-semibold text-orange-600" : "text-gray-700"}`}>
                      {formatNumber(row?.outlets?.[outlet.id])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold text-orange-600">{formatNumber(row.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => openEditModal(row.month)}
                      className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {row.isProvisional ? "Finalize" : "Edit"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {tableRows.length > 0 && (
              <tfoot className="border-t border-gray-200 bg-[#F9F4ED]">
                <tr>
                  <td className="px-4 py-3 font-bold text-orange-700">Grand Total</td>
                  {sortedOutlets.map((outlet) => (
                    <td key={outlet.id} className="px-4 py-3 text-right font-bold text-orange-700">
                      {formatNumber(grandTotals.outletTotals[outlet.id])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-orange-700">{formatNumber(grandTotals.allTotal)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {modalExistingEntry ? "Edit Salary Entry" : "Add Salary Entry"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-600"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveEntry} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(event) => onMonthChange(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  required
                >
                  <option value="">Select Month</option>
                  {MONTHS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                {modalExistingEntry && (
                  <p className="mt-1 text-xs text-orange-600">
                    Existing entry found for this month. Saving will update it.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {sortedOutlets.map((outlet) => (
                  <label key={outlet.id} className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">{getOutletLabel(outlet)}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={salaryInputs[outlet.id] || ""}
                      onChange={(event) => onSalaryChange(outlet.id, event.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
                    />
                  </label>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDailyRateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add Per Day Salary</h2>
                <p className="mt-1 text-sm text-gray-500">One editable daily salary rule per outlet.</p>
              </div>
              <button type="button" onClick={() => setIsDailyRateModalOpen(false)} className="rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-600">Close</button>
            </div>
            <form onSubmit={saveDailyRate} className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Outlet
                <select value={dailyRateOutlet} onChange={(event) => setDailyRateOutlet(event.target.value)} disabled={editingDailyRate} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" required>
                  <option value="">Select outlet</option>
                  {sortedOutlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{getOutletLabel(outlet)}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-gray-700">Amount per day (Rs.)
                <input type="number" min="1" step="0.01" value={dailyRateAmount} onChange={(event) => setDailyRateAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" required />
              </label>
              <label className="block text-sm font-semibold text-gray-700">Effective from
                <input type="date" value={dailyRateDate} onChange={(event) => setDailyRateDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" required />
              </label>
              <button type="submit" disabled={saving} className="w-full rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Daily Salary"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
