const API_URL = import.meta.env.VITE_API_URL;
import { useState, useEffect } from 'react';
import Entryform from '../components/Entryform'
import Rateanalytics from '../components/Rateanalytics'
import Sidebar from '../components/Sidebar'
import Table from '../components/Table'
import Topbar from '../components/Topbar'

const Neccrate = () => {

  // ...existing code...
  const [rows, setRows] = useState([]);
  // Wire up edit callback for Table
  useEffect(() => {
    window.onNeccEdit = handleEditClick;
    return () => { window.onNeccEdit = undefined; };
  }, [rows]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const blockedDates = rows.map(row => row.date);

  // Always show the latest 10 entries, regardless of date
  const filteredRows = [...rows]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-6);

  // Fetch NECC rates from backend
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${API_URL}/neccrate/all`);
        const data = await res.json();
        // Always include id in rows
        setRows(Array.isArray(data) ? data.map(d => ({ id: d.id, ...d })) : []);
      } catch {
        setRows([]);
      }
      setIsLoaded(true);
    };
    fetchRates();
  }, []);
  // Open modal and set values for editing
  const handleEditClick = (row) => {
    const fullRow = { ...row };
    if (!row.id) {
      const found = rows.find(r => r.date === row.date);
      if (found && found.id) fullRow.id = found.id;
    }
    setEditRow(fullRow);
    setEditValues({ rate: row.rate, remarks: row.remarks });
    setEditModalOpen(true);
  };

  // Handle value change in modal
  const handleEditValueChange = (name, value) => {
    setEditValues((prev) => ({ ...prev, [name]: value }));
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
    try {
      const response = await fetch(`${API_URL}/neccrate/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editRow.date, rate: editValues.rate, remarks: editValues.remarks }),
      });
      if (!response.ok) {
        alert("Failed to update entry: " + response.status);
        return;
      }
      // Refetch rates after update
      const res = await fetch(`${API_URL}/neccrate/all`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map(d => ({ id: d.id, ...d })) : []);
      setEditModalOpen(false);
      setEditRow({});
      setEditValues({});
    } catch (err) {
      alert("Error updating entry: " + err.message);
    }
  };

  // Add new entry
  const addRow = async (newRow) => {
    try {
      const response = await fetch(`${API_URL}/neccrate/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRow),
      });

      if (!response.ok) {
        console.error('Failed to add NECC rate');
        return;
      }

      // Refetch from backend after adding
      const res = await fetch(`${API_URL}/neccrate/all`);
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
          setToDate={setToDate}
          onEdit={handleEditClick}
        />
        <Rateanalytics/>
        <Entryform addRow={addRow} blockedDates={blockedDates} rows={rows}/>
        {/* Edit Modal */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-xl shadow-lg p-6 min-w-[320px] max-w-full">
              <h2 className="text-lg font-semibold mb-4">Edit NECC Rate ({editRow.date})</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="w-32 text-xs font-medium text-gray-700">Rate</label>
                  <input
                    type="text"
                    value={editValues.rate || ""}
                    onChange={e => handleEditValueChange("rate", e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-32 text-xs font-medium text-gray-700">Remarks</label>
                  <input
                    type="text"
                    value={editValues.remarks || ""}
                    onChange={e => handleEditValueChange("remarks", e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
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
      </div>
    </div>
  )
}

export default Neccrate