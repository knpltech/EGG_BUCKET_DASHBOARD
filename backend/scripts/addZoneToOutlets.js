// Script to add zoneId to existing outlets that don't have one
import { db } from "../config/firebase.js";

async function addZoneToOutlets() {
  try {
    const snapshot = await db.collection("outlets").get();
    const batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      // If outlet doesn't have zoneId, add "Zone 1"
      if (!data.zoneId) {
        batch.update(doc.ref, { zoneId: "Zone 1" });
        count++;
        console.log(`Will update: ${doc.id} - ${data.name}`);
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`\nSuccessfully updated ${count} outlets with zoneId: "Zone 1"`);
    } else {
      console.log("All outlets already have zoneId set.");
    }

    process.exit(0);
  } catch (err) {
    console.error("Error updating outlets:", err);
    process.exit(1);
  }
}

addZoneToOutlets();
