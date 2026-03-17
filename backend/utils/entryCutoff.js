const ENTRY_TIMEZONE = process.env.ENTRY_TIMEZONE || "Asia/Kolkata";

const getTodayIsoInTimezone = (timeZone = ENTRY_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

export const validateSupervisorSameDayEntry = (date, addedBy) => {
  const role = normalizeRole(addedBy?.role);
  if (role !== "supervisor") {
    return { allowed: true };
  }

  const todayIso = getTodayIsoInTimezone();
  if (date !== todayIso) {
    return {
      allowed: false,
      message:
        "Entry locked. Supervisors can submit only today's data. Previous-date entries are blocked after 12:00 AM.",
      todayIso,
      timezone: ENTRY_TIMEZONE,
    };
  }

  return { allowed: true };
};
