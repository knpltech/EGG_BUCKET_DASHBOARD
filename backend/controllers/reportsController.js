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

export const getStatistics = async (req, res) => {
  const startTime = Date.now();

  try {
    const { dateFrom, dateTo, zone } = req.query;
    const startDate = normalizeDateKey(dateFrom) || '';
    const endDate = normalizeDateKey(dateTo) || '';
    const requestedZone = normalizeZoneLabel(zone);

    const [
      salesSnapshot,
      digitalPaymentsSnapshot,
      cashPaymentsSnapshot,
      neccRateSnapshot,
      dailyDamagesSnapshot,
      incentiveSnapshot,
      foodAllowanceSnapshot,
      outletsSnapshot,
    ] = await Promise.all([
      db.collection('dailySales').get(),
      db.collection('digitalPayments').get(),
      db.collection('cashPayments').get(),
      db.collection('neccRates').get(),
      db.collection('dailyDamages').get(),
      db.collection('incentive').get(),
      db.collection('foodAllowance').get(),
      db.collection('outlets').get(),
    ]);

    const outlets = [];
    const outletByAlias = new Map();

    const addOutletAlias = (outlet, value) => {
      const key = normalizeOutletKey(value);
      if (key) outletByAlias.set(key, outlet);
    };

    outletsSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const outlet = {
        id: data.id || doc.id,
        name: data.name || data.area || data.id || doc.id,
        area: data.area || data.name || data.id || doc.id,
        zoneId: data.zoneId || data.zone || data.zoneNumber || null,
        status: data.status || 'Active',
      };

      if (requestedZone && normalizeZoneLabel(outlet.zoneId) !== requestedZone) return;
      if (String(outlet.status || '').toLowerCase() === 'inactive') return;

      outlets.push(outlet);
      [outlet.id, outlet.name, outlet.area, doc.id].forEach((value) => addOutletAlias(outlet, value));
    });

    const includeLooseOutlet = (rawKey) => {
      if (requestedZone) return null;
      const alias = normalizeOutletKey(rawKey);
      if (!alias) return null;
      if (outletByAlias.has(alias)) return outletByAlias.get(alias);

      const outlet = {
        id: String(rawKey),
        name: String(rawKey),
        area: String(rawKey),
        zoneId: null,
        status: 'Active',
      };
      outlets.push(outlet);
      addOutletAlias(outlet, rawKey);
      return outlet;
    };

    const getOutletForKey = (key) => outletByAlias.get(normalizeOutletKey(key)) || includeLooseOutlet(key);
    const outletDateMap = new Map();

    const isDateAllowed = (dateKey) => {
      if (!dateKey) return false;
      if (startDate && dateKey < startDate) return false;
      if (endDate && dateKey > endDate) return false;
      return true;
    };

    const ensureOutletDate = (outlet, dateKey) => {
      if (!outlet || !dateKey) return null;
      const mapKey = `${outlet.id}__${dateKey}`;
      if (!outletDateMap.has(mapKey)) {
        outletDateMap.set(mapKey, {
          outletId: outlet.id,
          outletName: outlet.area || outlet.name || outlet.id,
          zoneId: outlet.zoneId || null,
          date: dateKey,
          salesQty: 0,
          neccRate: 0,
          neccRateTime: 0,
          digitalPay: 0,
          cashPay: 0,
          damages: 0,
          incentive: 0,
          foodAllowance: 0,
        });
      }
      return outletDateMap.get(mapKey);
    };

    const addMappedValues = (docData, field, targetField) => {
      const dateKey = normalizeDateKey(docData.date || docData.createdAt);
      if (!isDateAllowed(dateKey)) return;
      const values = docData[field];
      if (!values || typeof values !== 'object') return;

      Object.entries(values).forEach(([key, value]) => {
        const outlet = getOutletForKey(key);
        const entry = ensureOutletDate(outlet, dateKey);
        if (entry) entry[targetField] += Number(value) || 0;
      });
    };

    salesSnapshot.forEach((doc) => addMappedValues(doc.data() || {}, 'outlets', 'salesQty'));
    digitalPaymentsSnapshot.forEach((doc) => addMappedValues(doc.data() || {}, 'outlets', 'digitalPay'));
    cashPaymentsSnapshot.forEach((doc) => addMappedValues(doc.data() || {}, 'outlets', 'cashPay'));
    dailyDamagesSnapshot.forEach((doc) => addMappedValues(doc.data() || {}, 'damages', 'damages'));
    incentiveSnapshot.forEach((doc) => addMappedValues(doc.data() || {}, 'outlets', 'incentive'));
    foodAllowanceSnapshot.forEach((doc) => addMappedValues(doc.data() || {}, 'outlets', 'foodAllowance'));

    neccRateSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const dateKey = normalizeDateKey(data.date || data.createdAt);
      if (!isDateAllowed(dateKey)) return;
      const eventTime = getEntryTimeMs(data);

      if (data.outlets && typeof data.outlets === 'object') {
        Object.entries(data.outlets).forEach(([key, value]) => {
          const outlet = getOutletForKey(key);
          const entry = ensureOutletDate(outlet, dateKey);
          if (entry && eventTime >= entry.neccRateTime) {
            entry.neccRate = Number(value) || 0;
            entry.neccRateTime = eventTime;
          }
        });
        return;
      }

      const outlet = getOutletForKey(data.outletId || data.outlet);
      const entry = ensureOutletDate(outlet, dateKey);
      if (entry && eventTime >= entry.neccRateTime) {
        entry.neccRate = parseNeccRateValue(data);
        entry.neccRateTime = eventTime;
      }
    });

    const dailyMap = new Map();
    const weeklyMap = new Map();
    const monthlyMap = new Map();
    const outletMap = new Map();
    const neccRates = [];

    const ensureBucket = (map, key, label = key) => {
      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          salesQty: 0,
          revenue: 0,
          digitalPay: 0,
          cashPay: 0,
          totalReceived: 0,
          damages: 0,
          damageCost: 0,
          incentive: 0,
          foodAllowance: 0,
          totalCost: 0,
          closingAmount: 0,
          pending: 0,
          neccRateTotal: 0,
          neccRateCount: 0,
        });
      }
      return map.get(key);
    };

    outletDateMap.forEach((entry) => {
      const revenue = Number((entry.salesQty * entry.neccRate).toFixed(2));
      const damageCost = Number((entry.damages * entry.neccRate).toFixed(2));
      const totalCost = Number((revenue + damageCost + entry.incentive + entry.foodAllowance).toFixed(2));
      const totalReceived = Number((entry.digitalPay + entry.cashPay).toFixed(2));
      const closingAmount = Number((totalReceived - totalCost).toFixed(2));
      const pending = Number((totalReceived - revenue).toFixed(2));
      const week = getWeekBucket(entry.date);
      const month = entry.date.slice(0, 7);
      const monthLabel = formatMonthLabel(entry.date);

      const buckets = [
        ensureBucket(dailyMap, entry.date, formatDisplayDate(entry.date)),
        ensureBucket(weeklyMap, week.key, week.label),
        ensureBucket(monthlyMap, month, monthLabel),
        ensureBucket(outletMap, entry.outletId, entry.outletName),
      ];

      buckets.forEach((bucket) => {
        bucket.salesQty += entry.salesQty;
        bucket.revenue += revenue;
        bucket.digitalPay += entry.digitalPay;
        bucket.cashPay += entry.cashPay;
        bucket.totalReceived += totalReceived;
        bucket.damages += entry.damages;
        bucket.damageCost += damageCost;
        bucket.incentive += entry.incentive;
        bucket.foodAllowance += entry.foodAllowance;
        bucket.totalCost += totalCost;
        bucket.closingAmount += closingAmount;
        bucket.pending += pending;
        if (entry.neccRate > 0) {
          bucket.neccRateTotal += entry.neccRate;
          bucket.neccRateCount += 1;
        }
      });

      if (entry.neccRate > 0) neccRates.push(entry.neccRate);
    });

    const finalizeBucket = (bucket) => ({
      ...bucket,
      salesQty: Math.round(bucket.salesQty),
      revenue: Number(bucket.revenue.toFixed(2)),
      digitalPay: Number(bucket.digitalPay.toFixed(2)),
      cashPay: Number(bucket.cashPay.toFixed(2)),
      totalReceived: Number(bucket.totalReceived.toFixed(2)),
      damages: Math.round(bucket.damages),
      damageCost: Number(bucket.damageCost.toFixed(2)),
      incentive: Number(bucket.incentive.toFixed(2)),
      foodAllowance: Number(bucket.foodAllowance.toFixed(2)),
      totalCost: Number(bucket.totalCost.toFixed(2)),
      closingAmount: Number(bucket.closingAmount.toFixed(2)),
      pending: Number(bucket.pending.toFixed(2)),
      averageNeccRate: bucket.neccRateCount ? Number((bucket.neccRateTotal / bucket.neccRateCount).toFixed(2)) : 0,
    });

    const byKey = (a, b) => a.key.localeCompare(b.key);
    const daily = Array.from(dailyMap.values()).sort(byKey).map(finalizeBucket);
    const weekly = Array.from(weeklyMap.values()).sort(byKey).map(finalizeBucket);
    const monthly = Array.from(monthlyMap.values()).sort(byKey).map(finalizeBucket);
    const outletBreakdown = Array.from(outletMap.values())
      .map(finalizeBucket)
      .sort((a, b) => b.revenue - a.revenue);

    const totals = daily.reduce((acc, item) => ({
      salesQty: acc.salesQty + item.salesQty,
      revenue: acc.revenue + item.revenue,
      digitalPay: acc.digitalPay + item.digitalPay,
      cashPay: acc.cashPay + item.cashPay,
      totalReceived: acc.totalReceived + item.totalReceived,
      damages: acc.damages + item.damages,
      damageCost: acc.damageCost + item.damageCost,
      incentive: acc.incentive + item.incentive,
      foodAllowance: acc.foodAllowance + item.foodAllowance,
      totalCost: acc.totalCost + item.totalCost,
      closingAmount: acc.closingAmount + item.closingAmount,
      pending: acc.pending + item.pending,
    }), {
      salesQty: 0,
      revenue: 0,
      digitalPay: 0,
      cashPay: 0,
      totalReceived: 0,
      damages: 0,
      damageCost: 0,
      incentive: 0,
      foodAllowance: 0,
      totalCost: 0,
      closingAmount: 0,
      pending: 0,
    });

    const bestSalesDay = [...daily].sort((a, b) => b.salesQty - a.salesQty)[0] || null;
    const bestRevenueDay = [...daily].sort((a, b) => b.revenue - a.revenue)[0] || null;
    const highestDamageDay = [...daily].sort((a, b) => b.damages - a.damages)[0] || null;
    const averageDailySales = daily.length ? Math.round(totals.salesQty / daily.length) : 0;
    const averageDailyRevenue = daily.length ? Number((totals.revenue / daily.length).toFixed(2)) : 0;
    const averageNeccRate = neccRates.length
      ? Number((neccRates.reduce((sum, value) => sum + value, 0) / neccRates.length).toFixed(2))
      : 0;

    res.status(200).json({
      success: true,
      filters: { dateFrom: startDate, dateTo: endDate, zone: requestedZone || null },
      totals: {
        ...totals,
        revenue: Number(totals.revenue.toFixed(2)),
        totalReceived: Number(totals.totalReceived.toFixed(2)),
        damageCost: Number(totals.damageCost.toFixed(2)),
        incentive: Number(totals.incentive.toFixed(2)),
        foodAllowance: Number(totals.foodAllowance.toFixed(2)),
        totalCost: Number(totals.totalCost.toFixed(2)),
        closingAmount: Number(totals.closingAmount.toFixed(2)),
        pending: Number(totals.pending.toFixed(2)),
        averageDailySales,
        averageDailyRevenue,
        averageNeccRate,
        damageRate: totals.salesQty ? Number(((totals.damages / totals.salesQty) * 100).toFixed(2)) : 0,
        outletCount: outlets.length,
        daysCount: daily.length,
      },
      daily,
      weekly,
      monthly,
      outletBreakdown,
      highlights: { bestSalesDay, bestRevenueDay, highestDamageDay },
      _performance: {
        totalTimeMs: Date.now() - startTime,
        recordsProcessed:
          salesSnapshot.size +
          digitalPaymentsSnapshot.size +
          cashPaymentsSnapshot.size +
          neccRateSnapshot.size +
          dailyDamagesSnapshot.size +
          incentiveSnapshot.size +
          foodAllowanceSnapshot.size,
      },
    });
  } catch (error) {
    console.error('Statistics error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics data',
      message: error.message,
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

function normalizeZoneLabel(value) {
  if (!value) return null;
  return String(value).toLowerCase().replace('zone', '').trim();
}

function getWeekBucket(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const key = toIsoDate(start);
  return {
    key,
    label: `${formatShortDate(start)} - ${formatShortDate(end)}`,
  };
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}`;
}

function formatMonthLabel(isoDate) {
  const [year, month] = String(isoDate).split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return isoDate;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}
