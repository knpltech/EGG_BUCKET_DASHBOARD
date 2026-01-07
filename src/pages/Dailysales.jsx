const API_URL = import.meta.env.VITE_API_URL;

import React, { useState, useEffect } from "react";
import { getRoleFlags } from "../utils/role";
import * as XLSX from "xlsx";

import Topbar from "../components/Topbar";
import Dailyheader from "../components/Dailyheader";
import DailyTable from "../components/DailyTable";
import Dailyentryform from "../components/Dailyentryform";
import Weeklytrend from "../components/Weeklytrend";

const DEFAULT_OUTLETS = [
  "AECS Layout",
  "Bandepalya",
  "Hosa Road",
  "Singasandra",
  "Kudlu Gate",
];

const SAMPLE_OUTLETS = [
  { area: "AECS Layout" },
  { area: "Bandepalya" },
  { area: "Hosa Road" },
  { area: "Singasandra" },
  { area: "Kudlu Gate" },
];

const OUTLETS_KEY = "egg_outlets_v1";

const Dailysales = () => {
  const { isAdmin, isViewer, isDataAgent } = getRoleFlags();

  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState(DEFAULT_OUTLETS);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState({});
  const [editValues, setEditValues] = useState({});

  /* ================= FETCH SALES ================= */
  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await fetch(`${API_URL}/dailysales/all`);
        const data = await res.json();

        if (Array.isArray(data)) {
          setRows(data);
        } else if (data.success && Array.isArray(data.data)) {
          setRows(data.data);
        } else {
          setRows([]);
        }
      } catch {
        setRows([]);
      }
    };
    fetchSales();
  }, []);

  /* ================= OUTLETS ================= */
  useEffect(() => {
    const loadOutlets = () => {
      const saved = localStorage.getItem(OUTLETS_KEY);
      if (saved) {
        try {
          setOutlets(JSON.parse(saved));
        } catch {
          setOutlets(SAMPLE_OUTLETS);
        }
      } else {
        setOutlets(SAMPLE_OUTLETS);
      }
    };

    loadOutlets();
    window.addEventListener("egg:outlets-updated", loadOutlets);
    window.addEventListener("storage", loadOutlets);

    return () => {
      window.removeEventListener("egg:outlets-updated", loadOutlets);
      window.removeEventListener("storage", loadOutlets);
    };
  }, []);

  /* ================= EDIT (ADMIN ONLY) ================= */
  const handleEditClick = (row) => {
    if (!isAdmin) return;
    setEditRow(row);
    setEditValues({ ...row.outlets });
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    const updatedOutlets = { ...editValues };
    const total = Object.values(updatedOutlets).reduce(
      (s, v) => s + (Number(v) || 0),
      0
    );

    await fetch(`${API_URL}/dailysales/${editRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: editRow.date,
        outlets: updatedOutlets,
        total,
      }),
    });

    setEditModalOpen(false);
  };

  /* ================= ADD ROW ================= */
  const addrow = async (newrow) => {
    await fetch(`${API_URL}/dailysales/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newrow),
    });

    const res = await fetch(`${API_URL}/dailysales/all`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : data.data || []);
  };

  /* ================= SORT ================= */
  const sortedRows = [...rows]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-6);

  /* ================= DOWNLOAD ================= */
  const handleDownload = () => {
    const data = sortedRows.map((row) => {
      const obj = { Date: row.date };
      outlets.forEach((o) => {
        const area = o.area || o;
        obj[area] = row.outlets?.[area] ?? 0;
      });
      obj.Total = row.total || 0;
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Sales");
    XLSX.writeFile(wb, "Daily_Sales_Report.xlsx");
  };

  return (
    <div className="flex">
      <div className="bg-eggBg min-h-screen p-6 w-full">

        <Topbar />

        {/* ================= HEADER ================= */}
        {(isAdmin || isViewer || isDataAgent) && <Dailyheader dailySalesData={rows} />}

        {/* ================= TABLE (ADMIN + VIEWER + DATA AGENT) ================= */}
        {(isAdmin || isViewer || isDataAgent) && (
          <DailyTable
            rows={sortedRows}
            outlets={outlets}
            onEdit={isAdmin ? handleEditClick : null}
          />
        )}

        {/* ================= EDIT MODAL (ADMIN ONLY) ================= */}
        {isAdmin && editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-xl p-6">
              <h2 className="font-semibold mb-4">
                Edit Daily Sales ({editRow.date})
              </h2>

              {outlets.map((o) => {
                const area = o.area || o;
                return (
                  <input
                    key={area}
                    type="number"
                    value={editValues[area] ?? 0}
                    onChange={(e) =>
                      setEditValues((p) => ({
                        ...p,
                        [area]: Number(e.target.value),
                      }))
                    }
                    className="block mb-2 border p-2 w-full"
                  />
                );
              })}

              <button
                onClick={handleEditSave}
                className="mt-4 bg-orange-500 text-white px-4 py-2 rounded"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* ================= ENTRY FORM (ADMIN + DATA AGENT) ================= */}
        {!isViewer && (
          <div className="mt-10">
            <Dailyentryform
              addrow={addrow}
              blockeddates={rows.filter((r) => r.locked).map((r) => r.date)}
              rows={sortedRows}
              outlets={outlets}
            />
          </div>
        )}

        {/* ================= WEEKLY TREND (ADMIN ONLY) ================= */}
        {isAdmin && (
          <div className="mt-10">
            <Weeklytrend />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dailysales;