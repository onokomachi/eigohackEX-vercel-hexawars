import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBNWMO_u5s4aQv_qgKVuXuO-5e5kDay2fc",
  authDomain: "eigohack2-vercel.firebaseapp.com",
  projectId: "eigohack2-vercel",
  storageBucket: "eigohack2-vercel.firebasestorage.app",
  messagingSenderId: "501623708326",
  appId: "1:501623708326:web:9f7195850fb08a24353267",
  measurementId: "G-R07HSYHW8K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, db, analytics };
