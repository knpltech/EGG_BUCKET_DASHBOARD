/**
 * Utility functions for handling "Added by" user tracking information
 */

/**
 * Extract unique zones from addedByHistory
 * @param {Array} addedByHistory - Array of objects with {username, zone, role, timestamp}
 * @returns {Array} Unique zones
 */
export const extractZones = (addedByHistory) => {
  if (!Array.isArray(addedByHistory)) return [];
  const zones = new Set();
  addedByHistory.forEach(entry => {
    if (entry && entry.zone) {
      zones.add(String(entry.zone).trim());
    }
  });
  return Array.from(zones);
};

/**
 * Format added by information for display
 * @param {Array} addedByHistory - Array of objects with {username, zone, role, timestamp}
 * @returns {String} Formatted string like "Added by supervisor of zone 1, 2"
 */
export const formatAddedByText = (addedByHistory) => {
  if (!Array.isArray(addedByHistory) || addedByHistory.length === 0) {
    return "—";
  }
  
  // Get the first entry (usually the one who created it)
  const firstEntry = addedByHistory[0];
  if (!firstEntry) return "—";
  
  const zones = extractZones(addedByHistory);
  const zoneText = zones.join(", ");
  const role = firstEntry.role || "user";
  const roleName = role === "supervisor" ? "supervisor" : role === "dataagent" ? "data agent" : role;
  
  return `Added by ${roleName} of zone ${zoneText}`;
};

/**
 * Get all users who added/updated the data
 * @param {Array} addedByHistory - Array of objects with {username, zone, role, timestamp}
 * @returns {String} Formatted string like "user1 (zone 1), user2 (zone 2)"
 */
export const getAllAddedByUsers = (addedByHistory) => {
  if (!Array.isArray(addedByHistory) || addedByHistory.length === 0) {
    return "—";
  }
  
  const userList = addedByHistory
    .map(entry => {
      if (!entry || !entry.username) return null;
      const zone = entry.zone ? ` (${entry.zone})` : "";
      return `${entry.username}${zone}`;
    })
    .filter(Boolean);
  
  return userList.length > 0 ? userList.join(", ") : "—";
};
