import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "../assets/Logo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIndianRupeeSign } from "@fortawesome/free-solid-svg-icons";
import { faMoneyBillWave } from "@fortawesome/free-solid-svg-icons";
import {
  faTableCells,
  faEgg,
  faDollarSign,
  faWallet,
  faTruck,
  faStore,
  faChartLine,
  faUsers,
  faRightFromBracket,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const linkClass = (path) =>
    `flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition ${
      pathname.startsWith(path)
        ? "bg-orange-500 text-white"
        : "text-gray-700 hover:bg-orange-100"
    } ${open ? "justify-start" : "justify-center"}`;

  const handleSignOut = () => {
    localStorage.clear();
    navigate("/signin");
  };

  return (
    <div
      className={`h-screen sticky top-0 bg-orange-50 shadow-md p-4 transition-all duration-300 ${
        open ? "w-64" : "w-20"
      }`}
    >
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2 justify-center">
        <div className={`inline-block bg-orange-50 rounded ${open ? 'p-2' : 'p-1'}`}>
          <img src={logo} alt="Egg Bucket Logo" className={`h-10 sm:h-12 md:h-14 w-auto object-contain mix-blend-multiply opacity-95`} />
        </div>
      </div>

      {/* Menu Toggle */}
      <div
        className={`flex items-center cursor-pointer mb-8 ${
          open ? "justify-between" : "justify-center"
        }`}
        onClick={() => setOpen(!open)}
      >
        {open && <span className="font-semibold text-sm">MENU</span>}
        <span className="text-lg">☰</span>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">
        <Link to="/admin/dashboard" className={linkClass("/admin/dashboard")}>
          <FontAwesomeIcon icon={faTableCells} />
          {open && "Dashboard"}
        </Link>

        <Link to="/admin/damages" className={linkClass("/admin/damages")}>
          <FontAwesomeIcon icon={faExclamationTriangle} />
          {open && "Daily Damages"}
        </Link>

        <Link to="/admin/neccrate" className={linkClass("/admin/neccrate")}>
          <FontAwesomeIcon icon={faEgg} />
          {open && "NECC Rate"}
        </Link>

        <Link to="/admin/dailysales" className={linkClass("/admin/dailysales")}>
          <FontAwesomeIcon icon={faIndianRupeeSign} />
          {open && "Daily Sales"}
        </Link>

        <Link
          to="/admin/digital-payments"
          className={linkClass("/admin/digital-payments")}
        >
          <FontAwesomeIcon icon={faWallet} />
          {open && "Digital Payments"}
        </Link>

        <Link
  to="/admin/cash-payments"
  className={linkClass("/admin/cash-payments")}
>
  <FontAwesomeIcon icon={faMoneyBillWave} />
  {open && "Cash Payments"}
</Link>

        <Link
          to="/admin/distribution"
          className={linkClass("/admin/distribution")}
        >
          <FontAwesomeIcon icon={faUsers} />
          {open && "Add Data Agent"}
        </Link>

        <Link to="/admin/outlets" className={linkClass("/admin/outlets")}>
          <FontAwesomeIcon icon={faStore} />
          {open && "Outlets"}
        </Link>

        <Link to="/admin/users" className={linkClass("/admin/users")}>
          <FontAwesomeIcon icon={faUsers} />
          {open && "Users"}
        </Link>
      </nav>

      {/* Sign Out */}
      <div className="mt-auto pt-6">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-2 text-gray-600 hover:text-red-600"
        >
          <FontAwesomeIcon icon={faRightFromBracket} />
          {open && "Sign Out"}
        </button>
      </div>
    </div>
  );
}
