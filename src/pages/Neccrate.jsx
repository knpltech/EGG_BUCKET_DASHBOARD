const API_URL = import.meta.env.VITE_API_URL;
import { useState, useEffect } from 'react';
import Entryform from '../components/Entryform'
import Rateanalytics from '../components/Rateanalytics'
import Sidebar from '../components/Sidebar'
import Table from '../components/Table'
import Topbar from '../components/Topbar'

const Neccrate = () => {

  const [rows, setRows] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const blockedDates = rows.map(row => row.date);

  const filteredRows = rows
    .filter((row) => {
      if (!fromDate || !toDate) return true;
      const rowDate = new Date(row.date);
      const from = new Date(fromDate);
      const to = new Date(toDate);
      return rowDate >= from && rowDate <= to;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending (oldest to newest)

  // Fetch NECC rates from backend
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${API_URL}/api/neccrate/all`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch {
        setRows([]);
      }
      setIsLoaded(true);
    };
    fetchRates();
  }, []);

  // Add new entry
  const addRow = async (newRow) => {
    try {
      const response = await fetch(`${API_URL}/api/neccrate/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRow),
      });

      if (!response.ok) {
        console.error('Failed to add NECC rate');
        return;
      }

      // Refetch from backend after adding
      const res = await fetch(`${API_URL}/api/neccrate/all`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error adding NECC rate:', err);
    }
  };

  return (
    <div className='flex'>
      <div className="bg-[#F8F6F2] min-h-screen p-6 w-340">
        <Table rows={filteredRows}
          fromDate={fromDate}
          toDate={toDate}
          setFromDate={setFromDate}
          setToDate={setToDate}/>
        <Rateanalytics/>
        <Entryform addRow={addRow} blockedDates={blockedDates} rows={rows}/>
      </div>
    </div>
  )
}

export default Neccrate