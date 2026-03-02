import React, { useEffect, useState } from "react";
import { getRoleFlags, zonesMatch } from "../utils/role";

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
  try {
    // Also store a zone-indexed map for quick lookup by zone
    const byZone = {};
    (data || []).forEach((s) => {
      const z = s.zoneId || s.zone || "_no_zone";
      byZone[z] = byZone[z] || [];
      byZone[z].push(s);
    });
    localStorage.setItem("supervisors_by_zone", JSON.stringify(byZone));
  } catch (err) {
    // ignore
  }
};

const SupervisorList = () => {
  const [supervisors, setSupervisors] = useState([]);
  const [outlets, setOutlets] = useState([]);

  /* =========================
     LOAD SUPERVISORS FROM API
  ========================= */
  useEffect(() => {
    const fetchData = async () => {
      let fetchedSupervisors = null;
      try {
        const [supRes, outletsRes] = await Promise.all([
          fetch(`${API_URL}/admin/all-supervisors`),
          fetch(`${API_URL}/outlets/all`),
        ]);

        if (supRes.ok) {
          const sdata = await supRes.json();
          if (Array.isArray(sdata) && sdata.length > 0) fetchedSupervisors = sdata;
        }

        if (outletsRes && outletsRes.ok) {
          const odata = await outletsRes.json();
          if (Array.isArray(odata)) {
            setOutlets(odata);
            localStorage.setItem("egg_outlets_v1", JSON.stringify(odata));
          }
        } else {
          // fallback to localStorage for outlets
          const saved = localStorage.getItem("egg_outlets_v1");
          if (saved) {
            try { setOutlets(JSON.parse(saved)); } catch {}
          }
        }
      } catch (err) {
        console.error("Error fetching supervisors/outlets:", err);
      }

      if (fetchedSupervisors) {
        // Merge fetched supervisors with any locally stored supervisors (which may contain passwords)
        const stored = getStoredSupervisors();
        const byUsername = {};
        (fetchedSupervisors || []).forEach((fs) => {
          const key = (fs.username || fs.id || "").toLowerCase();
          byUsername[key] = { ...fs };
        });
        (stored || []).forEach((ls) => {
          const key = (ls.username || ls.id || "").toLowerCase();
          if (byUsername[key]) {
            // merge stored fields into fetched (prefer fetched for backend fields, but keep stored.password)
            byUsername[key] = { ...byUsername[key], ...ls, password: ls.password || byUsername[key].password };
          } else {
            byUsername[key] = ls;
          }
        });

        const merged = Object.values(byUsername);
        setSupervisors(merged);
        setStoredSupervisors(merged);
      } else {
        setSupervisors(getStoredSupervisors());
      }
    };
    fetchData();
    const handleSupUpdate = (e) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setSupervisors(e.detail);
        setStoredSupervisors(e.detail);
      }
    };
    window.addEventListener('egg:supervisors-updated', handleSupUpdate);
    return () => window.removeEventListener('egg:supervisors-updated', handleSupUpdate);
  }, []);

  // helper to get outlets for a zone
  const getOutletsForZone = (zoneId) => {
    if (!zoneId) return [];
    if (!Array.isArray(outlets)) return [];
    return outlets.filter((o) => zonesMatch(o.zoneId || o.zone, zoneId));
  };

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
              {/* Show outlets for supervisor's zone */}
              {((s.zoneId || s.zone) && getOutletsForZone(s.zoneId || s.zone).length > 0) && (
                <div>
                  <p className="font-medium">Outlets in zone:</p>
                  <ul className="text-sm text-gray-600 list-disc list-inside max-h-24 overflow-auto">
                    {getOutletsForZone(s.zoneId || s.zone).map((o) => (
                      <li key={o.id || (o.area || o)}>{o.area || o.name || o.id || o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleDelete(s.id, s.username)}
                className="text-xs px-3 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:opacity-90 transition"
              >
                Delete
              </button>
              {getRoleFlags().isAdmin && s.password && (
                <div className="text-xs px-3 py-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-800">
                  <strong>Password:</strong> {s.password}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupervisorList;
