// Delete an outlet by ID
export const deleteOutlet = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Missing outlet ID" });
    }
    await db.collection("outlets").doc(id).delete();
    return res.json({ success: true, message: "Outlet deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
import { db } from "../config/firebase.js";

// Add a new outlet
export const addOutlet = async (req, res) => {
  try {
    console.log('=== ADD OUTLET REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { id, name, area, contact, phone, status, reviewStatus, zoneId, createdBy } = req.body;
    
    console.log('Extracted zoneId:', zoneId);
    
    if (!id || !name || !area || !zoneId) {
      console.log('Missing required fields - id:', id, 'name:', name, 'area:', area, 'zoneId:', zoneId);
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    await db.collection("outlets").doc(id).set({
      id,
      name,
      area,
      contact,
      phone,
      status,
      reviewStatus,
      zoneId,
      createdBy: createdBy || null,
      createdAt: new Date()
    });
    console.log('Outlet saved successfully with zoneId:', zoneId);
    return res.json({ success: true, message: "Outlet added successfully" });
  } catch (err) {
    console.error('Add outlet error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
// Normalize zone for comparison (handles "2" vs "Zone 2" mismatch)
const normalizeZone = (z) => {
  if (!z) return null;
  const str = String(z).toLowerCase().replace('zone', '').trim();
  return str;
};

// Get outlets for a specific zone
export const getZoneOutlets = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { createdBy } = req.query;
    if (!zoneId) {
      return res.status(400).json({ success: false, error: "Missing zoneId" });
    }
    
    // Get all outlets and filter by normalized zone (handles "2" vs "Zone 2" mismatch)
    const snapshot = await db.collection("outlets").get();
    let outlets = snapshot.docs.map(doc => doc.data());
    
    // Filter by zone (normalized comparison)
    const normalizedRequestZone = normalizeZone(zoneId);
    outlets = outlets.filter(outlet => normalizeZone(outlet.zoneId) === normalizedRequestZone);
    
    // Filter by createdBy if provided
    if (createdBy) {
      outlets = outlets.filter(outlet => outlet.createdBy === createdBy);
    }
    
    console.log('getZoneOutlets - requested zone:', zoneId, '| normalized:', normalizedRequestZone, '| found:', outlets.length);
    return res.json(outlets);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Get all outlets
export const getAllOutlets = async (req, res) => {
  try {
    const snapshot = await db.collection("outlets").get();
    const outlets = snapshot.docs.map(doc => doc.data());
    return res.json(outlets);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
