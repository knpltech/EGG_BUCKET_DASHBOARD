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

const getDocTimestamp = (doc) => {
  const value = doc?.updatedAt || doc?.createdAt || doc?.date;
  if (value && typeof value === "object" && typeof value.toDate === "function") return value.toDate().getTime();
  if (value && typeof value === "object" && value._seconds !== undefined) return value._seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const compareIsoDates = (left, right) => String(left || "").localeCompare(String(right || ""));

const getEntryWindowState = (now = new Date()) => {
  const currentDate = getLocalIsoDate(now);
  const currentHour = now.getHours();
  const isBeforeNoon = currentHour < 12;

  return {
    currentDate,
    isBeforeNoon,
    cutoffLabel: "12:00 PM",
  };
};

const formatDate = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
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

  const normalized = Array.from(new Set(candidates.map((z) => normalizeZone(z)).filter(Boolean)));
  return normalized
    .map((z) => `Zone ${z}`)
    .filter((zone) => ALL_ZONES.includes(zone))
    .sort((a, b) => Number(normalizeZone(a)) - Number(normalizeZone(b)));
};

const getValueForOutlet = (values, outlet) => {
  if (!values || typeof values !== "object" || Array.isArray(values)) return 0;
  const keys = [outlet?.id, outlet?.area, outlet?.name].filter(Boolean);
  for (const key of keys) {
    if (values[key] !== undefined) return toNumber(values[key]);
  }
  return 0;
};

const hasValueForOutlet = (values, outlet) => {
  if (!values || typeof values !== "object" || Array.isArray(values)) return false;
  const keys = [outlet?.id, outlet?.area, outlet?.name].filter(Boolean);
  return keys.some((key) => values[key] !== undefined);
};

const getLatestDayDoc = (rows, selectedDate) => {
  if (!Array.isArray(rows)) return null;
  const dayRows = rows
    .filter((doc) => normalizeDate(doc?.date || doc?.createdAt) === selectedDate)
    .sort((a, b) => getDocTimestamp(b) - getDocTimestamp(a));
  return dayRows[0] || null;
};

