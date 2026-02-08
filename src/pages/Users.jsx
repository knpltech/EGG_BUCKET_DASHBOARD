const API_URL = import.meta.env.VITE_API_URL;
import React, { useEffect, useMemo, useState, useRef } from "react";
import Topbar from "../components/Topbar";
import Sidebar from "../components/Sidebar";
import SupervisorList from "../components/SupervisorList";

const escapeRegExp = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const Users = () => {
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);

    const getDataAgentZones = () => {
      try {
        return JSON.parse(localStorage.getItem("dataAgentZones")) || [];
      } catch {
        return [];
      }
    };

        // 🔹 username -> zoneId map
    const dataAgentZoneMap = useMemo(() => {
      const map = {};
      getDataAgentZones().forEach((d) => {
        map[d.username] = d.zoneId;
      });
      return map;
    }, []);

    // Delete user handler
    const handleDeleteUser = async (id, username, roles) => {
      if (!window.confirm('Are you sure you want to delete this user?')) return;
      // Determine collection: dataagents if roles includes 'dataagent', else users
      const isDataAgent = (Array.isArray(roles) ? roles : [roles]).some(r => (r || '').toLowerCase() === 'dataagent');
      const collection = isDataAgent ? 'dataagents' : 'users';
      try {
        const response = await fetch(`${API_URL}/admin/delete-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, collection }),
        });

        if (response.ok) {
          setUsers(users.filter(u => u.id !== id));
        } else {
          console.error('Failed to delete user');
        }
      } catch (err) {
        console.error('Error deleting user:', err);
      }
    };

    // Edit user handler
    const handleEditUser = (user) => {
      setEditUser(user);
      setEditModalOpen(true);
    };

    

    // Save edited user
    const handleSaveEdit = (updatedUser) => {
      const updated = users.map(u => u.id === updatedUser.id ? updatedUser : u);
      setUsers(updated);
      setEditModalOpen(false);
      setEditUser(null);
    };

    // Cancel edit
    const handleCancelEdit = () => {
      setEditModalOpen(false);
      setEditUser(null);
    };

  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);
  const overflowBtnRef = useRef(null);
  const VISIBLE_CHIPS = 5;

  // Close overflow if clicking outside or pressing Escape
  useEffect(() => {
    const onDocClick = (e) => {
      if (!overflowOpen) return;
      if (overflowRef.current && overflowBtnRef.current && !overflowRef.current.contains(e.target) && !overflowBtnRef.current.contains(e.target)) {
        setOverflowOpen(false);
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") setOverflowOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [overflowOpen]);

  // Fetch users (dataagents + viewers) from backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [dataagentsRes, viewersRes] = await Promise.all([
          fetch(`${API_URL}/admin/all-dataagents`),
          fetch(`${API_URL}/admin/all-viewers`)
        ]);
        const dataagents = await dataagentsRes.json();
        const viewers = await viewersRes.json();
        // Merge and deduplicate by username (if needed)
        const allUsers = [
          ...(Array.isArray(dataagents) ? dataagents : []),
          ...(Array.isArray(viewers) ? viewers : [])
        ];
        setUsers(allUsers);
      } catch {
        setUsers([]);
      }
    };
    fetchUsers();

    // Poll for new users every 5 seconds to keep data fresh
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Debounce search input for smoother UX
  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const roles = useMemo(() => {
    const setRoles = new Set();
    users.forEach((u) => {
      if (Array.isArray(u.roles)) u.roles.forEach((r) => r && setRoles.add(r));
      else if (u.role) setRoles.add(u.role);
    });
    return Array.from(setRoles);
  }, [users]);

  const filtered = useMemo(() => {
    const q = (debounced || "").toLowerCase();
    return users.filter((u) => {
      if (selectedRoles.length > 0) {
        const r = Array.isArray(u.roles) ? u.roles : [u.role];
        const lowerSet = new Set(selectedRoles.map((s) => s.toLowerCase()));
        if (!r || !r.some((x) => lowerSet.has((x || "").toLowerCase()))) return false;
      }

      if (!q) return true;

      const fields = [u.fullName, u.username, u.phone, ...(Array.isArray(u.roles) ? u.roles : [u.role])];
      return fields.some((f) => (f || "").toString().toLowerCase().includes(q));
    });
  }, [users, debounced, selectedRoles]);

  const highlight = (text = "", q = "") => {
    if (!q) return text;
    const safe = escapeRegExp(q);
    const regex = new RegExp(`(${safe})`, "ig");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-100 rounded px-1">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="flex min-h-screen bg-eggBg px-4 py-6 md:px-8">
      {/* Sidebar */}

      {/* Main Content */}
      <div className="flex-1 p-4 pt-0 overflow-x-hidden">
        <Topbar />

        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Users</h1>

          {/* Search & Filters */}
          <div className="mb-6"><div className="sticky top-4 z-20 bg-white/60 backdrop-blur-sm px-4 py-3 rounded-lg -mx-4 md:-mx-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-80">
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search users by name, username, phone, or role..."
                  className="w-full bg-white border border-eggAccent/20 shadow-sm rounded-lg px-10 py-2 pr-12 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-eggAccent/30 transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-full w-7 h-7 flex items-center justify-center"
                    aria-label="Clear search"
                  >
                    <span className="text-sm">×</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex gap-2 items-center md:flex-nowrap overflow-x-auto py-1">
                  <button
                    onClick={() => setSelectedRoles([])}
                    aria-pressed={selectedRoles.length === 0}
                    title="Show all roles (clear filters)"
                    className={`text-sm px-3 py-1 rounded-full border transition focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-1 ${selectedRoles.length === 0 ? "bg-green-400 text-black border-green-400" : "bg-red-100 text-red-800 border-red-200 hover:bg-red-200"}`}
                  >
                    All
                  </button>

                  {/* visible chips */}
                  {(() => {
                    const showOverflow = roles.length > VISIBLE_CHIPS;
                    const visibleRoles = showOverflow ? roles.slice(0, VISIBLE_CHIPS) : roles;
                    const overflowRoles = showOverflow ? roles.slice(VISIBLE_CHIPS) : [];
                    return (
                      <>
                        {visibleRoles.map((r) => (
                          <button
                            key={r}
                            onClick={() => setSelectedRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))}
                            aria-pressed={selectedRoles.includes(r)}
                            title={`Filter by ${r}`}
                            className={`text-sm px-3 py-1 rounded-full border transition focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-1 ${selectedRoles.includes(r) ? "bg-green-400 text-black border-green-400 hover:opacity-95 shadow-sm" : "bg-red-100 text-red-800 border-red-200 hover:bg-red-200"}`}
                          >
                            {r}
                          </button>
                        ))}

                        {showOverflow && (
                          <div className="relative">
                            <button
                              ref={overflowBtnRef}
                              onClick={() => setOverflowOpen((s) => !s)}
                              aria-expanded={overflowOpen}
                              aria-controls="roles-overflow"
                              title={`${overflowRoles.length} more roles`}
                              className="text-sm px-3 py-1 rounded-full border bg-red-100 text-red-800 border-red-200 transition focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-1"
                            >
                              +{overflowRoles.length}
                            </button>

                            {overflowOpen && (
                              <div id="roles-overflow" ref={overflowRef} role="menu" className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-30 p-2">
                                {overflowRoles.map((r) => (
                                  <button
                                    key={r}
                                    onClick={() => {
                                      setSelectedRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
                                      setOverflowOpen(false);
                                    }}
                                    role="menuitem"
                                    aria-checked={selectedRoles.includes(r)}
                                    className={`w-full text-left px-3 py-1 rounded-md text-sm transition ${selectedRoles.includes(r) ? "bg-green-400 text-black" : "hover:bg-red-50 text-red-800"}`}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  {selectedRoles.length > 0 && (
                    <>
                      <span className="inline-flex items-center bg-green-400 text-black text-xs font-medium px-2 py-0.5 rounded-full" aria-hidden>
                        {selectedRoles.length}
                      </span>
                      <button onClick={() => setSelectedRoles([])} className="text-sm px-3 py-1 rounded-full border bg-red-100 text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-1">Clear</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-500">
              Showing <span className="font-medium text-gray-700">{filtered.length}</span> of <span className="font-medium text-gray-700">{users.length}</span> users
            </div>
          </div></div>

          {/* Results */}
          <SupervisorList/>
          {users.length === 0 ? (
            <div className="bg-white shadow rounded-xl p-6 text-center text-gray-500">No users found.</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white shadow rounded-xl p-6 text-center text-gray-500">
              No matching users. Try adjusting your search or filters.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((u) => (
                <div key={u.id} className="bg-white shadow rounded-xl p-5 border hover:shadow-md transition">
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">
                    {highlight(u.fullName || "", debounced)}
                  </h2>
                  <p className="text-sm text-gray-500 mb-2">@{highlight(u.username || "", debounced)}</p>

                  <div className="text-sm text-gray-700 space-y-1">
                    <p>
                      <span className="font-medium">Phone:</span>{" "}
                      {highlight(u.phone || "", debounced)}
                    </p>

                    <p>
                      <span className="font-medium">Role:</span>{" "}
                      {Array.isArray(u.roles)
                        ? u.roles.join(", ")
                        : u.role}
                    </p>

                    {/* 👇 ADD THIS */}
                    {Array.isArray(u.roles) &&
                      u.roles.includes("dataagent") &&
                      dataAgentZoneMap[u.username] && (
                        <p className="text-blue-600 font-medium">
                          Zone: {dataAgentZoneMap[u.username]}
                        </p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="text-xs px-3 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:opacity-90 transition" onClick={() => handleDeleteUser(u.id, u.username, u.roles)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Edit Modal (outside map and grid) */}
          {editModalOpen && editUser && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4">Edit User</h2>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSaveEdit(editUser);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editUser.fullName || ""}
                      onChange={e => setEditUser({ ...editUser, fullName: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={editUser.username || ""}
                      onChange={e => setEditUser({ ...editUser, username: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editUser.phone || ""}
                      onChange={e => setEditUser({ ...editUser, phone: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <input
                      type="text"
                      value={Array.isArray(editUser.roles) ? editUser.roles.join(", ") : (editUser.role || "")}
                      onChange={e => {
                        const val = e.target.value;
                        setEditUser({ ...editUser, roles: val.split(",").map(r => r.trim()).filter(Boolean) });
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button type="button" onClick={handleCancelEdit} className="px-4 py-2 rounded-lg border bg-gray-100 text-gray-700">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-eggAccent text-white">Save</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div>
        
      </div>
    </div>

    
  );
};

export default Users;