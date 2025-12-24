export default function DailyTable({ rows, outlets }) {
  const totals = outlets.reduce((acc, name) => {
    acc[name] = rows.reduce((s, r) => s + (r.outlets?.[name] || 0), 0);
    return acc;
  }, {});

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  return (
    <div className="bg-white ml-4 rounded-xl shadow p-6">
      <table className="w-full h-15 text-left ">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="py-2 px-4">Date</th>
            {outlets.map((o) => (
              <th key={o} className="py-2 px-4">{o}</th>
            ))}
            <th className="py-2 px-4">Total</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b h-15">
              <td className="py-2 px-4">{row.date}</td>
              {outlets.map((o) => (
                <td key={o} className="py-2 px-4">{row.outlets?.[o] ?? 0}</td>
              ))}
              <td className="py-2 px-4 font-semibold text-orange-600">{row.total}</td>
            </tr>
          ))}

          {/* ⭐ COLUMN TOTAL ROW (GRAND TOTAL) */}
          <tr className="bg-orange-50 font-semibold text-orange-700">
            <td className="py-3 px-4">Grand Total</td>
            {outlets.map((o) => (
              <td key={o} className="py-3 px-4">{totals[o]}</td>
            ))}
            <td className="py-3 px-4 text-orange-800">{grandTotal}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-4 text-sm text-gray-500">
        Showing {rows.length}
      </p>
    </div>
  );
}
