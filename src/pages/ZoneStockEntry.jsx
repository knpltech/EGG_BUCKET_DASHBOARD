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
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("-");
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

const getLatestDayDoc = (rows, selectedDate) => {
  if (!Array.isArray(rows)) return null;
  const dayRows = rows
    .filter((doc) => normalizeDate(doc?.date || doc?.createdAt) === selectedDate)
    .sort((a, b) => getDocTimestamp(b) - getDocTimestamp(a));
  return dayRows[0] || null;
};

export default function ZoneStockEntry() {
  const { isAdmin, isSupervisor, zone } = getRoleFlags();
  const [selectedDate, setSelectedDate] = useState(getLocalIsoDate());
  const [selectedZone, setSelectedZone] = useState("");
  const [stockIn, setStockIn] = useState("0");

  const [outlets, setOutlets] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [damageRows, setDamageRows] = useState([]);
  const [zoneStockRows, setZoneStockRows] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const availableZones = useMemo(() => {
    if (isAdmin) return ALL_ZONES;
    if (isSupervisor) return extractUserZones(user, zone);
    return [];
  }, [isAdmin, isSupervisor, user, zone]);

  useEffect(() => {
    if (!selectedZone && availableZones.length > 0) {
      setSelectedZone(availableZones[0]);
    }
  }, [availableZones, selectedZone]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
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
    } catch {
      setOutlets([]);
      setSalesRows([]);
      setDamageRows([]);
      setZoneStockRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const zoneOutlets = useMemo(() => {
    if (!selectedZone) return [];
    const zoneKey = normalizeZone(selectedZone);
    return outlets.filter((outlet) => {
      if (outlet?.status && outlet.status !== "Active") return false;
      return normalizeZone(outlet?.zoneId || outlet?.zone || outlet?.zoneNumber) === zoneKey;
    });
  }, [outlets, selectedZone]);

  const selectedDateSales = useMemo(() => {
    const doc = getLatestDayDoc(salesRows, selectedDate);
    if (!doc) return 0;
    return zoneOutlets.reduce((sum, outlet) => sum + getValueForOutlet(doc.outlets, outlet), 0);
  }, [salesRows, selectedDate, zoneOutlets]);

  const selectedDateDamages = useMemo(() => {
    const doc = getLatestDayDoc(damageRows, selectedDate);
    if (!doc) return 0;
    return zoneOutlets.reduce((sum, outlet) => sum + getValueForOutlet(doc.damages, outlet), 0);
  }, [damageRows, selectedDate, zoneOutlets]);

  const zoneHistory = useMemo(() => {
    if (!selectedZone) return [];
    return zoneStockRows
      .filter((row) => row?.zone === selectedZone)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [zoneStockRows, selectedZone]);

  const existingForDate = useMemo(
    () => zoneHistory.find((row) => normalizeDate(row.date) === selectedDate) || null,
    [zoneHistory, selectedDate]
  );

  const previousClosing = useMemo(() => {
    const previous = zoneHistory
      .filter((row) => normalizeDate(row.date) < selectedDate)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
    return previous ? toNumber(previous.closingStock) : 0;
  }, [zoneHistory, selectedDate]);

  const openingStock = existingForDate ? toNumber(existingForDate.openingStock) : previousClosing;

  useEffect(() => {
    if (existingForDate) {
      setStockIn(String(toNumber(existingForDate.stockIn)));
      return;
    }
    setStockIn("0");
  }, [existingForDate?.id, selectedDate, selectedZone]);

  const stockInNumber = toNumber(stockIn);
  const closingStock = openingStock + stockInNumber - selectedDateSales - selectedDateDamages;

  const canSave = Boolean(selectedZone && selectedDate);

  const handleSave = async () => {
    if (!canSave) {
      alert("Please select zone and date");
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
          salesQty: selectedDateSales,
          damagesQty: selectedDateDamages,
          closingStock,
          addedBy,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save entry");
      }

      await loadAll();
      alert("Zone stock entry saved successfully");
    } catch (error) {
      alert(error?.message || "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin || !existingForDate) return;

    if (!window.confirm(`Delete entry for ${selectedZone} on ${selectedDate}?`)) return;

    const token = localStorage.getItem("token");
    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_URL}/zone-stock/zone/${encodeURIComponent(selectedZone)}/date/${encodeURIComponent(selectedDate)}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete entry");
      }

      await loadAll();
      alert("Entry deleted");
    } catch (error) {
      alert(error?.message || "Failed to delete entry");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAdmin && !isSupervisor) {
    return (
      <div className="min-h-screen bg-eggBg flex items-center justify-center px-4">
        <div className="rounded-2xl border border-orange-200 bg-white px-6 py-5 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Zone Stock Entry</h2>
          <p className="mt-2 text-sm text-gray-500">Only Admin and Supervisor can access this page.</p>
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
          <h2 className="text-xl font-semibold text-gray-900">New Entry</h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-7">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
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
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
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
                {isSaving ? "Saving..." : existingForDate ? "Update Entry" : "Save Entry"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Sales and Damages are auto-calculated from zone-wise Daily Sales and Daily Damages data.
          </p>

          {isAdmin && existingForDate ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className={[
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                  isDeleting
                    ? "cursor-not-allowed border-gray-200 text-gray-400"
                    : "border-red-200 text-red-600 hover:bg-red-50",
                ].join(" ")}
              >
                {isDeleting ? "Deleting..." : "Delete This Date Entry"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Stock History</h2>
            <span className="text-xs font-semibold text-gray-500">{selectedZone || "No zone selected"}</span>
          </div>

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
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500">Loading history...</td>
                  </tr>
                ) : zoneHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500">No entries available for this zone.</td>
                  </tr>
                ) : (
                  zoneHistory.map((row) => {
                    const isToday = normalizeDate(row.date) === getLocalIsoDate();
                    return (
                      <tr key={row.id || `${row.zone}-${row.date}`} className="border-b border-gray-100 text-gray-800">
                        <td className="px-3 py-3 font-medium">
                          {formatDate(row.date)}
                          {isToday ? (
                            <span className="ml-2 rounded-md bg-gray-700 px-2 py-0.5 text-[10px] font-semibold text-white">Today</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">{toNumber(row.openingStock).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 font-semibold text-green-600">+{toNumber(row.stockIn).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 font-semibold text-blue-700">{toNumber(row.salesQty).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 font-semibold text-red-600">{toNumber(row.damagesQty).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 text-lg font-bold text-gray-900">{toNumber(row.closingStock).toLocaleString("en-IN")}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
