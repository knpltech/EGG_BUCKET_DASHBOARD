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

  // Handle export
  const handleExport = async (format) => {
    try {
      const blob = await exportReports(selectedOutlet, format, {
        dateFrom: dateRange.from,
        dateTo: dateRange.to
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reports_${selectedOutlet}_${new Date().toISOString()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
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
      <div className="min-h-screen" style={{ backgroundColor: '#faf8f3' }}>
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
    <div className="min-h-screen" style={{ backgroundColor: '#faf8f3' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;500;600;700&display=swap');
        
        * {
          font-family: 'Segoe UI', 'Segoe UI Web', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .stat-card {
          background: white;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
          transition: all 0.2s ease;
          border: 1px solid #f0ebe0;
        }

        .stat-card:hover {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        }

        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .table-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
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
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-6">Reports</h1>
          <p className="text-gray-600 mb-6 text-sm">Track sales and payment data across all outlets.</p>
          
          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Outlet Selector */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-2">Select Outlet</label>
              <select 
                className="select-custom w-full"
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
            <div className="lg:col-span-1 relative">
              <label className="block text-xs font-medium text-gray-700 mb-2">Date From</label>
              <div 
                className="date-input"
                onClick={() => {
                  setShowFromCalendar(!showFromCalendar);
                  setShowToCalendar(false);
                }}
              >
                {formatDisplayDate(dateRange.from)}
              </div>
              
              {showFromCalendar && (
                <CalendarPicker
                  selectedDate={dateRange.from}
                  onSelectDate={(date) => handleDateSelect(date, 'from')}
                  onClose={() => setShowFromCalendar(false)}
                />
              )}
            </div>

            {/* Date To */}
            <div className="lg:col-span-1 relative">
              <label className="block text-xs font-medium text-gray-700 mb-2">Date To</label>
              <div 
                className="date-input"
                onClick={() => {
                  setShowToCalendar(!showToCalendar);
                  setShowFromCalendar(false);
                }}
              >
                {formatDisplayDate(dateRange.to)}
              </div>
              
              {showToCalendar && (
                <CalendarPicker
                  selectedDate={dateRange.to}
                  onSelectDate={(date) => handleDateSelect(date, 'to')}
                  onClose={() => setShowToCalendar(false)}
                />
              )}
            </div>

            {/* Quick Filters */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-2">Quick Select</label>
              <div className="flex gap-2">
                <button className="btn-quick flex-1" disabled={loading}>Last Week</button>
                <button className="btn-quick flex-1" disabled={loading}>Last Month</button>
              </div>
            </div>

            {/* Export Button */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-2">Export</label>
              <button 
                className="btn-export w-full"
                onClick={() => handleExport('excel')}
                disabled={loading || !reportData}
              >
                Download Data
              </button>
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="stat-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="stat-icon" style={{ backgroundColor: '#fff3e0' }}>🥚</div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Sales Quantity</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-gray-900">{reportData.totalSalesQuantity || 0}</span>
                  <span className="text-base text-gray-500">eggs</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="stat-icon" style={{ backgroundColor: '#e8f5e9' }}>📊</div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">NECC Rate</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-gray-900">₹ {reportData.averageNeccRate?.toFixed(2) || '0.00'}</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="stat-icon" style={{ backgroundColor: '#e3f2fd' }}>💰</div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Amount</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-gray-900">₹ {reportData.totalAmount?.toLocaleString() || '0'}</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="stat-icon" style={{ backgroundColor: '#ffebee' }}>⚠️</div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Difference</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-semibold ${
                    reportData.totalDifference < 0 ? 'text-red-600' : 
                    reportData.totalDifference > 0 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {reportData.totalDifference > 0 ? '+' : ''} ₹ {Math.abs(reportData.totalDifference || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="table-container mb-8 overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: '#faf8f3' }}>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-5 text-xs font-semibold text-gray-700 uppercase">Date</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-700 uppercase">Sales Qty</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-700 uppercase">NECC Rate</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-700 uppercase">Total Amount</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-700 uppercase">Digital Pay</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-700 uppercase">Cash Pay</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-700 uppercase">Total Recv.</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-700 uppercase">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions?.length > 0 ? (
                    reportData.transactions.map((transaction, index) => (
                      <tr key={index} className="table-row border-b border-gray-100 last:border-0">
                        <td className="py-3 px-5 text-sm font-medium text-gray-900">{transaction.date}</td>
                        <td className="py-3 px-5 text-sm text-right text-gray-700">{transaction.salesQty}</td>
                        <td className="py-3 px-5 text-sm text-right text-gray-700">₹{transaction.neccRate.toFixed(2)}</td>
                        <td className="py-3 px-5 text-sm text-right font-medium text-gray-900">₹{transaction.totalAmount.toLocaleString()}</td>
                        <td className="py-3 px-5 text-sm text-right text-gray-700">₹{transaction.digitalPay.toLocaleString()}</td>
                        <td className="py-3 px-5 text-sm text-right text-gray-700">₹{transaction.cashPay}</td>
                        <td className="py-3 px-5 text-sm text-right font-medium text-gray-900">₹{transaction.totalRecv.toLocaleString()}</td>
                        <td className={`py-3 px-5 text-sm text-right font-semibold ${
                          transaction.difference < 0 ? 'text-red-600' : 
                          transaction.difference > 0 ? 'text-green-600' : 'text-gray-700'
                        }`}>
                          {transaction.difference > 0 ? '+ ' : transaction.difference < 0 ? '- ' : ''}₹{Math.abs(transaction.difference)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-gray-500 text-sm">
                        No transactions found for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="chart-container">
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

              <div className="chart-container">
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
const CalendarPicker = ({ selectedDate, onSelectDate, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const renderDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day other-month"></div>);
    }

    // Add days of the month
    const today = new Date();
    const selected = selectedDate ? new Date(selectedDate) : null;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = selected && date.toDateString() === selected.toDateString();

      days.push(
        <div
          key={day}
          className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelectDate(date)}
        >
          {day}
        </div>
      );
    }

    return days;
  };

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
    <div className="calendar-popup">
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={handlePrevMonth}>
          ‹
        </button>
        <div className="flex gap-2">
          <select 
            className="calendar-select" 
            value={currentMonth}
            onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
          >
            {monthNames.map((month, idx) => (
              <option key={idx} value={idx}>{month}</option>
            ))}
          </select>
          <select 
            className="calendar-select" 
            value={currentYear}
            onChange={(e) => setCurrentYear(parseInt(e.target.value))}
          >
            {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <button className="calendar-nav-btn" onClick={handleNextMonth}>
          ›
        </button>
      </div>

      <div className="calendar-weekdays">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="calendar-weekday">{day}</div>
        ))}
      </div>

      <div className="calendar-days">
        {renderDays()}
      </div>
    </div>
  );
};

export default Reports;