"use client";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// NEXT_PUBLIC_ values are safe to ship to the browser — Firestore rules protect the data.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app = configured ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
