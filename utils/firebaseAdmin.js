// Firebase Admin SDK initialization for Express.js backend
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// You can use applicationDefault() if running on Google Cloud, else use service account
// const serviceAccount = require("./path/to/serviceAccountKey.json");

initializeApp({
  credential: applicationDefault(),
  // Or use credential: cert(serviceAccount),
});

const db = getFirestore();

export { db };
