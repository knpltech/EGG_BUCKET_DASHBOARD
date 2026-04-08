const API_URL = import.meta.env.VITE_API_URL;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";
import { getThisWeekRange } from "../utils/dateRange";

const getOutletRevenueValue = (row, outletRef) => {
  const outletObj = typeof outletRef === "object" ? outletRef : null;
  const outletId = outletObj?.id || outletRef;
  const outletArea = outletObj?.area || outletObj?.name || outletId;
  const values = row?.outlets || {};

  if (values[outletId] !== undefined) return Number(values[outletId]) || 0;
  if (outletArea && values[outletArea] !== undefined) return Number(values[outletArea]) || 0;
  return 0;
};

const formatDateDMY = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
};

function RevenueAnalytics({ rows }) {
  const chartData = useMemo(() => {
    return rows.map((row) => ({
      date: formatDateDMY(row.date),
      total: Number(row.total) || 0,
    }));
  }, [rows]);

  if (!chartData.length) return null;

  return (
    <div className="mt-10">
      <h1 className="text-2xl font-bold mb-6">Daily Revenue Analytics</h1>

      <div className="ml-4 bg-white shadow rounded-xl p-6">
        <h2 className="font-semibold mb-4">Revenue Trend by Date</h2>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#f97316"
                strokeWidth={3}
                dot={{ r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function DailyRevenue() {
  const defaultWeekRange = useMemo(() => getThisWeekRange(), []);
  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(defaultWeekRange.from);
  const [toDate, setToDate] = useState(defaultWeekRange.to);

  const fetchRevenueData = useCallback(async () => {
    setLoading(true);
    try {
      const [outletsRes, cashRes, digitalRes] = await Promise.all([
        fetch(`${API_URL}/outlets/all`),
        fetch(`${API_URL}/cash-payments/all`),
        fetch(`${API_URL}/digital-payments/all`),
      ]);

      const [outletsData, cashData, digitalData] = await Promise.all([
        outletsRes.json(),
        cashRes.json(),
        digitalRes.json(),
      ]);

      const outletList = Array.isArray(outletsData) ? outletsData : [];
      const cashRows = Array.isArray(cashData) ? cashData : [];
      const digitalRows = Array.isArray(digitalData) ? digitalData : [];

      const dateMap = new Map();

      const applyPaymentRows = (paymentRows) => {
        paymentRows.forEach((entry) => {
          const date = String(entry?.date || "").slice(0, 10);
          if (!date) return;

          if (!dateMap.has(date)) {
            dateMap.set(date, { date, outlets: {} });
          }

          const current = dateMap.get(date);
          outletList.forEach((outlet) => {
            const outletId = outlet?.id;
            if (!outletId) return;

            const value = getOutletRevenueValue(entry, outlet);
            current.outlets[outletId] = (Number(current.outlets[outletId]) || 0) + value;
          });
        });
      };

      applyPaymentRows(cashRows);
      applyPaymentRows(digitalRows);

      const mergedRows = Array.from(dateMap.values())
        .map((row) => ({
          ...row,
          total: Object.values(row.outlets).reduce((sum, value) => sum + (Number(value) || 0), 0),
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setOutlets(outletList);
      setRows(mergedRows);
    } catch (error) {
      console.error("Error fetching daily revenue:", error);
      setRows([]);
      setOutlets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (fromDate && toDate) {
      return sorted.filter((row) => {
        const date = new Date(row.date);
        return date >= new Date(fromDate) && date <= new Date(toDate);
      });
    }
    if (fromDate) return sorted.filter((row) => new Date(row.date) >= new Date(fromDate));
    if (toDate) return sorted.filter((row) => new Date(row.date) <= new Date(toDate));
    return sorted;
  }, [rows, fromDate, toDate]);

  const handleDownload = useCallback(() => {
    if (!filteredRows.length) {
      alert("No data available");
      return;
    }

    const data = filteredRows.map((row) => {
      const record = { Date: formatDateDMY(row.date) };
      outlets.forEach((outlet) => {
        const outletId = outlet?.id;
        const label = outlet?.area || outlet?.name || outletId;
        record[label] = Number(row.outlets?.[outletId] ?? 0);
      });
      record.Total = Number(row.total || 0);
      return record;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Revenue");
    XLSX.writeFile(workbook, "Daily_Revenue_Report.xlsx");
  }, [filteredRows, outlets]);

  if (loading) {
    return (
      <div className="flex">
        <div className="bg-eggBg min-h-screen p-6 w-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff7518] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading daily revenue...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="bg-eggBg min-h-screen p-6 w-full">
        <Topbar />

        <Dailyheader
          title={"Daily Revenue"}
          subtitle={"View outlet-wise daily revenue."}
          dailySalesData={filteredRows}
          fromDate={fromDate}
          toDate={toDate}
          setFromDate={setFromDate}
          setToDate={setToDate}
          allRows={rows}
          onExport={handleDownload}
        />

        <DailyTable
          rows={filteredRows}
          outlets={outlets.map((outlet) => outlet.id)}
          allOutlets={outlets}
          showRupee={true}
        />

        <RevenueAnalytics rows={filteredRows} />
      </div>
    </div>
  );
}
