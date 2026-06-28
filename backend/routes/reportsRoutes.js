// reportsRoutes.js
// Routes for reports endpoints

import express from 'express';
import * as reportsController from '../controllers/reportsController.js';
import { cacheJsonResponse } from '../middleware/responseCache.js';

const router = express.Router();
const env = globalThis.process?.env || {};
const REPORTS_OUTLETS_CACHE_TTL_MS = Number(env.REPORTS_OUTLETS_CACHE_TTL_MS || 300_000);
const STATISTICS_CACHE_TTL_MS = Number(env.STATISTICS_CACHE_TTL_MS || 60_000);

/**
 * @route   GET /api/reports/outlets
 * @desc    Get list of available outlets with data
 * @access  Public
 */
router.get(
  '/outlets',
  cacheJsonResponse({ ttlMs: REPORTS_OUTLETS_CACHE_TTL_MS, namespace: 'reports-outlets' }),
  reportsController.getAvailableOutlets,
);

/**
 * @route   GET /api/reports/statistics
 * @desc    Get cross-outlet statistics with charts-ready aggregates
 * @access  Private (add authentication middleware if needed)
 * @query   dateFrom (optional), dateTo (optional), zone (optional)
 */
router.get(
  '/statistics',
  cacheJsonResponse({ ttlMs: STATISTICS_CACHE_TTL_MS, maxEntries: 200, namespace: 'reports-statistics' }),
  reportsController.getStatistics,
);

/**
 * @route   GET /api/reports
 * @desc    Get aggregated reports data for an outlet
 * @access  Private (add authentication middleware if needed)
 * @query   outletId (required), dateFrom (optional), dateTo (optional)
 */
router.get('/', reportsController.getReports);

/**
 * @route   GET /api/reports/export
 * @desc    Export reports data as Excel or PDF
 * @access  Private
 * @query   outletId (required), format (pdf/excel), dateFrom (optional), dateTo (optional)
 */
router.get('/export', reportsController.exportReports);

export default router;
