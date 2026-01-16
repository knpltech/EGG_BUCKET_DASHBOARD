const API_URL = import.meta.env.VITE_API_URL;
// src/pages/Outlets.jsx
import { useMemo, useState, useEffect } from "react";

const SAMPLE_OUTLETS = [
  {
    id: "OUT-001",
    name: "Sunrise Bakery",
    area: "AECS Layout",
    contact: "Rajesh Kumar",
    phone: "+91 98765 43210",
    status: "Active",
    reviewStatus: "ok",
  },
  {
    id: "OUT-002",
    name: "City Mart Supermarket",
    area: "Bandepalya",
    contact: "Anita Roy",
    phone: "+91 91234 56789",
    status: "Active",
    reviewStatus: "ok",
  },
  {
    id: "OUT-003",
    name: "Hosa Road Bakers",
    area: "Hosa Road",
    contact: "Manish Patel",
    phone: "+91 99887 66554",
    status: "Active",
    reviewStatus: "ok",
  },
  {
    id: "OUT-004",
    name: "Singasandra Grocers",
    area: "Singasandra",
    contact: "Deepa Rao",
    phone: "+91 88776 55443",
    status: "Active",
    reviewStatus: "ok",
  },
  {
    id: "OUT-005",
    name: "Kudlu Gate Store",
    area: "Kudlu Gate",
    contact: "Vijay Kumar",
    phone: "+91 77665 44332",
    status: "Active",
    reviewStatus: "ok",
  },
];

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-600",
  "bg-purple-100 text-purple-600",
  "bg-green-100 text-green-600",
  "bg-orange-100 text-orange-600",
  "bg-pink-100 text-pink-600",
  "bg-teal-100 text-teal-600",
];

function getAvatarInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getStatusBadgeClasses(status) {
  if (status === "Active") {
    return "bg-green-50 text-green-700 border border-green-200";
  }
  if (status === "Inactive") {
    return "bg-gray-100 text-gray-600 border border-gray-200";
  }
  return "bg-orange-50 text-orange-700 border border-orange-200";
}

/* ---------- Icons ---------- */
function SearchIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="9"
        cy="9"
        r="5"
        stroke="#D5964A"
        strokeWidth="1.4"
      />
      <line
        x1="12.5"
        y1="12.5"
        x2="16"
        y2="16"
        stroke="#D5964A"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 5H16"
        stroke="#44403C"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6 10H14"
        stroke="#44403C"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9 15H11"
        stroke="#44403C"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
/* --------------------------- */

const STORAGE_KEY = "egg_outlets_v1";

// The five required layouts used across the app
const REQUIRED_AREAS = [
  "AECS Layout",
  "Bandepalya",
  "Hosa Road",
  "Singasandra",
  "Kudlu Gate",
];

