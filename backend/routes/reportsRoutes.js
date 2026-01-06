// reportsRoutes.js
// Routes for reports endpoints

import express from 'express';
import * as reportsController from '../controllers/reportsController.js';

const router = express.Router();

/**
 * @route   GET /api/reports/outlets
 * @desc    Get list of available outlets with data
 * @access  Public
 */
router.get('/outlets', reportsController.getAvailableOutlets);

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