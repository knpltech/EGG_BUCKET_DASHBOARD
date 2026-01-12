const API_URL = import.meta.env.VITE_API_URL;

import { useState, useEffect } from "react";
import Entryform from "../components/Entryform";
import Rateanalytics from "../components/Rateanalytics";
import Table from "../components/Table";
import Topbar from "../components/Topbar";
import { getRoleFlags } from "../utils/role";

/* ---------- helper: clamp future dates to today ---------- */
const normalizeDate = (dateStr) => {
  if (!dateStr) return dateStr;

  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d > today) {
    return today.toISOString().split("T")[0]; // yyyy-mm-dd
  }
  return dateStr;
};

const Neccrate = () => {
  const { isAdmin, isViewer, isDataAgent } = getRoleFlags();

  const [rows, setRows] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const blockedDates = rows.map((row) => row.date);

  /* ================= FILTER TABLE ================= */

  const getFilteredRows = () => {
    const sortedRows = [...rows].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    if (fromDate && toDate) {
      return sortedRows.filter((row) => {
        const d = new Date(row.date);
        return d >= new Date(fromDate) && d <= new Date(toDate);
      });
    }

    if (fromDate) {
      return sortedRows.filter(
        (row) => new Date(row.date) >= new Date(fromDate)
      );
    }

    if (toDate) {
      return sortedRows.filter(
        (row) => new Date(row.date) <= new Date(toDate)
      );
    }

    return sortedRows;
  };

  const filteredRows = getFilteredRows();

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${API_URL}/neccrate/all`);
        const data = await res.json();

        setRows(
          Array.isArray(data)
            ? data.map((d) => ({
                id: d.id,
                date: normalizeDate(d.date),
                rate: String(d.rate),
                remarks: d.remarks || "",
              }))
            : []
        );
      } catch {
        setRows([]);
      }
    };

    fetchRates();
  }, []);

  /* ================= EDIT HANDLERS ================= */

  const handleEditClick = (row) => {
    if (!isAdmin) return;

    setEditRow(row);
    setEditValues({ rate: row.rate, remarks: row.remarks });
    setEditModalOpen(true);
  };

  const handleEditValueChange = (name, value) => {
    setEditValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditCancel = () => {
    setEditModalOpen(false);
    setEditRow({});
    setEditValues({});
  };

  const handleEditSave = async () => {
    if (!editRow.id) return alert("No ID found");

    try {
      await fetch(`${API_URL}/neccrate/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: normalizeDate(editRow.date),
          rate: editValues.rate,
          remarks: editValues.remarks,
        }),
      });

      const res = await fetch(`${API_URL}/neccrate/all`);
      const data = await res.json();

      setRows(
        Array.isArray(data)
          ? data.map((d) => ({
              id: d.id,
              date: normalizeDate(d.date),
              rate: String(d.rate),
              remarks: d.remarks || "",
            }))
          : []
      );

      handleEditCancel();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ================= ADD ENTRY ================= */

  const addRow = async (newRow) => {
    try {
      await fetch(`${API_URL}/neccrate/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRow,
          date: normalizeDate(newRow.date),
        }),
      });

      const res = await fetch(`${API_URL}/neccrate/all`);
      const data = await res.json();

      setRows(
        Array.isArray(data)
          ? data.map((d) => ({
              id: d.id,
              date: normalizeDate(d.date),
              rate: String(d.rate),
              remarks: d.remarks || "",
            }))
          : []
      );
    } catch (err) {
      alert("Error adding entry");
    }
  };

  /* ================= UI ================= */

  return (
    <div className="bg-eggBg min-h-screen p-6">
      <Topbar />

      {!isViewer && (
        <Entryform addRow={addRow} blockedDates={blockedDates} rows={rows} />
      )}

      {(isAdmin || isViewer || isDataAgent) && (
        <Rateanalytics rows={rows} />
      )}

      {(isAdmin || isViewer || isDataAgent) && (
        <Table
          rows={filteredRows}
          fromDate={fromDate}
          toDate={toDate}
          setFromDate={setFromDate}
          setToDate={setToDate}
          onEdit={isAdmin ? handleEditClick : null}
          showEditColumn={isAdmin}
          allRows={rows}
        />
      )}

      {isAdmin && editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl shadow-lg p-6 min-w-[320px]">
            <h2 className="text-lg font-semibold mb-4">
              Edit NECC Rate ({editRow.date})
            </h2>

            <div className="space-y-3">
              <input
                value={editValues.rate || ""}
                onChange={(e) =>
                  handleEditValueChange("rate", e.target.value)
                }
                className="w-full border px-3 py-2 rounded"
              />
              <input
                value={editValues.remarks || ""}
                onChange={(e) =>
                  handleEditValueChange("remarks", e.target.value)
                }
                className="w-full border px-3 py-2 rounded"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={handleEditCancel}>Cancel</button>
              <button onClick={handleEditSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Neccrate;
