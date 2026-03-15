import dotenv from 'dotenv';
dotenv.config();
import { db } from "../config/firebase.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not set");

const isFirestoreQuotaError = (err) => {
  if (!err) return false;
  const code = String(err.code ?? "").toLowerCase();
  const details = String(err.details || err.message || "").toLowerCase();
  return (
    code === "8" ||
    code === "resource-exhausted" ||
    details.includes("quota exceeded") ||
    details.includes("resource_exhausted") ||
    details.includes("resource exhausted") ||
    details.includes("quota")
  );
};

const LOGIN_QUOTA_RETRY_SECONDS = Number(process.env.LOGIN_QUOTA_RETRY_SECONDS || 60);


export const loginUser = async (req, res) => {
  try {
    let { username, password, role, zone } = req.body;

    if (!username || !password || !role)
      return res.status(400).json({ success: false, error: "Missing credentials" });

    // Normalize role value
    role = String(role).trim().toLowerCase();

    let collection = null;
    if (role === "admin") collection = "admin";
    else if (role === "dataagent") collection = "dataagents";
    else if (role === "viewer") collection = "viewers";
    else if (role === "supervisor") collection = "supervisors";
    if (!collection)
      return res.status(400).json({ success: false, error: "Invalid role" });

    const userSnap = await db.collection(collection).doc(username).get();
    if (!userSnap.exists)
      return res.status(401).json({ success: false, error: "Invalid credentials" });

    const user = userSnap.data();

    // For supervisors, validate that selected zone matches their assigned zone
    if (role === "supervisor") {
      const userZone = user.zoneId || user.zone;
      // Normalize zone comparison (handle "Zone 1" vs "zone 1" vs "1")
      const normalizeZone = (z) => z ? String(z).toLowerCase().replace('zone', '').trim() : null;
      if (zone && userZone && normalizeZone(zone) !== normalizeZone(userZone)) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }
    }

    // For dataagents with assigned zone, validate selected zone matches
    if (role === "dataagent") {
      const userZone = user.zoneId || user.zone;
      const normalizeZone = (z) => z ? String(z).toLowerCase().replace('zone', '').trim() : null;
      if (zone && userZone && normalizeZone(zone) !== normalizeZone(userZone)) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }
    }

    // Role validation
    if (
      role === "admin" &&
      !(user.role === "Admin" || (Array.isArray(user.roles) && user.roles.includes("admin")))
    ) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    if (
      role === "dataagent" &&
      !(user.role === "DataAgent" || (Array.isArray(user.roles) && user.roles.includes("dataagent")))
    ) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    if (
      role === "viewer" &&
      !(user.role === "Viewer" || (Array.isArray(user.roles) && user.roles.includes("viewer")))
    ) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }


    // Password validation (SECURE)
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

// Generate JWT
const token = jwt.sign(
  {
    username,
    role: user.role,
  },
  JWT_SECRET,
  { expiresIn: "8h" }
);

// Remove password before sending response
const { password: _, ...userWithoutPassword } = user;

return res.json({
  success: true,
  token,
  user: {
    username,
    ...userWithoutPassword,
  },
});

  }catch (err) { 
    if (isFirestoreQuotaError(err)) {
      console.error("loginUser firestore quota error:", err.message);
      const retryAfter = Number.isFinite(LOGIN_QUOTA_RETRY_SECONDS) && LOGIN_QUOTA_RETRY_SECONDS > 0
        ? Math.floor(LOGIN_QUOTA_RETRY_SECONDS)
        : 60;
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        error: "Firestore quota exceeded. Please wait and retry.",
        code: "FIRESTORE_QUOTA_EXCEEDED",
        retryAfterSeconds: retryAfter,
      });
    }

    console.error("loginUser error:", err); 
    return res.status(500).json({ success: false, error: err.message }); 
  } 
};