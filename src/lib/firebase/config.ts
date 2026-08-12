import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

function assertConfig() {
  const required = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ] as const;
  const missing = required.filter((key) => !firebaseConfig[key]);
  if (missing.length) {
    throw new Error(
      `Firebase configuration is incomplete (missing: ${missing.join(", ")}). Check .env.local.`
    );
  }
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function getFirebaseApp() {
  if (typeof window === "undefined") {
    assertConfig();
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  if (!app) {
    assertConfig();
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth() {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function getDb() {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

export function getFirebaseStorage() {
  if (!storage) storage = getStorage(getFirebaseApp());
  return storage;
}

export const COLLECTIONS = {
  users: "users",
  settings: "settings",
  products: "products",
  batches: "batches",
  studyTypes: "studyTypes",
  storageConditions: "storageConditions",
  pullPoints: "pullPoints",
  chambers: "chambers",
  storageLocations: "storageLocations",
  units: "units",
  stabilityStudies: "stabilityStudies",
  stabilitySamples: "stabilitySamples",
  studyPullPoints: "studyPullPoints",
  sampleWithdrawals: "sampleWithdrawals",
  sampleMovements: "sampleMovements",
  sampleDisposals: "sampleDisposals",
  inventoryReconciliations: "inventoryReconciliations",
  inventoryTransactions: "inventoryTransactions",
  inventoryAlerts: "inventoryAlerts",
  auditLogs: "auditLogs",
  counters: "counters",
} as const;
