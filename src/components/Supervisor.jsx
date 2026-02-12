import React, { useEffect, useMemo, useState } from "react";
import {
  faLayerGroup,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

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

const Supervisor = () => {
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    zone: "",
  });

  const zones = ["Zone 1", "Zone 2", "Zone 3","Zone 4","Zone 5"];
  const [existingSupervisors, setExistingSupervisors] = useState([]);

  /* =========================
     LOAD EXISTING SUPERVISORS
  ========================= */
  useEffect(() => {
    setExistingSupervisors(getStoredSupervisors());
  }, []);

  /* =========================
     OCCUPIED ZONES
  ========================= */
  const occupiedZones = useMemo(() => {
    return existingSupervisors.map((s) => s.zoneId);
  }, [existingSupervisors]);

  /* =========================
     SUBMIT HANDLER
  ========================= */
  const handleSubmit = () => {
    if (!form.username || !form.password || !form.zone) {
      alert("All fields are required");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    // Convert zone string (e.g. 'Zone 2') to number 2 for storage
    const zoneNum = parseInt(form.zone.replace(/[^0-9]/g, ""), 10);

    // POST to backend
    fetch("/api/supervisor/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username.trim(),
        password: form.password,
        zone: zoneNum
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Store supervisor in localStorage with numeric zone
          const supervisors = getStoredSupervisors();
          supervisors.push({ username: form.username.trim(), zone: zoneNum });
          setStoredSupervisors(supervisors);
          alert("Supervisor created successfully");
          setForm({
            username: "",
            password: "",
            confirmPassword: "",
            zone: "",
          });
        } else {
          alert(data.error || "Failed to create supervisor");
        }
      })
      .catch(() => alert("Failed to create supervisor"));
  };

  return (
    <div className="px-4 pt-6 max-w-[1200px] mx-auto w-full">

      {/* PAGE HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Create Supervisor
        </h1>
        <p className="text-gray-600 mb-8">
          Add one supervisor per zone. Each zone can have only one supervisor.
        </p>
      </div>

      {/* FORM CARD */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">

        {/* SECTION HEADER */}
        <div className="px-6 py-6 rounded-t-2xl">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FontAwesomeIcon icon={faUser} />
            Supervisor Account Details
          </h2>
        </div>

        {/* FORM BODY */}
        <div className="p-6 space-y-6">

          {/* USERNAME */}
          <div>
            <label className="text-sm text-gray-600 font-medium">
              Username
            </label>
            <input
              type="text"
              placeholder="Enter supervisor username"
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
              className="w-full mt-1 p-3 rounded-lg border focus:ring-2 focus:ring-blue-400 outline-none"
            />
          </div>

          {/* PASSWORDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-600 font-medium">
                Password
              </label>
              <input
                type="password"
                placeholder="Create password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                className="w-full mt-1 p-3 rounded-lg border focus:ring-2 focus:ring-orange-400 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 font-medium">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                className="w-full mt-1 p-3 rounded-lg border focus:ring-2 focus:ring-orange-400 outline-none"
              />
            </div>
          </div>

          {/* ZONE */}
          <div>
            <label className="text-sm text-gray-600 font-medium flex items-center gap-2">
              <FontAwesomeIcon icon={faLayerGroup} />
              Zone Assignment
            </label>
            <select
              value={form.zone}
              onChange={(e) =>
                setForm({ ...form, zone: e.target.value })
              }
              className="w-full mt-1 p-3 rounded-lg border bg-white focus:ring-2 focus:ring-blue-400 outline-none"
            >
              <option value="">Select Zone</option>
              {zones.map((zone) => (
                <option
                  key={zone}
                  value={zone}
                  disabled={occupiedZones.includes(zone)}
                >
                  {zone} {occupiedZones.includes(zone) ? "(Already Assigned)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ACTION BAR */}
        <div className="px-6 py-4  rounded-b-2xl flex justify-end">
          <button
            onClick={handleSubmit}
            className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-semibold transition"
          >
            Create Supervisor
          </button>
        </div>
      </div>

      {/* INFO */}
      <div className="mt-6 bg-orange-50 border border-black-200 rounded-xl p-4">
        <h3 className="font-semibold mb-1">
          Supervisor Rules
        </h3>
        <ul className="text-sm ml-5">
          <li>Only one supervisor per zone</li>
          <li>Zones are locked once a supervisor is created</li>
          <li>Deleting a supervisor frees the zone automatically</li>
        </ul>
      </div>
    </div>
  );
};

export default Supervisor;
