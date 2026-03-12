// reportsApi.js
// Frontend API service for fetching reports data from backend

// Configuration - Use Vite env variable or fallback to relative path for deployment compatibility
const config = {
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api'
};

const API_BASE_URL = config.apiBaseUrl;

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
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
      ? cashPayments.filter(p => p.date === dateStr)
      : [];
    const todaysDigital = Array.isArray(digitalPayments)
      ? digitalPayments.filter(p => p.date === dateStr)
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
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const normalizeZoneLabel = (zone) => {
      if (!zone) return null;
      const raw = String(zone).trim();
      const numberMatch = raw.match(/(\d+)/);
      return numberMatch ? `Zone ${numberMatch[1]}` : raw;
    };

    const normalizeOutletKey = (value) => {
      if (!value) return null;
      return String(value).trim().toUpperCase();
    };

    const createEmptyZoneRevenue = () => ({
      'Zone 1': { cash: 0, digital: 0, total: 0 },
      'Zone 2': { cash: 0, digital: 0, total: 0 },
      'Zone 3': { cash: 0, digital: 0, total: 0 },
      'Zone 4': { cash: 0, digital: 0, total: 0 },
      'Zone 5': { cash: 0, digital: 0, total: 0 },
    });

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

    // Aggregate all payment documents for today, not just the first one.
    const todaysCash = Array.isArray(cashPayments)
      ? cashPayments.filter(p => p.date === dateStr)
      : [];
    const todaysDigital = Array.isArray(digitalPayments)
      ? digitalPayments.filter(p => p.date === dateStr)
      : [];

    const zoneRevenue = createEmptyZoneRevenue();

    const outletToZone = new Map();
    if (Array.isArray(outlets)) {
      outlets.forEach((outlet) => {
        const zoneKey = normalizeZoneLabel(outlet.zoneId || outlet.zone || outlet.zoneNumber);
        if (!zoneKey) return;
        if (!zoneRevenue[zoneKey]) {
          zoneRevenue[zoneKey] = { cash: 0, digital: 0, total: 0 };
        }

        [outlet.id, outlet.area, outlet.name].forEach((key) => {
          const normalized = normalizeOutletKey(key);
          if (normalized) outletToZone.set(normalized, zoneKey);
        });
      });
    }

    const addPaymentTotals = (paymentDoc, paymentType) => {
      const outletsObj = paymentDoc?.outlets;
      if (!outletsObj || typeof outletsObj !== 'object') return;

      const addedByZoneMap = new Map();
      const addedByPerOutlet = paymentDoc?.addedByPerOutlet;
      if (addedByPerOutlet && typeof addedByPerOutlet === 'object') {
        Object.entries(addedByPerOutlet).forEach(([outletKey, addedBy]) => {
          const zoneKey = normalizeZoneLabel(addedBy?.zone);
          const normalizedOutlet = normalizeOutletKey(outletKey);
          if (zoneKey && normalizedOutlet) {
            if (!zoneRevenue[zoneKey]) {
              zoneRevenue[zoneKey] = { cash: 0, digital: 0, total: 0 };
            }
            addedByZoneMap.set(normalizedOutlet, zoneKey);
          }
        });
      }

      Object.entries(outletsObj).forEach(([outlet, amount]) => {
        const amountNum = parseFloat(amount) || 0;
        if (amountNum === 0) return;

        const normalizedOutlet = normalizeOutletKey(outlet);
        const zoneKey = outletToZone.get(normalizedOutlet) || addedByZoneMap.get(normalizedOutlet);
        if (!zoneKey) return;

        zoneRevenue[zoneKey][paymentType] += amountNum;
      });
    };

    todaysCash.forEach(paymentDoc => addPaymentTotals(paymentDoc, 'cash'));
    todaysDigital.forEach(paymentDoc => addPaymentTotals(paymentDoc, 'digital'));

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