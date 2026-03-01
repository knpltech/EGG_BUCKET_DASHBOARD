const API_URL = import.meta.env.VITE_API_URL;
import React, { useEffect, useMemo, useState, useRef } from "react";
import Topbar from "../components/Topbar";
import Sidebar from "../components/Sidebar";
import SupervisorList from "../components/SupervisorList";

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

  // Fetch all users from backend then keep only supervisors
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [dataagentsRes, viewersRes, supervisorsRes] = await Promise.all([
          fetch(`${API_URL}/admin/all-dataagents`),
          fetch(`${API_URL}/admin/all-viewers`),
          fetch(`${API_URL}/admin/all-supervisors`)
        ]);
        const dataagents = await dataagentsRes.json();
        const viewers = await viewersRes.json();
        const supervisors = await supervisorsRes.json();
        // Merge and deduplicate by username (if needed)
        const allUsers = [
          ...(Array.isArray(dataagents) ? dataagents : []),
          ...(Array.isArray(viewers) ? viewers : []),
          ...(Array.isArray(supervisors) ? supervisors : [])
        ];
        // Only keep entries where the role list includes "supervisor"
        const onlySupervisors = allUsers.filter((u) => {
          const r = Array.isArray(u.roles) ? u.roles : [u.role];
          return r && r.some((x) => (x || "").toLowerCase() === "supervisor");
        });
        setUsers(onlySupervisors);
      } catch {
        setUsers([]);
      }
    };
    fetchUsers();

    // Poll for new users every 5 seconds to keep data fresh
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, []);


  const roles = useMemo(() => {
    const setRoles = new Set();
    users.forEach((u) => {
      if (Array.isArray(u.roles)) u.roles.forEach((r) => r && setRoles.add(r));
      else if (u.role) setRoles.add(u.role);
    });
    return Array.from(setRoles);
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (selectedRoles.length > 0) {
        const r = Array.isArray(u.roles) ? u.roles : [u.role];
        const lowerSet = new Set(selectedRoles.map((s) => s.toLowerCase()));
        if (!r || !r.some((x) => lowerSet.has((x || "").toLowerCase()))) return false;
      }
      return true;
    });
  }, [users, selectedRoles]);


  return (
    <div className="flex min-h-screen bg-eggBg px-4 py-6 md:px-8">
      {/* Sidebar */}

      {/* Main Content */}
      <div className="flex-1 p-4 pt-0 overflow-x-hidden">
        <Topbar />

        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Supervisors</h1>

          {/* Filters */}
          

          {/* Results */}
          <SupervisorList/>
          
          
        </div>
      </div>
      
      <div>
        
      </div>
    </div>

    
  );
};

export default Users;