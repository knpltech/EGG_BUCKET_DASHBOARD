import React, { useState } from "react";
import {
  faUser,
  faLock,
  faKey,
  faChartLine,
  faStore,
  faMoneyBill,
  faWallet,
  faIndianRupeeSign,
  faArrowsSplitUpAndLeft,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const Distributorcomp = () => {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
    roles: [],
  });

  const roles = [
    {
      name: "Daily Sales",
      value: "daily_sales",
      icon: faChartLine,
      desc: "Manage daily egg sales records.",
    },
    {
      name: "Outlets",
      value: "outlets",
      icon: faStore,
      desc: "Manage distribution outlets.",
    },
    {
      name: "Digital Payments",
      value: "digital_payments",
      icon: faWallet,
      desc: "Process UPI and card payments.",
    },
    {
      name: "Cash Payments",
      value: "cash_payments",
      icon: faMoneyBill,
      desc: "Log and verify cash transactions.",
    },
    {
      name: "NECC Rate",
      value:"neccrate",
      icon: faIndianRupeeSign,
      desc: "Average amount of eggs.",
    },
    {
      name: "Daily Damages",
      value:"dailydamages",
      icon: faArrowsSplitUpAndLeft,
      desc: "total eggs damaged.",
    },
  ];

  const handleSubmit = () => {
    // Basic validation
    if (!form.fullName || !form.username) {
      alert("Please provide full name and username.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    const existing = JSON.parse(localStorage.getItem("users")) || [];

    // Normalize username for uniqueness (case-insensitive)
    const normalizedUsername = (form.username || "").trim().toLowerCase();
    if (existing.some((u) => (u.username || "").trim().toLowerCase() === normalizedUsername)) {
      alert("Username already exists!");
      return;
    }

    // Prevent duplicate phone (if provided)
    if (form.phone && existing.some((u) => u.phone === form.phone)) {
      alert("Phone number already in use!");
      return;
    }

    // Generate stable unique id
    const id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `user-${Date.now()}`;

    const newUser = {
      id,
      fullName: form.fullName.trim(),
      phone: form.phone?.trim() || "",
      username: normalizedUsername,
      roles: Array.isArray(form.roles) ? form.roles : [],
      // NOTE: passwords are not persisted in this demo app for simplicity/security
    };

    const updated = [...existing, newUser];
    localStorage.setItem("users", JSON.stringify(updated));

    alert("Distributor added successfully!");

    setForm({
      fullName: "",
      phone: "",
      username: "",
      password: "",
      confirmPassword: "",
      roles: [],
    });
  };

  return (
    <div className="px-4 pt-4 max-w-[1200px] mx-auto w-full">

      {/* PAGE TITLE */}
      <h1 className="text-3xl font-bold mb-2">Add Distributor</h1>
      <p className="text-gray-600 mb-8">
        Create a new distributor account and assign module access.
      </p>

      <div className="bg-white shadow rounded-xl">

        {/* SECTION 1 */}
        <div className="p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 pb-3">
            <FontAwesomeIcon icon={faUser} /> Distributor Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 mb-4">
            <div>
              <label className="text-gray-600 text-sm">Full Name</label>
              <input
                type="text"
                className="border rounded-lg w-full p-2 mt-1"
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-gray-600 text-sm">Phone Number</label>
              <input
                type="tel"
                className="border rounded-lg w-full p-2 mt-1"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* SECTION 2 */}
        <div className="p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FontAwesomeIcon icon={faLock} /> Account Security
          </h2>

          <div className="flex flex-col gap-4 mt-4">
            <div>
              <label className="text-gray-600 text-sm">Username</label>
              <input
                type="text"
                className="border rounded-lg w-full p-2 mt-1"
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-600 text-sm">Password</label>
                <input
                  type="password"
                  className="border rounded-lg w-full p-2 mt-1"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-gray-600 text-sm">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="border rounded-lg w-full p-2 mt-1"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: ACCESS ROLES */}
        <div className="p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-orange-600">
            <FontAwesomeIcon icon={faKey} /> Access Roles
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            Distributor can access one or more modules.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => {
              const active = form.roles.includes(role.value);

              return (
                <div
                  key={role.value}
                  className={`p-4 rounded-xl border cursor-pointer ${
                    active
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    const exists = form.roles.includes(role.value);
                    setForm({
                      ...form,
                      roles: exists
                        ? form.roles.filter((r) => r !== role.value)
                        : [...form.roles, role.value],
                    });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon
                      icon={role.icon}
                      className={`text-xl ${
                        active
                          ? "text-orange-600"
                          : "text-gray-600"
                      }`}
                    />
                    <span className="font-medium">
                      {role.name}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-2">
                    {role.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SUBMIT */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          className="bg-orange-600 text-white px-6 py-3 rounded-lg text-lg font-semibold"
        >
          Add Distributor
        </button>
      </div>
    </div>
  );
};

export default Distributorcomp;