export const filterByZone = (data = [], user) => {
  if (!user || user.role === "Admin") return data;
  return data.filter(item => item.zoneId === user.zoneId);
};
