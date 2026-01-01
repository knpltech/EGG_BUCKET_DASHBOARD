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

export const addUser = async (req, res) => {
  try {
    const { username, password, fullName, phone, roles, fromDistributorPage } = req.body;

    if (!username || !password)
      return res.status(400).json({ success: false, error: "Missing fields" });

    const hashed = await bcrypt.hash(password, 10);

    if (fromDistributorPage) {
      // Always store as viewer in viewers collection, but include access roles
      const viewerData = {
        username,
        password: hashed,
        fullName: fullName || "",
        phone: phone || "",
        role:"Viewer",
        roles: Array.isArray(roles) && roles.length > 0 ? roles : ["viewer"],
        createdAt: new Date()
      };
      console.log('Creating viewer from distributor page:', { username, roles: viewerData.roles });
      await db.collection('viewers').doc(username).set(viewerData);
      return res.json({ success: true, message: `Viewer created successfully in viewers collection` });
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
