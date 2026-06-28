import { useCallback, useEffect, useMemo, useState } from "react";
import { getRoleFlags } from "../utils/role";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const ALL_ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];
const PAYMENT_STATUSES = ["Paid", "Unpaid"];

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

const toNumber = (value) => {
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getDocTimestamp = (doc) => {
  const value = doc?.updatedAt || doc?.createdAt || doc?.date;
  if (value && typeof value === "object" && typeof value.toDate === "function") return value.toDate().getTime();
  if (value && typeof value === "object" && value._seconds !== undefined) return value._seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortRowsByDateDesc = (a, b) => {
  const aDate = normalizeDate(a?.date || a?.createdAt);
  const bDate = normalizeDate(b?.date || b?.createdAt);
  const dateDiff = String(bDate || "").localeCompare(String(aDate || ""));
  if (dateDiff !== 0) return dateDiff;
  return getDocTimestamp(b) - getDocTimestamp(a);
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

const normalizePaymentStatus = (value) => {
  const status = String(value || "").trim().toLowerCase();
  return status === "paid" ? "Paid" : "Unpaid";
};

const getPaymentStatusClasses = (status) => {
  return normalizePaymentStatus(status) === "Paid"
    ? "bg-green-600 text-white"
    : "bg-red-600 text-white";
};

export default function StockOptionsPage() {
  const { isAdmin } = getRoleFlags();
  const [selectedDate, setSelectedDate] = useState(getLocalIsoDate());
  const [selectedZone, setSelectedZone] = useState("Zone 1");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [price, setPrice] = useState("0");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");
  const [farmName, setFarmName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editStockQuantity, setEditStockQuantity] = useState("0");
  const [editPrice, setEditPrice] = useState("0");
  const [editPaymentStatus, setEditPaymentStatus] = useState("Unpaid");
  const [editFarmName, setEditFarmName] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [collectionRows, setCollectionRows] = useState([]);
  const [collectionDamageTotal, setCollectionDamageTotal] = useState(0);
  const [collectionReturnTotal, setCollectionReturnTotal] = useState(0);
  const [collectionError, setCollectionError] = useState("");
  const [isCollectionLoading, setIsCollectionLoading] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!selectedZone && ALL_ZONES.length) {
      setSelectedZone(ALL_ZONES[0]);
    }
  }, [selectedZone]);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = selectedZone
        ? `${API_URL}/stock-options/zone/${encodeURIComponent(selectedZone)}`
        : `${API_URL}/stock-options/all`;
      const response = await fetch(endpoint);
      const data = response.ok ? await response.json() : [];
      setRows(Array.isArray(data) ? data : []);
      setLastRefreshedAt(new Date());
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedZone]);

  const loadCollectionRows = useCallback(async () => {
    setIsCollectionLoading(true);
    setCollectionError("");
    try {
      const response = await fetch(`${API_URL}/admin/retail-collection-summary?date=${encodeURIComponent(selectedDate)}`);

      if (!response.ok) {
        const message = await getResponseErrorMessage(response, "Failed to fetch Retail Admin collections");
        throw new Error(message);
      }

      const data = await response.json();
      const rows = Array.isArray(data) ? data : data?.rows;
      setCollectionRows(Array.isArray(rows) ? rows : []);
      setCollectionDamageTotal(toNumber(data?.totalDamage));
      setCollectionReturnTotal(toNumber(data?.totalReturn));
    } catch (error) {
      setCollectionRows([]);
      setCollectionDamageTotal(0);
      setCollectionReturnTotal(0);
      setCollectionError(error?.message || "Failed to fetch Retail Admin collections.");
    } finally {
      setIsCollectionLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    loadCollectionRows();
  }, [loadCollectionRows]);

  const filteredRows = useMemo(() => {
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => row?.zone === selectedZone)
      .sort(sortRowsByDateDesc);
  }, [rows, selectedZone]);

  const selectedDateRows = useMemo(() => {
    return filteredRows.filter((row) => normalizeDate(row.date || row.createdAt) === selectedDate);
  }, [filteredRows, selectedDate]);

  const totalSelectedQuantity = useMemo(() => {
    return selectedDateRows.reduce((sum, row) => sum + toNumber(row.stockQuantity), 0);
  }, [selectedDateRows]);

  const invoiceAmount = useMemo(() => {
    return toNumber(stockQuantity) * toNumber(price);
  }, [stockQuantity, price]);

  const editInvoiceAmount = useMemo(() => {
    return toNumber(editStockQuantity) * toNumber(editPrice);
  }, [editStockQuantity, editPrice]);

  const collectionTotals = useMemo(() => {
    return collectionRows.reduce((totals, row) => ({
      quantity: totals.quantity + toNumber(row.quantity),
      cash: totals.cash + toNumber(row.cash),
      upi: totals.upi + toNumber(row.upi),
      amount: totals.amount + toNumber(row.amount),
    }), { quantity: 0, cash: 0, upi: 0, amount: 0 });
  }, [collectionRows]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!isAdmin) {
      alert("Admin access only.");
      return;
    }
    if (!selectedZone || !selectedDate) {
      alert("Please select a zone and date.");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/stock-options/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          zone: selectedZone,
          date: selectedDate,
          stockQuantity: toNumber(stockQuantity),
          price: toNumber(price),
          invoiceAmount,
          paymentStatus,
          farmName: String(farmName || "").trim(),
          remarks: String(remarks || "").trim(),
          addedBy: {
            username: user?.username || user?.uid || "unknown",
            role: user?.role || "unknown",
            zone: selectedZone,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const message = await getResponseErrorMessage(response, "Failed to save stock entry");
        throw new Error(message);
      }

      const savedRow = await response.json();
      setRows((currentRows) => [savedRow, ...currentRows].sort(sortRowsByDateDesc));
      setStockQuantity("0");
      setPrice("0");
      setPaymentStatus("Unpaid");
      setFarmName("");
      setRemarks("");
      setLastRefreshedAt(new Date());
      alert("Stock entry saved successfully.");
    } catch (error) {
      alert(error?.message || "Failed to save stock entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = useCallback((row) => {
    if (!isAdmin || !row) return;
    setEditRow(row);
    setEditStockQuantity(String(toNumber(row.stockQuantity)));
    setEditPrice(String(toNumber(row.price)));
    setEditPaymentStatus(normalizePaymentStatus(row.paymentStatus));
    setEditFarmName(String(row.farmName || ""));
    setEditRemarks(String(row.remarks || ""));
    setEditModalOpen(true);
  }, [isAdmin]);

  const handleEditCancel = useCallback(() => {
    setEditModalOpen(false);
    setEditRow(null);
    setEditStockQuantity("0");
    setEditPrice("0");
    setEditPaymentStatus("Unpaid");
    setEditFarmName("");
    setEditRemarks("");
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!isAdmin || !editRow) return;

    const rowZone = editRow.zone || selectedZone;
    const rowDate = editRow.date || selectedDate;
    if (!rowZone || !rowDate) {
      alert("Missing row date or zone.");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      const endpoint = editRow.id
        ? `${API_URL}/stock-options/${encodeURIComponent(editRow.id)}`
        : `${API_URL}/stock-options/zone/${encodeURIComponent(rowZone)}/date/${encodeURIComponent(rowDate)}`;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          stockQuantity: toNumber(editStockQuantity),
          price: toNumber(editPrice),
          invoiceAmount: editInvoiceAmount,
          paymentStatus: editPaymentStatus,
          farmName: String(editFarmName || "").trim(),
          remarks: String(editRemarks || "").trim(),
          addedBy: {
            username: user?.username || user?.uid || "unknown",
            role: user?.role || "unknown",
            zone: rowZone,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const message = await getResponseErrorMessage(response, "Failed to update stock entry");
        throw new Error(message);
      }

      const updatedRow = await response.json();
      setRows((currentRows) => currentRows
        .map((row) => row.id === updatedRow.id ? updatedRow : row)
        .sort(sortRowsByDateDesc));
      setLastRefreshedAt(new Date());
      handleEditCancel();
      alert("Stock entry updated successfully.");
    } catch (error) {
      alert(error?.message || "Failed to update stock entry");
    } finally {
      setIsSaving(false);
    }
  }, [isAdmin, editRow, editStockQuantity, editPrice, editInvoiceAmount, editPaymentStatus, editFarmName, editRemarks, selectedDate, selectedZone, user, handleEditCancel]);

  const handlePaymentStatusToggle = useCallback(async (row) => {
    if (!isAdmin || !row) return;

    const rowZone = row.zone || selectedZone;
    const rowDate = normalizeDate(row.date || row.createdAt) || selectedDate;
    if (!rowZone || !rowDate) {
      alert("Missing row date or zone.");
      return;
    }

    const currentStatus = normalizePaymentStatus(row.paymentStatus);
    const nextStatus = currentStatus === "Paid" ? "Unpaid" : "Paid";
    const rowKey = row.id || `${rowZone}-${rowDate}`;

    setTogglingStatusId(rowKey);
    setRows((currentRows) => currentRows.map((item) => (
      item === row || (row.id && item.id === row.id)
        ? { ...item, paymentStatus: nextStatus }
        : item
    )));

    try {
      const token = localStorage.getItem("token");
      const endpoint = row.id
        ? `${API_URL}/stock-options/${encodeURIComponent(row.id)}`
        : `${API_URL}/stock-options/zone/${encodeURIComponent(rowZone)}/date/${encodeURIComponent(rowDate)}`;
      const stockQuantityValue = toNumber(row.stockQuantity);
      const priceValue = toNumber(row.price);
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          zone: rowZone,
          date: rowDate,
          stockQuantity: stockQuantityValue,
          price: priceValue,
          invoiceAmount: stockQuantityValue * priceValue,
          paymentStatus: nextStatus,
          farmName: String(row.farmName || "").trim(),
          remarks: String(row.remarks || "").trim(),
          addedBy: {
            username: user?.username || user?.uid || "unknown",
            role: user?.role || "unknown",
            zone: rowZone,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const message = await getResponseErrorMessage(response, "Failed to update payment status");
        throw new Error(message);
      }

      const updatedRow = await response.json();
      setRows((currentRows) => currentRows
        .map((item) => item.id === updatedRow.id ? updatedRow : item)
        .sort(sortRowsByDateDesc));
      setLastRefreshedAt(new Date());
    } catch (error) {
      setRows((currentRows) => currentRows.map((item) => (
        item === row || (row.id && item.id === row.id)
          ? { ...item, paymentStatus: currentStatus }
          : item
      )));
      alert(error?.message || "Failed to update payment status");
    } finally {
      setTogglingStatusId(null);
    }
  }, [isAdmin, selectedDate, selectedZone, user]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-eggBg flex items-center justify-center px-4">
        <div className="rounded-2xl border border-orange-200 bg-white px-6 py-5 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Stock Options</h2>
          <p className="mt-2 text-sm text-gray-500">Admin access only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eggBg p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Add Stock Options</h1>
          <p className="mt-1 text-sm text-gray-500">
            Zone stock entry for Zones 1 to 5 with stock quantity, price, farm name, and remarks.
          </p>
          <p className="mt-1 text-sm text-orange-700">
            Every save updates the day&apos;s running total and pushes it to Inventory Stock In automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected Zone</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{selectedZone}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Day Total Stock Quantity</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{totalSelectedQuantity.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Inventory Stock In</p>
            <p className="mt-1 text-lg font-semibold text-orange-900">
              {totalSelectedQuantity.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-orange-700">Auto-synced from the day&apos;s stock entries</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm w-full">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Retail Admin Collection Summary</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Delivered customer collections from Retail Admin for {selectedDate}.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => loadCollectionRows()}
                  disabled={isCollectionLoading}
                  className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCollectionLoading ? "Fetching..." : "Fetch Collections"}
                </button>
              </div>
            </div>

            {collectionError ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {collectionError}
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-7">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivered Rows</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{collectionRows.length.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quantity</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{collectionTotals.quantity.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cash</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">Rs. {collectionTotals.cash.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">UPI</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">Rs. {collectionTotals.upi.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Total Damage</p>
                <p className="mt-1 text-lg font-semibold text-red-700">{collectionDamageTotal.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Total Return</p>
                <p className="mt-1 text-lg font-semibold text-blue-700">{collectionReturnTotal.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">UPI + Cash</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">Rs. {collectionTotals.amount.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex flex-wrap gap-2">
                {ALL_ZONES.map((zoneName) => (
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
                onClick={loadRows}
                disabled={isLoading}
                className="w-38 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm w-full">
            <h2 className="text-xl font-semibold text-gray-900">New Stock Entry</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6 md:items-end">
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
                <label className="mb-1 block text-sm font-semibold text-gray-700">Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Invoice Amount</label>
                <input
                  type="text"
                  value={`₹${invoiceAmount.toLocaleString("en-IN")}`}
                  readOnly
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Farm Name</label>
                <input
                  type="text"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="Enter farm name"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {PAYMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-6">
                <label className="mb-1 block text-sm font-semibold text-gray-700">Remarks</label>
                <textarea
                  rows="2"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="md:col-span-6 flex flex-col">
                <label className="mb-1 block text-sm font-semibold text-gray-700"></label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? "Updating..." : "Update Stock"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStockQuantity("0"); setPrice("0"); setPaymentStatus("Unpaid"); setFarmName(""); setRemarks(""); }}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </form>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Entered Stock Data</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedZone} · {selectedDate} · Total quantity: {totalSelectedQuantity.toLocaleString("en-IN")}
                </p>
              </div>
              {lastRefreshedAt ? (
                <p className="text-xs text-gray-400">
                  Last refreshed {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              ) : null}
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-orange-50 text-left text-xs font-semibold uppercase tracking-wide text-orange-800">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Stock Quantity</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Invoice Amount</th>
                    <th className="px-4 py-3">Farm Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Remarks</th>
                    {isAdmin ? <th className="px-4 py-3 text-right">Action</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredRows.length ? (
                    filteredRows.map((row) => (
                      <tr key={row.id || `${row.zone}-${row.date}-${row.createdAt}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{row.date || normalizeDate(row.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.zone}</td>
                        <td className="px-4 py-3 text-gray-700">{toNumber(row.stockQuantity).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-gray-700">₹{toNumber(row.price).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-gray-700">₹{toNumber(row.invoiceAmount ?? toNumber(row.stockQuantity) * toNumber(row.price)).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-gray-700">{row.farmName || "-"}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onDoubleClick={() => handlePaymentStatusToggle(row)}
                            disabled={togglingStatusId === (row.id || `${row.zone}-${normalizeDate(row.date || row.createdAt)}`)}
                            title="Double-click to toggle status"
                            className={`inline-flex min-w-[70px] items-center justify-center rounded-full px-3 py-1 text-xs font-bold transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70 ${getPaymentStatusClasses(row.paymentStatus)}`}
                          >
                            {normalizePaymentStatus(row.paymentStatus)}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.remarks || "-"}</td>
                        {isAdmin ? (
                          <td className="px-4 py-3 text-right">
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
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={isAdmin ? 8 : 7}>
                        No stock entries found for {selectedZone}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {isAdmin && editModalOpen && editRow ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Edit Stock Entry ({editRow.zone} · {editRow.date || normalizeDate(editRow.createdAt)})
              </h2>

              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Zone</p>
                    <p className="mt-1 font-semibold text-gray-900">{editRow.zone}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date</p>
                    <p className="mt-1 font-semibold text-gray-900">{editRow.date || normalizeDate(editRow.createdAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Stock Quantity</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editStockQuantity}
                      onChange={(e) => setEditStockQuantity(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invoice Amount</p>
                  <p className="mt-1 text-base font-bold text-gray-900">₹{editInvoiceAmount.toLocaleString("en-IN")}</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Status</label>
                  <select
                    value={editPaymentStatus}
                    onChange={(e) => setEditPaymentStatus(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {PAYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Farm Name</label>
                  <input
                    type="text"
                    value={editFarmName}
                    onChange={(e) => setEditFarmName(e.target.value)}
                    placeholder="Enter farm name"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Remarks</label>
                  <textarea
                    rows="2"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Enter remarks"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleEditCancel}
                  disabled={isSaving}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={isSaving}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
