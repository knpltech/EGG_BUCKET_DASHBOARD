const toLocalIsoDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const getThisWeekRange = (value = new Date()) => {
  const today = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(today.getTime())) return { from: "", to: "" };

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  return {
    from: toLocalIsoDate(startOfWeek),
    to: toLocalIsoDate(today),
  };
};

export { toLocalIsoDate, getThisWeekRange };
