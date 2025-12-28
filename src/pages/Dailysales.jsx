import React from 'react'
import * as XLSX from 'xlsx';
import Topbar from '../components/Topbar'
import Dailyheader from '../components/Dailyheader'
import DailyTable from '../components/DailyTable'
import Dailyentryform from '../components/Dailyentryform'
import Weeklytrend from '../components/Weeklytrend'
import Sidebar from '../components/Sidebar'
import { useState, useEffect } from 'react';

const DEFAULT_OUTLETS = [
  "AECS Layout",
  "Bandepalya",
  "Hosa Road",
  "Singasandra",
  "Kudlu Gate",
];

const SAMPLE_OUTLETS = [
  {
    id: "OUT-001",
    name: "Sunrise Bakery",
    area: "AECS Layout",
    contact: "Rajesh Kumar",
    phone: "+91 98765 43210",
    status: "Active",
    reviewStatus: "ok",
  },
  {
    id: "OUT-002",
    name: "City Mart Supermarket",
    area: "Bandepalya",
    contact: "Anita Roy",
    phone: "+91 91234 56789",
    status: "Active",
    reviewStatus: "ok",
  },
  {
    id: "OUT-003",
    name: "Hosa Road Bakers",
    area: "Hosa Road",
    contact: "Manish Patel",
    phone: "+91 99887 66554",
    status: "Active",
    reviewStatus: "ok",
  },
  {
    id: "OUT-004",
    name: "Singasandra Grocers",
    area: "Singasandra",
    contact: "Deepa Rao",
    phone: "+91 88776 55443",
    status: "Active",
    reviewStatus: "ok",
  },
  {
    id: "OUT-005",
    name: "Kudlu Gate Store",
    area: "Kudlu Gate",
    contact: "Vijay Kumar",
    phone: "+91 77665 44332",
    status: "Active",
    reviewStatus: "ok",
  },
];

const Dailysales = () => {
  const STORAGE_KEY = "dailySales_v2";
  const OUTLETS_KEY = "egg_outlets_v1";

  const [rows,setRows]=useState([]);
  const [isLoaded, setIsLoaded]= useState(false);
  const [outlets, setOutlets] = useState(DEFAULT_OUTLETS);
  
  useEffect(()=>{
    const loadOutletsFromLocal = () => {
      const saved = localStorage.getItem(OUTLETS_KEY);
      if (saved) {
        const savedOutlets = JSON.parse(saved);
        const required = DEFAULT_OUTLETS;
        const hasAllRequired = required.every((r) => savedOutlets.some(o => o.area === r));
        setOutlets(hasAllRequired ? savedOutlets : 
          // If not all required, mix with defaults
          savedOutlets.concat(
            SAMPLE_OUTLETS.filter(s => !savedOutlets.some(o => o.area === s.area))
          )
        );
      } else {
        setOutlets(SAMPLE_OUTLETS);
      }
    };

    loadOutletsFromLocal();

    const onUpdate = (e) => {
      const outlets = (e && e.detail && Array.isArray(e.detail)) ? e.detail : null;
      if (outlets) {
        setOutlets(outlets);
      } else {
        loadOutletsFromLocal();
      }
    };

    window.addEventListener('egg:outlets-updated', onUpdate);

    const onStorage = (evt) => {
      if (evt.key === OUTLETS_KEY) onUpdate();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('egg:outlets-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  
  useEffect(()=>{
    const savedDate= localStorage.getItem(STORAGE_KEY);
    if(savedDate){
      setRows(JSON.parse(savedDate));
    }
    setIsLoaded(true);
  },[]);

  useEffect(()=>{
    if(isLoaded){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
    }
  },[rows,isLoaded]);

  // If outlets change, remap existing rows to include all current outlets
  useEffect(() => {
    if (!Array.isArray(outlets) || outlets.length === 0) return;
    
    setRows((prevRows) =>
      prevRows.map((r) => {
        const newOutlets = {};
        outlets.forEach((outletObj) => {
          const area = outletObj.area || outletObj;
          newOutlets[area] = (r.outlets && r.outlets[area]) || 0;
        });
        const total = Object.values(newOutlets).reduce((s, v) => s + (Number(v) || 0), 0);
        return { ...r, outlets: newOutlets, total };
      })
    );
  }, [outlets]);

  const blockeddates = rows
  .filter(r => r.locked)
  .map(r => r.date);

  const addrow=(newrow)=>{
    setRows(prev => {
      // Prevent duplicate date entries
      if (prev.some(r => r.date === newrow.date)) {
        alert('');
        return prev;
      }
      return [newrow, ...prev];
    });
  }

  // Sort rows by date ascending (oldest to newest)
  const sortedRows = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Download as Excel (robust for both possible row structures)
  const handleDownload = () => {
    if (!sortedRows.length) {
      alert('No data to export!');
      return;
    }
    // Try to handle both {date, outlets, total} and flat {date, ...outlet, total}
    const data = sortedRows.map(row => {
      const obj = { Date: row.date };
      if (row.outlets && typeof row.outlets === 'object') {
        outlets.forEach(o => {
          const area = o.area || o;
          obj[area] = row.outlets[area] ?? 0;
        });
      } else {
        outlets.forEach(o => {
          const area = o.area || o;
          obj[area] = row[area] ?? 0;
        });
      }
      obj.Total = row.total ?? row.Total ?? 0;
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Sales');
    XLSX.writeFile(wb, 'Daily_Sales_Report.xlsx');
  };

  return (
    <div className='flex'>
      <div className='bg-[#F8F6F2] min-h-screen p-6 w-340'>

      <Topbar/>
      <Dailyheader dailySalesData={rows}/>
      <DailyTable rows={rows} outlets={outlets}/>
      <div className="grid grid-cols-3 gap-6 mt-10">

        {/* Entry Form (biggest block) */}
        <div className="col-span-2">
          <Dailyentryform addrow={addrow} blockeddates={blockeddates} rows={sortedRows} outlets={outlets}/>
        </div>

        <div className="flex flex-col">
          {/* Weekly Trend */}
          <Weeklytrend />
        </div>

      </div>
    </div>
    </div>
  )
}

export default Dailysales
