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
  const [zone, setZone] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const zones = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

  // Add a placeholder for handleSignin to prevent runtime errors
  async function handleSignin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Example API call for login
      const response = await fetch(`${API_URL}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, zone })
      });
      const data = await response.json();
      if (response.ok && data.user) {
        // Store user info in localStorage
        // Use zoneId from server response (user record) if available
        // Check both 'zoneId' and 'zone' fields from user record
        // Admin defaults to Zone 1 for data entry forms
        let userZoneId = data.user.zoneId || data.user.zone || (zone && zone !== "null" ? zone : null);
        if (role === 'admin' && !userZoneId) {
          userZoneId = "Zone 1";
        }
        console.log('Login - Server zoneId:', data.user.zoneId, '| Server zone:', data.user.zone, '| Form zone:', zone, '| Using:', userZoneId);
        localStorage.setItem('user', JSON.stringify({
          ...data.user,
          role: role.charAt(0).toUpperCase() + role.slice(1),
          zoneId: userZoneId
        }));
        // Redirect based on role
        if (role === 'supervisor') {
          navigate('/supervisor/dashboard');
        } else if (role === 'admin') {
          navigate('/admin/dashboard');
        } else if (role === 'dataagent') {
          navigate('/dataagent/dashboard');
        } else if (role === 'viewer') {
          navigate('/viewer/dashboard');
        } else {
          navigate('/');
        }
      } else {
        alert(data.message || 'Invalid credentials');
      }
    } catch (err) {
      alert('Server error');
    } finally {
      setLoading(false);
    }
  }

    /* =========================
      LOGIN HANDLER
    ========================= */
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
          {[
            "dataagent",
            "viewer",
            "supervisor"
          ].includes(role) && (
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