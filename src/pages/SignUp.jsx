import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/Logo.png";
import egg from "../assets/egg.png";
import { useState } from "react";

export default function SignUp() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Distributor");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // 🔹 SIGNUP FUNCTION (CONNECTS TO BACKEND)
  const handleSignup = async () => {
    if (!fullName || !phone || !username || !password) {
      alert("Please fill all fields.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          username,
          password,
          role,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Account created successfully!");
        navigate("/Dashboard");
      } else {
        alert(data.error || "Signup failed");
      }
    } catch (error) {
      alert("Server error: " + error.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-eggBg flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* FALLING EGGS (ANIMATION) */}
      {[...Array(5)].map((_, i) => (
        <img
          key={i}
          src={egg}
          className="egg-fall"
          style={{
            left: `${Math.random() * 90}vw`,
            animationDuration: `${6 + Math.random() * 4}s`,
            animationDelay: `${Math.random() * 3}s`,
            width: "55px",
            opacity: 0.85,
            position: "absolute",
            top: "-80px",
          }}
        />
      ))}

      {/* SIGNUP CARD */}
      <div className="bg-eggWhite w-full max-w-md p-8 rounded-2xl shadow-xl relative z-10">

        {/* LOGO */}
        <div className="flex flex-col items-center mb-4">
          <img src={logo} alt="Logo" className="w-28 h-auto" />
          <h1 className="text-xl font-semibold mt-2">Egg Bucket</h1>
        </div>

        <h2 className="text-center text-2xl font-semibold mb-6">Create Your Account</h2>

        {/* FORM FIELDS */}
        <div className="space-y-4">
          <input
            onChange={(e) => setFullName(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
            placeholder="Enter your full name"
          />

          <input
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
            placeholder="Enter your phone number"
          />

          <input
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
            placeholder="Choose a username"
          />

          <input
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput outline-none shadow"
            placeholder="Create a password"
            type="password"
          />

          <select
            onChange={(e) => setRole(e.target.value)}
            className="w-full p-3 rounded-xl bg-eggInput shadow outline-none"
          >
            <option>Distributor</option>
            <option>Admin</option>
          </select>

          {/* SUBMIT BUTTON */}
          <button
            onClick={handleSignup}
            disabled={loading}
            className={`w-full bg-eggOrange text-white py-3 rounded-full mt-2 shadow-md transition 
              ${loading ? "opacity-50" : "hover:opacity-90"}`}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <p className="text-center mt-4">
            Already have an account?{" "}
            <Link to="/signin" className="font-semibold">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
