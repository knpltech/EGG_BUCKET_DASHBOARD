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

    // Find today's data
    const todaysCash = Array.isArray(cashPayments) 
      ? cashPayments.find(p => p.date === dateStr)
      : null;
    const todaysDigital = Array.isArray(digitalPayments)
      ? digitalPayments.find(p => p.date === dateStr)
      : null;

    const cashTotal = todaysCash?.total || 0;
    const digitalTotal = todaysDigital?.total || 0;
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

    // Fetch cash and digital payments
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

    // Find today's payments
    const todaysCash = Array.isArray(cashPayments) 
      ? cashPayments.find(p => p.date === dateStr)
      : null;
    const todaysDigital = Array.isArray(digitalPayments)
      ? digitalPayments.find(p => p.date === dateStr)
      : null;

    // Initialize zone revenue object
    const zoneRevenue = {
      'Zone 1': { cash: 0, digital: 0, total: 0 },
      'Zone 2': { cash: 0, digital: 0, total: 0 },
      'Zone 3': { cash: 0, digital: 0, total: 0 },
      'Zone 4': { cash: 0, digital: 0, total: 0 },
      'Zone 5': { cash: 0, digital: 0, total: 0 },
    };

    // Define outlet to zone mapping (will be updated based on actual data)
    const outletToZone = {
      'AECS LAYOUT': 1,
      'AECS Layout': 1,
      'SINGASANDRA': 1,
      'Singasandra': 1,
      'HOSA ROAD': 1,
      'Hosa Road': 1,
      'KUDLU GATE': 1,
      'Kudlu Gate': 1,
      'BANDEPALYA': 2,
      'Bandepalya': 2,
    };

    // Process cash payments
    if (todaysCash?.outlets && typeof todaysCash.outlets === 'object') {
      Object.entries(todaysCash.outlets).forEach(([outlet, amount]) => {
        const amountNum = parseFloat(amount) || 0;
        if (amountNum === 0) return;

        // Try to find zone
        let zone = outletToZone[outlet] || outletToZone[outlet.toUpperCase()] || null;

        if (zone) {
          const zoneKey = `Zone ${zone}`;
          zoneRevenue[zoneKey].cash += amountNum;
        }
      });
    }

    // Process digital payments
    if (todaysDigital?.outlets && typeof todaysDigital.outlets === 'object') {
      Object.entries(todaysDigital.outlets).forEach(([outlet, amount]) => {
        const amountNum = parseFloat(amount) || 0;
        if (amountNum === 0) return;

        // Try to find zone
        let zone = outletToZone[outlet] || outletToZone[outlet.toUpperCase()] || null;

        if (zone) {
          const zoneKey = `Zone ${zone}`;
          zoneRevenue[zoneKey].digital += amountNum;
        }
      });
    }

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