export const getRoleFlags = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return {};

    const role = user.role;
    const roles = Array.isArray(user.roles) ? user.roles : [];

    return {
      isAdmin: role === "Admin" || roles.includes("admin"),
      isViewer: role === "Viewer" || roles.includes("viewer"),
      isDataAgent: role === "DataAgent" || roles.includes("dataagent"),
      isSupervisor: role === "Supervisor" || roles.includes("supervisor"),
      zone: user.zoneId || user.zone || null,
    };
  } catch {
    return {};
  }
};

// Normalize zone for comparison (handles "2" vs "Zone 2" mismatch)
export const normalizeZone = (z) => {
  if (!z) return null;
  const str = String(z).toLowerCase().replace('zone', '').trim();
  return str;
};

// Check if two zones match (handles different formats)
export const zonesMatch = (zone1, zone2) => {
  return normalizeZone(zone1) === normalizeZone(zone2);
};
