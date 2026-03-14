// Firebase client initialization for frontend usage
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAJa-SsQElMye-IDEv_vRjIKG4X1eiNCgs",
  authDomain: "dailyseochecker-f2123.firebaseapp.com",
  projectId: "dailyseochecker-f2123",
  storageBucket: "dailyseochecker-f2123.firebasestorage.app",
  messagingSenderId: "844744866374",
  appId: "1:844744866374:web:c6211820c21ad2d62fa847",
  measurementId: "G-N4KRCJ0NVN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
