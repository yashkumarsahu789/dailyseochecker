// Firebase client initialization for frontend usage
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBFMqvjRu22iTn3V8pDKNyQVGCgXeLTN9k",
  authDomain: "dailyseochecker.firebaseapp.com",
  projectId: "dailyseochecker",
  storageBucket: "dailyseochecker.firebasestorage.app",
  messagingSenderId: "22153071843",
  appId: "1:22153071843:web:647d50ff9f4072371fc9d6",
  measurementId: "G-WV41YZ86PH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
