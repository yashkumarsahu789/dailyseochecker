// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAdWSvwhOwBcuMe-0xb3lwoa1WfqmpmeWc",
  authDomain: "dailyseochecker-cca44.firebaseapp.com",
  projectId: "dailyseochecker-cca44",
  storageBucket: "dailyseochecker-cca44.firebasestorage.app",
  messagingSenderId: "547460921218",
  appId: "1:547460921218:web:64b4cae2702dbdf7d6819b",
  measurementId: "G-8GWF195K8N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const functions = getFunctions(app);

export { app, analytics, db, functions };
