import admin from "firebase-admin";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ============ Firestore Collections ============
const COLLECTIONS = {
  websites: "websites",
  reports: "reports",
  alerts: "alerts",
  settings: "settings",
  uptime: "uptime",
  keywordRanks: "keywordRanks",
  backlinks: "backlinks",
};

// ============ readDb — same JSON shape as before ============
export async function readDb() {
  const [
    websitesSnap,
    reportsSnap,
    alertsSnap,
    settingsSnap,
    uptimeSnap,
    keywordRanksSnap,
    backlinksSnap,
  ] = await Promise.all([
    db.collection(COLLECTIONS.websites).get(),
    db
      .collection(COLLECTIONS.reports)
      .orderBy("timestamp", "desc")
      .limit(500)
      .get(),
    db
      .collection(COLLECTIONS.alerts)
      .orderBy("timestamp", "desc")
      .limit(200)
      .get(),
    db.collection(COLLECTIONS.settings).get(),
    db
      .collection(COLLECTIONS.uptime)
      .orderBy("timestamp", "desc")
      .limit(1000)
      .get(),
    db
      .collection(COLLECTIONS.keywordRanks)
      .orderBy("timestamp", "desc")
      .limit(1000)
      .get(),
    db
      .collection(COLLECTIONS.backlinks)
      .orderBy("lastSeen", "desc")
      .limit(500)
      .get(),
  ]);

  // Websites
  const websites = websitesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Reports
  const reports = reportsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Alerts
  const alerts = alertsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Settings → key-value object
  const settings = {};
  settingsSnap.docs.forEach((doc) => {
    settings[doc.id] = doc.data().value;
  });

  // Uptime
  const uptime = uptimeSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Keyword Ranks
  const keywordRanks = keywordRanksSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Backlinks
  const backlinks = backlinksSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    websites,
    reports,
    alerts,
    settings,
    uptime,
    keywordRanks,
    backlinks,
  };
}

// ============ writeDb — writes changed data back to Firestore ============
export async function writeDb(data) {
  const batch = db.batch();
  let opCount = 0;
  const MAX_BATCH = 400; // Firestore limit is 500, keep buffer

  async function flushBatch() {
    if (opCount > 0) {
      await batch.commit();
      opCount = 0;
    }
  }

  // ─── Websites ───
  if (data.websites) {
    for (const w of data.websites) {
      const docId = String(w.id);
      const ref = db.collection(COLLECTIONS.websites).doc(docId);
      const docData = { ...w };
      delete docData.id;
      batch.set(ref, docData, { merge: true });
      opCount++;
      if (opCount >= MAX_BATCH) await flushBatch();
    }
  }

  // ─── Reports (only new ones without firestore doc id) ───
  if (data.reports) {
    for (const r of data.reports) {
      if (!r._persisted) {
        const ref = db.collection(COLLECTIONS.reports).doc();
        const docData = { ...r };
        delete docData.id;
        docData._persisted = true;
        batch.set(ref, docData);
        opCount++;
        if (opCount >= MAX_BATCH) await flushBatch();
      }
    }
  }

  // ─── Alerts ───
  if (data.alerts) {
    for (const a of data.alerts) {
      const docId = String(a.id || Date.now() + Math.random());
      const ref = db.collection(COLLECTIONS.alerts).doc(docId);
      const docData = { ...a };
      delete docData.id;
      batch.set(ref, docData, { merge: true });
      opCount++;
      if (opCount >= MAX_BATCH) await flushBatch();
    }
  }

  // ─── Settings ───
  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      const ref = db.collection(COLLECTIONS.settings).doc(key);
      batch.set(ref, { value });
      opCount++;
      if (opCount >= MAX_BATCH) await flushBatch();
    }
  }

  // ─── Uptime ───
  if (data.uptime) {
    for (const u of data.uptime) {
      if (!u._persisted) {
        const ref = db.collection(COLLECTIONS.uptime).doc();
        const docData = { ...u };
        delete docData.id;
        docData._persisted = true;
        batch.set(ref, docData);
        opCount++;
        if (opCount >= MAX_BATCH) await flushBatch();
      }
    }
  }

  // ─── Keyword Ranks ───
  if (data.keywordRanks) {
    for (const k of data.keywordRanks) {
      if (!k._persisted) {
        const ref = db.collection(COLLECTIONS.keywordRanks).doc();
        const docData = { ...k };
        delete docData.id;
        docData._persisted = true;
        batch.set(ref, docData);
        opCount++;
        if (opCount >= MAX_BATCH) await flushBatch();
      }
    }
  }

  // ─── Backlinks ───
  if (data.backlinks) {
    for (const b of data.backlinks) {
      const docId = String(b.id || Date.now() + Math.random());
      const ref = db.collection(COLLECTIONS.backlinks).doc(docId);
      const docData = { ...b };
      delete docData.id;
      batch.set(ref, docData, { merge: true });
      opCount++;
      if (opCount >= MAX_BATCH) await flushBatch();
    }
  }

  await flushBatch();
}

