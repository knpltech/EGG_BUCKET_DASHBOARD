import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchReportsData, fetchOutlets, exportReports } from '../context/reportsApi';

// DEBUG: Fetch all outlet names from backend data for troubleshooting
async function fetchAllOutletNames() {
  try {
    const res = await fetch(import.meta.env.VITE_API_URL + '/outlets/all');
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map(o => o.id || o.name || '').filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

// Fetch daily damages for a specific outlet and date range.
// Mirrors exactly how DailyDamages.jsx fetches: GET /daily-damage/all
// Backend shape per entry: { id, date, damages: { [areaName]: number }, total }
async function fetchDailyDamages(outletName, filters = {}) {
  try {
    const API_URL = import.meta.env.VITE_API_URL;
    const res = await fetch(`${API_URL}/daily-damage/all`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // Normalise each entry the same way DailyDamages.jsx does:
    // spread d.damages so outlet area keys sit at the top level
    const normalised = data.map(d => ({
      id:   d.id,
      date: d.date,
      ...((d.damages && typeof d.damages === 'object') ? d.damages : {}),
      total: d.total || 0,
    }));

    // Apply client-side date filtering
    let filtered = normalised;
    if (filters.dateFrom) filtered = filtered.filter(d => d.date >= filters.dateFrom);
    if (filters.dateTo)   filtered = filtered.filter(d => d.date <= filters.dateTo);

    // Extract the selected outlet column (outletName == outlet area key in d.damages)
    return filtered
      .map(entry => ({
        date:    entry.date,
        damages: entry[outletName] != null ? Math.round(Number(entry[outletName])) : null,
      }))
      .filter(e => e.damages !== null)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  } catch (err) {
    console.error('Failed to fetch daily damages:', err);
    return [];
  }
}

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine, Legend
} from 'recharts';

const Reports = () => {
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [outletsLoading, setOutletsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [debugOutletNames, setDebugOutletNames] = useState([]);
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);

  // Daily damages state
  const [damagesData, setDamagesData] = useState([]);
  const [damagesLoading, setDamagesLoading] = useState(false);

  const fromCalendarRef = useRef(null);
  const toCalendarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fromCalendarRef.current && !fromCalendarRef.current.contains(event.target)) {
        setShowFromCalendar(false);
      }
      if (toCalendarRef.current && !toCalendarRef.current.contains(event.target)) {
        setShowToCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load outlets once on mount
  useEffect(() => {
    const loadOutlets = async () => {
      setOutletsLoading(true);
      try {
        const outletsData = await fetchOutlets();
        const normalizedOutlets = outletsData.map(o => ({
          id: o.name || o.id,
          name: o.name || o.id
        }));
        setOutlets(normalizedOutlets);
        if (normalizedOutlets.length > 0) {
          setSelectedOutlet(normalizedOutlets[0].id);
        }
      } catch (err) {
        setError('Failed to load outlets');
        const demoOutlets = [
          { id: 'AECS Layout', name: 'AECS Layout' },
          { id: 'Bandepalya', name: 'Bandepalya' }
        ];
        setOutlets(demoOutlets);
        setSelectedOutlet(demoOutlets[0].id);
      } finally {
        setOutletsLoading(false);
      }
    };
    loadOutlets();
    fetchAllOutletNames().then(setDebugOutletNames);
  }, []);

  // Fetch report data when outlet or date range changes
  useEffect(() => {
    if (!selectedOutlet) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const filters = {};
        if (dateRange.from) filters.dateFrom = dateRange.from;
        if (dateRange.to) filters.dateTo = dateRange.to;

        const data = await fetchReportsData(selectedOutlet, filters);

        if (data && data.transactions) {
          data.transactions = [...data.transactions].sort((a, b) =>
            new Date(a.date) - new Date(b.date)
          );
          if (!dateRange.from && !dateRange.to) {
            data.transactions = data.transactions.slice(-7);
          }
        }
        setReportData(data);
      } catch (err) {
        console.error('Failed to fetch report data:', err);
        setError('Failed to load report data');
        setReportData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedOutlet, dateRange]);

  // Fetch daily damages when outlet or date range changes
  useEffect(() => {
    if (!selectedOutlet) return;
    const loadDamages = async () => {
      setDamagesLoading(true);
      try {
        const filters = {};
        if (dateRange.from) filters.dateFrom = dateRange.from;
        if (dateRange.to) filters.dateTo = dateRange.to;
        const data = await fetchDailyDamages(selectedOutlet, filters);
        // If no filter, show last 14 days
        setDamagesData(!dateRange.from && !dateRange.to ? data.slice(-14) : data);
      } catch (err) {
        setDamagesData([]);
      } finally {
        setDamagesLoading(false);
      }
    };
    loadDamages();
  }, [selectedOutlet, dateRange]);

  const handleQuickRange = (type) => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    let fromDate;
    if (type === 'lastWeek') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().slice(0, 10);
    } else if (type === 'lastMonth') {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      fromDate = d.toISOString().slice(0, 10);
    }
    setDateRange({ from: fromDate || '', to });
  };

  const handleExport = async () => {
    try {
      if (!reportData || !reportData.transactions || reportData.transactions.length === 0) {
        alert('No data to export');
        return;
      }

      const XLSX = await import('xlsx');

      const avgClosingBalance = reportData.transactions.length > 0
        ? reportData.transactions.reduce((sum, t) => sum + t.difference, 0) / reportData.transactions.length
        : 0;

      const summaryData = [
        { Field: 'Outlet', Value: selectedOutlet },
        { Field: 'Date From', Value: dateRange.from || 'All' },
        { Field: 'Date To', Value: dateRange.to || 'All' },
        { Field: '', Value: '' },
        { Field: 'Total Sales Quantity', Value: `${reportData.totalSalesQuantity || 0} eggs` },
        { Field: 'Average Closing Balance', Value: `₹${Math.round(avgClosingBalance)}` },
        { Field: 'Total Amount', Value: `₹${reportData.totalAmount?.toLocaleString() || '0'}` },
        { Field: 'Total Damages', Value: `${Math.round(Math.abs(reportData.totalDamages || 0))}` },
        { Field: '', Value: '' }
      ];

      const transactionsData = reportData.transactions.map(t => ({
        Date: t.date,
        'Sales Qty': t.salesQty,
        'NECC Rate': `₹${t.neccRate.toFixed(2)}`,
        'Total Amount': `₹${t.totalAmount.toLocaleString()}`,
        'Digital Pay': `₹${t.digitalPay.toLocaleString()}`,
        'Cash Pay': `₹${t.cashPay.toLocaleString()}`,
        'Total Recv.': `₹${t.totalRecv.toLocaleString()}`,
        'Closing Balance': `₹${t.difference.toLocaleString()}`
      }));

      const damagesExportData = damagesData.map(d => ({
        Date: d.date,
        'Damages (eggs)': d.damages
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Summary');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transactionsData), 'Transactions');
      if (damagesExportData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(damagesExportData), 'Daily Damages');
      }
      XLSX.writeFile(wb, `reports_${selectedOutlet}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Failed to export reports:', err);
      alert('Failed to export reports. Please try again.');
    }
  };

  const handleDateSelect = (date, type) => {
    const formattedDate = date.toISOString().split('T')[0];
    setDateRange(prev => ({ ...prev, [type]: formattedDate }));
    if (type === 'from') setShowFromCalendar(false);
    else setShowToCalendar(false);
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'dd-mm-yyyy';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Format date for chart x-axis labels (compact: DD MMM)
  const formatChartDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const salesVsPaymentsData = useMemo(() => {
    if (!reportData?.transactions) return [];
    return reportData.transactions.map(t => ({
      date: t.date.split(' ')[1] + ' ' + t.date.split(' ')[0],
      sales: t.totalAmount,
      received: t.totalRecv
    }));
  }, [reportData?.transactions]);

  const { digitalVsCashData, pieChartData } = useMemo(() => {
    if (!reportData?.transactions) return { digitalVsCashData: null, pieChartData: [] };
    const digitalVsCash = reportData.transactions.reduce((acc, t) => ({
      digital: acc.digital + t.digitalPay,
      cash: acc.cash + t.cashPay
    }), { digital: 0, cash: 0 });
    const pieData = [
      { name: 'Digital', value: digitalVsCash.digital },
      { name: 'Cash', value: digitalVsCash.cash }
    ];
    return { digitalVsCashData: digitalVsCash, pieChartData: pieData };
  }, [reportData?.transactions]);

  const averageClosingBalance = useMemo(() => {
    if (!reportData?.transactions || reportData.transactions.length === 0) return 0;
    const sum = reportData.transactions.reduce((total, t) => total + t.difference, 0);
    return Math.round(sum / reportData.transactions.length);
  }, [reportData?.transactions]);

  const columnTotals = useMemo(() => {
    if (!reportData?.transactions || reportData.transactions.length === 0) {
      return { quantity: 0, amount: 0, digitalPay: 0, cashPay: 0, totalRecv: 0, closingBalance: 0 };
    }
    return reportData.transactions.reduce((totals, transaction) => ({
      quantity: totals.quantity + (transaction.salesQty || 0),
      amount: totals.amount + (transaction.totalAmount || 0),
      digitalPay: totals.digitalPay + (transaction.digitalPay || 0),
      cashPay: totals.cashPay + (transaction.cashPay || 0),
      totalRecv: totals.totalRecv + (transaction.totalRecv || 0),
      closingBalance: totals.closingBalance + (transaction.difference || 0)
    }), { quantity: 0, amount: 0, digitalPay: 0, cashPay: 0, totalRecv: 0, closingBalance: 0 });
  }, [reportData?.transactions]);

  // Damages chart computed stats
  const damagesStats = useMemo(() => {
    if (!damagesData.length) return { total: 0, avg: 0, max: 0, maxDate: '' };
    const total = damagesData.reduce((s, d) => s + d.damages, 0);
    const avg = Math.round(total / damagesData.length);
    const maxEntry = damagesData.reduce((a, b) => (b.damages > a.damages ? b : a), damagesData[0]);
    return { total, avg, max: maxEntry.damages, maxDate: maxEntry.date };
  }, [damagesData]);

  // Custom tooltip for damages chart
  const DamagesTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <p style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>{formatChartDate(label)}</p>
        <p style={{ color: '#dc2626' }}>Damages: <strong>{payload[0].value} eggs</strong></p>
      </div>
    );
  };

  const COLORS = ['#ff7518', '#ffa866'];

  if (outletsLoading) {
    return (
      <div className="min-h-screen bg-eggBg">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff7518] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading outlets...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eggBg px-3 py-6 md:px-6 flex flex-col">
      <style>{`
        * { font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
        .stat-card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s ease; border: 1px solid #f0ebe0; }
        .stat-card:hover { box-shadow: 0 2px 6px rgba(0,0,0,0.12); }
        .error-banner { background: #fff4e6; border: 1px solid #ffe0b2; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; color: #e65100; font-size: 14px; }
        @media (max-width: 768px) { .stat-card { padding: 16px; } table { font-size: 13px; } }
      `}</style>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm md:text-base text-gray-500">Track sales and payment data across all outlets.</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* Controls */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap gap-3">
            {/* Outlet Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs md:text-sm font-medium text-gray-700">Select Outlet</label>
              <select
                className="min-w-[150px] rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                value={selectedOutlet || ''}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                disabled={loading}
              >
                {outlets.filter(o => o.status !== 'Inactive').map(outlet => (
                  <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex items-center gap-2">
              <label className="text-xs md:text-sm font-medium text-gray-700">Date From</label>
              <div className="relative z-30" ref={fromCalendarRef}>
                <button type="button" onClick={() => { setShowFromCalendar(!showFromCalendar); setShowToCalendar(false); }} className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                  <span>{dateRange.from ? formatDisplayDate(dateRange.from) : "dd-mm-yyyy"}</span>
                  <CalendarIcon />
                </button>
                {showFromCalendar && (
                  <div className="absolute left-0 top-full z-50 mt-2">
                    <CalendarPicker selectedDate={dateRange.from} onSelectDate={(date) => handleDateSelect(date, 'from')} onClose={() => setShowFromCalendar(false)} />
                  </div>
                )}
              </div>
            </div>

            {/* Date To */}
            <div className="flex items-center gap-2">
              <label className="text-xs md:text-sm font-medium text-gray-700">Date To</label>
              <div className="relative z-30" ref={toCalendarRef}>
                <button type="button" onClick={() => { setShowToCalendar(!showToCalendar); setShowFromCalendar(false); }} className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm">
                  <span>{dateRange.to ? formatDisplayDate(dateRange.to) : "dd-mm-yyyy"}</span>
                  <CalendarIcon />
                </button>
                {showToCalendar && (
                  <div className="absolute left-0 top-full z-50 mt-2">
                    <CalendarPicker selectedDate={dateRange.to} onSelectDate={(date) => handleDateSelect(date, 'to')} onClose={() => setShowToCalendar(false)} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => handleQuickRange('lastWeek')} className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50" disabled={loading}>Last Week</button>
            <button type="button" onClick={() => handleQuickRange('lastMonth')} className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50" disabled={loading}>Last Month</button>
            <button onClick={handleExport} disabled={loading || !reportData} className="inline-flex items-center rounded-full bg-[#ff7518] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">Download Data</button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff7518] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading report data...</p>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && reportData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#fff3e0' }}>🥚</div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Sales Quantity</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">{reportData.totalSalesQuantity || 0}</span>
                  <span className="text-base text-gray-500">eggs</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#e3f2fd' }}>💰</div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Amount</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">₹ {reportData.totalAmount?.toLocaleString() || '0'}</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#ffebee' }}>⚠️</div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Damages</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${reportData.totalDamages < 0 ? 'text-red-600' : reportData.totalDamages > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {Math.round(Math.abs(reportData.totalDamages || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#e8f5e9' }}>📊</div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg of Closing Balances</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">₹ {averageClosingBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-hidden rounded-2xl bg-eggWhite shadow-sm mb-6">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold text-gray-500">
                      <th className="min-w-[130px] px-4 py-3">DATE</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">QUANTITY</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">NECC RATE</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">AMOUNT</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">DIGITAL PAYMENT</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">CASH PAYMENT</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">TOTAL AMOUNT</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">CLOSING BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.transactions?.length > 0 ? (
                      <>
                        {reportData.transactions.map((transaction, index) => (
                          <tr key={index} className={`text-xs text-gray-700 md:text-sm ${index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                            <td className="whitespace-nowrap px-4 py-3">{transaction.date}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{transaction.salesQty}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">₹{transaction.neccRate.toFixed(2)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">₹{transaction.totalAmount.toLocaleString()}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">₹{transaction.digitalPay.toLocaleString()}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">₹{transaction.cashPay.toLocaleString()}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">₹{transaction.totalRecv.toLocaleString()}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${transaction.difference < 0 ? 'text-red-600' : transaction.difference > 0 ? 'text-green-600' : 'text-gray-700'}`}>
                              {transaction.difference > 0 ? '+ ' : transaction.difference < 0 ? '- ' : ''}₹{Math.abs(transaction.difference).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-orange-50 font-semibold text-orange-700 border-t-2 border-orange-200">
                          <td className="whitespace-nowrap px-4 py-3">GRAND TOTAL</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">{columnTotals.quantity}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">-</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">₹{columnTotals.amount.toLocaleString()}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">₹{columnTotals.digitalPay.toLocaleString()}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">₹{columnTotals.cashPay.toLocaleString()}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">₹{columnTotals.totalRecv.toLocaleString()}</td>
                          <td className={`whitespace-nowrap px-4 py-3 text-right ${columnTotals.closingBalance < 0 ? 'text-red-600' : columnTotals.closingBalance > 0 ? 'text-green-600' : 'text-orange-700'}`}>
                            {columnTotals.closingBalance > 0 ? '+ ' : columnTotals.closingBalance < 0 ? '- ' : ''}₹{Math.abs(columnTotals.closingBalance).toLocaleString()}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-gray-500 text-sm bg-white">No transactions found for the selected period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts Row 1: Sales vs Payments + Digital vs Cash */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Sales vs Payments</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={salesVsPaymentsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#666' }} axisLine={{ stroke: '#e5e7eb' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#666' }} axisLine={{ stroke: '#e5e7eb' }} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '13px' }} />
                    <Bar dataKey="sales" fill="#ffa866" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="received" fill="#ff7518" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Digital vs Cash</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value">
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '13px' }} formatter={(value) => `₹${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center mt-4">
                  <div className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Total</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    ₹{digitalVsCashData ? (digitalVsCashData.digital + digitalVsCashData.cash).toLocaleString() : '0'}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Damages Chart — full width */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Daily Damages</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Egg damage count per day for <span className="font-medium text-gray-700">{selectedOutlet}</span></p>
                </div>
                {/* Mini stat pills */}
                {damagesData.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-100 px-3 py-1 text-xs font-medium text-red-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block" />
                      Total: {damagesStats.total} eggs
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-3 py-1 text-xs font-medium text-orange-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" />
                      Avg/day: {damagesStats.avg} eggs
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 border border-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 inline-block" />
                      Peak: {damagesStats.max} eggs ({formatChartDate(damagesStats.maxDate)})
                    </span>
                  </div>
                )}
              </div>

              {damagesLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400"></div>
                </div>
              ) : damagesData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <span className="text-4xl mb-3">📭</span>
                  <p className="text-sm font-medium">No damage records found</p>
                  <p className="text-xs mt-1">for the selected outlet and date range</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={damagesData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="damagesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#fca5a5" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickLine={false}
                        tickFormatter={formatChartDate}
                        interval={damagesData.length > 10 ? Math.floor(damagesData.length / 8) : 0}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}`}
                        width={36}
                      />
                      <Tooltip content={<DamagesTooltip />} cursor={{ fill: '#fef2f2', radius: 4 }} />
                      {/* Average reference line */}
                      <ReferenceLine
                        y={damagesStats.avg}
                        stroke="#f97316"
                        strokeDasharray="5 4"
                        strokeWidth={1.5}
                        label={{ value: `Avg ${damagesStats.avg}`, position: 'insideTopRight', fontSize: 11, fill: '#f97316', fontWeight: 600 }}
                      />
                      <Bar dataKey="damages" fill="url(#damagesGradient)" radius={[5, 5, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>

                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Shared calendar icon
const CalendarIcon = () => (
  <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <circle cx="8.5" cy="14.5" r="1" />
    <circle cx="12" cy="14.5" r="1" />
    <circle cx="15.5" cy="14.5" r="1" />
  </svg>
);

// Calendar Picker Component
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CalendarPicker = ({ selectedDate, onSelectDate }) => {
  const today = new Date();
  const initialDate = selectedDate ? new Date(selectedDate) : today;

  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    if (!Number.isNaN(d.getTime())) {
      setViewMonth(d.getMonth());
      setViewYear(d.getFullYear());
    }
  }, [selectedDate]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const buildIso = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const weeks = [];
  let day = 1 - firstDay;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++, day++) {
      week.push(day < 1 || day > daysInMonth ? null : day);
    }
    weeks.push(week);
  }

  const goPrevMonth = () => setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; });
  const goNextMonth = () => setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; });

  const yearOptions = [];
  for (let y = viewYear - 3; y <= viewYear + 3; y++) yearOptions.push(y);

  const selectedIso = selectedDate || "";

  return (
    <div className="w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button type="button" onClick={goPrevMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">‹</button>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400" value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))}>
            {MONTHS.map((m, idx) => <option key={m} value={idx}>{m.slice(0, 3)}</option>)}
          </select>
          <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400" value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" onClick={goNextMonth} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">›</button>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-4 text-center text-[11px] font-medium text-gray-400">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-3 pb-3 text-center text-xs">
        {weeks.map((week, wIdx) =>
          week.map((d, idx) => {
            if (!d) return <div key={`${wIdx}-${idx}`} />;
            const iso = buildIso(viewYear, viewMonth, d);
            const isSelected = selectedIso === iso;
            const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;
            return (
              <button key={`${wIdx}-${idx}`} type="button" onClick={() => onSelectDate(new Date(viewYear, viewMonth, d))} className="flex h-8 items-center justify-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isSelected ? "bg-green-500 text-white" : isToday ? "border border-green-500 text-green-600" : "text-gray-700 hover:bg-gray-100"}`}>{d}</div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Reports;