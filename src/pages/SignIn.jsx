import { useState } from "react";
import { useNavigate } from "react-router-dom";

import logo from "../assets/Logo.png";
import egg from "../assets/egg.png";

const API_URL = import.meta.env.VITE_API_URL;

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSignin = async () => {
    if (!username || !password) {
      alert("Enter username & password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          role: role.toLowerCase(),
        }),
      });

      const contentType = res.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
        console.log("Login response:", data); // Debug log
      } else {
        const text = await res.text();
        console.error("Non-JSON response from server:", text);
        setLoading(false);
        alert(`Server error: Non-JSON response (${res.status}):\n` + text);
        return;
      }

      setLoading(false);

      if (!res.ok || !data.success) {
        alert(data.error || "Login failed");
        return;
      }

      // Save session
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect
      if (data.user.role === "Admin") {
        navigate("/admin/dashboard");
      } else if (data.user.role === "Viewer") {
        navigate("/viewer/data");
      } else {
        navigate("/dashboard");
        // DataAgent: redirect to first allowed feature
        const roles = Array.isArray(data.user.roles) ? data.user.roles : (data.user.role ? [data.user.role] : []);
        // Map roles to paths in order of preference
        const roleToPath = {
          daily_sales: "/admin/dailysales",
          outlets: "/admin/outlets",
          digital_payments: "/admin/digital-payments",
          cash_payments: "/admin/cash-payments",
          neccrate: "/admin/neccrate",
          daily_damages: "/admin/damages"
        };
        let firstPath = null;
        for (const r of Object.keys(roleToPath)) {
          if (roles.includes(r)) {
            firstPath = roleToPath[r];
            break;
          }
        }
        navigate(firstPath || "/signin");
      }

    } catch (err) {
      console.error("Login error:", err);
      setLoading(false);
      alert("Server error: " + err.message);
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

      {/* Card */}
      <div className="bg-eggWhite w-full max-w-sm p-8 rounded-2xl shadow-xl relative z-10">

        <div className="flex flex-col items-center mb-4">
          <div className="inline-block bg-eggWhite p-0 rounded-md">
            <img
              src={logo}
              alt="Egg Bucket Logo"
              className="w-24 sm:w-28 md:w-32 h-auto object-contain mix-blend-multiply"
            />
          </div>

          <div className="mt-2">
            <span className="text-sm sm:text-base md:text-lg font-semibold text-[#2C1A0C] opacity-95">
              KACKLEWALLS NUTRITION PVT LTD
            </span>
          </div>
        </div>

        <h2 className="text-center text-2xl font-semibold mb-6">Sign In</h2>

        <div className="space-y-4">

          <input
            type="text"
            placeholder="Username (phone number)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
          >
            <option value="admin">Admin</option>
            <option value="dataagent">Data Agent</option>
              <option value="viewer">Viewer</option>
          </select>

          <button
            onClick={handleSignin}
            disabled={loading}
            className="w-full bg-eggOrange text-white py-3 rounded-full mt-2 hover:opacity-90 shadow-md disabled:opacity-40"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

        </div>
      </div>
    </div>
  );
}