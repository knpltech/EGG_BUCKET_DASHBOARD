// ...existing code...

import { useMemo, useState, useEffect, useCallback } from "react";
import { getRoleFlags } from "../utils/role";

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

const API_URL = import.meta.env.VITE_API_URL;

export default function SupervisorOutlet() {
  // Parse user inside component so it reads fresh on each mount
  const user = JSON.parse(localStorage.getItem("user"));
  const userZone = user?.zoneId;
  const userId = user?.uid || user?.email || user?.id;

  const [outlets, setOutlets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // Fetch only outlets for this supervisor's zone
  const fetchOutlets = useCallback(async () => {
    try {
      if (!userZone) {
        setOutlets([]);
        setError("No zone found.");
        setIsLoading(false);
        return;
      }
      // Fetch all outlets in supervisor's zone (no createdBy filter)
      let url = `${API_URL}/outlets/zone/${userZone}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOutlets(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        setOutlets([]);
        setError("Failed to fetch outlets.");
      }
    } catch (err) {
      setOutlets([]);
      setError("Error fetching outlets.");
    }
    setIsLoading(false);
  }, [userZone]);

  useEffect(() => {
    setIsLoading(true);
    fetchOutlets();
  }, [fetchOutlets]);

  // Filtering logic
  const filteredOutlets = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = outlets;
    if (query) {
      list = list.filter((o) =>
        o.name.toLowerCase().includes(query) ||
        o.area.toLowerCase().includes(query) ||
        o.phone.toLowerCase().includes(query)
      );
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
  const fromIndex = filteredOutlets.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIndex = Math.min(page * pageSize, filteredOutlets.length);

  // Metrics
  const metrics = useMemo(() => {
    const totalOutlets = outlets.length;
    const activeOutlets = outlets.filter((o) => o.status === "Active").length;
    const pendingReview = outlets.filter((o) => o.reviewStatus === "pending").length;
    return { totalOutlets, activeOutlets, pendingReview };
  }, [outlets]);

  // Handlers (add/edit/status)
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

  const handleOpenEditModal = (outlet) => {
    setNewOutlet({
      name: outlet.name,
      area: outlet.area,
      contact: outlet.contact === "-" ? "" : outlet.contact,
      phone: outlet.phone === "-" ? "" : outlet.phone,
      status: outlet.status,
      zoneId: outlet.zoneId
    });
    setIsEditMode(true);
    setEditingId(outlet.id);
    setShowAddModal(true);
    setOpenActionId(null);
  };

  const handleSetStatus = async (id, newStatus) => {
    try {
      const outlet = outlets.find(o => o.id === id);
      if (!outlet) return;
      const updated = { ...outlet, status: newStatus };
      const res = await fetch(`${API_URL}/outlets/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setOutlets(prev => prev.map(o => o.id === id ? updated : o));
      } else {
        alert("Failed to update status in backend.");
      }
    } catch (err) {
      alert("Failed to update status.");
    }
    setOpenActionId(null);
  };

  const handleSaveNewOutlet = async (e) => {
    e.preventDefault();
    if (!newOutlet.name || !newOutlet.area) {
      alert("Please fill Outlet Name and Area.");
      return;
    }
    try {
      if (isEditMode && editingId) {
        // Edit existing outlet
        const original = outlets.find(o => o.id === editingId) || {};
        const updatedOutlet = {
          id: editingId,
          name: newOutlet.name,
          area: newOutlet.area,
          contact: newOutlet.contact || "-",
          phone: newOutlet.phone || "-",
          status: newOutlet.status,
          reviewStatus: original.reviewStatus || "ok",
          zoneId: userZone,
          createdBy: userId
        };
        const res = await fetch(`${API_URL}/outlets/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedOutlet),
        });
        if (res.ok) {
          await fetchOutlets();
        } else {
          alert("Failed to update outlet in backend.");
        }
        setIsEditMode(false);
        setEditingId(null);
      } else {
        // Add new outlet
        const id = `OUT-${Date.now()}`;
        const outletToAdd = {
          id,
          name: newOutlet.name,
          area: newOutlet.area,
          contact: newOutlet.contact || "-",
          phone: newOutlet.phone || "-",
          status: "Active",
          reviewStatus: "ok",
          zoneId: userZone,
          createdBy: userId
        };
        const res = await fetch(`${API_URL}/outlets/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(outletToAdd),
        });
        if (res.ok) {
          setOutlets((prev) => [outletToAdd, ...prev]);
          setPage(1);
        } else {
          alert("Failed to add outlet to backend.");
        }
      }
      setShowAddModal(false);
    } catch (err) {
      alert("Failed to save outlet.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff7518] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading outlets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Outlets Management</h1>
        <p className="mt-1 text-sm md:text-base text-gray-500">Manage all your outlets, contact details, and status.</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Search + Filter + Add Outlet */}
      <div className="mb-6 space-y-4">
        <div className="rounded-2xl bg-eggWhite px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search input */}
            <div className="relative flex-1">
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
            {/* Filter + Add buttons */}
            <div className="flex items-center gap-2 md:ml-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((o) => !o)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                >
                  <span>Filter</span>
                </button>
                {isFilterOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-gray-100 bg-white p-2 text-xs shadow-lg z-20">
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase text-gray-400">Status</p>
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
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15">+</span>
                <span>Add Outlet</span>
              </button>
            </div>
          </div>
        </div>
        {/* Metrics cards */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl bg-eggWhite px-4 py-3 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Total Outlets</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{metrics.totalOutlets}</p>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-medium text-green-700">Active</span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-eggWhite px-4 py-3 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Active Outlets</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{metrics.activeOutlets}</p>
            </div>
            <span className="text-[11px] font-medium text-gray-500">
              {metrics.totalOutlets > 0 ? Math.round((metrics.activeOutlets / metrics.totalOutlets) * 100) : 0}%
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-eggWhite px-4 py-3 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Pending Review</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{metrics.pendingReview}</p>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-medium text-orange-700">
              {metrics.pendingReview > 0 ? 'Action' : 'None'}
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
                <th className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">Contact Person</th>
                <th className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-500">
                  No outlets found for the current filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs md:flex-row md:items-center md:justify-between">
          <p className="text-gray-500">
            No results
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              disabled={true}
              className="flex h-8 w-20 items-center justify-center rounded-full border text-xs font-medium border-gray-100 text-gray-300"
            >
              Previous
            </button>
            <button
              disabled={true}
              className="flex h-8 w-20 items-center justify-center rounded-full border text-xs font-medium border-gray-100 text-gray-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      {/* Add/Edit Outlet Modal */}
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
                  <label className="text-xs font-medium text-gray-700">Outlet Name</label>
                  <input
                    type="text"
                    value={newOutlet.name}
                    onChange={(e) => setNewOutlet((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Area</label>
                  <input
                    type="text"
                    value={newOutlet.area}
                    onChange={(e) => setNewOutlet((prev) => ({ ...prev, area: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Contact Person</label>
                  <input
                    type="text"
                    value={newOutlet.contact}
                    onChange={(e) => setNewOutlet((prev) => ({ ...prev, contact: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Phone</label>
                  <input
                    type="text"
                    value={newOutlet.phone}
                    onChange={(e) => setNewOutlet((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Status</label>
                <select
                  value={newOutlet.status}
                  onChange={(e) =>
                    setNewOutlet((prev) => ({ ...prev, status: e.target.value }))
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
