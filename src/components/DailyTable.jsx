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

export default function DailyTable({rows, outlets = [], onEdit, showRupee = false, allOutlets = []}) {


  // Use outletId for mapping and display
  const outletIds = Array.isArray(outlets) && outlets.length > 0
    ? outlets.map(o => typeof o === 'string' ? o : o.id)
    : [];
  // Map outletId to display name
  const getOutletName = (id) => {
    const found = (allOutlets || []).find(o => (typeof o === 'string' ? o : o.id) === id);
    return found ? (found.area || found.name || id) : id;
  };

  // Helper: get value from row.outlets by case-insensitive key
  function getOutletValue(outletsObj, outletName) {
    if (!outletsObj) return 0;
    // Try direct match first
    if (outletsObj[outletName] !== undefined) return outletsObj[outletName];
    // Try case-insensitive match
    const key = Object.keys(outletsObj).find(k => k.trim().toLowerCase() === outletName.trim().toLowerCase());
    return key ? outletsObj[key] : 0;
  }

  // Calculate totals dynamically based on outlets
  const totals = {};
  outletIds.forEach((outletId) => {
    totals[outletId] = rows.reduce((s, r) => s + (r.outlets ? Number(r.outlets[outletId] || 0) : 0), 0);
  });

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  // Check if outlet is active: default to active if status is missing
  const isOutletActive = (outletName) => {
    if (!Array.isArray(allOutlets) || allOutlets.length === 0) return true;
    const outletObj = allOutlets.find(o => (typeof o === 'string' ? o : o.id) === outletName);
    if (!outletObj || typeof outletObj.status === 'undefined') return true;
    return outletObj.status === "Active";
  };

  // Currency formatter for ₹
  const formatCurrencyNoDecimals = (value) => {
    if (showRupee) {
      if (value == null || isNaN(value)) return "₹0";
      return "₹" + Number(value).toLocaleString("en-IN", {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      });
    } else {
      if (value == null || isNaN(value)) return "0";
      return Number(value).toLocaleString("en-IN", {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-eggWhite shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold text-gray-500">
              <th className="min-w-[130px] px-4 py-3">Date</th>
              {outletIds.map((outletId, i) => {
                return (
                  <th key={String(outletId) + '-' + i} className="px-4 py-3 whitespace-nowrap">
                    {getOutletName(outletId).toUpperCase()}
                  </th>
                );
              })}
              <th className="px-4 py-3 whitespace-nowrap text-right">
                Total
              </th>
              {/* Edit column for admin */}
              {typeof window !== 'undefined' && localStorage.getItem('user') && (() => {
                const user = JSON.parse(localStorage.getItem('user'));
                const isAdmin = user && (user.role === "Admin" || (Array.isArray(user.roles) && user.roles.includes("admin")));
                if (isAdmin && typeof onEdit === 'function') return <th className="px-4 py-3">Edit</th>;
                return null;
              })()}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.date ? String(row.date) + '-' + idx : idx}
                className={`text-xs text-gray-700 md:text-sm ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  {formatDisplayDate(row.date)}
                </td>
                {outletIds.map((outletId, j) => (
                  <td key={String(outletId) + '-' + j} className="whitespace-nowrap px-4 py-3">
                    {formatCurrencyNoDecimals(
                      row.outlets
                        ? row.outlets[outletId] || 0
                        : row[outletId] ?? 0
                    )}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-orange-600">
                  {formatCurrencyNoDecimals(row.total)}
                </td>
                {/* Edit button for admin */}
                {typeof window !== 'undefined' && localStorage.getItem('user') && (() => {
                  const user = JSON.parse(localStorage.getItem('user'));
                  const isAdmin = user && (user.role === "Admin" || (Array.isArray(user.roles) && user.roles.includes("admin")));
                  if (isAdmin && typeof onEdit === 'function') {
                    return (
                      <td className="whitespace-nowrap px-4 py-3">
                        <button className="text-blue-600 hover:underline text-xs font-medium" onClick={() => onEdit(row)}>Edit</button>
                      </td>
                    );
                  }
                  return null;
                })()}
              </tr>
            ))}

            {/* ⭐ COLUMN TOTAL ROW (GRAND TOTAL) */}
            <tr className="bg-orange-50 font-semibold text-orange-700">
              <td className="whitespace-nowrap px-4 py-3">Grand Total</td>
              {outletIds.map((outletId, i) => (
                <td key={String(outletId) + '-total-' + i} className="whitespace-nowrap px-4 py-3">
                  {formatCurrencyNoDecimals(totals[outletId])}
                </td>
              ))}
              <td className="whitespace-nowrap px-4 py-3 text-right text-orange-800">
                {formatCurrencyNoDecimals(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer below table */}
      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs md:flex-row md:items-center md:justify-between">
        <p className="text-gray-500">Showing {rows.length} records</p>
      </div>
    </div>
  );
}