// Script to delete all NECC rate documents in Firestore that do not have an outletId

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../config/serviceAccountKey.json"), "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function deleteNeccRatesWithoutOutletId() {
  const snapshot = await db.collection("neccRates").get();
  let deleteCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.outletId || data.outletId === "") {
      await db.collection("neccRates").doc(doc.id).delete();
      console.log(`Deleted doc ${doc.id} (missing outletId)`);
      deleteCount++;
    }
  }
  console.log(`Done. Deleted ${deleteCount} documents without outletId.`);
  process.exit(0);
}

deleteNeccRatesWithoutOutletId().catch(err => {
  console.error("Error deleting NECC rates without outletId:", err);
  process.exit(1);
});
