import React from "react";

function formatDisplayDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default function DailyTable({ rows, outlets = [], onEdit, showRupee = false, allOutlets = [] }) {
  // Use outletId for mapping and display
  const outletIds = Array.isArray(outlets) && outlets.length > 0
    ? outlets.map(o => typeof o === 'string' ? o : o.id)
    : [];

  // Map outletId → display name
  const getOutletName = (id) => {
    const found = (allOutlets || []).find(o => (typeof o === 'string' ? o : o.id) === id);
    return found ? (found.area || found.name || id) : id;
  };

  // Get outlet value: try outletId key first, then area key
  // This handles both storage formats (keyed by id OR by area)
  const getOutletValue = (row, outletId) => {
    const outletsObj = row.outlets || {};
    // Direct match by id
    if (outletsObj[outletId] !== undefined) return Number(outletsObj[outletId]) || 0;
    // Fallback: match by area name (area === outletId in some data sets)
    const outletMeta = (allOutlets || []).find(o => (typeof o === 'string' ? o : o.id) === outletId);
    if (outletMeta) {
      const area = outletMeta.area || outletMeta.name;
      if (area && outletsObj[area] !== undefined) return Number(outletsObj[area]) || 0;
    }
    return 0;
  };

  // Row total: always recompute from outlets so edits reflect immediately
  const getRowTotal = (row) => {
    return outletIds.reduce((s, id) => s + getOutletValue(row, id), 0);
  };

  // Column totals
  const totals = {};
  outletIds.forEach((outletId) => {
    totals[outletId] = rows.reduce((s, r) => s + getOutletValue(r, outletId), 0);
  });
  const grandTotal = outletIds.reduce((s, id) => s + (totals[id] || 0), 0);

  // Smart formatter: no unnecessary decimals, preserves whole numbers
  const fmt = (value) => {
    if (value == null || value === "" || isNaN(Number(value))) {
      return showRupee ? "₹0" : "0";
    }
    const num = Number(value);
    // Only show decimals if the value actually has a meaningful fraction
    const formatted = num % 1 === 0
      ? num.toLocaleString("en-IN")
      : num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return showRupee ? `₹${formatted}` : formatted;
  };

  // Determine if current user is admin (used for Edit column)
  const isAdmin = (() => {
    try {
      if (typeof window === 'undefined') return false;
      const raw = localStorage.getItem('user');
      if (!raw) return false;
      const user = JSON.parse(raw);
      return user && (user.role === "Admin" || (Array.isArray(user.roles) && user.roles.includes("admin")));
    } catch { return false; }
  })();

  const showEditCol = isAdmin && typeof onEdit === 'function';

  return (
    <div className="overflow-hidden rounded-2xl bg-eggWhite shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold text-gray-500">
              <th className="min-w-[130px] px-4 py-3">Date</th>
              {outletIds.map((outletId, i) => (
                <th key={String(outletId) + '-' + i} className="px-4 py-3 whitespace-nowrap">
                  {getOutletName(outletId).toUpperCase()}
                </th>
              ))}
              <th className="px-4 py-3 whitespace-nowrap text-right">Total</th>
              {showEditCol && <th className="px-4 py-3">Edit</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const rowTotal = getRowTotal(row);
              return (
                <tr
                  key={row.date ? String(row.date) + '-' + idx : idx}
                  className={`text-xs text-gray-700 md:text-sm ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}
                >
                  <td className="whitespace-nowrap px-4 py-3">{formatDisplayDate(row.date)}</td>
                  {outletIds.map((outletId, j) => (
                    <td key={String(outletId) + '-' + j} className="whitespace-nowrap px-4 py-3">
                      {fmt(getOutletValue(row, outletId))}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-orange-600">
                    {fmt(rowTotal)}
                  </td>
                  {showEditCol && (
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        className="text-blue-600 hover:underline text-xs font-medium"
                        onClick={() => onEdit(row)}
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {/* Grand Total row */}
            <tr className="bg-orange-50 font-semibold text-orange-700">
              <td className="whitespace-nowrap px-4 py-3">Grand Total</td>
              {outletIds.map((outletId, i) => (
                <td key={String(outletId) + '-total-' + i} className="whitespace-nowrap px-4 py-3">
                  {fmt(totals[outletId])}
                </td>
              ))}
              <td className="whitespace-nowrap px-4 py-3 text-right text-orange-800">
                {fmt(grandTotal)}
              </td>
              {showEditCol && <td className="px-4 py-3" />}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs md:flex-row md:items-center md:justify-between">
        <p className="text-gray-500">Showing {rows.length} records</p>
      </div>
    </div>
  );
}