import admin from "firebase-admin";

const db = admin.firestore();

export const getAllWebsites = async () => {
  const snapshot = await db.collection("websites").get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getWebsite = async (id) => {
  const doc = await db.collection("websites").doc(String(id)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

export const addWebsite = async (siteData) => {
  const id = siteData.id || String(Date.now());
  await db.collection("websites").doc(String(id)).set({ ...siteData, id });
  return { id, ...siteData };
};

export const updateWebsite = async (id, updates) => {
  await db.collection("websites").doc(String(id)).update(updates);
};

export const deleteWebsite = async (id) => {
  await db.collection("websites").doc(String(id)).delete();
};

export const getReportsForSite = async (siteId) => {
  const snapshot = await db.collection("reports")
    .where("websiteId", "==", Number(siteId))
    .orderBy("timestamp", "desc")
    .limit(50)
    .get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addReport = async (report) => {
  const id = String(Date.now());
  await db.collection("reports").doc(id).set(report);
};

export const getAlerts = async () => {
  const snapshot = await db.collection("alerts").where("dismissed", "==", false).get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const dismissAlert = async (id) => {
  await db.collection("alerts").doc(String(id)).update({ dismissed: true });
};

export const dismissAllAlerts = async () => {
  const snapshot = await db.collection("alerts").where("dismissed", "==", false).get();
  const batch = db.batch();
  snapshot.forEach(doc => batch.update(doc.ref, { dismissed: true }));
  await batch.commit();
};

const DEFAULT_SETTINGS = {
  cronSchedule: "0 0 * * *",
  scoreDropThreshold: 5,
  uptimeCheckInterval: 5,
  maxReportsPerSite: 30,
};

export const getSettings = async () => {
  const doc = await db.collection("config").doc("settings").get();
  if (!doc.exists) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...doc.data() };
};

export const updateSettings = async (updates) => {
  const current = await getSettings();
  await db.collection("config").doc("settings").set({ ...current, ...updates });
};

export const getUptime = async (siteId) => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const snapshot = await db.collection("uptime")
    .where("siteId", "==", String(siteId))
    .where("timestamp", ">", twentyFourHoursAgo)
    .orderBy("timestamp", "desc")
    .get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
};

export const getKeywords = async (siteId) => {
  const site = await getWebsite(siteId);
  const keywords = site?.keywords || [];
  const snapshot = await db.collection("keyword_ranks")
    .where("siteId", "==", String(siteId))
    .get();
  const ranks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  return { keywords, ranks };
};

export const getBacklinks = async (siteId) => {
  const snapshot = await db.collection("backlinks").where("siteId", "==", String(siteId)).get();
  const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  const active = all.filter(b => b.active);
  const lost = all.filter(b => !b.active);
  return { active, lost, total: active.length };
};

export const getGroups = async () => {
  const websites = await getAllWebsites();
  return [...new Set(websites.map(w => w.group || "Ungrouped"))];
};

export const writeDb = async (data) => {
  const batch = db.batch();

  if (data.websites) {
    for (const w of data.websites) {
      batch.set(db.collection("websites").doc(String(w.id)), w, { merge: true });
    }
  }
  if (data.reports) {
    for (const r of data.reports) {
      if (!r._persisted) {
        batch.set(db.collection("reports").doc(String(Date.now() + Math.random())), r);
        r._persisted = true;
      }
    }
  }
  if (data.alerts) {
    for (const a of data.alerts) {
      batch.set(db.collection("alerts").doc(String(a.id || Date.now() + Math.random())), a, { merge: true });
    }
  }
  if (data.uptime) {
    for (const u of data.uptime) {
      if (!u._persisted) {
        batch.set(db.collection("uptime").doc(String(Date.now() + Math.random())), u);
        u._persisted = true;
      }
    }
  }
  if (data.keywordRanks) {
    for (const k of data.keywordRanks) {
      if (!k._persisted) {
        batch.set(db.collection("keyword_ranks").doc(String(Date.now() + Math.random())), k);
        k._persisted = true;
      }
    }
  }
  if (data.backlinks) {
    for (const b of data.backlinks) {
      batch.set(db.collection("backlinks").doc(String(b.id || Date.now() + Math.random())), b, { merge: true });
    }
  }
  
  await batch.commit();
};

export const readDb = async () => {
  const websites = await getAllWebsites();
  const settings = await getSettings();
  const alerts = await getAlerts();
  
  const keywordRanksSnap = await db.collection("keyword_ranks").get();
  const keywordRanks = keywordRanksSnap.docs.map(d => d.data());
  
  const backlinksSnap = await db.collection("backlinks").get();
  const backlinks = backlinksSnap.docs.map(d => d.data());

  const reportsSnap = await db.collection("reports").orderBy("timestamp", "desc").limit(100).get();
  const reports = reportsSnap.docs.map(d => d.data());

  const uptimeSnap = await db.collection("uptime").orderBy("timestamp", "desc").limit(500).get();
  const uptime = uptimeSnap.docs.map(d => d.data());

  return { websites, reports, alerts, settings, uptime, keywordRanks, backlinks };
};
