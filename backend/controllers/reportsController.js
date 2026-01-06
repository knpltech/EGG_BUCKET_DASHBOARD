// reportsController.js - FOR NESTED OUTLETS STRUCTURE
import { db } from '../config/firebase.js';

let outletsCache = null;
let outletsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Get list of available outlets from nested structure
 */
export const getAvailableOutlets = async (req, res) => {
  try {
    const now = Date.now();
    
    if (outletsCache && (now - outletsCacheTime) < CACHE_DURATION) {
      console.log('✅ Returning cached outlets');
      return res.status(200).json(outletsCache);
    }

    console.log('🔍 Extracting outlets from nested structure...');

    const outletNames = new Set();

    // Fetch documents
    const [salesSnapshot, digitalSnapshot, cashSnapshot, neccSnapshot] = await Promise.all([
      db.collection('dailySales').limit(50).get(),
      db.collection('digitalPayments').limit(50).get(),
      db.collection('cashPayments').limit(50).get(),
      db.collection('neccRate').limit(50).get()
    ]);

    console.log('📊 Found records:', {
      sales: salesSnapshot.size,
      digital: digitalSnapshot.size,
      cash: cashSnapshot.size,
      necc: neccSnapshot.size
    });

    // Extract outlet names from nested outlets object
    [salesSnapshot, digitalSnapshot, cashSnapshot, neccSnapshot].forEach(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.outlets && typeof data.outlets === 'object') {
          Object.keys(data.outlets).forEach(outletName => {
            outletNames.add(outletName);
          });
        }
      });
    });

    const outlets = Array.from(outletNames).map(name => ({ 
      id: name, 
      name: name 
    }));
    
    const responseData = {
      success: true,
      outlets,
      totalRecords: {
        sales: salesSnapshot.size,
        digitalPayments: digitalSnapshot.size,
        cashPayments: cashSnapshot.size,
        neccRate: neccSnapshot.size
      },
      cached: false
    };

    outletsCache = responseData;
    outletsCacheTime = now;

    console.log('✅ Found', outlets.length, 'unique outlets:', Array.from(outletNames));
    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get reports for nested outlets structure
 */
