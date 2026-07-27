const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getValidDate = (value) => {
  const date = String(value || "").trim();
  return DATE_PATTERN.test(date) ? date : "";
};

const getPositiveLimit = (value) => {
  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 0;
};

export const applyDateQuery = (collection, query = {}, direction = "desc") => {
  const from = getValidDate(query.from);
  const to = getValidDate(query.to);
  const limit = getPositiveLimit(query.limit);
  let firestoreQuery = collection;

  if (from) firestoreQuery = firestoreQuery.where("date", ">=", from);
  if (to) firestoreQuery = firestoreQuery.where("date", "<=", to);

  firestoreQuery = firestoreQuery.orderBy("date", direction);
  if (limit) firestoreQuery = firestoreQuery.limit(limit);

  return firestoreQuery;
};
