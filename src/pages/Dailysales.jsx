import React from 'react'
import Topbar from '../components/Topbar'
import Dailyheader from '../components/Dailyheader'
import DailyTable from '../components/DailyTable'
import Dailyentryform from '../components/Dailyentryform'
import Weeklytrend from '../components/Weeklytrend'
import Sidebar from '../components/Sidebar'
import { useState, useEffect } from 'react';

const Dailysales = () => {

  const [rows,setRows]=useState([]);
  const [isLoaded, setIsLoaded]= useState(false);
  
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
      <Dailyheader dailySalesData={rows}/>
      <DailyTable rows={rows}/>
      <div className="grid grid-cols-3 gap-6 mt-10">

        {/* Entry Form (biggest block) */}
        <div className="col-span-2">
          <Dailyentryform addrow={addrow} blockeddates={blockeddates}/>
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
