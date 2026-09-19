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

type FirebaseGlobals = {
  app?: FirebaseApp;
  auth?: Auth;
  db?: Firestore;
  storage?: FirebaseStorage;
  idbGuard?: boolean;
};

const firebaseGlobals = globalThis as typeof globalThis & { __skymapFirebase?: FirebaseGlobals };

function store(): FirebaseGlobals {
  if (!firebaseGlobals.__skymapFirebase) firebaseGlobals.__skymapFirebase = {};
  return firebaseGlobals.__skymapFirebase;
}

export function isIndexedDbClosingError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || "");
  return /database is closing\/hidden|database connection is closing/i.test(message);
}

function installIndexedDbClosingGuard() {
  if (typeof window === "undefined") return;
  const s = store();
  if (s.idbGuard) return;
  s.idbGuard = true;
  window.addEventListener("unhandledrejection", (event) => {
    if (isIndexedDbClosingError(event.reason)) {
      event.preventDefault();
    }
  });
}

export function getFirebaseApp() {
  const s = store();
  if (!s.app) {
    assertConfig();
    s.app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  installIndexedDbClosingGuard();
  return s.app;
}

export function getFirebaseAuth() {
  const s = store();
  if (!s.auth) s.auth = getAuth(getFirebaseApp());
  return s.auth;
}

export function getDb() {
  const s = store();
  if (!s.db) s.db = getFirestore(getFirebaseApp());
  return s.db;
}

export function getFirebaseStorage() {
  const s = store();
  if (!s.storage) s.storage = getStorage(getFirebaseApp());
  return s.storage;
}

export const COLLECTIONS = {
  users: "users",
  settings: "settings",
  products: "products",
  batches: "batches",
  controlSampleProducts: "controlSampleProducts",
  controlSampleBatches: "controlSampleBatches",
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
  studyReasons: "studyReasons",
  packagingMaterials: "packagingMaterials",
  markets: "markets",
  packSizes: "packSizes",
  dailyCollectionRecords: "dailyCollectionRecords",
  sampleReceipts: "sampleReceipts",
  controlSamples: "controlSamples",
  controlSampleCollections: "controlSampleCollections",
  controlSampleObservations: "controlSampleObservations",
  controlSampleWithdrawals: "controlSampleWithdrawals",
  controlSampleMovements: "controlSampleMovements",
  controlSampleDestructions: "controlSampleDestructions",
  controlSampleDestructionLogs: "controlSampleDestructionLogs",
  controlSampleTransactions: "controlSampleTransactions",
  controlSampleLocations: "controlSampleLocations",
  controlSampleBoxes: "controlSampleBoxes",
  controlSampleQuantityMasters: "controlSampleQuantityMasters",
  controlSampleObservationParameters: "controlSampleObservationParameters",
  controlSampleHolds: "controlSampleHolds",
  controlSampleBoxCategories: "controlSampleBoxCategories",
  analysisRequests: "analysisRequests",
  chamberAlarms: "chamberAlarms",
  chamberExcursions: "chamberExcursions",
  chamberCleaning: "chamberCleaning",
  chamberCalibration: "chamberCalibration",
  temperatureMappings: "temperatureMappings",
  chamberMaintenance: "chamberMaintenance",
  chamberEvents: "chamberEvents",
  chamberDataLogs: "chamberDataLogs",
  electronicSignatures: "electronicSignatures",
  stabilityProtocols: "stabilityProtocols",
  stabilityReports: "stabilityReports",
  waterLossStudies: "waterLossStudies",
  sopTasks: "sopTasks",
} as const;