// ─── Individual Firestore helpers for targeted operations ───

export async function getWebsite(id) {
  const doc = await db.collection(COLLECTIONS.websites).doc(String(id)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function addWebsite(siteData) {
  const docId = String(siteData.id);
  await db.collection(COLLECTIONS.websites).doc(docId).set(siteData);
  return siteData;
}

export async function updateWebsite(id, updates) {
  await db.collection(COLLECTIONS.websites).doc(String(id)).update(updates);
}

export async function deleteWebsite(id) {
  const docId = String(id);
  await db.collection(COLLECTIONS.websites).doc(docId).delete();

  // Also delete related reports, uptime, alerts, keyword ranks, backlinks
  const collections = ["reports", "uptime", "keywordRanks", "backlinks"];
  for (const col of collections) {
    const snap = await db
      .collection(col)
      .where("websiteId", "==", Number(id))
      .get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    if (snap.docs.length > 0) await batch.commit();
  }
}

export async function getAllWebsites() {
  const snap = await db.collection(COLLECTIONS.websites).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getReportsForSite(siteId) {
  const snap = await db
    .collection(COLLECTIONS.reports)
    .where("websiteId", "==", Number(siteId))
    .orderBy("timestamp", "desc")
    .limit(10)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function addReport(report) {
  await db.collection(COLLECTIONS.reports).add(report);
}

export async function getAlerts() {
  const snap = await db
    .collection(COLLECTIONS.alerts)
    .where("dismissed", "==", false)
    .orderBy("timestamp", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function dismissAlert(id) {
  await db
    .collection(COLLECTIONS.alerts)
    .doc(String(id))
    .update({ dismissed: true });
}

export async function dismissAllAlerts() {
  const snap = await db
    .collection(COLLECTIONS.alerts)
    .where("dismissed", "==", false)
    .get();
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.update(doc.ref, { dismissed: true }));
  if (snap.docs.length > 0) await batch.commit();
}

export async function getSettings() {
  const snap = await db.collection(COLLECTIONS.settings).get();
  const settings = {};
  snap.docs.forEach((doc) => {
    settings[doc.id] = doc.data().value;
  });
  return settings;
}

export async function updateSettings(newSettings) {
  const batch = db.batch();
  for (const [key, value] of Object.entries(newSettings)) {
    const ref = db.collection(COLLECTIONS.settings).doc(key);
    batch.set(ref, { value });
  }
  await batch.commit();
}

export async function getUptime(siteId) {
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();
  const snap = await db
    .collection(COLLECTIONS.uptime)
    .where("siteId", "==", Number(siteId))
    .where("timestamp", ">", twentyFourHoursAgo)
    .orderBy("timestamp", "asc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getKeywords(siteId) {
  const site = await getWebsite(siteId);
  const keywords = site?.keywords || [];
  const snap = await db
    .collection(COLLECTIONS.keywordRanks)
    .where("siteId", "==", Number(siteId))
    .orderBy("timestamp", "desc")
    .limit(200)
    .get();
  const ranks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { keywords, ranks };
}

export async function getBacklinks(siteId) {
  const snap = await db
    .collection(COLLECTIONS.backlinks)
    .where("siteId", "==", Number(siteId))
    .get();
  const all = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const active = all.filter((b) => b.active);
  const lost = all.filter((b) => !b.active);
  return { active, lost, total: active.length };
}

export async function getGroups() {
  const websites = await getAllWebsites();
  const groups = [...new Set(websites.map((w) => w.group || "Ungrouped"))];
  return groups;
}

export { db };
