// Get all data agents from Firestore
export const getAllDataAgents = async (req, res) => {
  try {
    const snapshot = await db.collection("dataagents").get();
    const dataagents = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password;
      return { id: doc.id, ...data };
    });
    res.status(200).json(dataagents);
  } catch (error) {
    res.status(500).json({ message: "Error fetching data agents", error: error.message });
  }
};
// Get all supervisors from Firestore
export const getAllSupervisors = async (req, res) => {
  try {
    const snapshot = await db.collection("supervisors").get();
    const supervisors = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password;
      return { id: doc.id, ...data };
    });
    res.status(200).json(supervisors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching supervisors", error: error.message });
  }
};
// Get all distributors from Firestore
export const getAllDistributors = async (req, res) => {
  try {
    const snapshot = await db.collection("distributors").get();
    const distributors = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password;
      return { id: doc.id, ...data };
    });
    res.status(200).json(distributors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching distributors", error: error.message });
  }
};
// Get all admin users from Firestore
// Get all viewers from Firestore
export const getAllViewers = async (req, res) => {
  try {
    const snapshot = await db.collection("viewers").get();
    const viewers = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password;
      return { id: doc.id, ...data };
    });
    res.status(200).json(viewers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching viewers", error: error.message });
  }
};
export const getAllUsers = async (req, res) => {
  try {
    const snapshot = await db.collection("admin").get();
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      // Never send password hash to frontend
      delete data.password;
      return { id: doc.id, ...data };
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching admin users", error: error.message });
  }
};
import { db } from "../config/firebase.js";
import bcrypt from "bcryptjs";

const RETAIL_ADMIN_API_URL = process.env.RETAIL_ADMIN_API_URL || "https://eggbucketretailadmin.onrender.com/api/admin";
const RETAIL_ADMIN_REQUEST_TIMEOUT_MS = 15000;

