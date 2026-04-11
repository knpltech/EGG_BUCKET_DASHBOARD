const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";
import { getThisWeekRange } from "../utils/dateRange";
import * as XLSX from "xlsx";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";

const Incentive = () => {

  const { isAdmin, isViewer, isDataAgent, isSupervisor, zone } = getRoleFlags();
  const defaultWeekRange = useMemo(() => getThisWeekRange(), []);
  const showTable = isAdmin || isViewer || isDataAgent || isSupervisor;
  const isReadOnly = isViewer;

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

  const [fromDate,setFromDate] = useState(defaultWeekRange.from);
  const [toDate,setToDate] = useState(defaultWeekRange.to);

  /* ================= EDIT ================= */

const [editModalOpen,setEditModalOpen] = useState(false);
const [editRow,setEditRow] = useState({});
const [editValues,setEditValues] = useState({});
const [isEditSaving,setIsEditSaving] = useState(false);

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

  if(!isAdmin || isReadOnly) return;

  const values = {};

  outlets.forEach(o=>{
    const area = o.area || o;
    values[area] = row.outlets?.[area] ?? "";
  });

  setEditRow(row);
  setEditValues(values);
  setEditModalOpen(true);

};

const handleEditCancel = ()=>{
  setEditModalOpen(false);
  setEditRow({});
  setEditValues({});
  setIsEditSaving(false);
};

const editTotal = useMemo(()=>Object.values(editValues).reduce((sum,value)=>sum + (Number(value) || 0),0),[editValues]);

/* ================= SAVE EDIT ================= */

const handleEditSave = async()=>{
  if (!isAdmin || isReadOnly) return;
  if(isEditSaving) return;

  if(!editRow.id){
    alert("No ID found");
    return;
  }

  const numericOutlets = {};

  Object.entries(editValues).forEach(([k,v])=>{
    numericOutlets[k] = Number(v) || 0;
  });

  const total = Object.values(numericOutlets).reduce((s,v)=>s+v,0);

  setIsEditSaving(true);
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

    handleEditCancel();

  }catch(err){
    alert("Error updating incentive");
  }finally{
    setIsEditSaving(false);
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
              subtitle={isReadOnly ? "View daily incentive entries." : "Manage and track daily incentive entries."}
              dailySalesData={filteredRows}
              fromDate={fromDate}
              toDate={toDate}
              setFromDate={setFromDate}
              setToDate={setToDate}
              allRows={rows}
              onExport={handleDownload}
            />

            {isReadOnly && (
              <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                Viewer access is read-only on this page. Editing incentive values is disabled.
              </div>
            )}

            <DailyTable
              rows={filteredRows}
              outlets={displayedOutlets.map(o=> typeof o==="string" ? o : o.id)}
              allOutlets={outlets}
              onEdit={isAdmin && !isReadOnly ? handleEditClick : null}
            />
          </>
        )}

        {isAdmin && !isReadOnly && editModalOpen && (

            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">

            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">

            <h2 className="font-semibold mb-4 text-lg">
            Edit Incentive ({editRow.date})
            </h2>

            <div className="space-y-3">

            {outlets.map(o=>{

            const area = o.area || o;

            return(

            <div key={area} className="flex flex-col sm:flex-row sm:items-center gap-2">

            <label className="w-full sm:w-32 text-xs font-medium text-gray-700">
            {typeof o === "string" ? o : (o.area || o.name || o.id || area)}
            </label>

            <input
            type="number"
            min="0"
            step="any"
            value={editValues[area] ?? ""}
            onChange={(e)=>setEditValues(p=>({...p,[area]:e.target.value}))}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />

            </div>

            )

            })}

            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-xs font-semibold text-gray-600">Total</span>
            <span className="text-sm font-bold text-orange-600">{editTotal.toLocaleString("en-IN")}</span>
            </div>

            <div className="flex justify-end gap-2 mt-6">

            <button
            onClick={handleEditCancel}
            disabled={isEditSaving}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
            Cancel
            </button>

            <button
            onClick={handleEditSave}
            disabled={isEditSaving}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
            >
            {isEditSaving ? (
            <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Saving...
            </>
            ) : "Save"}
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
