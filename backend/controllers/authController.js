import { db } from "../config/firebase.js";
import bcrypt from "bcryptjs";

// SIGN UP
export const registerUser = async (req, res) => {
  try {
    const { fullName, phone, username, password, role } = req.body;

    // Check if username already exists
    const userRef = db.collection("users").doc(username);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      return res.status(400).json({ success: false, error: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save to Firestore
    await userRef.set({
      fullName,
      phone,
      username,
      password: hashedPassword,
      role,
      createdAt: new Date(),
    });

    return res.json({ success: true, message: "Account created!" });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};


// SIGN IN
export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    const userRef = db.collection("users").doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = userDoc.data();

    // Check password
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ success: false, error: "Incorrect password" });
    }

    return res.json({
      success: true,
      message: "Login successful",
      user,
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
