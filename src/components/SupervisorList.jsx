import React, { useEffect, useState } from "react";

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
     LOAD SUPERVISORS
  ========================= */
  useEffect(() => {
    setSupervisors(getStoredSupervisors());
  }, []);

  /* =========================
     DELETE SUPERVISOR
  ========================= */
  const handleDelete = (id) => {
    if (!window.confirm("Delete this supervisor?")) return;

    const updated = supervisors.filter((s) => s.id !== id);
    setStoredSupervisors(updated);
    setSupervisors(updated);
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
                <span className="font-medium">Role:</span>{" "}
                <span className="text-blue-600 font-medium">
                  Supervisor
                </span>
              </p>
              <p>
                <span className="font-medium">Zone:</span>{" "}
                <span className="text-blue-700">
                  {s.zoneId}
                </span>
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleDelete(s.id)}
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