export default function ZoneStockEntry() {
  const { isAdmin, isSupervisor, isViewer, zone } = getRoleFlags();
  const [now, setNow] = useState(() => new Date());
  const entryWindow = useMemo(() => getEntryWindowState(now), [now]);
  const [selectedDate, setSelectedDate] = useState(entryWindow.currentDate);
  const [selectedZone, setSelectedZone] = useState("");
  const [stockIn, setStockIn] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editStockIn, setEditStockIn] = useState("0");
  const [editRemarks, setEditRemarks] = useState("");

  const [outlets, setOutlets] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [damageRows, setDamageRows] = useState([]);
  const [zoneStockRows, setZoneStockRows] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

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

  useEffect(() => {
    if (!selectedZone && availableZones.length > 0) {
      setSelectedZone(availableZones[0]);
    }
  }, [availableZones, selectedZone]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  const loadAll = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const [outletsRes, salesRes, damageRes, zoneStockRes] = await Promise.all([
        fetch(`${API_URL}/outlets/all`),
        fetch(`${API_URL}/dailysales/all`),
        fetch(`${API_URL}/daily-damage/all`),
        fetch(`${API_URL}/zone-stock/all`),
      ]);

      const [outletsData, salesData, damageData, zoneStockData] = await Promise.all([
        outletsRes.ok ? outletsRes.json() : [],
        salesRes.ok ? salesRes.json() : [],
        damageRes.ok ? damageRes.json() : [],
        zoneStockRes.ok ? zoneStockRes.json() : [],
      ]);

      setOutlets(Array.isArray(outletsData) ? outletsData : []);
      setSalesRows(Array.isArray(salesData) ? salesData : []);
      setDamageRows(Array.isArray(damageData) ? damageData : []);
      setZoneStockRows(Array.isArray(zoneStockData) ? zoneStockData : []);
      setLastRefreshedAt(new Date());
    } catch {
      setOutlets([]);
      setSalesRows([]);
      setDamageRows([]);
      setZoneStockRows([]);
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const refresh = async (silent = false) => {
      if (!mounted) return;
      await loadAll(silent);
    };

    refresh(false);

    const intervalId = window.setInterval(() => refresh(true), 30000);
    const handleFocus = () => refresh(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh(true);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadAll]);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    try {
      await loadAll(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadAll]);

  const zoneOutlets = useMemo(() => {
    if (!selectedZone) return [];
    const zoneKey = normalizeZone(selectedZone);
    return outlets.filter((outlet) => {
      if (outlet?.status && outlet.status !== "Active") return false;
      return normalizeZone(outlet?.zoneId || outlet?.zone || outlet?.zoneNumber) === zoneKey;
    });
  }, [outlets, selectedZone]);

  const selectedDateSalesDoc = useMemo(() => getLatestDayDoc(salesRows, selectedDate), [salesRows, selectedDate]);

  const selectedDateSales = useMemo(() => {
    const doc = selectedDateSalesDoc;
    if (!doc) return 0;
    return zoneOutlets.reduce((sum, outlet) => sum + getValueForOutlet(doc.outlets, outlet), 0);
  }, [selectedDateSalesDoc, zoneOutlets]);

  const selectedDateDamages = useMemo(() => {
    const doc = getLatestDayDoc(damageRows, selectedDate);
    if (!doc) return 0;
    return zoneOutlets.reduce((sum, outlet) => sum + getValueForOutlet(doc.damages, outlet), 0);
  }, [damageRows, selectedDate, zoneOutlets]);

  const zoneHistory = useMemo(() => {
    if (!selectedZone) return [];
    const latestByDate = new Map();
    const sortedRows = zoneStockRows
      .filter((row) => row?.zone === selectedZone)
      .sort((a, b) => getDocTimestamp(b) - getDocTimestamp(a));

    for (const row of sortedRows) {
      const rowDate = normalizeDate(row.date || row.createdAt);
      if (!rowDate) continue;
      // Rows are already sorted newest-first, keep the first row per date.
      if (!latestByDate.has(rowDate)) latestByDate.set(rowDate, row);
    }

    return Array.from(latestByDate.values()).sort((a, b) =>
      compareIsoDates(normalizeDate(b.date || b.createdAt), normalizeDate(a.date || a.createdAt))
    );
  }, [zoneStockRows, selectedZone]);

  const existingForDate = useMemo(
    () => zoneHistory.find((row) => normalizeDate(row.date || row.createdAt) === selectedDate) || null,
    [zoneHistory, selectedDate]
  );

  const previousClosing = useMemo(() => {
    const previous = zoneHistory
      .filter((row) => compareIsoDates(normalizeDate(row.date || row.createdAt), selectedDate) < 0)
      .sort((a, b) => compareIsoDates(normalizeDate(b.date || b.createdAt), normalizeDate(a.date || a.createdAt)))[0];
    return previous ? toNumber(previous.closingStock) : 0;
  }, [zoneHistory, selectedDate]);

  const openingStock = previousClosing;

  const missingSalesOutlets = useMemo(() => {
    if (!zoneOutlets.length) return [];
    const salesValues = selectedDateSalesDoc?.outlets || {};
    return zoneOutlets.filter((outlet) => !hasValueForOutlet(salesValues, outlet));
  }, [zoneOutlets, selectedDateSalesDoc]);

  useEffect(() => {
    if (existingForDate) {
      setStockIn(String(toNumber(existingForDate.stockIn)));
      setRemarks(String(existingForDate.remarks || ""));
      return;
    }
    setStockIn("0");
    setRemarks("");
  }, [existingForDate?.id, selectedDate, selectedZone]);

  const stockInNumber = toNumber(stockIn);
  const closingStock = openingStock + stockInNumber - selectedDateSales - selectedDateDamages;

  const isTodaySelected = selectedDate === entryWindow.currentDate;
  const hasMissingSalesEntries = missingSalesOutlets.length > 0;
  const isSupervisorLockedForDate = Boolean(isSupervisor && existingForDate);
  const canEditInventory = isAdmin || isSupervisor;
  const canSave = Boolean(canEditInventory && selectedZone && selectedDate && isTodaySelected && !isSupervisorLockedForDate);

  const saveDisabledReason = useMemo(() => {
    if (!selectedZone || !selectedDate) return "Please select zone and date.";
    if (!isTodaySelected) return "Inventory entry can only be created for today's date.";
    if (isSupervisorLockedForDate) return "Entry locked. Supervisors can submit inventory only once per day.";
    return "";
  }, [selectedZone, selectedDate, isTodaySelected, isSupervisorLockedForDate]);

  const handleSave = async () => {
    if (!canSave) {
      alert(saveDisabledReason || "Entry is allowed only for today's date.");
      return;
    }

    const token = localStorage.getItem("token");
    const addedBy = {
      username: user?.username || user?.uid || "unknown",
      role: user?.role || "unknown",
      zone: selectedZone,
      timestamp: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/zone-stock/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          zone: selectedZone,
          date: selectedDate,
          openingStock,
          stockIn: stockInNumber,
          remarks: remarks.trim(),
          salesQty: selectedDateSales,
          damagesQty: selectedDateDamages,
          closingStock,
          addedBy,
        }),
      });

      if (!response.ok) {
        let message = "Failed to save entry";
        try {
          const errorJson = await response.json();
          if (errorJson?.message) message = errorJson.message;
        } catch {
          const errorText = await response.text();
          if (errorText) message = errorText;
        }
        throw new Error(message);
      }

      await loadAll();
      alert(existingForDate ? "Zone stock entry updated successfully." : "Zone stock entry saved successfully.");
    } catch (error) {
      alert(error?.message || "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = useCallback((row) => {
    if (!isAdmin || !row) return;
    setEditRow(row);
    setEditStockIn(String(toNumber(row.stockIn)));
    setEditRemarks(String(row.remarks || ""));
    setEditModalOpen(true);
  }, [isAdmin]);

  const handleEditCancel = useCallback(() => {
    setEditModalOpen(false);
    setEditRow(null);
    setEditStockIn("0");
    setEditRemarks("");
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!isAdmin || !editRow) return;

    const rowDate = normalizeDate(editRow.date || editRow.createdAt);
    const rowOpeningStock = toNumber(editRow.openingStock);
    const updatedStockIn = toNumber(editStockIn);
    const rowSales = rowDate === selectedDate ? selectedDateSales : toNumber(editRow.salesQty);
    const rowDamages = rowDate === selectedDate ? selectedDateDamages : toNumber(editRow.damagesQty);
    const updatedClosingStock = rowOpeningStock + updatedStockIn - rowSales - rowDamages;

    const token = localStorage.getItem("token");
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/zone-stock/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          zone: editRow.zone || selectedZone,
          date: rowDate,
          openingStock: rowOpeningStock,
          stockIn: updatedStockIn,
          remarks: editRemarks.trim(),
          salesQty: rowSales,
          damagesQty: rowDamages,
          closingStock: updatedClosingStock,
          addedBy: {
            username: user?.username || user?.uid || "unknown",
            role: user?.role || "unknown",
            zone: editRow.zone || selectedZone,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update stock in");
      }

      await loadAll();
      handleEditCancel();
      alert("Stock In updated successfully.");
    } catch (error) {
      alert(error?.message || "Failed to update stock in");
    } finally {
      setIsSaving(false);
    }
  }, [isAdmin, editRow, editStockIn, editRemarks, selectedDate, selectedDateSales, selectedDateDamages, selectedZone, user, loadAll, handleEditCancel]);

  const displayedHistory = useMemo(() => {
    if (!zoneHistory.length) return [];
    return zoneHistory.map((row) => {
      const rowDate = normalizeDate(row.date || row.createdAt);
      if (rowDate !== selectedDate) return row;
      return {
        ...row,
        openingStock,
        stockIn: stockInNumber,
        salesQty: selectedDateSales,
        damagesQty: selectedDateDamages,
        closingStock,
      };
    });
  }, [zoneHistory, selectedDate, openingStock, stockInNumber, selectedDateSales, selectedDateDamages, closingStock]);

  if (!isAdmin && !isSupervisor && !isViewer) {
    return (
      <div className="min-h-screen bg-eggBg flex items-center justify-center px-4">
        <div className="rounded-2xl border border-orange-200 bg-white px-6 py-5 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Zone Stock Entry</h2>
          <p className="mt-2 text-sm text-gray-500">Only Admin, Supervisor, and Viewer can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eggBg p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Zone Stock Entry</h1>
          <p className="mt-1 text-sm text-gray-500">
            Opening Stock = Previous Day Closing Stock, Closing Stock = Opening + Stock In - Sales - Damages.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-5">
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

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading}
              className="w-38 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {canEditInventory ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">New Entry</h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-7">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={entryWindow.currentDate}
                max={entryWindow.currentDate}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Opening Stock</label>
              <input
                type="number"
                value={openingStock}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Stock In</label>
              <input
                type="number"
                min="0"
                value={stockIn}
                onChange={(e) => setStockIn(e.target.value)}
                readOnly={!isTodaySelected}
                className={[
                  "w-full rounded-xl border px-3 py-2.5 text-sm",
                  isTodaySelected
                    ? "border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    : "border-gray-200 bg-gray-50 text-gray-500",
                ].join(" ")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Sales</label>
              <input
                type="number"
                value={selectedDateSales}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-blue-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Damages</label>
              <input
                type="number"
                value={selectedDateDamages}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-orange-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Closing Stock</label>
              <input
                type="number"
                value={closingStock}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-green-600"
              />
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-sm font-semibold text-gray-700">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes for this stock entry"
                maxLength={500}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave || isSaving || isLoading}
                className={[
                  "w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors",
                  !canSave || isSaving || isLoading
                    ? "cursor-not-allowed bg-gray-300"
                    : "bg-emerald-500 hover:bg-emerald-600",
                ].join(" ")}
              >
                {isSaving ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Sales and Damages are auto-calculated from zone-wise Daily Sales and Daily Damages data.
          </p>
          {hasMissingSalesEntries ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Missing sales entries for this zone: {missingSalesOutlets.map((outlet) => outlet.area || outlet.name || outlet.id).join(", ")}.
            </p>
          ) : null}
          <p className={`mt-2 text-xs font-medium ${saveDisabledReason ? "text-red-600" : "text-emerald-600"}`}>
            {saveDisabledReason || "Entries are allowed only for today's date."}
          </p>
        </div>
        ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Inventory Data</h2>
          <p className="mt-2 text-sm text-gray-500">Viewer access is read-only. You can review zone-wise stock history below.</p>
        </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Stock History</h2>
            <span className="text-xs font-semibold text-gray-500">{selectedZone || "No zone selected"}</span>
          </div>

          {lastRefreshedAt ? (
            <p className="mt-2 text-xs text-gray-500">
              Last refreshed at {lastRefreshedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Opening Stock</th>
                  <th className="px-3 py-3">Stock In</th>
                  <th className="px-3 py-3">Sales</th>
                  <th className="px-3 py-3">Damages</th>
                  <th className="px-3 py-3">Closing Stock</th>
                  <th className="px-3 py-3">Remarks</th>
                  {isAdmin ? <th className="px-3 py-3 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="px-3 py-6 text-center text-gray-500">Loading history...</td>
                  </tr>
                ) : displayedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="px-3 py-6 text-center text-gray-500">No entries available for this zone.</td>
                  </tr>
                ) : (
                  displayedHistory.map((row) => {
                    const rowDate = normalizeDate(row.date || row.createdAt);
                    const isToday = rowDate === getLocalIsoDate();
                    return (
                      <tr key={row.id || `${row.zone}-${rowDate}`} className="border-b border-gray-100 text-gray-800">
                        <td className="px-3 py-3 font-medium">
                          {formatDate(rowDate)}
                          {isToday ? (
                            <span className="ml-2 rounded-md bg-gray-700 px-2 py-0.5 text-[10px] font-semibold text-white">Today</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">{toNumber(row.openingStock).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 font-semibold text-green-600">+{toNumber(row.stockIn).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 font-semibold text-blue-700">{toNumber(row.salesQty).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 font-semibold text-red-600">{toNumber(row.damagesQty).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 text-lg font-bold text-gray-900">{toNumber(row.closingStock).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 max-w-xs text-gray-700">{String(row.remarks || "-")}</td>
                        {isAdmin ? (
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditClick(row)}
                              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                            >
                              Edit
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {isAdmin && editModalOpen && editRow ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Edit Stock In ({normalizeDate(editRow.date || editRow.createdAt)})</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-600">Opening Stock</span>
                  <span className="font-semibold text-gray-900">{toNumber(editRow.openingStock).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Stock In</label>
                  <input
                    type="number"
                    min="0"
                    value={editStockIn}
                    onChange={(e) => setEditStockIn(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-600">Sales</span>
                  <span className="font-semibold text-blue-700">{toNumber(normalizeDate(editRow.date || editRow.createdAt) === selectedDate ? selectedDateSales : editRow.salesQty).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-600">Damages</span>
                  <span className="font-semibold text-red-600">{toNumber(normalizeDate(editRow.date || editRow.createdAt) === selectedDate ? selectedDateDamages : editRow.damagesQty).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-600">Closing Stock</span>
                  <span className="font-bold text-green-600">
                    {(toNumber(editRow.openingStock) + toNumber(editStockIn) - toNumber(normalizeDate(editRow.date || editRow.createdAt) === selectedDate ? selectedDateSales : editRow.salesQty) - toNumber(normalizeDate(editRow.date || editRow.createdAt) === selectedDate ? selectedDateDamages : editRow.damagesQty)).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Remarks</label>
                  <input
                    type="text"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Optional notes"
                    maxLength={500}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleEditCancel}
                  disabled={isSaving}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={isSaving}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
