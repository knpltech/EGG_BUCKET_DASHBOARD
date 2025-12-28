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

export default function DailyTable({rows, outlets = []}) {
  // Build outlet names from objects or use defaults
  const outletNames = Array.isArray(outlets) && outlets.length > 0 
    ? outlets.map(o => (typeof o === 'string' ? o : o.area || o.name || o.id || JSON.stringify(o)))
    : ["AECS Layout", "Bandepalya", "Hosa Road", "Singasandra", "Kudlu Gate"];

  // Calculate totals dynamically based on outlets
  const totals = {};
  outletNames.forEach((outlet) => {
    totals[outlet] = rows.reduce((s, r) => s + (r.outlets && r.outlets[outlet] ? Number(r.outlets[outlet]) : 0), 0);
  });

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  // Check if outlet is active
  const isOutletActive = (outletName) => {
    if (!Array.isArray(outlets) || outlets.length === 0) return true;
    const outletObj = outlets.find(o => o.area === outletName);
    return !outletObj || outletObj.status === "Active";
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-eggWhite shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold text-gray-500">
              <th className="min-w-[130px] px-4 py-3">Date</th>
              {outletNames.map((outlet, i) => {
                const isActive = isOutletActive(outlet);
                return (
                  <th key={String(outlet) + '-' + i} className="px-4 py-3 whitespace-nowrap">
                    {String(outlet).toUpperCase()}
                    {!isActive && <span className="text-red-500 text-[10px] block">(Inactive)</span>}
                  </th>
                );
              })}
              <th className="px-4 py-3 whitespace-nowrap text-right">
                Total
              </th>
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
                {outletNames.map((outlet, j) => (
                  <td key={String(outlet) + '-' + j} className="whitespace-nowrap px-4 py-3">
                    ₹{
                        row.outlets
                          ? row.outlets[outlet] ?? 0
                          : row[outlet] ?? 0
                      }
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-orange-600">
                  ₹{row.total}
                </td>
              </tr>
            ))}

            {/* ⭐ COLUMN TOTAL ROW (GRAND TOTAL) */}
            <tr className="bg-orange-50 font-semibold text-orange-700">
              <td className="whitespace-nowrap px-4 py-3">Grand Total</td>
              {outletNames.map((outlet, i) => (
                <td key={String(outlet) + '-total-' + i} className="whitespace-nowrap px-4 py-3">
                  ₹{totals[outlet]}
                </td>
              ))}
              <td className="whitespace-nowrap px-4 py-3 text-right text-orange-800">
                ₹{grandTotal}
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