const toNumber = (value) => {
  if (typeof value === "string") {
    const numeric = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(numeric) ? numeric : 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getRetailAdminToken = async () => {
  const configuredToken = String(process.env.RETAIL_ADMIN_TOKEN || "").trim();
  if (configuredToken) return configuredToken;

  const username = String(process.env.RETAIL_ADMIN_USERNAME || "").trim();
  const password = String(process.env.RETAIL_ADMIN_PASSWORD || "");
  if (!username || !password) {
    throw new Error("Retail Admin credentials are not configured on this server.");
  }

  const response = await fetch(`${RETAIL_ADMIN_API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role: "admin" }),
    signal: AbortSignal.timeout(RETAIL_ADMIN_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Retail Admin login failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!data?.token) {
    throw new Error("Retail Admin login did not return a token.");
  }

  return data.token;
};

const getDamageValue = (entry = {}) => {
  const candidates = [
    entry.damage,
    entry.damages,
    entry.damageQty,
    entry.damageQuantity,
    entry.damagedQty,
    entry.damagedQuantity,
    entry.damagedEggs,
    entry.brokenEggs,
    entry.breakage,
    entry.waste,
    entry.loss,
  ];

  for (const value of candidates) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") {
      const nestedValue = value.total ?? value.quantity ?? value.qty ?? value.count ?? value.value;
      if (nestedValue !== null && nestedValue !== undefined && nestedValue !== "") return toNumber(nestedValue);
      continue;
    }
    return toNumber(value);
  }

  return 0;
};

const getReturnValue = (entry = {}) => {
  const candidates = [
    entry.return,
    entry.returns,
    entry.returnQty,
    entry.returnQuantity,
    entry.returnedQty,
    entry.returnedQuantity,
    entry.returnedEggs,
    entry.returnEggs,
    entry.returned,
  ];

  for (const value of candidates) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") {
      const nestedValue = value.total ?? value.quantity ?? value.qty ?? value.count ?? value.value;
      if (nestedValue !== null && nestedValue !== undefined && nestedValue !== "") return toNumber(nestedValue);
      continue;
    }
    return toNumber(value);
  }

  return 0;
};

const getCollectionRowsFromCustomers = (customers, date) => {
  if (!Array.isArray(customers) || !date) return [];

  const getPaymentMethod = (entry, cash, upi) => {
    const method = String(entry?.paymentMethod || entry?.paymentMode || entry?.mode || "").trim();
    if (method) return method;
    if (cash > 0 && upi > 0) return "Cash + UPI";
    if (cash > 0) return "Cash";
    if (upi > 0) return "UPI";
    return "-";
  };

  const formatDeliveryTime = (value) => {
    if (!value) return null;
    if (typeof value === "string" || typeof value === "number") return value;
    if (value && typeof value.toDate === "function") return value.toDate().toISOString();
    if (value && typeof value === "object" && value._seconds !== undefined) {
      return new Date(value._seconds * 1000).toISOString();
    }
    if (value instanceof Date) return value.toISOString();
    return String(value);
  };

  return customers
    .map((customer) => {
      const entry = customer?.last8Days?.[date];
      if (!entry || entry.status !== "delivered") return null;

      const cash = Number(entry.cashAmount) || 0;
      const upi = Number(entry.upiAmount) || 0;
      const damage = getDamageValue(entry);
      const returnQuantity = getReturnValue(entry);

      return {
        customerId: customer.custid || customer.id || customer._id || "",
        customerName: customer.name || customer.customerName || "N/A",
        salesPoint: entry.salesPoint || entry.salespoint || entry.salesPointName || entry.outletName || customer.salesPoint || customer.salespoint || customer.salesPointName || customer.outletName || "-",
        quantity: entry.quantity ?? entry.trays ?? 0,
        damage,
        returnQuantity,
        cash,
        upi,
        amount: cash + upi,
        paymentMethod: getPaymentMethod(entry, cash, upi),
        deliveryAgent: entry.agentName || "-",
        deliveryTime: formatDeliveryTime(entry.time || entry.timestamp),
      };
    })
    .filter(Boolean);
};

const getTotalDamageFromCustomers = (customers, date) => {
  if (!Array.isArray(customers) || !date) return 0;

  return customers.reduce((total, customer) => {
    const entry = customer?.last8Days?.[date];
    if (!entry || entry.status !== "delivered") return total;
    return total + getDamageValue(entry);
  }, 0);
};

const getTotalReturnFromCustomers = (customers, date) => {
  if (!Array.isArray(customers) || !date) return 0;

  return customers.reduce((total, customer) => {
    const entry = customer?.last8Days?.[date];
    if (!entry || entry.status !== "delivered") return total;
    return total + getReturnValue(entry);
  }, 0);
};

export const getRetailCollectionSummary = async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Valid date query is required in YYYY-MM-DD format." });
    }

    const token = await getRetailAdminToken();
    const response = await fetch(`${RETAIL_ADMIN_API_URL}/user-info`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(RETAIL_ADMIN_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        message: `Retail Admin user-info failed with status ${response.status}`,
      });
    }

    const customers = await response.json();
    return res.json({
      rows: getCollectionRowsFromCustomers(customers, date),
      totalDamage: getTotalDamageFromCustomers(customers, date),
      totalReturn: getTotalReturnFromCustomers(customers, date),
    });
  } catch (error) {
    return res.status(500).json({
      message: error?.message || "Failed to fetch Retail Admin collection summary.",
    });
  }
};

// Add supervisor to Firestore
export const addSupervisor = async (req, res) => {
  try {
    const { username, password, zone } = req.body;
    if (!username || !password || !zone) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }
    const hashed = await bcrypt.hash(password, 10);
    // Store zone as numeric type
    const zoneType = typeof zone === "number" ? zone : parseInt(zone.replace(/[^0-9]/g, ""), 10);
    const supervisorData = {
      username,
      password: hashed,
      zone: zoneType,
      createdAt: new Date()
    };
    await db.collection("supervisors").doc(username).set(supervisorData);
    return res.json({ success: true, message: "Supervisor created successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const addUser = async (req, res) => {
  try {
    const { username, password, fullName, phone, roles, fromDistributorPage } = req.body;

    if (!username || !password)
      return res.status(400).json({ success: false, error: "Missing fields" });

    const hashed = await bcrypt.hash(password, 10);

    if (fromDistributorPage) {
      // If only 'viewer' role, add to viewers collection
      if (Array.isArray(roles) && roles.length === 1 && roles[0] === "viewer") {
        const viewerData = {
          username,
          password: hashed,
          fullName: fullName || "",
          phone: phone || "",
          role: "Viewer",
          roles: ["viewer"],
          createdAt: new Date()
        };
        console.log('Creating viewer from distributor page:', { username, roles: viewerData.roles });
        await db.collection('viewers').doc(username).set(viewerData);
        return res.json({ success: true, message: `Viewer created successfully in viewers collection` });
      } else {
        // Otherwise, add to dataagents collection
        const dataAgentData = {
          username,
          password: hashed,
          fullName: fullName || "",
          phone: phone || "",
          role: "DataAgent",
          roles: Array.isArray(roles) && roles.length > 0 ? roles : ["dataagent"],
          zone: req.body.zone || null,
          createdAt: new Date()
        };
        console.log('Creating data agent from distributor page:', { username, roles: dataAgentData.roles });
        await db.collection('dataagents').doc(username).set(dataAgentData);
        return res.json({ success: true, message: `DataAgent created successfully in dataagents collection` });
      }
    }

    // Otherwise, treat as admin (manual entry)
    const adminData = {
      username,
      password: hashed,
      fullName: fullName || "",
      phone: phone || "",
      role: "Admin",
      roles: Array.isArray(roles) ? roles : (roles ? [roles] : []),
      createdAt: new Date()
    };
    await db.collection('admin').doc(username).set(adminData);
    return res.json({ success: true, message: `Admin user created successfully in admin collection` });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
// Delete user from admin, viewers, or distributors collection
export const deleteUser = async (req, res) => {
  try {
    let { username, collection } = req.body;
    if (!username || !collection) {
      return res.status(400).json({ success: false, error: "Missing username or collection" });
    }
    // If collection is 'users', change to 'admin' for backward compatibility
    if (collection === 'users') collection = 'admin';
    await db.collection(collection).doc(username).delete();
    return res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
