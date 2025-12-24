import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/Logo.png";
import egg from "../assets/egg.png";

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Admin"); 
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignin = async () => {
    if (!username || !password) {
      alert("Enter username & password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await res.json();
      setLoading(false);

      if (!data.success) {
        alert(data.error || "Login failed");
        return;
      }

      // Save login session
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect based on role
      if (data.user.role === "Admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard"); // Viewer dashboard
      }

    } catch (err) {
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
        />
      ))}

      {/* Card */}
      <div className="bg-eggWhite w-full max-w-sm p-8 rounded-2xl shadow-xl relative z-10">

        <div className="flex flex-col items-center mb-4">
          {/* Make the logo container match the card background so white image blends */}
          <div className="inline-block bg-eggWhite p-0 rounded-md">
            <img src={logo} alt="Egg Bucket Logo" className="w-24 sm:w-28 md:w-32 h-auto object-contain mix-blend-multiply" />
          </div>
          <div className="mt-2">
            {/* Keep the company name plain so it sits directly on the card background */}
            <span className="text-sm sm:text-base md:text-lg font-semibold text-[#2C1A0C] opacity-95">
              KACKLEWALLS NUTRITION PVT LTD
            </span>
          </div>
        </div>

        <h2 className="text-center text-2xl font-semibold mb-6">Sign In</h2>

        <div className="space-y-4">

          <input
            placeholder="Username (phone number)"
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
          />

          <input
            placeholder="Password"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
          />

          {/* ROLE SELECTOR */}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
          >
            <option value="Admin">Admin</option>
            <option value="Viewer">Viewer</option>
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
