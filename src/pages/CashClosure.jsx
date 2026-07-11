import { useCallback, useEffect, useMemo, useState } from "react";
import { getRoleFlags, normalizeZone } from "../utils/role";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const ALL_ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

const getLocalIsoDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const normalizeDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("-");
      return `${year}-${month}-${day}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("/");
      return `${year}-${month}-${day}`;
    }
  }

  if (value && typeof value === "object" && typeof value.toDate === "function") {
    return getLocalIsoDate(value.toDate());
  }

  if (value && typeof value === "object" && value._seconds !== undefined) {
    return getLocalIsoDate(new Date(value._seconds * 1000));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : getLocalIsoDate(parsed);
};

const normalizeZoneLabel = (zone) => {
  if (!zone) return "";
  const normalized = String(zone).trim();
  const match = normalized.match(/(\d+)/);
  return match ? `Zone ${match[1]}` : normalized;
};

const normalizeTextKey = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const toNumber = (value) => {
  const numeric = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatCurrency = (value) => `₹${toNumber(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const formatDisplayDate = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const extractUserZones = (user, fallbackZone) => {
  const candidates = [];
  if (Array.isArray(user?.zoneIds)) candidates.push(...user.zoneIds);
  if (Array.isArray(user?.zones)) candidates.push(...user.zones);
  if (Array.isArray(user?.assignedZones)) candidates.push(...user.assignedZones);
  candidates.push(user?.zoneId, user?.zone, user?.zoneNumber, fallbackZone);

  return Array.from(new Set(candidates.map((zone) => normalizeZone(zone)).filter(Boolean)))
    .map((zone) => `Zone ${zone}`)
    .filter((zone) => ALL_ZONES.includes(zone))
    .sort((a, b) => Number(normalizeZone(a)) - Number(normalizeZone(b)));
};

const buildZoneOutletKeySet = (outlets, zoneLabel) => {
  const normalizedZone = normalizeZone(zoneLabel);
  const keys = new Set();

  (Array.isArray(outlets) ? outlets : []).forEach((outlet) => {
    if (!outlet || typeof outlet !== "object") return;
    const outletZone = normalizeZone(outlet.zoneId || outlet.zone || outlet.zoneNumber);
    if (!outletZone || outletZone !== normalizedZone) return;

    [outlet.id, outlet.name, outlet.area].forEach((key) => {
      const normalized = normalizeTextKey(key);
      if (normalized) keys.add(normalized);
    });
  });

  return keys;
};

const getResponseErrorMessage = async (response, fallbackMessage) => {
  try {
    const responseClone = response.clone();
    const responseText = await responseClone.text();
    if (!responseText) return fallbackMessage;

    try {
      const parsed = JSON.parse(responseText);
      return parsed?.message || parsed?.error || responseText || fallbackMessage;
    } catch {
      return responseText || fallbackMessage;
    }
  } catch {
    return fallbackMessage;
  }
};

const toZoneScopedTotal = (entry, zoneLabel, zoneOutletKeys) => {
  if (!entry || typeof entry !== "object") return 0;

  const outlets = entry.outlets && typeof entry.outlets === "object" && !Array.isArray(entry.outlets)
    ? entry.outlets
    : {};

  const addedByPerOutlet = entry.addedByPerOutlet && typeof entry.addedByPerOutlet === "object"
    ? entry.addedByPerOutlet
    : {};

  const normalizedZone = normalizeZone(zoneLabel);

  return Object.entries(outlets).reduce((sum, [outletKey, amount]) => {
    const byUserZone = normalizeZone(addedByPerOutlet?.[outletKey]?.zone) === normalizedZone;
    const byOutletZone = zoneOutletKeys.has(normalizeTextKey(outletKey));
    if (!byUserZone && !byOutletZone) return sum;
    return sum + toNumber(amount);
  }, 0);
};

export default function CashClosure() {
  const { isAdmin, isSupervisor, isViewer, zone } = getRoleFlags();
  const [rows, setRows] = useState([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedDate, setSelectedDate] = useState(getLocalIsoDate());
  const [totalCashAmount, setTotalCashAmount] = useState("0");
  const [incentives, setIncentives] = useState("0");
  const [foodAllowance, setFoodAllowance] = useState("0");
  const [advance, setAdvance] = useState("0");
  const [cashHandover, setCashHandover] = useState("0");
  const [cashRemarks, setCashRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingAutoData, setFetchingAutoData] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const availableZones = useMemo(() => {
    if (isAdmin || isViewer) return ALL_ZONES;
    if (isSupervisor) return extractUserZones(user, zone);
    return [];
  }, [isAdmin, isSupervisor, isViewer, user, zone]);

  const selectedZoneLabel = useMemo(() => normalizeZoneLabel(selectedZone), [selectedZone]);

  const loadRows = useCallback(async (zoneName) => {
    setLoading(true);
    try {
      let response;
      if (zoneName) {
        response = await fetch(`${API_URL}/cash-closure/zone/${encodeURIComponent(zoneName)}`);
      } else {
        response = await fetch(`${API_URL}/cash-closure/all`);
      }

      if (!response.ok) {
        setRows([]);
        return;
      }

      const data = await response.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAutofillData = useCallback(async (zoneName, dateValue) => {
    if (!zoneName || !dateValue) return;
    
    // Ensure date is in ISO format (YYYY-MM-DD)
    const isoDate = normalizeDate(dateValue);
    if (!isoDate) return;
    
    setFetchingAutoData(true);
    try {
      const [cashPaymentsRes, incentivesRes, foodAllowanceRes, advanceRes, outletsRes] = await Promise.all([
        fetch(`${API_URL}/cash-payments/date/${isoDate}`),
        fetch(`${API_URL}/incentive/date/${isoDate}`),
        fetch(`${API_URL}/food-allowance/date/${isoDate}`),
        fetch(`${API_URL}/advance/date/${isoDate}`),
        fetch(`${API_URL}/outlets/all`),
      ]);

      let totalCash = 0;
      let incentivesAmount = 0;
      let foodAllowanceAmount = 0;
      let advanceAmount = 0;

      const outletsData = outletsRes.ok ? await outletsRes.json() : [];
      const zoneOutletKeys = buildZoneOutletKeySet(outletsData, zoneName);

      if (cashPaymentsRes.ok) {
        const cashPaymentsData = await cashPaymentsRes.json();
        const cashEntry = Array.isArray(cashPaymentsData) ? cashPaymentsData[0] : cashPaymentsData;
        totalCash = toZoneScopedTotal(cashEntry, zoneName, zoneOutletKeys);
      }

      if (incentivesRes.ok) {
        const data = await incentivesRes.json();
        incentivesAmount = toZoneScopedTotal(data, zoneName, zoneOutletKeys);
      }

      if (foodAllowanceRes.ok) {
        const data = await foodAllowanceRes.json();
        foodAllowanceAmount = toZoneScopedTotal(data, zoneName, zoneOutletKeys);
      }

      if (advanceRes.ok) {
        const data = await advanceRes.json();
        advanceAmount = toZoneScopedTotal(data, zoneName, zoneOutletKeys);
      }

      setTotalCashAmount(String(totalCash));
      setIncentives(String(incentivesAmount));
      setFoodAllowance(String(foodAllowanceAmount));
      setAdvance(String(advanceAmount));
    } catch (error) {
      console.error("Error fetching autofill data:", error);
    } finally {
      setFetchingAutoData(false);
    }
  }, []);

  useEffect(() => {
    loadRows(selectedZone);
    const interval = window.setInterval(() => loadRows(selectedZone), 30000);
    return () => window.clearInterval(interval);
  }, [loadRows, selectedZone]);

  useEffect(() => {
    if (!selectedZone && availableZones.length > 0) {
      setSelectedZone(availableZones[0]);
    }
  }, [availableZones, selectedZone]);

  const existingEntry = useMemo(() => {
    if (!selectedZoneLabel || !selectedDate) return null;
    return rows.find((row) => normalizeZoneLabel(row?.zone) === selectedZoneLabel && normalizeDate(row?.date || row?.createdAt) === selectedDate) || null;
  }, [rows, selectedZoneLabel, selectedDate]);

  const lockedForSupervisor = Boolean(isSupervisor && existingEntry);

  useEffect(() => {
    if (existingEntry) {
      setTotalCashAmount(String(existingEntry.totalCashAmount ?? 0));
      setIncentives(String(existingEntry.incentives ?? 0));
      setFoodAllowance(String(existingEntry.foodAllowance ?? 0));
      setAdvance(String(existingEntry.advance ?? 0));
      setCashHandover(String(existingEntry.cashHandover ?? 0));
      setCashRemarks(String(existingEntry.cashRemarks ?? ""));
      return;
    }

    fetchAutofillData(selectedZoneLabel, selectedDate);
    setCashHandover("0");
    setCashRemarks("");
  }, [existingEntry?.id, selectedZoneLabel, selectedDate, fetchAutofillData]);

  const handleAdminEdit = useCallback((row) => {
    if (!isAdmin || !row) return;
    const rowZone = normalizeZoneLabel(row.zone) || selectedZone;
    const rowDate = normalizeDate(row.date || row.createdAt) || selectedDate;
    setSelectedZone(rowZone);
    setSelectedDate(rowDate);
    // scroll to top so the New Entry form is visible
    try { window.scrollTo?.({ top: 0, behavior: "smooth" }); } catch {}
  }, [isAdmin, selectedZone, selectedDate]);

  const sortedRows = useMemo(() => {
    return [...rows]
      .filter((row) => normalizeZoneLabel(row?.zone) === selectedZoneLabel)
      .sort((left, right) => {
        const dateCompare = String(right?.date || "").localeCompare(String(left?.date || ""));
        if (dateCompare !== 0) return dateCompare;
        return String(left?.zone || "").localeCompare(String(right?.zone || ""));
      });
  }, [rows, selectedZoneLabel]);

  const balance = useMemo(() => {
    const total = toNumber(totalCashAmount);
    const incentivesAmount = toNumber(incentives);
    const handoverAmount = toNumber(cashHandover);
    const advanceAmount = toNumber(advance);
    return total - incentivesAmount - handoverAmount - advanceAmount;
  }, [totalCashAmount, incentives, cashHandover, advance]);

  const handleSave = async () => {
    if (isSupervisor && existingEntry) {
      alert("You cannot update a saved entry. Contact an admin to make changes for this date.");
      return;
    }
    if (!selectedZoneLabel || !selectedDate) {
      alert("Please select a zone and date.");
      return;
    }

    const token = localStorage.getItem("token");
    const addedBy = {
      username: user?.username || user?.uid || "unknown",
      role: user?.role || "unknown",
      zone: selectedZoneLabel,
      timestamp: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/cash-closure/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          zone: selectedZoneLabel,
          date: selectedDate,
          totalCashAmount: toNumber(totalCashAmount),
          incentives: toNumber(incentives),
          foodAllowance: toNumber(foodAllowance),
          advance: toNumber(advance),
          cashHandover: toNumber(cashHandover),
          cashRemarks: String(cashRemarks || "").trim(),
          addedBy,
        }),
      });

      if (!response.ok) {
        const message = await getResponseErrorMessage(response, "Failed to save cash closure entry");
        throw new Error(message);
      }

      await loadRows(selectedZone);
      alert(existingEntry ? "Cash closure entry updated." : "Cash closure entry saved.");
    } catch (error) {
      alert(error?.message || "Failed to save cash closure entry");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin && !isSupervisor && !isViewer) {
    return (
      <div className="min-h-screen bg-eggBg flex items-center justify-center px-4">
        <div className="rounded-2xl border border-orange-200 bg-white px-6 py-5 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Cash Closure</h2>
          <p className="mt-2 text-sm text-gray-500">Only Admin, Supervisor, and Viewer can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eggBg p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Cash Closure</h1>
          <p className="mt-1 text-sm text-gray-500">
            Record zone-wise cash closure values and review the full daily history below.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {availableZones.map((zoneName) => (
              <button
                key={zoneName}
                type="button"
                onClick={() => setSelectedZone(zoneName)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  selectedZone === zoneName
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:text-orange-600",
                ].join(" ")}
              >
                {zoneName}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">New Entry</h2>
              <p className="mt-1 text-sm text-gray-500">Fill the form as shown in the cash closure sheet.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={lockedForSupervisor}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">Total Cash Amount</label>
                {fetchingAutoData && <span className="text-xs text-orange-600">Auto-filling...</span>}
              </div>
              <div className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-semibold">
                {formatCurrency(totalCashAmount)}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">Incentives</label>
                {fetchingAutoData && <span className="text-xs text-orange-600">Auto-filling...</span>}
              </div>
              <div className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-semibold">
                {formatCurrency(incentives)}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">Food Allowance</label>
                {fetchingAutoData && <span className="text-xs text-orange-600">Auto-filling...</span>}
              </div>
              <div className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-semibold">
                {formatCurrency(foodAllowance)}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">Advance</label>
                {fetchingAutoData && <span className="text-xs text-orange-600">Auto-filling...</span>}
              </div>
              <div className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-semibold">
                {formatCurrency(advance)}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Balance</label>
              <div className="w-full rounded-xl border-2 border-blue-400 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-800">
                {formatCurrency(balance)}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Cash Handover</label>
              <input
                type="number"
                min="0"
                value={cashHandover}
                onChange={(e) => setCashHandover(e.target.value)}
                disabled={lockedForSupervisor}
                placeholder="Enter cash handover amount"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold text-gray-700">Cash Remarks</label>
              <textarea
                rows={3}
                value={cashRemarks}
                onChange={(e) => setCashRemarks(e.target.value)}
                disabled={lockedForSupervisor}
                placeholder="Enter cash remarks (optional)"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {existingEntry ? (
              isAdmin ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !selectedZoneLabel || !selectedDate}
                  className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {saving ? "Saving..." : "Update Entry"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 cursor-not-allowed"
                  title="Supervisors cannot edit saved entries. Contact admin to modify."
                >
                  Locked
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !selectedZoneLabel || !selectedDate}
                className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving ? "Saving..." : "Save Entry"}
              </button>
            )}
            <button
              type="button"
              onClick={() => loadRows(selectedZone)}
              disabled={loading}
              className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cash Closure History</h2>
              <p className="text-sm text-gray-500">All saved zone records are shown here.</p>
            </div>
            <div className="rounded-full bg-orange-50 px-4 py-1 text-xs font-semibold text-orange-700">
              {sortedRows.length} record{sortedRows.length === 1 ? "" : "s"}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-gray-500">Loading cash closure data...</div>
          ) : sortedRows.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-gray-500">No cash closure entries found yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-orange-800">Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-800">Total Cash Amount</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-800">Incentives</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-800">Food Allowance</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-800">Advance</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-800">Cash Handover</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-800">Balance</th>
                    <th className="px-4 py-3 text-left font-semibold text-orange-800">Cash Remarks</th>
                    {isAdmin ? <th className="px-4 py-3 text-right font-semibold text-orange-800">Action</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {sortedRows.map((row) => {
                    const rowBalance = toNumber(row.totalCashAmount) - toNumber(row.incentives) - toNumber(row.cashHandover) - toNumber(row.advance);
                    return (
                      <tr key={row.id || `${row.zone}-${row.date}`} className="hover:bg-gray-50/70">
                        <td className="px-4 py-3 text-gray-700">{formatDisplayDate(normalizeDate(row.date || row.createdAt))}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.totalCashAmount)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.incentives)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.foodAllowance)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.advance)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.cashHandover)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatCurrency(rowBalance)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          <span className="block max-w-xs break-words">{row.cashRemarks || "-"}</span>
                        </td>
                          {isAdmin ? (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleAdminEdit(row)}
                                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                              >
                                Edit
                              </button>
                            </td>
                          ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
