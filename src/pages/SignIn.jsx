import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import logo from "../assets/Logo.png";
import egg from "../assets/egg.png";

const API_URL = import.meta.env.VITE_API_URL;
const API_WARMUP_TIMEOUT_MS = 4000;
const SIGNIN_TIMEOUT_MS = 12000;

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
  const warmupPromiseRef = useRef(null);

  const navigate = useNavigate();

  const zones = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

  useEffect(() => {
    if (!API_URL || warmupPromiseRef.current) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_WARMUP_TIMEOUT_MS);

    warmupPromiseRef.current = fetch(`${API_URL}`, {
      method: "GET",
      signal: controller.signal,
    })
      .catch(() => null)
      .finally(() => {
        clearTimeout(timeoutId);
      });
  }, []);

  // Add a placeholder for handleSignin to prevent runtime errors
  async function handleSignin(e) {
    e.preventDefault();
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SIGNIN_TIMEOUT_MS);

    try {
      await Promise.resolve(warmupPromiseRef.current).catch(() => null);

      const response = await fetch(`${API_URL}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, zone }),
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : {};

      if (response.ok && data.user) {
        // Store user info in localStorage
        // Use zoneId from server response (user record) if available
        // Check both 'zoneId' and 'zone' fields from user record
        // Admin defaults to Zone 1 for data entry forms
        let userZoneId = data.user.zoneId || data.user.zone || (zone && zone !== "null" ? zone : null);
        if (role === 'admin' && !userZoneId) {
          userZoneId = "Zone 1";
        }
        // Persist token for authenticated requests
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        localStorage.setItem('user', JSON.stringify({
          ...data.user,
          role: role.charAt(0).toUpperCase() + role.slice(1),
          zoneId: userZoneId
        }));
        // Redirect based on role
        if (role === 'supervisor') {
          navigate('/supervisor/dashboard');
        } else if (role === 'paymentauditor') {
          navigate('/admin/digital-payments');
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
        if (response.status === 429 && data?.code === 'FIRESTORE_QUOTA_EXCEEDED') {
          const backendMessage = data?.error || data?.message || 'Service unavailable. Please try again.';
          const retryText = data?.retryAfterSeconds ? ` Retry in ${data.retryAfterSeconds}s.` : '';
          alert(`${backendMessage}${retryText}`);
        } else {
          alert('Invalid credentials');
        }
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        alert("Login request timed out. Please try again.");
      } else {
        alert(err?.message || 'Server error');
      }
    } finally {
      clearTimeout(timeoutId);
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
            <option value="viewer">Viewer</option>
            <option value="paymentauditor">Payment Auditor</option>
          </select>
          {/* ZONE (only for data agents and supervisors) */}
          {[
            "dataagent",
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