export default function Outlets() {
  const [outlets, setOutlets] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : SAMPLE_OUTLETS;
  });

  // On first mount, store all outlets in the database if not already present
  useEffect(() => {
    async function syncToBackend() {
      for (const outlet of outlets) {
        try {
          await fetch(`${API_URL}/outlets/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(outlet),
          });
        } catch (err) {
          // ignore network errors for now
        }
      }
    }
    syncToBackend();
  }, []);

  // Persist to localStorage when outlets change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(outlets));
    // Dispatch a custom event so other pages in the same tab can update immediately
    try {
      window.dispatchEvent(new CustomEvent('egg:outlets-updated', { detail: outlets }));
    } catch (err) {
      // ignore
    }
  }, [outlets]);

  // Ensure required areas exist as outlets (add missing ones automatically)
  useEffect(() => {
    setOutlets((prev) => {
      const areas = prev.map((o) => o.area);
      const missing = REQUIRED_AREAS.filter((r) => !areas.includes(r));
      if (missing.length === 0) return prev;

      const nextNumberStart = prev.length + 1;
      const added = missing.map((area, idx) => ({
        id: `OUT-${String(nextNumberStart + idx).padStart(3, "0")}`,
        name: `${area} Outlet`,
        area,
        contact: "-",
        phone: "-",
        status: "Active",
        reviewStatus: "ok",
      }));

      return [...added, ...prev];
    });
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 6;

const [showAddModal, setShowAddModal] = useState(false);
const [newOutlet, setNewOutlet] = useState({
  name: "",
  area: "",
  contact: "",
  phone: "",
  status: "Active",
});
const [openActionId, setOpenActionId] = useState(null);
const [isEditMode, setIsEditMode] = useState(false);
const [editingId, setEditingId] = useState(null);

// Close action menu when clicking outside of any action menu
useEffect(() => {
  const handler = (e) => {
    // Treat both the menu and the toggle button as "inside" so clicks that open the menu
    // don't get immediately closed by this handler.
    if (!e.target.closest("[data-action-menu], [data-action-toggle]")) {
      setOpenActionId(null);
    }
  };
  document.addEventListener("click", handler);
  return () => document.removeEventListener("click", handler);
}, []);

const handleOpenEditModal = (outlet) => {
  setNewOutlet({
    name: outlet.name,
    area: outlet.area,
    contact: outlet.contact === "-" ? "" : outlet.contact,
    phone: outlet.phone === "-" ? "" : outlet.phone,
    status: outlet.status,
  });
  setIsEditMode(true);
  setEditingId(outlet.id);
  setShowAddModal(true);
  setOpenActionId(null);
};

const handleDeleteOutlet = async (id) => {
  if (!confirm("Are you sure you want to delete this outlet?")) return;
  try {
    await fetch(`${API_URL}/outlets/delete/${id}`, { method: "DELETE" });
    setOutlets((prev) => prev.filter((o) => o.id !== id));
  } catch (err) {
    alert("Failed to delete outlet from backend.");
  }
  setOpenActionId(null);
};



  const metrics = useMemo(() => {
    const totalOutlets = outlets.length;
    const activeOutlets = outlets.filter((o) => o.status === "Active").length;
    const pendingReview = outlets.filter(
      (o) => o.reviewStatus === "pending"
    ).length;

    return { totalOutlets, activeOutlets, pendingReview };
  }, [outlets]);

  const filteredOutlets = useMemo(() => {
    const query = search.trim().toLowerCase();

    let list = outlets;

    if (query) {
      list = list.filter((o) => {
        return (
          o.name.toLowerCase().includes(query) ||
          o.area.toLowerCase().includes(query) ||
          o.phone.toLowerCase().includes(query)
        );
      });
    }

    if (statusFilter !== "All") {
      list = list.filter((o) => o.status === statusFilter);
    }

    return list;
  }, [outlets, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOutlets.length / pageSize));

  const currentPageOutlets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOutlets.slice(start, start + pageSize);
  }, [filteredOutlets, page]);

  const fromIndex =
    filteredOutlets.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIndex = Math.min(page * pageSize, filteredOutlets.length);

  const handleOpenAddModal = () => {
    setNewOutlet({
      name: "",
      area: "",
      contact: "",
      phone: "",
      status: "Active",
    });
    setIsEditMode(false);
    setEditingId(null);
    setShowAddModal(true);
  };

  const handleSaveNewOutlet = async (e) => {
    e.preventDefault();
    if (!newOutlet.name || !newOutlet.area) {
      alert("Please fill Outlet Name and Area.");
      return;
    }

    if (isEditMode && editingId) {
      // Edit existing outlet
      const updatedOutlet = {
        id: editingId,
        name: newOutlet.name,
        area: newOutlet.area,
        contact: newOutlet.contact || "-",
        phone: newOutlet.phone || "-",
        status: newOutlet.status,
      };
      try {
        await fetch(`${API_URL}/outlets/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedOutlet),
        });
        setOutlets((prev) =>
          prev.map((o) => (o.id === editingId ? { ...o, ...updatedOutlet } : o))
        );
      } catch (err) {
        alert("Failed to update outlet in backend.");
      }
      setIsEditMode(false);
      setEditingId(null);
    } else {
      // Add new outlet
      const nextNumber = outlets.length + 1;
      const id = `OUT-${String(nextNumber).padStart(3, "0")}`;
      const outletToAdd = {
        id,
        name: newOutlet.name,
        area: newOutlet.area,
        contact: newOutlet.contact || "-",
        phone: newOutlet.phone || "-",
        status: "Inactive",
        reviewStatus: "pending",
      };
      try {
        await fetch(`${API_URL}/outlets/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(outletToAdd),
        });
        setOutlets((prev) => [outletToAdd, ...prev]);
        setPage(1);
      } catch (err) {
        alert("Failed to add outlet to backend.");
      }
    }
    setShowAddModal(false);
  };

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">
      {/* Header (title + subtitle) */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
          Outlets Management
        </h1>
        <p className="mt-1 text-sm md:text-base text-gray-500">
          Manage all your outlets, contact details, and status.
        </p>
      </div>

      {/* Search + Filter + Add Outlet */}
      <div className="mb-6 space-y-4">
        <div className="rounded-2xl bg-eggWhite px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search input */}
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <SearchIcon className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search outlets by name, area or phone..."
                className="w-full rounded-xl border border-transparent bg-eggBg pl-9 pr-3 py-2 text-xs md:text-sm text-gray-700 placeholder:text-[#D0A97B] focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>

            {/* Filter + Add Outlet buttons */}
            <div className="flex items-center gap-2 md:ml-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((o) => !o)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                >
                  <FilterIcon className="h-4 w-4" />
                  <span>Filter</span>
                </button>

                {isFilterOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-gray-100 bg-white p-2 text-xs shadow-lg z-20">
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase text-gray-400">
                      Status
                    </p>
                    {["All", "Active", "Inactive"].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          setStatusFilter(status);
                          setIsFilterOpen(false);
                          setPage(1);
                        }}
                        className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                          statusFilter === status
                            ? "bg-orange-50 text-orange-600"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs md:text-sm font-semibold text-white shadow-md hover:bg-orange-600"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
                  +
                </span>
                <span>Add Outlet</span>
              </button>
            </div>
          </div>
        </div>

        {/* Metrics cards */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl bg-eggWhite px-4 py-3 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Total Outlets
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {metrics.totalOutlets}
              </p>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-medium text-green-700">
              +4 this month
            </span>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-eggWhite px-4 py-3 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Active Outlets
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {metrics.activeOutlets}
              </p>
            </div>
            <span className="text-[11px] font-medium text-gray-500">
              97% operational
            </span>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-eggWhite px-4 py-3 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Pending Review
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {metrics.pendingReview}
              </p>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-medium text-orange-700">
              Action required
            </span>
          </div>
        </div>
      </div>

      {/* Outlets Table */}
      <div className="overflow-hidden rounded-2xl bg-eggWhite shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-[11px] md:text-xs font-semibold text-gray-500">
                <th className="px-4 py-3 min-w-[220px]">Outlet Name</th>
                <th className="px-4 py-3 whitespace-nowrap">Area</th>
                <th className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                  Contact Person
                </th>
                <th className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                  Phone
                </th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {currentPageOutlets.map((outlet, index) => {
                const avatarClass =
                  AVATAR_COLORS[index % AVATAR_COLORS.length];
                const initials = getAvatarInitials(outlet.name);

                return (
                  <tr
                    key={outlet.id}
                    className={`text-xs md:text-sm text-gray-700 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${avatarClass}`}
                        >
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {outlet.name}
                          </p>
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">
                            ID: #{outlet.id}
                          </p>
                        </div>
                      </div>

                      {/* On very small screens, show contact + phone stacked */}
                      <div className="mt-2 flex flex-col gap-1 text-[11px] text-gray-500 sm:hidden">
                        <span>
                          <span className="font-semibold text-gray-700">
                            Contact:
                          </span>{" "}
                          {outlet.contact}
                        </span>
                        <span>
                          <span className="font-semibold text-gray-700">
                            Phone:
                          </span>{" "}
                          {outlet.phone}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {outlet.area}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-orange-600 hidden sm:table-cell">
                      {outlet.contact}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                      {outlet.phone}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${getStatusBadgeClasses(
                          outlet.status
                        )}`}
                      >
                        {outlet.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap relative">
                      <button
                        type="button"
                        data-action-toggle
                        onClick={() => setOpenActionId((id) => (id === outlet.id ? null : outlet.id))}
                        aria-expanded={openActionId === outlet.id}
                        className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium text-gray-700 ${
                          openActionId === outlet.id 
                            ? "border-gray-200 bg-white ring-2 ring-orange-200" 
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        ⋮
                      </button>

                      {openActionId === outlet.id && (
                        <div 
                          data-action-menu 
                          className="absolute right-0 mt-2 w-36 rounded-lg border border-gray-200 bg-white shadow-lg z-30 text-xs"
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await fetch(`${API_URL}/outlets/add`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ ...outlet, status: "Active" }),
                                });
                                setOutlets((prev) =>
                                  prev.map((o) =>
                                    o.id === outlet.id ? { ...o, status: "Active" } : o
                                  )
                                );
                              } catch (err) {
                                alert("Failed to update status in backend.");
                              }
                              setOpenActionId(null);
                            }}
                            className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded-t-lg"
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await fetch(`${API_URL}/outlets/add`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ ...outlet, status: "Inactive" }),
                                });
                                setOutlets((prev) =>
                                  prev.map((o) =>
                                    o.id === outlet.id ? { ...o, status: "Inactive" } : o
                                  )
                                );
                              } catch (err) {
                                alert("Failed to update status in backend.");
                              }
                              setOpenActionId(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-red-600 hover:bg-gray-100 rounded-b-lg"
                          >
                            Inactive
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {currentPageOutlets.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-xs text-gray-500"
                  >
                    No outlets found for the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs md:flex-row md:items-center md:justify-between">
          <p className="text-gray-500">
            {filteredOutlets.length === 0
              ? "No results"
              : `Showing ${fromIndex} to ${toIndex} of ${filteredOutlets.length} results`}
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`flex h-8 w-20 items-center justify-center rounded-full border text-xs font-medium ${
                page <= 1
                  ? "border-gray-100 text-gray-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`flex h-8 w-20 items-center justify-center rounded-full border text-xs font-medium ${
                page >= totalPages
                  ? "border-gray-100 text-gray-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Outlet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-eggWhite p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base md:text-lg font-semibold text-gray-900">
                {isEditMode ? "Edit Outlet" : "Add Outlet"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setIsEditMode(false);
                  setEditingId(null);
                }}
                className="rounded-full px-2 py-1 text-sm text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewOutlet} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Outlet Name
                  </label>
                  <input
                    type="text"
                    value={newOutlet.name}
                    onChange={(e) =>
                      setNewOutlet((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Area
                  </label>
                  <input
                    type="text"
                    value={newOutlet.area}
                    onChange={(e) =>
                      setNewOutlet((prev) => ({
                        ...prev,
                        area: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={newOutlet.contact}
                    onChange={(e) =>
                      setNewOutlet((prev) => ({
                        ...prev,
                        contact: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={newOutlet.phone}
                    onChange={(e) =>
                      setNewOutlet((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={newOutlet.status}
                  onChange={(e) =>
                    setNewOutlet((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="mt-3 flex flex-col gap-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setIsEditMode(false);
                    setEditingId(null);
                  }}
                  className="w-full md:w-auto rounded-2xl border border-gray-200 bg-white px-5 py-2 text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full md:w-auto rounded-2xl bg-orange-500 px-6 py-2 text-xs md:text-sm font-semibold text-white shadow-md hover:bg-orange-600"
                >
                  {isEditMode ? "Save Changes" : "Save Outlet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}