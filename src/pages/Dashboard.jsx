import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/Logo.png";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Load logged-in user
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      navigate("/signin"); // Not logged in → redirect
      return;
    }

    setUser(JSON.parse(storedUser));
  }, []);

  // Logout
  const logout = () => {
    localStorage.removeItem("user");
    navigate("/signin");
  };

  if (!user) return null; // Wait until data loads

  return (
    <div className="min-h-screen bg-eggBg p-6">

      {/* HEADER */}
      <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow">
        <div className="flex items-center gap-3">
          <img src={logo} className="w-16" />
          <h1 className="text-2xl font-semibold text-[#2C1A0C]">Egg Bucket Dashboard</h1>
        </div>

        <button
          onClick={logout}
          className="bg-red-500 text-white px-5 py-2 rounded-full hover:bg-red-600 transition"
        >
          Logout
        </button>
      </header>

      {/* WELCOME CARD */}
      <div className="bg-white mt-8 p-8 shadow-lg rounded-2xl">
        <h2 className="text-3xl font-bold text-[#2C1A0C]">
          Welcome, {user.fullName} 👋
        </h2>
        <p className="text-gray-600 mt-2">
          Role: <span className="font-semibold">{user.role}</span>
        </p>
        <p className="text-gray-600 mt-1">Phone: {user.phone}</p>
        <p className="text-gray-600 mt-1">Username: {user.username}</p>
      </div>

      {/* DASHBOARD STATS */}
      <div className="grid md:grid-cols-3 gap-6 mt-10">

        <div className="bg-white p-6 rounded-2xl shadow text-center">
          <h3 className="text-xl font-semibold text-[#C46A1A]">Today's Orders</h3>
          <p className="text-4xl font-bold mt-2">48</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow text-center">
          <h3 className="text-xl font-semibold text-[#C46A1A]">Total Sales</h3>
          <p className="text-4xl font-bold mt-2">₹12,450</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow text-center">
          <h3 className="text-xl font-semibold text-[#C46A1A]">Pending Deliveries</h3>
          <p className="text-4xl font-bold mt-2">6</p>
        </div>

      </div>

      {/* MORE SECTIONS COMING LATER */}
      {/* Example: Distributor List, Truck Tracking, Payments, Analytics */}
    </div>
  );
}
