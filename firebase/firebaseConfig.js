// firebaseConfig.js

import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBsh6boB3DNVawVc2thP5UMxtM9t7w2DEs",
  authDomain: "tattoo-hunter-35f6b.firebaseapp.com",
  projectId: "tattoo-hunter-35f6b",
  storageBucket: "tattoo-hunter-35f6b.firebasestorage.app",
  messagingSenderId: "914863598868",
  appId: "1:914863598868:android:3b22a92fad8e5ca5f7a601",
  measurementId: "G-HH3KYR08V8",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
