import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load JSON normally
const rawFile = fs.readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8");
const serviceAccount = JSON.parse(rawFile);

// Fix ONLY the private_key field
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const auth = admin.auth();
export const db = admin.firestore();
