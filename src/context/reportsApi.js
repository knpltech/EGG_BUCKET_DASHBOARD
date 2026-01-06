// reportsApi.js
// Frontend API service for fetching reports data from backend

// Configuration - Update this with your actual backend URL
const config = {
  apiBaseUrl: 'http://localhost:5000/api' // Update with your backend URL
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
    // Changed from /outlets to /reports/outlets
    const response = await fetch(`${API_BASE_URL}/reports/outlets`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch outlets: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Backend returns: { success: true, outlets: [...], totalRecords: {...} }
    // Return the outlets array
    return data.outlets || [];
    
  } catch (error) {
    console.error('Error fetching outlets:', error);
    
    // Fallback: If the discovery endpoint fails, return demo outlets
    console.log('Using fallback demo outlets');
    return [
      { id: '1', name: 'AECS Layout' },
      { id: '2', name: 'HSR Layout' },
      { id: '3', name: 'Koramangala' },
      { id: '4', name: 'Whitefield' }
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

export default {
  fetchReportsData,
  fetchOutlets,
  exportReports
};