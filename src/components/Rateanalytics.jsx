import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { useEffect, useMemo, useState } from "react";

/* ---------------- HELPERS ---------------- */

// Convert "₹6.50 per egg" or 6.5 → 6.5
function parseRate(rateValue) {
  if (!rateValue) return 0;
  if (typeof rateValue === 'number') return rateValue;
  if (typeof rateValue === 'string') {
    return Number(rateValue.replace(/[^\d.]/g, ""));
  }
  return 0;
}

function getRateFromRow(row) {
  if (typeof row?.rate === "number" && !isNaN(row.rate)) return row.rate;
  if (typeof row?.rateValue === "number" && !isNaN(row.rateValue)) return row.rateValue;
  return parseRate(row?.rate ?? row?.rateValue);
}

// Supports both dd-mm-yyyy and yyyy-mm-dd
function parseAnyDate(dateStr) {
  if (!dateStr) return null;

  // yyyy-mm-dd (ISO / Firebase)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }

  // ISO date-time (e.g. 2026-03-23T00:00:00.000Z)
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
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

export default function Rateanalytics({ rows = [], outlets: allowedOutlets = [] }) {
  const [chartData, setChartData] = useState([]);
  const [outletKeys, setOutletKeys] = useState([]);

  const { nameMap, outletLookup } = useMemo(() => {
    const nameMap = {};
    const outletLookup = new Map();

    if (Array.isArray(allowedOutlets)) {
      allowedOutlets.forEach((o) => {
        const canonical = String(o?.name || o?.area || o?.id || "").toUpperCase();
        if (!canonical) return;

        nameMap[canonical] = o?.name || o?.area || canonical;

        if (o?.id) {
          outletLookup.set(String(o.id), canonical);
          outletLookup.set(String(o.id).toUpperCase(), canonical);
          outletLookup.set(String(o.id).toLowerCase(), canonical);
        }
        if (o?.name) {
          outletLookup.set(String(o.name), canonical);
          outletLookup.set(String(o.name).toUpperCase(), canonical);
          outletLookup.set(String(o.name).toLowerCase(), canonical);
        }
        if (o?.area) {
          outletLookup.set(String(o.area), canonical);
          outletLookup.set(String(o.area).toUpperCase(), canonical);
          outletLookup.set(String(o.area).toLowerCase(), canonical);
        }
      });
    }

    return { nameMap, outletLookup };
  }, [allowedOutlets]);

  const resolveOutletKey = (key) => {
    if (!key) return "";
    const raw = String(key);
    return outletLookup.get(raw) || outletLookup.get(raw.toUpperCase()) || raw.toUpperCase();
  };

  useEffect(() => {
    if (!Array.isArray(rows) || rows.length === 0) {
      setChartData([]);
      setOutletKeys([]);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 14);

    const parsedRows = rows
      .map((r) => {
        const parsedDate = parseAnyDate(r.date);
        if (!parsedDate || isNaN(parsedDate)) return null;

        parsedDate.setHours(0, 0, 0, 0);

        return {
          date: r.date,                // label
          timestamp: parsedDate.getTime(),
          row: r
        };
      })
      .filter(Boolean)
      .filter(
        (r) =>
          r.timestamp >= startDate.getTime() &&
          r.timestamp <= today.getTime()
      )
      .sort((a, b) => a.timestamp - b.timestamp); // oldest → newest

    const discovered = new Set();
    if (Array.isArray(allowedOutlets) && allowedOutlets.length > 0) {
      allowedOutlets.forEach((o) => {
        const canonical = String(o?.name || o?.area || o?.id || "").toUpperCase();
        if (canonical) discovered.add(canonical);
      });
    }

    parsedRows.forEach(({ row }) => {
      if (row?.outlet) {
        discovered.add(resolveOutletKey(row.outlet));
      }
      if (row?.outlets && typeof row.outlets === "object") {
        Object.keys(row.outlets).forEach((k) => discovered.add(resolveOutletKey(k)));
      }
    });

    const keys = Array.from(discovered).filter(Boolean);
    setOutletKeys(keys);

    const dayToRates = new Map();
    parsedRows.forEach(({ timestamp, row }) => {
      const dayKey = new Date(timestamp).toISOString().slice(0, 10);
      if (!dayToRates.has(dayKey)) dayToRates.set(dayKey, {});
      const bucket = dayToRates.get(dayKey);

      if (row?.outlet) {
        const outletKey = resolveOutletKey(row.outlet);
        bucket[outletKey] = getRateFromRow(row);
      }

      if (row?.outlets && typeof row.outlets === "object") {
        Object.entries(row.outlets).forEach(([k, v]) => {
          const outletKey = resolveOutletKey(k);
          bucket[outletKey] = parseRate(v);
        });
      }
    });

    const finalData = [];
    for (let i = 14; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const dayKey = day.toISOString().slice(0, 10);

      finalData.push({
        date: dayKey,
        label: day.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" }),
        fullDate: day.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric"
        }),
        ...(keys.reduce((acc, key) => {
          const value = dayToRates.get(dayKey)?.[key];
          acc[key] = Number.isFinite(Number(value)) ? Number(value) : null;
          return acc;
        }, {}))
      });
    }

    setChartData(finalData);
  }, [rows, allowedOutlets, outletLookup]);

  const availableRates = chartData
    .flatMap((r) => outletKeys.map((key) => Number(r[key])))
    .filter((value) => Number.isFinite(value));

  const entriesCount = availableRates.length;

  const colors = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#f59e0b"];

  const averageRate =
    availableRates.length === 0
      ? "0.00"
      : (
          availableRates.reduce((sum, rate) => sum + rate, 0) / availableRates.length
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
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const rate = Number(value);
                    if (!Number.isFinite(rate)) return ["No entry", nameMap[name] || name];
                    return [`₹${rate.toFixed(2)}`, nameMap[name] || name];
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ""}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => nameMap[value] || value} />

                {outletKeys.map((key, idx) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={nameMap[key] || key}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 3, strokeWidth: 1 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
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
            {entriesCount}
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
