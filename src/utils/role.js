export const getRoleFlags = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return {};

    const role = user.role ? String(user.role).toLowerCase() : "";
    const roles = Array.isArray(user.roles) ? user.roles.map(r => String(r).toLowerCase()) : [];

    return {
      isAdmin: role === "admin" || roles.includes("admin"),
      isViewer: role === "viewer" || roles.includes("viewer"),
      isDataAgent: role === "dataagent" || roles.includes("dataagent"),
      isSupervisor: role === "supervisor" || roles.includes("supervisor"),
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
