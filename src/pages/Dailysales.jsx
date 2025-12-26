import React from 'react'
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

const STORAGE_KEY = "egg_outlets_v1";

const Dailysales = () => {

  const [rows,setRows]=useState([]);
  const [isLoaded, setIsLoaded]= useState(false);
  const [outlets, setOutlets] = useState(DEFAULT_OUTLETS);
  
  useEffect(()=>{
    const loadOutletsFromLocal = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedOutlets = JSON.parse(saved);
        const outletAreas = savedOutlets.map((o) => o.area);
        const required = DEFAULT_OUTLETS;
        const hasAllRequired = required.every((r) => outletAreas.includes(r));
        setOutlets(hasAllRequired ? outletAreas : DEFAULT_OUTLETS);
      } else {
        setOutlets(DEFAULT_OUTLETS);
      }
    };

    loadOutletsFromLocal();

    const onUpdate = (e) => {
      const areas = (e && e.detail) || null;
      if (Array.isArray(areas)) {
        setOutlets(areas);
      } else {
        loadOutletsFromLocal();
      }
    };

    window.addEventListener('egg:outlets-updated', onUpdate);

    const onStorage = (evt) => {
      if (evt.key === STORAGE_KEY) onUpdate();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('egg:outlets-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  
  useEffect(()=>{
    const savedDate= localStorage.getItem("dailySales");
    if(savedDate){
      setRows(JSON.parse(savedDate));
    }
    setIsLoaded(true);
  },[]);

  useEffect(()=>{
    if(isLoaded){
      localStorage.setItem("dailySales", JSON.stringify(rows))
    }
  },[rows,isLoaded]);

  const blockeddates=rows.map(row=> row.date);

  const addrow=(newrow)=>{
    setRows(prev => [newrow, ...prev]);
  }

  return (
    <div className='flex'>
      <div className='bg-[#F8F6F2] min-h-screen p-6 w-340'>

      <Topbar/>
      <Dailyheader/>
      <DailyTable rows={rows} outlets={outlets}/>
      <div className="grid grid-cols-3 gap-6 mt-10">

        {/* Entry Form (biggest block) */}
        <div className="col-span-2">
          <Dailyentryform addrow={addrow} blockeddates={blockeddates} rows={rows} outlets={outlets}/>
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
