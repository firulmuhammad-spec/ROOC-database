import { initializeApp } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";

// Firebase Configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyChStskx4TdHkyJt2TcnQTm7yty2_2QX20",
  authDomain: "pioneering-liberty-407pf.firebaseapp.com",
  projectId: "pioneering-liberty-407pf",
  storageBucket: "pioneering-liberty-407pf.firebasestorage.app",
  messagingSenderId: "649664060417",
  appId: "1:649664060417:web:7a2acec9583f9235e53400"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific database ID provided
export const db = getFirestore(app, "ai-studio-8e8374b0-be80-45a3-9fe9-b31a18395cbe");

export default app;
