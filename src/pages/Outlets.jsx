const API_URL = import.meta.env.VITE_API_URL;
import { useMemo, useState, useEffect, useCallback } from "react";

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-600",
  "bg-purple-100 text-purple-600",
  "bg-green-100 text-green-600",
  "bg-orange-100 text-orange-600",
  "bg-pink-100 text-pink-600",
  "bg-teal-100 text-teal-600",
];

const REQUIRED_AREAS = [
  "AECS Layout",
  "Bandepalya",
  "Hosa Road",
  "Singasandra",
  "Kudlu Gate",
];

const STORAGE_KEY = "egg_outlets_v1";

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

function SearchIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="9" cy="9" r="5" stroke="#D5964A" strokeWidth="1.4" />
      <line x1="12.5" y1="12.5" x2="16" y2="16" stroke="#D5964A" strokeWidth="1.4" strokeLinecap="round" />
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
      <path d="M4 5H16" stroke="#44403C" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 10H14" stroke="#44403C" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 15H11" stroke="#44403C" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const user = JSON.parse(localStorage.getItem("user"));
const userRole = user?.role;       // "Admin" | "Supervisor"
const userZone = user?.zoneId;     // null | "Zone 1" | "Zone 2"


export default function Outlets() {
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

  /* ================= FETCH OUTLETS ================= */
  const fetchOutlets = useCallback(async () => {
    try {
      console.log('Fetching outlets from backend...');
      const res = await fetch(`${API_URL}/outlets/all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log('Outlets loaded from backend:', data.length);
          setOutlets(data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          setError(null);
        } else {
          throw new Error('Empty outlets response');
        }
      } else {
        throw new Error(`Backend error: ${res.status}`);
      }
    } catch (err) {
      console.error("Error fetching outlets:", err);
      
      // Try localStorage as fallback
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('Using cached outlets from localStorage');
            setOutlets(parsed);
            setError(null);
            return;
          }
        } catch (parseErr) {
          console.error("Error parsing saved outlets:", parseErr);
        }
      }
      
      // No data available at all
      setOutlets([]);
      setError('Failed to load outlets. Please refresh the page.');
    }
  }, []);

  // Load outlets on component mount
  useEffect(() => {
    setIsLoading(true);
    fetchOutlets().finally(() => setIsLoading(false));
  }, [fetchOutlets]);

  // Listen for visibility change (tab switch)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        console.log('Page visible, reloading outlets');
        fetchOutlets();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchOutlets]);

  // Ensure required areas exist
  useEffect(() => {
    if (outlets.length === 0) return;

    setOutlets((prev) => {
      const areas = new Set(prev.map((o) => o.area));
      const missing = REQUIRED_AREAS.filter((r) => !areas.has(r));
      
      if (missing.length === 0) return prev;

      console.log('Adding missing outlets:', missing);
      
      const existingIds = new Set(prev.map((o) => o.id));
      let nextNum = 1;
      const getNextId = () => {
        while (existingIds.has(`OUT-${String(nextNum).padStart(3, "0")}`)) {
          nextNum++;
        }
        const id = `OUT-${String(nextNum).padStart(3, "0")}`;
        existingIds.add(id);
        return id;
      };

      const added = missing.map((area) => ({
        id: getNextId(),
        name: `${area} Outlet`,
        area,
        contact: "-",
        phone: "-",
        status: "Active",
        reviewStatus: "ok",
      }));

      // Sync missing outlets to backend
      added.forEach((outlet) => {
        fetch(`${API_URL}/outlets/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(outlet),
        }).catch(err => console.error('Failed to sync outlet to backend:', err));
      });

      return [...added, ...prev];
    });
  }, []);

  // Persist to localStorage and dispatch event when outlets change
  useEffect(() => {
    if (outlets.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(outlets));
      try {
        window.dispatchEvent(new CustomEvent('egg:outlets-updated', { detail: outlets }));
        console.log('Outlets updated event dispatched');
      } catch (err) {
        console.error('Failed to dispatch outlets event:', err);
      }
    }
  }, [outlets]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest("[data-action-menu], [data-action-toggle]")) {
        setOpenActionId(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  /* ================= METRICS ================= */
  const metrics = useMemo(() => {
    const totalOutlets = outlets.length;
    const activeOutlets = outlets.filter((o) => o.status === "Active").length;
    const pendingReview = outlets.filter((o) => o.reviewStatus === "pending").length;
    return { totalOutlets, activeOutlets, pendingReview };
  }, [outlets]);

  /* ================= FILTERING ================= */
  const filteredOutlets = useMemo(() => {
  const query = search.trim().toLowerCase();

  let list =
    userRole === "Supervisor"
      ? outlets.filter(o => o.zoneId === userZone)
      : outlets;

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
}, [outlets, search, statusFilter, userRole, userZone]);


  const totalPages = Math.max(1, Math.ceil(filteredOutlets.length / pageSize));

  const currentPageOutlets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOutlets.slice(start, start + pageSize);
  }, [filteredOutlets, page]);

  const fromIndex = filteredOutlets.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIndex = Math.min(page * pageSize, filteredOutlets.length);

  /* ================= HANDLERS ================= */
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
      zoneId: outlet.zoneId   // preserve zone
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
      console.error('Status update error:', err);
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
          reviewStatus: original.reviewStatus || "ok"
        };
        
        const res = await fetch(`${API_URL}/outlets/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedOutlet),
        });

        if (res.ok) {
          // Refetch to get latest data
          await fetchOutlets();
        } else {
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
          status: "Active",
          reviewStatus: "ok",
          zoneId:
            userRole === "Supervisor"
              ? userZone
              : newOutlet.zoneId || null
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
      console.error('Save error:', err);
      alert("Failed to save outlet.");
    }
  };

  // Loading state
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

            {/* Filter + Add buttons */}
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
              {currentPageOutlets.map((outlet, index) => {
                const avatarClass = AVATAR_COLORS[index % AVATAR_COLORS.length];
                const initials = getAvatarInitials(outlet.name);

                return (
                  <tr key={outlet.id} className={`text-xs md:text-sm text-gray-700 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${avatarClass}`}>
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{outlet.name}</p>
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">ID: #{outlet.id}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-col gap-1 text-[11px] text-gray-500 sm:hidden">
                        <span><span className="font-semibold text-gray-700">Contact:</span> {outlet.contact}</span>
                        <span><span className="font-semibold text-gray-700">Phone:</span> {outlet.phone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{outlet.area}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-orange-600 hidden sm:table-cell">{outlet.contact}</td>
                    <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">{outlet.phone}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${getStatusBadgeClasses(outlet.status)}`}>
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
                          openActionId === outlet.id ? "border-gray-200 bg-white ring-2 ring-orange-200" : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        ⋮
                      </button>

                      {openActionId === outlet.id && (
                        <div data-action-menu className="absolute right-0 mt-2 w-36 rounded-lg border border-gray-200 bg-white shadow-lg z-30 text-xs">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(outlet)}
                            className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded-t-lg"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(outlet.id, 'Active')}
                            className="block w-full text-left px-3 py-2 hover:bg-gray-100"
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(outlet.id, 'Inactive')}
                            className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded-b-lg"
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
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-500">
                    No outlets found for the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs md:flex-row md:items-center md:justify-between">
          <p className="text-gray-500">
            {filteredOutlets.length === 0 ? "No results" : `Showing ${fromIndex} to ${toIndex} of ${filteredOutlets.length} results`}
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`flex h-8 w-20 items-center justify-center rounded-full border text-xs font-medium ${
                page <= 1 ? "border-gray-100 text-gray-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`flex h-8 w-20 items-center justify-center rounded-full border text-xs font-medium ${
                page >= totalPages ? "border-gray-100 text-gray-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
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



              {/* ZONE SELECT — ADMIN ONLY */}
              {userRole === "Admin" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Zone</label>
                  <select
                    value={newOutlet.zoneId || ""}
                    onChange={(e) =>
                      setNewOutlet(prev => ({ ...prev, zoneId: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-eggBg px-3 py-2 text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  >
                    <option value="">Select Zone</option>
                    <option value="Zone 1">Zone 1</option>
                    <option value="Zone 2">Zone 2</option>
                    <option value="Zone 3">Zone 3</option>
                  </select>
                </div>
              )}

              {/* STATUS */}
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