import { db } from "../config/firebase.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not set");

export const loginUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role)
      return res.status(400).json({ success: false, error: "Missing credentials" });

    const collection = role === "admin" ? "admin" : role === "viewer" ? "viewers" : null;
    if (!collection)
      return res.status(400).json({ success: false, error: "Invalid role" });

    const userSnap = await db.collection(collection).doc(username).get();
    if (!userSnap.exists)
      return res.status(404).json({ success: false, error: "User not found" });

    const user = userSnap.data();

    // Role validation
    if (
      role === "admin" &&
      !(user.role === "Admin" || (Array.isArray(user.roles) && user.roles.includes("admin")))
    ) {
      return res.status(401).json({ success: false, error: "Admin access denied" });
    }

    if (
      role === "viewer" &&
      !(user.role === "Viewer" || (Array.isArray(user.roles) && user.roles.includes("viewer")))
    ) {
      return res.status(401).json({ success: false, error: "Viewer access denied" });
    }
// DEBUG (temporary)
console.log("TYPED PASSWORD:", JSON.stringify(password));
console.log("STORED PASSWORD:", JSON.stringify(user.password));
console.log("EQUAL:", password === user.password);

// Password validation (TESTING ONLY)
if (password !== user.password) {
  return res.status(401).json({
    success: false,
    error: "Invalid password",
  });
}

// Password validation (TESTING ONLY)
if (password !== user.password) {
  return res.status(401).json({
    success: false,
    error: "Invalid password",
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
    console.error("loginUser error:", err); 
    return res.status(500).json({ success: false, error: err.message }); 
  } 
};