export const getReports = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { outletId, dateFrom, dateTo } = req.query;

    if (!outletId) {
      return res.status(400).json({ 
        success: false,
        error: 'Outlet ID is required' 
      });
    }

    console.log('📊 Fetching reports for outlet:', outletId);

    // Fetch all collections in parallel
    const [salesSnapshot, digitalPaymentsSnapshot, cashPaymentsSnapshot, neccRateSnapshot] = await Promise.all([
      db.collection('dailySales').limit(100).get(),
      db.collection('digitalPayments').limit(100).get(),
      db.collection('cashPayments').limit(100).get(),
      db.collection('neccRate').limit(100).get()
    ]);

    const fetchTime = Date.now() - startTime;
    console.log(`⚡ Fetched in ${fetchTime}ms`);

    // Process data - extract values for the specific outlet
    const dateMap = {};

    // Process sales data
    salesSnapshot.forEach(doc => {
      const data = doc.data();
      const dateKey = formatDate(data.date || data.createdAt);
      
      // Check if this document has data for our outlet
      if (data.outlets && data.outlets[outletId] !== undefined) {
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = { 
            date: dateKey, 
            salesQty: 0, 
            neccRate: 0, 
            totalAmount: 0, 
            digitalPay: 0, 
            cashPay: 0, 
            totalRecv: 0, 
            difference: 0 
          };
        }
        
        // The value in outlets[outletName] is the quantity/amount
        dateMap[dateKey].salesQty += parseFloat(data.outlets[outletId] || 0);
      }
    });

    // Process digital payments
    digitalPaymentsSnapshot.forEach(doc => {
      const data = doc.data();
      const dateKey = formatDate(data.date || data.createdAt);
      
      if (data.outlets && data.outlets[outletId] !== undefined) {
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = { 
            date: dateKey, 
            salesQty: 0, 
            neccRate: 0, 
            totalAmount: 0, 
            digitalPay: 0, 
            cashPay: 0, 
            totalRecv: 0, 
            difference: 0 
          };
        }
        dateMap[dateKey].digitalPay += parseFloat(data.outlets[outletId] || 0);
      }
    });

    // Process cash payments
    cashPaymentsSnapshot.forEach(doc => {
      const data = doc.data();
      const dateKey = formatDate(data.date || data.createdAt);
      
      if (data.outlets && data.outlets[outletId] !== undefined) {
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = { 
            date: dateKey, 
            salesQty: 0, 
            neccRate: 0, 
            totalAmount: 0, 
            digitalPay: 0, 
            cashPay: 0, 
            totalRecv: 0, 
            difference: 0 
          };
        }
        dateMap[dateKey].cashPay += parseFloat(data.outlets[outletId] || 0);
      }
    });

    // Process NECC rate - might be stored differently
    neccRateSnapshot.forEach(doc => {
      const data = doc.data();
      const dateKey = formatDate(data.date || data.createdAt);
      
      if (dateMap[dateKey]) {
        // Try different structures for NECC rate
        if (data.outlets && data.outlets[outletId] !== undefined) {
          dateMap[dateKey].neccRate = parseFloat(data.outlets[outletId] || 0);
        } else if (data.rate !== undefined) {
          // If NECC rate is global (not per outlet)
          dateMap[dateKey].neccRate = parseFloat(data.rate || 0);
        }
      }
    });

    // Convert to array and calculate
    let transactions = Object.values(dateMap).map(t => {
      // If no NECC rate per outlet, try to calculate from total/quantity
      if (t.neccRate === 0 && t.salesQty > 0) {
        const totalReceived = t.digitalPay + t.cashPay;
        if (totalReceived > 0) {
          t.neccRate = parseFloat((totalReceived / t.salesQty).toFixed(2));
        }
      }
      
      t.totalAmount = parseFloat((t.salesQty * t.neccRate).toFixed(2));
      t.totalRecv = parseFloat((t.digitalPay + t.cashPay).toFixed(2));
      t.difference = parseFloat((t.totalRecv - t.totalAmount).toFixed(2));
      return t;
    });

    // Sort by date
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply date filtering
    if (dateFrom || dateTo) {
      const startDate = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
      const endDate = dateTo ? new Date(dateTo) : new Date('2100-12-31');
      transactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= startDate && tDate <= endDate;
      });
    }

    // Calculate summary
    const totalSalesQuantity = transactions.reduce((sum, t) => sum + (t.salesQty || 0), 0);
    const averageNeccRate = transactions.length > 0 
      ? transactions.reduce((sum, t) => sum + (t.neccRate || 0), 0) / transactions.length 
      : 0;
    const totalAmount = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalDifference = transactions.reduce((sum, t) => sum + (t.difference || 0), 0);

    console.log(`✅ Processed in ${Date.now() - startTime}ms - ${transactions.length} transactions`);

    res.status(200).json({
      success: true,
      outletId,
      totalSalesQuantity,
      averageNeccRate: parseFloat(averageNeccRate.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      totalDifference: parseFloat(totalDifference.toFixed(2)),
      transactions,
      _performance: {
        fetchTimeMs: fetchTime,
        totalTimeMs: Date.now() - startTime,
        recordsProcessed: salesSnapshot.size + digitalPaymentsSnapshot.size + cashPaymentsSnapshot.size + neccRateSnapshot.size,
        transactionsProcessed: transactions.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch reports data',
      message: error.message 
    });
  }
};

export const exportReports = async (req, res) => {
  try {
    const { outletId, format } = req.query;
    if (!outletId) {
      return res.status(400).json({ success: false, error: 'Outlet ID is required' });
    }
    res.status(200).json({
      success: true,
      message: 'Export functionality coming soon',
      format: format || 'excel',
      outletId
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to export reports', message: error.message });
  }
};

function formatDate(date) {
  if (!date) return 'Unknown Date';
  try {
    // Handle string dates like "2026-01-03"
    if (typeof date === 'string') {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
      }
    }
    
    // Handle Firestore timestamp
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
  } catch (error) {
    return 'Invalid Date';
  }
}