// reportsApi.js
// Frontend API service for fetching reports data from backend

// Configuration - Use Vite env variable or fallback to relative path for deployment compatibility
const config = {
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api'
};

const API_BASE_URL = config.apiBaseUrl;
const statisticsCache = new Map();
const STATISTICS_CACHE_TTL_MS = 5 * 60 * 1000;
export const STATISTICS_INVALIDATED_EVENT = 'statistics-data-invalidated';

// Keep normal navigation fast, while allowing a successful Data Entry save
// to make all statistics requests fresh immediately.
export const invalidateStatisticsCache = () => {
  statisticsCache.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(STATISTICS_INVALIDATED_EVENT));
  }
};

const getLocalIsoDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const normalizeDate = (value) => {
  try {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('-');
        return `${year}-${month}-${day}`;
      }
    }

    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      return getLocalIsoDate(value.toDate());
    }

    if (value && typeof value === 'object' && value._seconds !== undefined) {
      return getLocalIsoDate(new Date(value._seconds * 1000));
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return getLocalIsoDate(parsed);
  } catch {}

  return String(value ?? '').slice(0, 10);
};

const getDocTimestamp = (doc) => {
  const value = doc?.updatedAt || doc?.createdAt || doc?.date;

  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (value && typeof value === 'object' && value._seconds !== undefined) {
    return value._seconds * 1000;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeZoneLabel = (zone) => {
  if (!zone) return null;
  const raw = String(zone).trim();
  const numberMatch = raw.match(/(\d+)/);
  return numberMatch ? `Zone ${numberMatch[1]}` : raw;
};

const createEmptyZoneRevenue = () => ({
  'Zone 1': { cash: 0, digital: 0, total: 0 },
  'Zone 2': { cash: 0, digital: 0, total: 0 },
  'Zone 3': { cash: 0, digital: 0, total: 0 },
  'Zone 4': { cash: 0, digital: 0, total: 0 },
  'Zone 5': { cash: 0, digital: 0, total: 0 },
});

const getPaymentValueForOutlet = (doc, outlet) => {
  const values = doc?.outlets;
  if (!values || typeof values !== 'object' || Array.isArray(values)) return 0;

  const keys = [outlet.id, outlet.area, outlet.name].filter(Boolean);
  let fallbackValue = 0;
  for (const key of keys) {
    if (values[key] === undefined) continue;
    const value = Number(values[key]) || 0;
    if (value !== 0) return value;
    fallbackValue = value;
  }

  return fallbackValue;
};

const buildZoneTotalsFromPayments = (rows, outlets, paymentType, today, zoneRevenue) => {
  const activeOutlets = Array.isArray(outlets)
    ? outlets.filter((outlet) => outlet && outlet.status === 'Active')
    : [];

  const zoneOutletsMap = new Map();
  activeOutlets.forEach((outlet) => {
    const zoneKey = normalizeZoneLabel(outlet.zoneId || outlet.zone || outlet.zoneNumber);
    if (!zoneKey) return;
    if (!zoneRevenue[zoneKey]) zoneRevenue[zoneKey] = { cash: 0, digital: 0, total: 0 };
    if (!zoneOutletsMap.has(zoneKey)) zoneOutletsMap.set(zoneKey, []);
    zoneOutletsMap.get(zoneKey).push(outlet);
  });

  const dayRows = Array.isArray(rows)
    ? rows
        .filter((doc) => normalizeDate(doc.date || doc.createdAt) === today)
        .sort((a, b) => getDocTimestamp(a) - getDocTimestamp(b))
    : [];

  zoneOutletsMap.forEach((zoneOutlets, zoneKey) => {
    const latestValues = new Map();

    dayRows.forEach((doc) => {
      zoneOutlets.forEach((outlet) => {
        const currentValue = Number(latestValues.get(outlet.id)) || 0;
        const nextValue = getPaymentValueForOutlet(doc, outlet);
        if (!latestValues.has(outlet.id) || nextValue !== 0 || currentValue === 0) {
          latestValues.set(outlet.id, nextValue);
        }
      });
    });

    zoneRevenue[zoneKey][paymentType] = Array.from(latestValues.values()).reduce((sum, value) => sum + value, 0);
  });
};

/**
 * Fetch aggregated reports data for a specific outlet
 * This fetches combined data from daily sales, payments, and NECC rates
 * 
 * @param {string} outletId - The outlet identifier
 * @param {Object} filters - Optional filters (dateFrom, dateTo)
 * @returns {Promise<Object>} Reports data with summary and transactions
 */
export const fetchReportsData = async (outletId, filters = {}) => {
  try {
    const queryParams = new URLSearchParams({
      outletId,
      ...filters
    }).toString();

    const response = await fetch(`${API_BASE_URL}/reports?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication if needed:
        // 'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch reports: ${response.statusText}`);
    }

    const data = await response.json();
    
    // The backend returns data in this format:
    // {
    //   success: true,
    //   totalSalesQuantity: number,
    //   averageNeccRate: number,
    //   totalAmount: number,
    //   totalDifference: number,
    //   transactions: array
    // }
    
    return data;
  } catch (error) {
    console.error('Error fetching reports data:', error);
    throw error;
  }
};

/**
 * Fetch list of outlets from the backend
 * FIXED: Now fetches from /reports/outlets endpoint
 * @returns {Promise<Array>} List of outlets
 */
export const fetchOutlets = async () => {
  try {
    // Use the same endpoint as Outlets page for real-time sync
    const response = await fetch(`${API_BASE_URL}/outlets/all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch outlets: ${response.statusText}`);
    }

    const data = await response.json();
    // Return the outlets array directly
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching outlets:', error);
    // Fallback: If the endpoint fails, return demo outlets
    return [
      { id: 'OUT-001', name: 'AECS Layout' },
      { id: 'OUT-002', name: 'Bandepalya' },
      { id: 'OUT-003', name: 'Hosa Road' },
      { id: 'OUT-004', name: 'Singasandra' },
      { id: 'OUT-005', name: 'Kudlu Gate' }
    ];
  }
};

