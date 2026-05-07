import { db } from "../config/firebase.js";

// Get all DailyDamage entries from Firestore
export const getAllDailyDamages = async (req, res) => {
  try {
    const snapshot = await db.collection("dailyDamages").orderBy("date", "asc").get();
    const damages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(damages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching daily damages", error: error.message });
  }
};

export const getDailyDamageByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const snapshot = await db.collection("dailyDamages")
      .where("date", "==", date)
      .get();

    const damages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(damages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching daily damages by date", error: error.message });
  }
};
