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


  // Load data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("neccRates");
    if (savedData) {
      setRows(JSON.parse(savedData));
    }
    setIsLoaded(true);
  }, []);

  // Save data to localStorage whenever rows change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("neccRates", JSON.stringify(rows));
    }
  }, [rows,isLoaded]);

  // Add new entry
  const addRow = (newRow) => {
    setRows([newRow, ...rows]); // latest entry on top
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
