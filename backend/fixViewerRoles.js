// fixViewerRoles.js
import { db } from "./config/firebase.js";

async function fixViewerRoles() {
  const snapshot = await db.collection("viewers").get();
  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    let roles = data.roles || [];
    if (!Array.isArray(roles)) {
      roles = String(roles)
        .split(",")
        .map(r => r.trim())
        .filter(Boolean);
    }
    const originalRoles = [...roles]; // For comparison
    if (!roles.includes("viewer")) {
      roles.push("viewer");
    }
    roles = Array.from(new Set(roles));
    
    // Check if changed
    const changed = JSON.stringify(originalRoles.sort()) !== JSON.stringify(roles.sort());
    if (changed) {
      await db.collection("viewers").doc(doc.id).update({ roles });
      updated++;
      console.log(`Updated ${doc.id}:`, roles);
    }
  }
  console.log(`Done. Updated ${updated} users.`);
}

fixViewerRoles().catch(console.error);