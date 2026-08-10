import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { COLLECTIONS, getDb, getFirebaseAuth } from "@/lib/firebase/config";
import { addMonthsToDate, nowISO, todayISO } from "@/lib/utils";
import { ensureCounter } from "@/services/ids";
import { createStudyAndCharge, refreshAlerts } from "@/services/inventory";
import type { AppUser, UserRole } from "@/types";

const DEMO_USERS: { email: string; password: string; displayName: string; role: UserRole }[] = [
  { email: "admin@stability.local", password: "Admin@123", displayName: "System Admin", role: "Admin" },
  { email: "manager@stability.local", password: "Manager@123", displayName: "QA Manager", role: "QA Manager" },
  { email: "qa@stability.local", password: "QaUser@123", displayName: "QA User", role: "QA User" },
];

async function ensureAuthUser(email: string, password: string, displayName: string, role: UserRole) {
  try {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    await updateProfile(cred.user, { displayName });
    const user: AppUser = {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      active: true,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await setDoc(doc(getDb(), COLLECTIONS.users, cred.user.uid), user);
    return user;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("email-already-in-use")) {
      // User exists in Auth; profile may still need ensuring by login flow.
      return null;
    }
    throw error;
  }
}

export async function seedDemoData(currentUser?: AppUser | null) {
  const stamp = nowISO();
  const authUser = getFirebaseAuth().currentUser;

  // Create additional demo auth users only during first init when signed in as admin.
  // Skip if it would replace the current session unexpectedly mid-seed.
  if (!authUser) {
    for (const u of DEMO_USERS) {
      await ensureAuthUser(u.email, u.password, u.displayName, u.role);
    }
  }

  // If already seeded, skip master/study recreation
  const existingStudies = await getDocs(query(collection(getDb(), COLLECTIONS.stabilityStudies), limit(1)));
  if (!existingStudies.empty) {
    await refreshAlerts();
    return { seeded: false, message: "Demo data already exists. Alerts refreshed." };
  }

  await Promise.all([
    ensureCounter("STB", 0),
    ensureCounter("SMP", 0),
    ensureCounter("WDR", 0),
    ensureCounter("TRX", 0),
    ensureCounter("MOV", 0),
    ensureCounter("DSP", 0),
    ensureCounter("REC", 0),
  ]);

  const batch = writeBatch(getDb());

  const studyTypeRefs = {
    accelerated: doc(collection(getDb(), COLLECTIONS.studyTypes)),
    intermediate: doc(collection(getDb(), COLLECTIONS.studyTypes)),
    longTerm: doc(collection(getDb(), COLLECTIONS.studyTypes)),
  };

  batch.set(studyTypeRefs.accelerated, {
    name: "Accelerated",
    code: "ACC",
    description: "Accelerated stability study",
    defaultPullPointIds: [],
    status: "Active",
    sortOrder: 1,
    createdAt: stamp,
    updatedAt: stamp,
  });
  batch.set(studyTypeRefs.intermediate, {
    name: "Intermediate",
    code: "INT",
    description: "Intermediate stability study",
    defaultPullPointIds: [],
    status: "Active",
    sortOrder: 2,
    createdAt: stamp,
    updatedAt: stamp,
  });
  batch.set(studyTypeRefs.longTerm, {
    name: "Long Term / Real-Time",
    code: "LT",
    description: "Long term / real-time stability study",
    defaultPullPointIds: [],
    status: "Active",
    sortOrder: 3,
    createdAt: stamp,
    updatedAt: stamp,
  });

  const conditions = [
    { name: "Accelerated", temperature: "40°C", relativeHumidity: "75%", displayLabel: "40°C / 75% RH" },
    { name: "Intermediate", temperature: "30°C", relativeHumidity: "65%", displayLabel: "30°C / 65% RH" },
    { name: "Long Term", temperature: "25°C", relativeHumidity: "60%", displayLabel: "25°C / 60% RH" },
  ];
  const conditionRefs = conditions.map((c) => {
    const ref = doc(collection(getDb(), COLLECTIONS.storageConditions));
    batch.set(ref, { ...c, status: "Active", createdAt: stamp, updatedAt: stamp });
    return { ref, ...c };
  });

  const pullDefs = [
    { code: "1M", label: "1 Month", months: 1, types: ["accelerated", "intermediate", "longTerm"], sortOrder: 1 },
    { code: "2M", label: "2 Months", months: 2, types: ["accelerated"], sortOrder: 2 },
    { code: "3M", label: "3 Months", months: 3, types: ["accelerated", "intermediate", "longTerm"], sortOrder: 3 },
    { code: "6M", label: "6 Months", months: 6, types: ["accelerated", "intermediate", "longTerm"], sortOrder: 4 },
    { code: "9M", label: "9 Months", months: 9, types: ["longTerm"], sortOrder: 5 },
    { code: "12M", label: "12 Months", months: 12, types: ["longTerm"], sortOrder: 6 },
    { code: "18M", label: "18 Months", months: 18, types: ["longTerm"], sortOrder: 7 },
    { code: "24M", label: "24 Months", months: 24, types: ["longTerm"], sortOrder: 8 },
    { code: "36M", label: "36 Months", months: 36, types: ["longTerm"], sortOrder: 9 },
  ];

  const pullRefs = pullDefs.map((p) => {
    const ref = doc(collection(getDb(), COLLECTIONS.pullPoints));
    batch.set(ref, {
      code: p.code,
      label: p.label,
      months: p.months,
      studyTypeIds: p.types.map((t) => studyTypeRefs[t as keyof typeof studyTypeRefs].id),
      status: "Active",
      sortOrder: p.sortOrder,
      createdAt: stamp,
      updatedAt: stamp,
    });
    return { ref, ...p };
  });

  batch.update(studyTypeRefs.accelerated, {
    defaultPullPointIds: pullRefs.filter((p) => p.types.includes("accelerated")).map((p) => p.ref.id),
  });
  batch.update(studyTypeRefs.intermediate, {
    defaultPullPointIds: pullRefs.filter((p) => p.types.includes("intermediate")).map((p) => p.ref.id),
  });
  batch.update(studyTypeRefs.longTerm, {
    defaultPullPointIds: pullRefs.filter((p) => p.types.includes("longTerm")).map((p) => p.ref.id),
  });

  const unitRef = doc(collection(getDb(), COLLECTIONS.units));
  batch.set(unitRef, {
    name: "Units",
    abbreviation: "nos",
    status: "Active",
    createdAt: stamp,
    updatedAt: stamp,
  });
  const bottleRef = doc(collection(getDb(), COLLECTIONS.units));
  batch.set(bottleRef, {
    name: "Bottles",
    abbreviation: "btl",
    status: "Active",
    createdAt: stamp,
    updatedAt: stamp,
  });

  const chambers = [
    {
      chamberId: "CH-001",
      chamberName: "Stability Chamber 01",
      chamberType: "Walk-in",
      temperature: "25°C",
      relativeHumidity: "60%",
      capacity: 500,
      usedCapacity: 0,
      location: "Stability Area A",
      status: "Active",
    },
    {
      chamberId: "CH-002",
      chamberName: "Stability Chamber 02",
      chamberType: "Reach-in",
      temperature: "30°C",
      relativeHumidity: "65%",
      capacity: 300,
      usedCapacity: 0,
      location: "Stability Area A",
      status: "Active",
    },
    {
      chamberId: "CH-003",
      chamberName: "Stability Chamber 03",
      chamberType: "Reach-in",
      temperature: "40°C",
      relativeHumidity: "75%",
      capacity: 250,
      usedCapacity: 0,
      location: "Stability Area B",
      status: "Active",
    },
  ];
  const chamberRefs = chambers.map((c) => {
    const ref = doc(collection(getDb(), COLLECTIONS.chambers));
    batch.set(ref, { ...c, createdAt: stamp, updatedAt: stamp });
    return { ref, ...c };
  });

  const locationDefs = [
    { chamberIdx: 0, rack: "Rack A", shelf: "Shelf 01", position: "Pos 01" },
    { chamberIdx: 0, rack: "Rack A", shelf: "Shelf 02", position: "Pos 05" },
    { chamberIdx: 1, rack: "Rack B", shelf: "Shelf 01", position: "Pos 03" },
    { chamberIdx: 2, rack: "Rack C", shelf: "Shelf 02", position: "Pos 08" },
  ];
  const locationRefs = locationDefs.map((l) => {
    const chamber = chamberRefs[l.chamberIdx];
    const ref = doc(collection(getDb(), COLLECTIONS.storageLocations));
    const label = `${chamber.chamberName} / ${l.rack} / ${l.shelf} / ${l.position}`;
    batch.set(ref, {
      chamberId: chamber.ref.id,
      chamberName: chamber.chamberName,
      rack: l.rack,
      shelf: l.shelf,
      position: l.position,
      label,
      status: "Active",
      createdAt: stamp,
      updatedAt: stamp,
    });
    return { ref, label, chamber };
  });

  const products = [
    { productName: "Fluconazole Injection 5 ml", productCode: "FLZ-5", strength: "2 mg/ml", dosageForm: "Injection" },
    { productName: "Paracetamol Tablets 500 mg", productCode: "PCM-500", strength: "500 mg", dosageForm: "Tablet" },
    { productName: "Amoxicillin Capsules 500 mg", productCode: "AMX-500", strength: "500 mg", dosageForm: "Capsule" },
  ];
  const productRefs = products.map((p) => {
    const ref = doc(collection(getDb(), COLLECTIONS.products));
    batch.set(ref, { ...p, status: "Active", createdAt: stamp, updatedAt: stamp });
    return { ref, ...p };
  });

  const batches = [
    {
      productIdx: 0,
      batchNumber: "FLZ25001",
      manufacturingDate: "2025-10-15",
      expiryDate: "2027-10-14",
    },
    {
      productIdx: 1,
      batchNumber: "PCM25014",
      manufacturingDate: "2025-11-01",
      expiryDate: "2028-10-31",
    },
    {
      productIdx: 2,
      batchNumber: "AMX25008",
      manufacturingDate: "2025-12-10",
      expiryDate: "2027-12-09",
    },
  ];
  const batchRefs = batches.map((b) => {
    const product = productRefs[b.productIdx];
    const ref = doc(collection(getDb(), COLLECTIONS.batches));
    batch.set(ref, {
      productId: product.ref.id,
      productName: product.productName,
      batchNumber: b.batchNumber,
      manufacturingDate: b.manufacturingDate,
      expiryDate: b.expiryDate,
      status: "Active",
      createdAt: stamp,
      updatedAt: stamp,
    });
    return { ref, product, ...b };
  });

  await batch.commit();

  if (!authUser && !currentUser) {
    throw new Error("Please sign in as Admin before seeding demo data.");
  }

  const actingUser: AppUser = {
    uid: authUser?.uid || currentUser!.uid,
    email: authUser?.email || currentUser?.email || "admin@stability.local",
    displayName: authUser?.displayName || currentUser?.displayName || "System Admin",
    role: "Admin",
    active: true,
    createdAt: stamp,
    updatedAt: stamp,
  };

  // Create realistic studies with pull dates around today for dashboard testing
  const chargeLongTerm = addMonthsToDate(todayISO(), -5); // so 6M is upcoming soon, 3M may be due/overdue depending
  const chargeAcc = addMonthsToDate(todayISO(), -2);
  const chargeInt = addMonthsToDate(todayISO(), -1);

  await createStudyAndCharge({
    productId: batchRefs[0].product.ref.id,
    productName: batchRefs[0].product.productName,
    batchId: batchRefs[0].ref.id,
    batchNumber: batchRefs[0].batchNumber,
    manufacturingDate: batchRefs[0].manufacturingDate,
    expiryDate: batchRefs[0].expiryDate,
    chargingDate: chargeLongTerm,
    studyTypeId: studyTypeRefs.longTerm.id,
    studyType: "Long Term / Real-Time",
    storageConditionId: conditionRefs[2].ref.id,
    storageCondition: conditionRefs[2].displayLabel,
    chamberId: chamberRefs[0].ref.id,
    chamberName: chamberRefs[0].chamberName,
    locationId: locationRefs[0].ref.id,
    locationLabel: locationRefs[0].label,
    totalQuantity: 135,
    reservedQuantity: 15,
    unit: "nos",
    duration: "36M",
    notes: "Demo long-term study",
    pullAllocations: [
      { code: "1M", months: 1, quantity: 15 },
      { code: "3M", months: 3, quantity: 15 },
      { code: "6M", months: 6, quantity: 15 },
      { code: "9M", months: 9, quantity: 15 },
      { code: "12M", months: 12, quantity: 15 },
      { code: "18M", months: 18, quantity: 15 },
      { code: "24M", months: 24, quantity: 15 },
      { code: "36M", months: 36, quantity: 15 },
    ],
    user: actingUser,
  });

  await createStudyAndCharge({
    productId: batchRefs[1].product.ref.id,
    productName: batchRefs[1].product.productName,
    batchId: batchRefs[1].ref.id,
    batchNumber: batchRefs[1].batchNumber,
    manufacturingDate: batchRefs[1].manufacturingDate,
    expiryDate: batchRefs[1].expiryDate,
    chargingDate: chargeAcc,
    studyTypeId: studyTypeRefs.accelerated.id,
    studyType: "Accelerated",
    storageConditionId: conditionRefs[0].ref.id,
    storageCondition: conditionRefs[0].displayLabel,
    chamberId: chamberRefs[2].ref.id,
    chamberName: chamberRefs[2].chamberName,
    locationId: locationRefs[3].ref.id,
    locationLabel: locationRefs[3].label,
    totalQuantity: 75,
    reservedQuantity: 15,
    unit: "nos",
    duration: "6M",
    notes: "Demo accelerated study",
    pullAllocations: [
      { code: "1M", months: 1, quantity: 15 },
      { code: "2M", months: 2, quantity: 15 },
      { code: "3M", months: 3, quantity: 15 },
      { code: "6M", months: 6, quantity: 15 },
    ],
    user: actingUser,
  });

  await createStudyAndCharge({
    productId: batchRefs[2].product.ref.id,
    productName: batchRefs[2].product.productName,
    batchId: batchRefs[2].ref.id,
    batchNumber: batchRefs[2].batchNumber,
    manufacturingDate: batchRefs[2].manufacturingDate,
    expiryDate: batchRefs[2].expiryDate,
    chargingDate: chargeInt,
    studyTypeId: studyTypeRefs.intermediate.id,
    studyType: "Intermediate",
    storageConditionId: conditionRefs[1].ref.id,
    storageCondition: conditionRefs[1].displayLabel,
    chamberId: chamberRefs[1].ref.id,
    chamberName: chamberRefs[1].chamberName,
    locationId: locationRefs[2].ref.id,
    locationLabel: locationRefs[2].label,
    totalQuantity: 60,
    reservedQuantity: 15,
    unit: "nos",
    duration: "6M",
    notes: "Demo intermediate study",
    pullAllocations: [
      { code: "1M", months: 1, quantity: 15 },
      { code: "3M", months: 3, quantity: 15 },
      { code: "6M", months: 6, quantity: 15 },
    ],
    user: actingUser,
  });

  await refreshAlerts();
  return {
    seeded: true,
    message: "Demo masters, chambers, products, and stability studies created successfully.",
    demoUsers: DEMO_USERS.map(({ email, password, role }) => ({ email, password, role })),
  };
}
