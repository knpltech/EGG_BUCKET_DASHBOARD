import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!admin.apps.some((app) => app.name === "[DEFAULT]")) {
  let credential;

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  } else {
    
    const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        "❌ Firebase credentials not found (env vars or serviceAccountKey.json missing)"
      );
    }

    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8")
    );

    credential = admin.credential.cert(serviceAccount);
  }

  admin.initializeApp({ credential });
}

export const db = admin.firestore();
