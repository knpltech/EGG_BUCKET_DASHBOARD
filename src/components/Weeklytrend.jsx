import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

/* ---------- HELPERS ---------- */


function getYAxisConfig(data, outletKeys) {
  let maxValue = 0;

  data.forEach(row => {
    outletKeys.forEach(key => {
      maxValue = Math.max(maxValue, Number(row[key]) || 0);
    });
  });

  // Round up to nearest 10k
  const roundedMax = Math.ceil(maxValue / 10000) * 10000 || 10000;

  return {
    domain: [0, roundedMax],
    ticks: Array.from(
      { length: roundedMax / 10000 + 1 },
      (_, i) => i * 10000
    )
  };
}


// Parse various date formats: yyyy-mm-dd, dd-mm-yyyy, ISO dates, etc.
function parseAnyDate(dateStr) {
  if (!dateStr) return null;

  // Handle yyyy-mm-dd format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }

  // Handle dd-mm-yyyy format
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split("-");
    return new Date(`${yyyy}-${mm}-${dd}`);
  }

  // Handle ISO date strings (e.g., 2026-03-05T00:00:00.000Z)
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
    return new Date(dateStr);
  }

  // Fallback: try parsing with Date constructor
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

// Short label for X-axis → 08 Jan
function formatShortDate(date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
}

// Full date for tooltip → Sunday, 14 Jan 2024
function formatFullDate(date) {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// Y-axis formatter → 30k, 60k
function formatYAxis(value) {
  if (value >= 1000) return `${value / 1000}k`;
  return value;
}

/* ---------- COMPONENT ---------- */

const Weeklytrend = ({ rows = [], outlets: allowedOutlets = [] }) => {
  const [chartData, setChartData] = useState([]);
  const [outletKeys, setOutletKeys] = useState([]);

  // map id -> display name AND create reverse mapping (area -> id)
  const { nameMap, areaToIdMap } = useMemo(() => {
    const nameMap = {};
    const areaToIdMap = {};
    if (Array.isArray(allowedOutlets)) {
      allowedOutlets.forEach(o => {
        const key = typeof o === 'string' ? o : o.id || o.area || o.name;
        const label = typeof o === 'string' ? o : o.area || o.name || key;
        nameMap[key] = label;
        // Map area name back to the key we use (for data lookup)
        if (typeof o === 'object' && o.area) {
          areaToIdMap[o.area] = key;
        }
      });
    }
    return { nameMap, areaToIdMap };
  }, [allowedOutlets]);

  useEffect(() => {
    if (!Array.isArray(rows)) {
      setChartData([]);
      setOutletKeys([]);
      return;
    }

    // 📅 Build last 7 calendar days (including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }

    // Use allowedOutlets as the source for outlet keys (so ALL outlets appear in chart)
    // This ensures newly created outlets and those without sales also show up
    let outlets = [];
    if (Array.isArray(allowedOutlets) && allowedOutlets.length > 0) {
      outlets = allowedOutlets.map(o => (typeof o === 'string' ? o : o.id || o.area || o.name));
    } else {
      // Fallback: collect outlet names from rows if no allowedOutlets provided
      const outletSet = new Set();
      rows.forEach(r => {
        if (r.outlets) {
          Object.keys(r.outlets).forEach(o => outletSet.add(o));
        }
      });
      outlets = Array.from(outletSet);
    }

    setOutletKeys(outlets);

    // Build chart rows day-by-day
    const finalData = days.map(dayDate => {
      const rowData = {
        label: formatShortDate(dayDate),
        fullDate: formatFullDate(dayDate)
      };

      // Initialize outlets with 0
      outlets.forEach(o => {
        rowData[o] = 0;
      });

      // Find matching sales row
      const match = rows.find(r => {
        const d = parseAnyDate(r.date);
        if (!d) return false;
        d.setHours(0, 0, 0, 0);
        return d.getTime() === dayDate.getTime();
      });

      if (match?.outlets) {
        // Map outlet values properly - data may be keyed by area name or by id
        outlets.forEach(outletKey => {
          // Direct match by key (could be id or area)
          if (match.outlets[outletKey] !== undefined) {
            rowData[outletKey] = Number(match.outlets[outletKey]) || 0;
          } else {
            // Fallback: if key is an id, look up by area name
            const areaName = nameMap[outletKey]; // nameMap maps id -> area name
            if (areaName && match.outlets[areaName] !== undefined) {
              rowData[outletKey] = Number(match.outlets[areaName]) || 0;
            }
          }
        });
      }

      return rowData;
    });

    setChartData(finalData);
  }, [rows, allowedOutlets, nameMap]);

  const COLORS = [
    "#f97316",
    "#3b82f6",
    "#22c55e",
    "#a855f7",
    "#ef4444"
  ];

  const yAxisConfig = getYAxisConfig(chartData, outletKeys);


  return (
    <div className="bg-gradient-to-br from-white to-orange-50 shadow-md rounded-2xl px-6 py-5 h-[420px] flex flex-col">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Last 7 Days – Outlet-wise Sales
        </h2>
        <span className="text-orange-500 text-lg">📊</span>
      </div>

      {/* CHART */}
      <div className="flex-1">
        {chartData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center mt-16">
            No data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barGap={6}
              barCategoryGap={16}
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />

              <XAxis
                dataKey="label"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                domain={yAxisConfig.domain}
                ticks={yAxisConfig.ticks}
                tickFormatter={formatYAxis}
                fontSize={11}
                axisLine={false}
                tickLine={false}
              />


              <Tooltip
                formatter={(value, name) => [value, nameMap[name] || name]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullDate
                }
              />

              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(val) => nameMap[val] || val} />

              {outletKeys.map((outlet, idx) => (
                <Bar
                  key={outlet}
                  dataKey={outlet}
                  name={nameMap[outlet] || outlet}
                  fill={COLORS[idx % COLORS.length]}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={26}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default Weeklytrend;
