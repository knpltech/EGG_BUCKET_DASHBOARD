const { db } = require("../config/firebase");

// Get User Data
exports.getUserData = async (req, res) => {
  try {
    const uid = req.params.uid;

    const docRef = await db.collection("users").doc(uid).get();

    if (!docRef.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(docRef.data());
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Update User Profile
exports.updateUser = async (req, res) => {
  try {
    const uid = req.params.uid;
    const data = req.body;

    await db.collection("users").doc(uid).update(data);

    return res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
