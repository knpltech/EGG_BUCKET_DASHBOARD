import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let collectionApp;

try {
  // We initialize the secondary app with a specific name "collectionApp"
  // to avoid conflicting with the default app.
  if (!admin.apps.find((app) => app.name === "collectionApp")) {
    let credential;
    let configured = false;

    if (
      process.env.COLLECTION_FIREBASE_PROJECT_ID &&
      process.env.COLLECTION_FIREBASE_CLIENT_EMAIL &&
      process.env.COLLECTION_FIREBASE_PRIVATE_KEY
    ) {
      credential = admin.credential.cert({
        projectId: process.env.COLLECTION_FIREBASE_PROJECT_ID,
        clientEmail: process.env.COLLECTION_FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.COLLECTION_FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });
      collectionApp = admin.initializeApp({ credential }, "collectionApp");
      configured = true;
      console.log("✅ Collection Firebase initialized via environment variables.");
    } else {
      const serviceAccountPath = path.join(__dirname, "collectionServiceAccountKey.json");

      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        collectionApp = admin.initializeApp(
          { credential: admin.credential.cert(serviceAccount) },
          "collectionApp"
        );
        configured = true;
        console.log("✅ Collection Firebase initialized via service account file.");
      } else {
        console.warn("⚠️ Collection Firebase credentials not found (env vars or collectionServiceAccountKey.json missing). Collection Website integration will fail.");
        // Initialize an empty app if credentials are missing to prevent immediate crashes
        collectionApp = admin.initializeApp({}, "collectionApp");
        configured = false;
      }
    }
    collectionApp.isConfigured = configured;
  } else {
    collectionApp = admin.app("collectionApp");
  }
} catch (error) {
  console.error("❌ Error initializing Collection Firebase:", error.message);
}

export const collectionDb = collectionApp ? collectionApp.firestore() : null;
export const isCollectionConfigured = collectionApp ? collectionApp.isConfigured : false;
