import { useState } from "react";
import { useNavigate } from "react-router-dom";

import logo from "../assets/Logo.png";
import egg from "../assets/egg.png";

const API_URL = import.meta.env.VITE_API_URL;

/* =========================
   LOCAL STORAGE HELPERS
========================= */
const getSupervisors = () => {
  try {
    return JSON.parse(localStorage.getItem("supervisors")) || [];
  } catch {
    return [];
  }
};

const getDataAgentZones = () => {
  try {
    return JSON.parse(localStorage.getItem("dataAgentZones")) || [];
  } catch {
    return [];
  }
};

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [zone, setZone] = useState("null");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const zones = ["Zone 1", "Zone 2", "Zone 3"];

  /* =========================
     LOGIN HANDLER
  ========================= */
  const handleSignin = async () => {
    if (!username || !password) {
      alert("Enter username & password");
      return;
    }

    // Zone required for these roles
    if (["dataagent", "viewer", "supervisor"].includes(role) && !zone) {
      alert("Please select your zone");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          role: role.toLowerCase(),
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok || !data.success) {
        alert(data.error || "Login failed");
        return;
      }

      /* =========================
         ZONE VALIDATION (FRONTEND)
      ========================= */

      // Supervisor validation
      if (role === "supervisor") {
        const supervisors = getSupervisors();
        const match = supervisors.find(
          (s) => s.username === username && s.zoneId === zone
        );
        if (!match) {
          alert("Invalid zone for supervisor");
          return;
        }
      }

      // Data Agent / Viewer validation
      if (role === "dataagent" || role === "viewer") {
        const mappings = getDataAgentZones();
        const match = mappings.find(
          (m) => m.username === username && m.zoneId === zone
        );
        if (!match) {
          alert("You are not assigned to this zone");
          return;
        }
      }

      /* =========================
         SAVE SESSION
      ========================= */
      localStorage.setItem("token", data.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...data.user,
          zoneId: zone || null,
        })
      );

      /* =========================
         REDIRECT
      ========================= */
      if (data.user.role === "Admin") {
        navigate("/admin/dashboard");
      } else if (data.user.role === "Viewer") {
        navigate("/viewer/data");
      } else if (data.user.role === "Supervisor") {
        navigate("/supervisor/dashboard");
      } else {
        const rolesArr = Array.isArray(data.user.roles)
          ? data.user.roles
          : [];

        const roleToPath = {
          daily_damages: "/admin/damages",
          cash_payments: "/admin/cash-payments",
          daily_sales: "/admin/dailysales",
          digital_payments: "/admin/digital-payments",
          outlets: "/admin/outlets",
          neccrate: "/admin/neccrate",
        };

        let firstPath = null;
        for (const r of Object.keys(roleToPath)) {
          if (rolesArr.includes(r)) {
            firstPath = roleToPath[r];
            break;
          }
        }

        navigate(firstPath || "/dashboard");
      }

    } catch (err) {
      console.error("Login error:", err);
      setLoading(false);
      alert("Server error");
    }
  };

  return (
    <div className="min-h-screen bg-eggBg flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Animated Eggs */}
      {[...Array(5)].map((_, i) => (
        <img
          key={i}
          src={egg}
          className="egg-fall"
          style={{
            left: `${Math.random() * 90}vw`,
            animationDuration: `${6 + Math.random() * 4}s`,
            animationDelay: `${Math.random() * 5}s`,
            width: "40px",
          }}
          alt=""
        />
      ))}

      <div className="bg-eggWhite w-full max-w-sm p-8 rounded-2xl shadow-xl z-10">

        <div className="flex flex-col items-center mb-4">
          <img src={logo} alt="Logo" className="w-28 mix-blend-multiply" />
          <span className="mt-2 text-sm font-semibold">
            KACKLEWALLS NUTRITION PVT LTD
          </span>
        </div>

        <h2 className="text-center text-2xl font-semibold mb-6">Sign In</h2>

        <div className="space-y-4">

          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput"
          />

          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setZone("");
            }}
            className="w-full p-3 rounded-xl bg-eggInput"
          >
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="dataagent">Data Agent</option>
            <option value="viewer">Viewer</option>
          </select>

          {/* ZONE (Conditional) */}
          {["dataagent", "viewer", "supervisor"].includes(role) && (
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full p-3 rounded-xl bg-eggInput"
            >
              <option value="">Select Zone</option>
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleSignin}
            disabled={loading}
            className="w-full bg-eggOrange text-white py-3 rounded-full mt-2"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

        </div>
      </div>
    </div>
  );
}