/**
 * Export reports data as PDF or Excel
 * @param {string} outletId - The outlet identifier
 * @param {string} format - Export format ('pdf' or 'excel')
 * @param {Object} filters - Optional filters
 * @returns {Promise<Blob>} File blob
 */
export const exportReports = async (outletId, format = 'excel', filters = {}) => {
  try {
    const queryParams = new URLSearchParams({
      outletId,
      format,
      ...filters
    }).toString();

    const response = await fetch(`${API_BASE_URL}/reports/export?${queryParams}`, {
      method: 'GET',
      headers: {
        // 'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to export reports: ${response.statusText}`);
    }

    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error('Error exporting reports:', error);
    throw error;
  }
};

export const fetchStatisticsData = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '')
      )
    ).toString();

    const cacheKey = queryParams || 'all';
    const cached = statisticsCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < STATISTICS_CACHE_TTL_MS) {
      return cached.data;
    }

    const response = await fetch(`${API_BASE_URL}/reports/statistics${queryParams ? `?${queryParams}` : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch statistics: ${response.statusText}`);
    }

    const data = await response.json();
    statisticsCache.set(cacheKey, { data, createdAt: Date.now() });
    return data;
  } catch (error) {
    console.error('Error fetching statistics data:', error);
    throw error;
  }
};

/**
 * Fetch today's revenue data (cash + digital payments)
 * @returns {Promise<Object>} Object with cashTotal, digitalTotal, and combinedTotal
 */
export const fetchTodayRevenue = async () => {
  try {
    const dateStr = getLocalIsoDate();

    const [cashResponse, digitalResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/cash-payments/date/${dateStr}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }),
      fetch(`${API_BASE_URL}/digital-payments/date/${dateStr}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
    ]);

    if (!cashResponse.ok || !digitalResponse.ok) {
      throw new Error('Failed to fetch payment data');
    }

    const cashPayments = await cashResponse.json();
    const digitalPayments = await digitalResponse.json();

    // Sum across all documents for today, not just the first one.
    const todaysCash = Array.isArray(cashPayments)
      ? cashPayments.filter(p => normalizeDate(p.date || p.createdAt) === dateStr)
      : [];
    const todaysDigital = Array.isArray(digitalPayments)
      ? digitalPayments.filter(p => normalizeDate(p.date || p.createdAt) === dateStr)
      : [];

    const cashTotal = todaysCash.reduce((sum, entry) => sum + (Number(entry?.total) || 0), 0);
    const digitalTotal = todaysDigital.reduce((sum, entry) => sum + (Number(entry?.total) || 0), 0);
    const combinedTotal = cashTotal + digitalTotal;

    return {
      cashTotal,
      digitalTotal,
      combinedTotal,
      date: dateStr,
      success: true
    };
  } catch (error) {
    console.error('Error fetching today\'s revenue:', error);
    return {
      cashTotal: 0,
      digitalTotal: 0,
      combinedTotal: 0,
      success: false,
      error: error.message
    };
  }
};

/**
 * Fetch revenue broken down by supervisor zones for a specific date
 * @param {string} selectedDate - ISO date string (YYYY-MM-DD)
 * @returns {Promise<Object>} Object with zone-wise revenue data
 */
export const fetchZoneWiseRevenue = async (selectedDate = getLocalIsoDate()) => {
  try {
    const dateStr = selectedDate || getLocalIsoDate();

    const [cashResponse, digitalResponse, outletsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/cash-payments/date/${dateStr}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }),
      fetch(`${API_BASE_URL}/digital-payments/date/${dateStr}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }),
      fetch(`${API_BASE_URL}/outlets/all`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
    ]);

    if (!cashResponse.ok || !digitalResponse.ok || !outletsResponse.ok) {
      throw new Error('Failed to fetch payment data');
    }

    const cashPayments = await cashResponse.json();
    const digitalPayments = await digitalResponse.json();
    const outlets = await outletsResponse.json();

    const zoneRevenue = createEmptyZoneRevenue();
    buildZoneTotalsFromPayments(cashPayments, outlets, 'cash', dateStr, zoneRevenue);
    buildZoneTotalsFromPayments(digitalPayments, outlets, 'digital', dateStr, zoneRevenue);

    // Revenue is based only on Egg Bucket payment entries for the selected
    // date. Do not pull retail-delivery totals here: they can exist before a
    // user has entered the day's data in Egg Bucket.
    Object.keys(zoneRevenue).forEach(zone => {
      zoneRevenue[zone].total = Number((zoneRevenue[zone].cash + zoneRevenue[zone].digital).toFixed(2));
    });

    return {
      zoneRevenue,
      date: dateStr,
      success: true
    };
  } catch (error) {
    console.error('Error fetching zone-wise revenue:', error);
    return {
      zoneRevenue: {
        'Zone 1': { cash: 0, digital: 0, total: 0 },
        'Zone 2': { cash: 0, digital: 0, total: 0 },
        'Zone 3': { cash: 0, digital: 0, total: 0 },
        'Zone 4': { cash: 0, digital: 0, total: 0 },
        'Zone 5': { cash: 0, digital: 0, total: 0 },
      },
      success: false,
      error: error.message
    };
  }
};

export default {
  fetchReportsData,
  fetchOutlets,
  exportReports,
  fetchStatisticsData,
  invalidateStatisticsCache,
  fetchTodayRevenue,
  fetchZoneWiseRevenue
};
