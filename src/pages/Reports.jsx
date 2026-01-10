import React, { useState, useEffect, useMemo } from 'react';
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
    from: null,
    to: null
  });
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);

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
      const d = new Date(today);
      d.setMonth(d.getMonth() - 1);
      fromDate = d.toISOString().slice(0, 10);
    }

    setDateRange({
      from: fromDate || '',
      to: to
    });
  };

  // Handle export (Excel only - no additional dependencies needed)
  const handleExport = async () => {
    try {
      if (!reportData || !reportData.transactions || reportData.transactions.length === 0) {
        alert('No data to export');
        return;
      }

      // Dynamic import of xlsx
      const XLSX = await import('xlsx');
      
      // Prepare summary data
      const summaryData = [
        { Field: 'Outlet', Value: selectedOutlet },
        { Field: 'Date From', Value: dateRange.from || 'All' },
        { Field: 'Date To', Value: dateRange.to || 'All' },
        { Field: '', Value: '' },
        { Field: 'Total Sales Quantity', Value: `${reportData.totalSalesQuantity || 0} eggs` },
        { Field: 'Average NECC Rate', Value: `₹${reportData.averageNeccRate?.toFixed(2) || '0.00'}` },
        { Field: 'Total Amount', Value: `₹${reportData.totalAmount?.toLocaleString() || '0'}` },
        { Field: 'Total Difference', Value: `₹${reportData.totalDifference?.toLocaleString() || '0'}` },
        { Field: '', Value: '' }
      ];
      
      // Prepare transactions data
      const transactionsData = reportData.transactions.map(t => ({
        Date: t.date,
        'Sales Qty': t.salesQty,
        'NECC Rate': `₹${t.neccRate.toFixed(2)}`,
        'Total Amount': `₹${t.totalAmount.toLocaleString()}`,
        'Digital Pay': `₹${t.digitalPay.toLocaleString()}`,
        'Cash Pay': `₹${t.cashPay.toLocaleString()}`,
        'Total Recv.': `₹${t.totalRecv.toLocaleString()}`,
        'Difference': `₹${t.difference.toLocaleString()}`
      }));
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create summary sheet
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      
      // Create transactions sheet
      const wsTransactions = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transactions');
      
      // Save file
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

        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-center: center;
          font-size: 20px;
        }

        .table-container {
          background: #fefdfb;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          border: 1px solid #f0ebe0;
        }

        .table-row {
          transition: background-color 0.15s ease;
        }

        .table-row:hover {
          background-color: #faf8f3;
        }

        .chart-container {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          border: 1px solid #f0ebe0;
        }

        .select-custom {
          background: white;
          border: 1px solid #d4cec0;
          border-radius: 6px;
          padding: 11px 16px;
          padding-right: 40px;
          font-size: 14px;
          font-weight: 400;
          color: #3c3c3c;
          cursor: pointer;
          transition: all 0.15s ease;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
        }

        .select-custom:hover {
          border-color: #ff7518;
          background-color: #fffbf5;
        }

        .select-custom:focus {
          outline: none;
          border-color: #ff7518;
          background-color: white;
        }

        .btn-quick {
          background: white;
          border: 1px solid #d4cec0;
          border-radius: 6px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.15s ease;
          color: #3c3c3c;
        }

        .btn-quick:hover {
          background: #fffbf5;
          border-color: #ff7518;
        }

        .btn-export {
          background: white;
          border: 1px solid #d4cec0;
          border-radius: 6px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.15s ease;
          color: #3c3c3c;
        }

        .btn-export:hover {
          background: #ff7518;
          color: white;
          border-color: #ff7518;
        }

        .date-input {
          background: white;
          border: 1px solid #d4cec0;
          border-radius: 6px;
          padding: 10px 40px 10px 14px;
          font-size: 13px;
          transition: all 0.15s ease;
          color: #3c3c3c;
          cursor: pointer;
          position: relative;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='16' y1='2' x2='16' y2='6'%3E%3C/line%3E%3Cline x1='8' y1='2' x2='8' y2='6'%3E%3C/line%3E%3Cline x1='3' y1='10' x2='21' y2='10'%3E%3C/line%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
        }

        .date-input:hover {
          border-color: #ff7518;
          background-color: #fffbf5;
        }

        .date-input:focus {
          outline: none;
          border-color: #ff7518;
          background-color: white;
        }

        .calendar-popup {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          background: white;
          border: 1px solid #d4cec0;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 12px;
          z-index: 1000;
          min-width: 260px;
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .calendar-nav-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.15s ease;
          color: #666;
          font-size: 18px;
        }

        .calendar-nav-btn:hover {
          background: #f5f5f5;
          color: #ff7518;
        }

        .calendar-select {
          background: white;
          border: 1px solid #d4cec0;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
        }

        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          margin-bottom: 4px;
        }

        .calendar-weekday {
          text-align: center;
          font-size: 10px;
          font-weight: 600;
          color: #666;
          padding: 4px 0;
        }

        .calendar-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }

        .calendar-day {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.15s ease;
          color: #333;
          width: 32px;
          height: 32px;
        }

        .calendar-day:hover {
          background: #fffbf5;
          color: #ff7518;
        }

        .calendar-day.today {
          border: 2px solid #4ade80;
          color: #4ade80;
          font-weight: 600;
        }

        .calendar-day.selected {
          background: #ff7518;
          color: white;
          font-weight: 600;
        }

        .calendar-day.other-month {
          color: #ccc;
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

          .chart-container {
            padding: 16px;
          }

          table {
            font-size: 13px;
          }

          .calendar-popup {
            min-width: 280px;
            padding: 16px;
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
                  {outlets.map(outlet => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-gray-700">Date From</label>
                <div className="relative">
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
                    <div className="absolute left-0 top-full z-30 mt-2">
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
                <div className="relative">
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
                    <div className="absolute left-0 top-full z-30 mt-2">
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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#fff3e0' }}>
                    🥚
                  </div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales Quantity</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">{reportData.totalSalesQuantity || 0}</span>
                  <span className="text-base text-gray-500">eggs</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#e8f5e9' }}>
                    📊
                  </div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NECC Rate</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">₹ {reportData.averageNeccRate?.toFixed(2) || '0.00'}</span>
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
                    {reportData.totalDifference > 0 ? '' : ''}  {Math.abs(reportData.totalDifference || 0).toLocaleString()}
                  </span>
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
                      reportData.transactions.map((transaction, index) => (
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
                      ))
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

// Calendar Picker Component - Matching Digital Payments style
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CalendarPicker = ({ selectedDate, onSelectDate, onClose }) => {
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
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;

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

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.calendar-popup') && !e.target.closest('.date-input')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
      {/* Header */}
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

      {/* Week days */}
      <div className="mt-1 grid grid-cols-7 gap-y-1 px-4 text-center text-[11px] font-medium text-gray-400">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      {/* Days */}
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
                onClick={() => {
                  onSelectDate(new Date(viewYear, viewMonth, d));
                }}
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