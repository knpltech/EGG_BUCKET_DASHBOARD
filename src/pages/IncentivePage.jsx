const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";
import * as XLSX from "xlsx";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";

const Incentive = () => {

  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  const showTable = isAdmin || isViewer || isDataAgent || isSupervisor;

  const [rows,setRows] = useState([]);
  const [outlets,setOutlets] = useState([]);
  const [outletLoading,setOutletLoading] = useState(true);

  const formOutlets = useMemo(() => {
    let list = outlets;
    if (!isViewer && !isAdmin && zone && Array.isArray(list)) {
      list = list.filter(o => typeof o === 'object' && zonesMatch(o.zoneId, zone));
    }
    return list;
  }, [outlets, isAdmin, isViewer, zone]);

  const displayedOutlets = isSupervisor ? formOutlets : outlets;

  const [fromDate,setFromDate] = useState("");
  const [toDate,setToDate] = useState("");

  /* ================= EDIT ================= */

const [editModalOpen,setEditModalOpen] = useState(false);
const [editRow,setEditRow] = useState({});
const [editValues,setEditValues] = useState({});

  /* ================= FETCH INCENTIVES ================= */

  const fetchIncentives = useCallback(async()=>{

    try{

      const res = await fetch(`${API_URL}/incentive/all`);

      if(!res.ok) {
        setRows([]);
        return;
      }

      const data = await res.json();

      if(Array.isArray(data)){
        setRows(data.map(d=>({id:d.id,...d})));
      }else{
        setRows([]);
      }

    }catch(err){
      console.error("Error fetching incentive:",err);
      setRows([]);
    }

  },[]);

  /* ================= EDIT CLICK ================= */

const handleEditClick = (row)=>{

  if(!isAdmin) return;

  const values = {};

  outlets.forEach(o=>{
    const area = o.area || o;
    values[area] = row.outlets?.[area] ?? "";
  });

  setEditRow(row);
  setEditValues(values);
  setEditModalOpen(true);

};

/* ================= SAVE EDIT ================= */

const handleEditSave = async()=>{

  if(!editRow.id){
    alert("No ID found");
    return;
  }

  const numericOutlets = {};

  Object.entries(editValues).forEach(([k,v])=>{
    numericOutlets[k] = Number(v) || 0;
  });

  const total = Object.values(numericOutlets).reduce((s,v)=>s+v,0);

  try{

    const res = await fetch(`${API_URL}/incentive/${editRow.id}`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        date:editRow.date,
        outlets:numericOutlets,
        total
      })
    });

    if(!res.ok){
      alert("Update failed");
      return;
    }

    setRows(prev =>
      prev.map(r =>
        r.id === editRow.id
          ? {...r,outlets:numericOutlets,total}
          : r
      )
    );

    setEditModalOpen(false);

  }catch(err){
    alert("Error updating incentive");
  }

};

  useEffect(()=>{
    fetchIncentives();
    const interval = setInterval(fetchIncentives,30000);
    return ()=>clearInterval(interval);
  },[fetchIncentives]);

  /* ================= LOAD OUTLETS ================= */

  const loadOutlets = useCallback(async()=>{

    setOutletLoading(true);

    try{

      const res = await fetch(`${API_URL}/outlets/all`);
      const data = await res.json();

      if(Array.isArray(data)) setOutlets(data);
      else setOutlets([]);

    }catch(err){
      setOutlets([]);
    }finally{
      setOutletLoading(false);
    }

  },[]);

  useEffect(()=>{
    loadOutlets();
  },[]);

  /* ================= FILTER ================= */

  const filteredRows = useMemo(()=>{

    const sorted = [...rows].sort((a,b)=> new Date(a.date)-new Date(b.date));

    if(fromDate && toDate){
      return sorted.filter(r=>{
        const d=new Date(r.date);
        return d>=new Date(fromDate) && d<=new Date(toDate);
      });
    }

    if(fromDate) return sorted.filter(r=>new Date(r.date)>=new Date(fromDate));
    if(toDate) return sorted.filter(r=>new Date(r.date)<=new Date(toDate));

    return sorted;

  },[rows,fromDate,toDate]);

  /* ================= EXPORT ================= */

  const handleDownload = ()=>{

    if (!filteredRows.length) {
      alert("No data available");
      return;
    }

    const data = filteredRows.map(row=>{

      const obj = { Date: row.date };

      displayedOutlets.forEach(o=>{
        const area = o.area || o;
        obj[area] = Number(row.outlets?.[area] ?? 0);
      });

      obj.Total = displayedOutlets.reduce((sum, o) => {
        const area = o.area || o;
        return sum + Number(row.outlets?.[area] ?? 0);
      }, 0);

      return obj;

    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb,ws,"Incentive");

    XLSX.writeFile(wb,"Incentive_Report.xlsx");

  };

  /* ================= LOADING ================= */

  if(outletLoading){
    return(
      <div className="flex">
        <div className="bg-eggBg min-h-screen p-6 w-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff7518] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading outlets...</p>
          </div>
        </div>
      </div>
    )
  }

  return(

    <div className="flex">

      <div className="bg-eggBg min-h-screen p-6 w-full">

        <Topbar/>

        {showTable && (
          <>
            <Dailyheader
              title={"Incentive Entry"}
              subtitle={"Manage and track daily incentive entries across all outlets."}
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
              outlets={displayedOutlets.map(o=> typeof o==="string" ? o : o.id)}
              allOutlets={outlets}
              onEdit={isAdmin ? handleEditClick : null}
            />
          </>
        )}

        {isAdmin && editModalOpen && (

            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">

            <div className="bg-white rounded-xl p-6 min-w-[320px] max-h-[80vh] overflow-y-auto">

            <h2 className="font-semibold mb-4 text-lg">
            Edit Incentive ({editRow.date})
            </h2>

            <div className="space-y-3">

            {outlets.map(o=>{

            const area = o.area || o;

            return(

            <div key={area} className="flex items-center gap-2">

            <label className="w-32 text-xs font-medium text-gray-700">
            {area}
            </label>

            <input
            type="number"
            value={editValues[area] ?? ""}
            onChange={(e)=>setEditValues(p=>({...p,[area]:e.target.value}))}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs"
            />

            </div>

            )

            })}

            </div>

            <div className="flex justify-end gap-2 mt-6">

            <button
            onClick={()=>setEditModalOpen(false)}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs"
            >
            Cancel
            </button>

            <button
            onClick={handleEditSave}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs"
            >
            Save
            </button>

            </div>

            </div>

            </div>

            )}

      </div>

    </div>

  )

};

export default Incentive;