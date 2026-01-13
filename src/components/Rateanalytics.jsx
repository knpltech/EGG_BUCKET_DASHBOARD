import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { useEffect, useState } from "react";

/* ---------------- HELPERS ---------------- */

// Convert "₹6.50 per egg" → 6.5
function parseRate(rateString) {
  if (!rateString) return 0;
  return Number(rateString.replace(/[^\d.]/g, ""));
}

// Supports both dd-mm-yyyy and yyyy-mm-dd
function parseAnyDate(dateStr) {
  if (!dateStr) return null;

  // yyyy-mm-dd (ISO / Firebase)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }

  // dd-mm-yyyy (UI)
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split("-");
    return new Date(`${yyyy}-${mm}-${dd}`);
  }

  return null;
}

/* ---------------- COMPONENT ---------------- */

export default function Rateanalytics({ rows = [] }) {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    console.log("ROWS RECEIVED IN RATE ANALYTICS:", rows);

    if (!Array.isArray(rows) || rows.length === 0) {
      setChartData([]);
      return;
    }

    // ✅ TODAY at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ 15-day sliding window (today + previous 14 days)
    const START_DATE = new Date(today);
    START_DATE.setDate(today.getDate() - 14);

    const parsed = rows
      .map((r) => {
        const parsedDate = parseAnyDate(r.date);
        if (!parsedDate || isNaN(parsedDate)) return null;

        parsedDate.setHours(0, 0, 0, 0);

        return {
          date: r.date,                // label
          timestamp: parsedDate.getTime(),
          rate: parseRate(r.rate)
        };
      })
      .filter(Boolean)
      // ✅ FILTER BY LAST 15 DAYS
      .filter(
        (r) =>
          r.timestamp >= START_DATE.getTime() &&
          r.timestamp <= today.getTime()
      )
      .sort((a, b) => a.timestamp - b.timestamp); // oldest → newest

    setChartData(parsed);
  }, [rows]);

  const averageRate =
    chartData.length === 0
      ? "0.00"
      : (
          chartData.reduce((sum, r) => sum + r.rate, 0) / chartData.length
        ).toFixed(2);

  return (
    <div className="mt-10">
      <h1 className="text-2xl font-bold mb-6">NECC Rate Analytics</h1>

      <div
        className="grid gap-6 ml-4"
        style={{ gridTemplateColumns: "1.3fr 0.5fr 0.5fr" }}
      >
        {/* 📈 LINE GRAPH for last 15 days*/}
        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="font-semibold mb-4">
            Last 15 Days NECC Rate Trend
          </h2>

          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 📊 AVERAGE */}
        <div className="bg-gradient-to-br from-white to-orange-50 shadow-sm rounded-xl px-5 py-4 flex flex-col items-center justify-center hover:shadow-md transition">
          
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-orange-500 text-base">📈</span>
            <h2 className="text-lg font-semibold text-gray-600 uppercase tracking-wide">
              15 Day Avg
            </h2>
          </div>

          <h1 className="text-5xl font-bold text-orange-600 leading-tight">
            ₹{averageRate}
          </h1>

          <div className="mt-1 text-[11px] text-gray-500">
            Last 15 days
          </div>

          <div className="mt-2 w-10 h-[2px] bg-orange-400 rounded-full" />
        </div>

        {/* 📊 COUNT */}
        <div className="bg-gradient-to-br from-white to-yellow-50 shadow-sm rounded-xl px-5 py-4 flex flex-col items-center justify-center hover:shadow-md transition">
          
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-blue-500 text-base">🧾</span>
            <h2 className="text-lg font-semibold text-gray-600 uppercase tracking-wide">
              Entries
            </h2>
          </div>

          <h1 className="text-5xl font-bold text-yellow-600 leading-tight">
            {chartData.length}
          </h1>

          <div className="mt-1 text-[11px] text-gray-500">
            Last 15 days
          </div>

          <div className="mt-2 w-10 h-[2px] bg-yellow-400 rounded-full" />
        </div>


      </div>
    </div>
  );
}
