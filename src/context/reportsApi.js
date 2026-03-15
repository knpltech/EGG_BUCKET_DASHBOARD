// reportsApi.js
// Frontend API service for fetching reports data from backend

// Configuration - Use Vite env variable or fallback to relative path for deployment compatibility
const config = {
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api'
};

const API_BASE_URL = config.apiBaseUrl;

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
  for (const key of keys) {
    if (values[key] !== undefined) return Number(values[key]) || 0;
  }

  return 0;
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
        latestValues.set(outlet.id, getPaymentValueForOutlet(doc, outlet));
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

/**
 * Fetch today's revenue data (cash + digital payments)
 * @returns {Promise<Object>} Object with cashTotal, digitalTotal, and combinedTotal
 */
export const fetchTodayRevenue = async () => {
  try {
    const dateStr = getLocalIsoDate();

    // Fetch both cash and digital payments
    const [cashResponse, digitalResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/cash-payments/all`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }),
      fetch(`${API_BASE_URL}/digital-payments/all`, {
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
 * Fetch today's revenue broken down by supervisor zones
 * @returns {Promise<Object>} Object with zone-wise revenue data
 */
export const fetchZoneWiseRevenue = async () => {
  try {
    const dateStr = getLocalIsoDate();

    // Fetch cash, digital payments, and outlets for real zone mapping
    const [cashResponse, digitalResponse, outletsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/cash-payments/all`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }),
      fetch(`${API_BASE_URL}/digital-payments/all`, {
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

    // Calculate totals
    Object.keys(zoneRevenue).forEach(zone => {
      zoneRevenue[zone].total = zoneRevenue[zone].cash + zoneRevenue[zone].digital;
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
  fetchTodayRevenue,
  fetchZoneWiseRevenue
};
