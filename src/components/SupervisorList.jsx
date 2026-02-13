import React, { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

/* =========================
   LOCAL STORAGE HELPERS
========================= */
const getStoredSupervisors = () => {
  try {
    return JSON.parse(localStorage.getItem("supervisors")) || [];
  } catch {
    return [];
  }
};

const setStoredSupervisors = (data) => {
  localStorage.setItem("supervisors", JSON.stringify(data));
};

const SupervisorList = () => {
  const [supervisors, setSupervisors] = useState([]);

  /* =========================
     LOAD SUPERVISORS FROM API
  ========================= */
  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/all-supervisors`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setSupervisors(data);
            setStoredSupervisors(data);
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching supervisors:", err);
      }
      // Fallback to localStorage
      setSupervisors(getStoredSupervisors());
    };
    fetchSupervisors();
  }, []);

  /* =========================
     DELETE SUPERVISOR
  ========================= */
  const handleDelete = async (id, username) => {
    if (!window.confirm("Delete this supervisor?")) return;

    try {
      const res = await fetch(`${API_URL}/admin/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, collection: 'supervisors' }),
      });
      
      if (res.ok) {
        const updated = supervisors.filter((s) => s.id !== id);
        setStoredSupervisors(updated);
        setSupervisors(updated);
      } else {
        console.error('Failed to delete supervisor');
      }
    } catch (err) {
      console.error('Error deleting supervisor:', err);
    }
  };

  if (supervisors.length === 0) {
    return (
      <div className="bg-white shadow rounded-xl p-6 text-center text-gray-500">
        No supervisors created yet.
      </div>
    );
  }

  return (
    <div className="mt-8 mb-10">
      <h2 className="text-xl font-semibold mb-4 text-blue-700">
        Supervisors
      </h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {supervisors.map((s) => (
          <div
            key={s.id}
            className="bg-white shadow rounded-xl p-5 border hover:shadow-md transition"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              {s.fullName || "Supervisor"}
            </h3>

            <p className="text-sm text-gray-500 mb-2">
              @{s.username}
            </p>

            <div className="text-sm text-gray-700 space-y-1">
              <p>
                <span className="font-medium">Phone:</span>{" "}
                <span>{s.phone || "-"}</span>
              </p>
              <p>
                <span className="font-medium">Role:</span>{" "}
                <span className="text-blue-600 font-medium">
                  {s.role || "Supervisor"}
                </span>
              </p>
              {(s.zoneId || s.zone) && (
                <p>
                  <span className="font-medium">Zone:</span>{" "}
                  <span className="text-blue-700">
                    {s.zoneId || s.zone}
                  </span>
                </p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleDelete(s.id, s.username)}
                className="text-xs px-3 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:opacity-90 transition"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupervisorList;
