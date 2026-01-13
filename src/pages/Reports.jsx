import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  fetchReportsData, 
  fetchOutlets, 
  exportReports 
} from '../context/reportsApi';

const Reports = () => {
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [outletsLoading, setOutletsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: '',
    to: ''
  });
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);

  // Refs for click outside
  const fromCalendarRef = useRef(null);
  const toCalendarRef = useRef(null);

  // Click outside handlers
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

  // Load outlets only once on mount
  useEffect(() => {
    const loadOutlets = async () => {
      setOutletsLoading(true);
      try {
        const outletsData = await fetchOutlets();
        setOutlets(outletsData);
        
        if (outletsData.length > 0) {
          setSelectedOutlet(outletsData[0].id);
        }
      } catch (err) {
        console.error('Failed to load outlets:', err);
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
        
        // Sort transactions in ascending order by date
        if (data && data.transactions) {
          data.transactions = [...data.transactions].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
          );
          
          // If no filters applied, ensure we show at least 7 entries (last 7)
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

  // Handle quick date range selection
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

    setDateRange({
      from: fromDate || '',
      to: to
    });
  };

  // Handle export
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
        { Field: 'Total Damages', Value: `${Math.round(Math.abs(reportData.totalDifference || 0))}` },
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
      
      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      const wsTransactions = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transactions');
      XLSX.writeFile(wb, `reports_${selectedOutlet}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      
    } catch (err) {
      console.error('Failed to export reports:', err);
      alert('Failed to export reports. Please try again.');
    }
  };

  // Handle date selection
  const handleDateSelect = (date, type) => {
    const formattedDate = date.toISOString().split('T')[0];
    setDateRange(prev => ({ ...prev, [type]: formattedDate }));
    if (type === 'from') {
      setShowFromCalendar(false);
    } else {
      setShowToCalendar(false);
    }
  };

  // Format date for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'dd-mm-yyyy';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Memoize chart data
  const salesVsPaymentsData = useMemo(() => {
    if (!reportData?.transactions) return [];
    return reportData.transactions.map(t => ({
      date: t.date.split(' ')[1] + ' ' + t.date.split(' ')[0],
      sales: t.totalAmount,
      received: t.totalRecv
    }));
  }, [reportData?.transactions]);

  const { digitalVsCashData, pieChartData } = useMemo(() => {
    if (!reportData?.transactions) {
      return { digitalVsCashData: null, pieChartData: [] };
    }

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

  // Calculate average closing balance
  const averageClosingBalance = useMemo(() => {
    if (!reportData?.transactions || reportData.transactions.length === 0) return 0;
    const sum = reportData.transactions.reduce((total, t) => total + t.difference, 0);
    return Math.round(sum / reportData.transactions.length);
  }, [reportData?.transactions]);

  // Calculate column totals
  const columnTotals = useMemo(() => {
    if (!reportData?.transactions || reportData.transactions.length === 0) {
      return {
        quantity: 0,
        amount: 0,
        digitalPay: 0,
        cashPay: 0,
        totalRecv: 0,
        closingBalance: 0
      };
    }

    return reportData.transactions.reduce((totals, transaction) => ({
      quantity: totals.quantity + (transaction.salesQty || 0),
      amount: totals.amount + (transaction.totalAmount || 0),
      digitalPay: totals.digitalPay + (transaction.digitalPay || 0),
      cashPay: totals.cashPay + (transaction.cashPay || 0),
      totalRecv: totals.totalRecv + (transaction.totalRecv || 0),
      closingBalance: totals.closingBalance + (transaction.difference || 0)
    }), {
      quantity: 0,
      amount: 0,
      digitalPay: 0,
      cashPay: 0,
      totalRecv: 0,
      closingBalance: 0
    });
  }, [reportData?.transactions]);

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
        @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;500;600;700&display=swap');
        
        * {
          font-family: 'Segoe UI', 'Segoe UI Web', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .stat-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
          border: 1px solid #f0ebe0;
        }

        .stat-card:hover {
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
        }

        .error-banner {
          background: #fff4e6;
          border: 1px solid #ffe0b2;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 16px;
          color: #e65100;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .stat-card {
            padding: 16px;
          }

          table {
            font-size: 13px;
          }
        }
      `}</style>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm md:text-base text-gray-500">Track sales and payment data across all outlets.</p>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

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
                  {outlets
                    .filter(
                      outlet => !["HSR LAYOUT", "Hsr layout", "kr market"].includes(
                        (outlet.name || outlet.id || "").toLowerCase()
                      ) &&
                      !["hsr layout", "kr market"].includes((outlet.name || outlet.id || "").toLowerCase())
                    )
                    .map(outlet => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Date From */}
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-gray-700">Date From</label>
                <div className="relative z-30" ref={fromCalendarRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFromCalendar(!showFromCalendar);
                      setShowToCalendar(false);
                    }}
                    className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
                  >
                    <span>
                      {dateRange.from ? formatDisplayDate(dateRange.from) : "dd-mm-yyyy"}
                    </span>
                    <svg
                      className="h-4 w-4 text-gray-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <circle cx="8.5" cy="14.5" r="1" />
                      <circle cx="12" cy="14.5" r="1" />
                      <circle cx="15.5" cy="14.5" r="1" />
                    </svg>
                  </button>
                  {showFromCalendar && (
                    <div className="absolute left-0 top-full z-50 mt-2">
                      <CalendarPicker
                        selectedDate={dateRange.from}
                        onSelectDate={(date) => handleDateSelect(date, 'from')}
                        onClose={() => setShowFromCalendar(false)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Date To */}
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-gray-700">Date To</label>
                <div className="relative z-30" ref={toCalendarRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowToCalendar(!showToCalendar);
                      setShowFromCalendar(false);
                    }}
                    className="flex min-w-[150px] items-center justify-between rounded-xl border border-gray-200 bg-eggWhite px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 md:text-sm"
                  >
                    <span>
                      {dateRange.to ? formatDisplayDate(dateRange.to) : "dd-mm-yyyy"}
                    </span>
                    <svg
                      className="h-4 w-4 text-gray-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <circle cx="8.5" cy="14.5" r="1" />
                      <circle cx="12" cy="14.5" r="1" />
                      <circle cx="15.5" cy="14.5" r="1" />
                    </svg>
                  </button>
                  {showToCalendar && (
                    <div className="absolute left-0 top-full z-50 mt-2">
                      <CalendarPicker
                        selectedDate={dateRange.to}
                        onSelectDate={(date) => handleDateSelect(date, 'to')}
                        onClose={() => setShowToCalendar(false)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button 
                type="button"
                onClick={() => handleQuickRange('lastWeek')}
                className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50" 
                disabled={loading}
              >
                Last Week
              </button>
              <button 
                type="button"
                onClick={() => handleQuickRange('lastMonth')}
                className="rounded-full border border-gray-200 bg-eggWhite px-4 py-2 text-xs md:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50" 
                disabled={loading}
              >
                Last Month
              </button>
              <button 
                onClick={handleExport}
                disabled={loading || !reportData}
                className="inline-flex items-center rounded-full bg-[#ff7518] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download Data
              </button>
            </div>
          </div>

        {/* Loading State */}
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
            {/* Summary Cards - Now Above Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#fff3e0' }}>
                    🥚
                  </div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Sales Quantity</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">{reportData.totalSalesQuantity || 0}</span>
                  <span className="text-base text-gray-500">eggs</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#e3f2fd' }}>
                    💰
                  </div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Amount</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">₹ {reportData.totalAmount?.toLocaleString() || '0'}</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#ffebee' }}>
                    ⚠️
                  </div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Damages</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${
                    reportData.totalDifference < 0 ? 'text-red-600' : 
                    reportData.totalDifference > 0 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {Math.round(Math.abs(reportData.totalDifference || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#e8f5e9' }}>
                    📊
                  </div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg of Closing Balances</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">₹ {averageClosingBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Transactions Table with Totals */}
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
                          <tr
                            key={index}
                            className={`text-xs text-gray-700 md:text-sm ${
                              index % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                            }`}
                          >
                            <td className="whitespace-nowrap px-4 py-3">{transaction.date}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">{transaction.salesQty}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">₹{transaction.neccRate.toFixed(2)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">₹{transaction.totalAmount.toLocaleString()}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">₹{transaction.digitalPay.toLocaleString()}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">₹{transaction.cashPay.toLocaleString()}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">₹{transaction.totalRecv.toLocaleString()}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                              transaction.difference < 0 ? 'text-red-600' : 
                              transaction.difference > 0 ? 'text-green-600' : 'text-gray-700'
                            }`}>
                              {transaction.difference > 0 ? '+ ' : transaction.difference < 0 ? '- ' : ''}₹{Math.abs(transaction.difference).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {/* Grand Total Row */}
                        <tr className="bg-orange-50 font-semibold text-orange-700 border-t-2 border-orange-200">
                          <td className="whitespace-nowrap px-4 py-3">GRAND TOTAL</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">{columnTotals.quantity}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">-</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">₹{columnTotals.amount.toLocaleString()}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">₹{columnTotals.digitalPay.toLocaleString()}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">₹{columnTotals.cashPay.toLocaleString()}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">₹{columnTotals.totalRecv.toLocaleString()}</td>
                          <td className={`whitespace-nowrap px-4 py-3 text-right ${
                            columnTotals.closingBalance < 0 ? 'text-red-600' : 
                            columnTotals.closingBalance > 0 ? 'text-green-600' : 'text-orange-700'
                          }`}>
                            {columnTotals.closingBalance > 0 ? '+ ' : columnTotals.closingBalance < 0 ? '- ' : ''}₹{Math.abs(columnTotals.closingBalance).toLocaleString()}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-gray-500 text-sm bg-white">
                          No transactions found for the selected period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          </>
        )}
      </div>
    </div>
  );
};

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
      if (day < 1 || day > daysInMonth) {
        week.push(null);
      } else {
        week.push(day);
      }
    }
    weeks.push(week);
  }

  const goPrevMonth = () => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const goNextMonth = () => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const yearOptions = [];
  for (let y = viewYear - 3; y <= viewYear + 3; y++) {
    yearOptions.push(y);
  }

  const selectedIso = selectedDate || "";

  return (
    <div className="w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={goPrevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          ‹
        </button>

        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400"
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx}>
                {m.slice(0, 3)}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 leading-none focus:outline-none focus:ring-1 focus:ring-orange-400"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={goNextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          ›
        </button>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-4 text-center text-[11px] font-medium text-gray-400">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span>
        <span>Th</span><span>Fr</span><span>Sa</span>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 px-3 pb-3 text-center text-xs">
        {weeks.map((week, wIdx) =>
          week.map((d, idx) => {
            if (!d) return <div key={`${wIdx}-${idx}`} />;

            const iso = buildIso(viewYear, viewMonth, d);
            const isSelected = selectedIso === iso;
            const isToday =
              today.getFullYear() === viewYear &&
              today.getMonth() === viewMonth &&
              today.getDate() === d;

            return (
              <button
                key={`${wIdx}-${idx}`}
                type="button"
                onClick={() => onSelectDate(new Date(viewYear, viewMonth, d))}
                className="flex h-8 items-center justify-center"
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    isSelected
                      ? "bg-green-500 text-white"
                      : isToday
                      ? "border border-green-500 text-green-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {d}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Reports;