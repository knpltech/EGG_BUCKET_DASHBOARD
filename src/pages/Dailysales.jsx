const API_URL = import.meta.env.VITE_API_URL;
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
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editRow, setEditRow] = useState({});
    const [editValues, setEditValues] = useState({});
    // Fetch daily sales from backend (ensure id is present)
    useEffect(() => {
      const fetchSales = async () => {
        try {
          const res = await fetch(`${API_URL}/dailysales/all`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setRows(data.map(d => ({ id: d.id, ...d })));
          } else if (data.success && Array.isArray(data.data)) {
            setRows(data.data.map(d => ({ id: d.id, ...d })));
          } else {
            setRows([]);
          }
        } catch (err) {
          setRows([]);
        }
        setIsLoaded(true);
      };
      fetchSales();
    }, []);
    // Open modal and set values for editing
    const handleEditClick = (row) => {
      const fullRow = { ...row };
      if (!row.id) {
        const found = rows.find(r => r.date === row.date);
        if (found && found.id) fullRow.id = found.id;
      }
      setEditRow(fullRow);
      setEditValues({ ...row.outlets });
      setEditModalOpen(true);
    };

    // Handle value change in modal
    const handleEditValueChange = (name, value) => {
      setEditValues((prev) => ({ ...prev, [name]: Number(value) }));
    };

    // Cancel edit
    const handleEditCancel = () => {
      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    };

    // Save edit
    const handleEditSave = async () => {
      if (!editRow.id) {
        alert("No ID found for entry. Cannot update.");
        return;
      }
      const updatedOutlets = { ...editValues };
      const total = Object.values(updatedOutlets).reduce((s, v) => s + (Number(v) || 0), 0);
      try {
        const response = await fetch(`${API_URL}/dailysales/${editRow.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: editRow.date, outlets: updatedOutlets, total }),
        });
        if (!response.ok) {
          alert("Failed to update entry: " + response.status);
          return;
        }
        // Refetch sales after update
        const res = await fetch(`${API_URL}/dailysales/all`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setRows(data.map(d => ({ id: d.id, ...d })));
        } else if (data.success && Array.isArray(data.data)) {
          setRows(data.data.map(d => ({ id: d.id, ...d })));
        } else {
          setRows([]);
        }
        setEditModalOpen(false);
        setEditRow({});
        setEditValues({});
      } catch (err) {
        alert("Error updating entry: " + err.message);
      }
    };
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
  

  // ✅ FIX: Fetch daily sales from backend with correct path
  useEffect(() => {
    const fetchSales = async () => {
      try {
        // ✅ FIXED: Added /api prefix to match backend route
        const res = await fetch(`${API_URL}/dailysales/all`);
        const data = await res.json();
        
        // ✅ Handle both response formats
        if (data.success && Array.isArray(data.data)) {
          setRows(data.data);
        } else if (Array.isArray(data)) {
          setRows(data);
        } else {
          setRows([]);
        }
      } catch (err) {
        console.error('Error fetching sales:', err);
        setRows([]);
      }
      setIsLoaded(true);
    };
    fetchSales();
  }, []);

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

  const addrow = async (newrow) => {
  try {
    const response = await fetch(`${API_URL}/dailysales/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newrow),
    });
    
    if (!response.ok) {
      console.error('Failed to add sales');
      return;
    }
    
    // Refetch from backend after adding
    const res = await fetch(`${API_URL}/dailysales/all`);
    const data = await res.json();
    
    if (data.success && Array.isArray(data.data)) {
      setRows(data.data);
    } else if (Array.isArray(data)) {
      setRows(data);
    } else {
      setRows([]);
    }
  } catch (err) {
    console.error('Error adding sales:', err);
  }
};

  // Sort rows by date ascending (oldest to newest)
  // Only show last 10 days
    // Always show the latest 6 entries, regardless of date
    const sortedRows = [...rows]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-6);

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
      <DailyTable rows={sortedRows} outlets={outlets} onEdit={handleEditClick}/>
      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl shadow-lg p-6 min-w-[320px] max-w-full">
            <h2 className="text-lg font-semibold mb-4">Edit Daily Sales ({editRow.date})</h2>
            <div className="space-y-3">
              {outlets.map((o) => {
                const area = o.area || o;
                return (
                  <div key={area} className="flex items-center gap-2">
                    <label className="w-32 text-xs font-medium text-gray-700">{area}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editValues[area] ?? 0}
                      onChange={e => handleEditValueChange(area, e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={handleEditCancel}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300"
              >Cancel</button>
              <button
                onClick={handleEditSave}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600"
              >Save</button>
            </div>
          </div>
        </div>
      )}
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