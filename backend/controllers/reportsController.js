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
      db.collection('neccRates').limit(50).get()
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

    const outletAliases = await resolveOutletAliases(outletId);
    const hasOutletAlias = (value) => outletAliases.has(normalizeOutletKey(value));
    const getOutletValue = (mapObj = {}) => {
      if (!mapObj || typeof mapObj !== 'object') return null;
      for (const [key, value] of Object.entries(mapObj)) {
        if (hasOutletAlias(key)) {
          return Number(value) || 0;
        }
      }
      return null;
    };


    // Fetch all collections in parallel, including dailyDamages.
    // Avoid hard limits here so reports always see the correct NECC entry
    // for the selected outlet/date range.
    const [salesSnapshot, digitalPaymentsSnapshot, cashPaymentsSnapshot, neccRateSnapshot, dailyDamagesSnapshot] = await Promise.all([
      db.collection('dailySales').get(),
      db.collection('digitalPayments').get(),
      db.collection('cashPayments').get(),
      db.collection('neccRates').get(),
      db.collection('dailyDamages').get()
    ]);

    const fetchTime = Date.now() - startTime;
    console.log(`⚡ Fetched in ${fetchTime}ms`);

    // Process data - extract values for the specific outlet
    const dateMap = {};
    const ensureDateEntry = (dateKey) => {
      if (!dateKey) return null;
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          salesQty: 0,
          neccRate: 0,
          totalAmount: 0,
          digitalPay: 0,
          cashPay: 0,
          totalRecv: 0,
          difference: 0,
          damages: 0,
        };
      }
      return dateMap[dateKey];
    };

    // Process sales data
    salesSnapshot.forEach(doc => {
      const data = doc.data();
      const dateKey = normalizeDateKey(data.date || data.createdAt);
      if (!dateKey) return;

      const salesValue = getOutletValue(data.outlets);
      if (salesValue !== null) {
        ensureDateEntry(dateKey).salesQty += salesValue;
      }
    });

    // Process digital payments
    digitalPaymentsSnapshot.forEach(doc => {
      const data = doc.data();
      const dateKey = normalizeDateKey(data.date || data.createdAt);
      if (!dateKey) return;

      const digitalValue = getOutletValue(data.outlets);
      if (digitalValue !== null) {
        ensureDateEntry(dateKey).digitalPay += digitalValue;
      }
    });

    // Process cash payments
    cashPaymentsSnapshot.forEach(doc => {
      const data = doc.data();
      const dateKey = normalizeDateKey(data.date || data.createdAt);
      if (!dateKey) return;

      const cashValue = getOutletValue(data.outlets);
      if (cashValue !== null) {
        ensureDateEntry(dateKey).cashPay += cashValue;
      }
    });

    const neccRateMeta = {};

    // Process NECC rate - outlet specific, supports legacy and current formats
    neccRateSnapshot.forEach(doc => {
      const data = doc.data();

      const dateKey = normalizeDateKey(data.date || data.createdAt);
      if (!dateKey) return;

      let matched = hasOutletAlias(data.outletId) || hasOutletAlias(data.outlet);
      let rateValue = parseNeccRateValue(data);

      if (!matched && data.outlets && typeof data.outlets === 'object') {
        const mapRateValue = getOutletValue(data.outlets);
        if (mapRateValue !== null) {
          matched = true;
          rateValue = mapRateValue;
        }
      }

      if (matched) {
        const entry = ensureDateEntry(dateKey);
        if (!entry) return;
        const eventTime = getEntryTimeMs(data);
        if (!neccRateMeta[dateKey] || eventTime >= neccRateMeta[dateKey]) {
          entry.neccRate = Number(rateValue) || 0;
          neccRateMeta[dateKey] = eventTime;
        }
      }
    });


    // Add damages from dailyDamages collection
    dailyDamagesSnapshot.forEach(doc => {
      const data = doc.data();
      const dateKey = normalizeDateKey(data.date || data.createdAt);
      if (!dateKey) return;
      const damagesValue = getOutletValue(data.damages);
      if (damagesValue !== null) {
        ensureDateEntry(dateKey).damages = damagesValue;
      }
    });

    // Convert to array and calculate
    let transactions = Object.values(dateMap).map(t => {
      // Only use NECC rate from neccrate collection; do not calculate or fallback
      t.totalAmount = parseFloat((t.salesQty * t.neccRate).toFixed(2));
      t.totalRecv = parseFloat((t.digitalPay + t.cashPay).toFixed(2));
      t.difference = parseFloat((t.totalRecv - t.totalAmount).toFixed(2));
      t.damages = t.damages || 0;
      return t;
    });

    // Sort by date
    transactions.sort((a, b) => b.date.localeCompare(a.date));

    // Apply date filtering
    if (dateFrom || dateTo) {
      const startDate = normalizeDateKey(dateFrom) || '2000-01-01';
      const endDate = normalizeDateKey(dateTo) || '2100-12-31';
      transactions = transactions.filter(t => {
        return t.date >= startDate && t.date <= endDate;
      });
    }

    transactions = transactions.map((transaction) => ({
      ...transaction,
      date: formatDisplayDate(transaction.date),
    }));


    // Calculate summary
    const totalSalesQuantity = transactions.reduce((sum, t) => sum + (t.salesQty || 0), 0);
    const averageNeccRate = transactions.length > 0 
      ? transactions.reduce((sum, t) => sum + (t.neccRate || 0), 0) / transactions.length 
      : 0;
    const totalAmount = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalDifference = transactions.reduce((sum, t) => sum + (t.difference || 0), 0);
    const totalDamages = transactions.reduce((sum, t) => sum + (t.damages || 0), 0);

    console.log(`✅ Processed in ${Date.now() - startTime}ms - ${transactions.length} transactions`);

    res.status(200).json({
      success: true,
      outletId,
      totalSalesQuantity,
      averageNeccRate: parseFloat(averageNeccRate.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      totalDifference: parseFloat(totalDifference.toFixed(2)),
      totalDamages: parseFloat(totalDamages.toFixed(2)),
      transactions,
      _performance: {
        fetchTimeMs: fetchTime,
        totalTimeMs: Date.now() - startTime,
        recordsProcessed: salesSnapshot.size + digitalPaymentsSnapshot.size + cashPaymentsSnapshot.size + neccRateSnapshot.size + dailyDamagesSnapshot.size,
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

function normalizeDateKey(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('-');
      return `${year}-${month}-${day}`;
    }
  }

  try {
    const parsedValue = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(parsedValue.getTime())) return '';

    const year = parsedValue.getFullYear();
    const month = String(parsedValue.getMonth() + 1).padStart(2, '0');
    const day = String(parsedValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return 'Unknown Date';
  const [year, month, day] = String(isoDate).split('-');
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(parsed.getTime())) return isoDate;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parsed.getMonth()]} ${String(parsed.getDate()).padStart(2, '0')}, ${parsed.getFullYear()}`;
}

function normalizeOutletKey(value) {
  return String(value || '').trim().toUpperCase();
}

async function resolveOutletAliases(requestedOutletId) {
  const aliases = new Set();
  const addAlias = (value) => {
    const key = normalizeOutletKey(value);
    if (key) aliases.add(key);
  };

  addAlias(requestedOutletId);

  try {
    const outletsSnapshot = await db.collection('outlets').get();
    outletsSnapshot.forEach((doc) => {
      const outlet = doc.data() || {};
      const rawKeys = [outlet.id, outlet.name, outlet.area, doc.id];
      const normalizedKeys = rawKeys.map(normalizeOutletKey).filter(Boolean);
      const matchesRequested = normalizedKeys.includes(normalizeOutletKey(requestedOutletId));

      if (matchesRequested) {
        rawKeys.forEach(addAlias);
      }
    });
  } catch (error) {
    console.warn('Failed to resolve outlet aliases, using requested outlet only:', error.message);
  }

  return aliases;
}

function parseNeccRateValue(data = {}) {
  if (typeof data.rate === 'number' && Number.isFinite(data.rate)) {
    return data.rate;
  }

  if (typeof data.rateValue === 'number' && Number.isFinite(data.rateValue)) {
    return data.rateValue;
  }

  if (typeof data.rate === 'string') {
    const match = data.rate.replace(/,/g, '').match(/([0-9]+(\.[0-9]+)?)/);
    return match ? Number(match[1]) : 0;
  }

  return 0;
}

function getEntryTimeMs(data = {}) {
  const candidates = [data.updatedAt, data.createdAt, data.date];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate && typeof candidate.toDate === 'function') {
      const t = candidate.toDate().getTime();
      if (!Number.isNaN(t)) return t;
      continue;
    }

    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) {
      return d.getTime();
    }
  }

  return 0;
}
