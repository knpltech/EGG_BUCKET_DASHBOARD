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
