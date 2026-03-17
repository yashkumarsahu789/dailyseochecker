import { db, functions } from "../firebase.js";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch
} from "firebase/firestore";

// Websites
export const getAllWebsites = async () => {
  const snapshot = await getDocs(collection(db, "websites"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addWebsite = async (url) => {
  const websites = await getAllWebsites();
  if (websites.find((w) => w.url === url)) {
    throw new Error("Website already tracked");
  }
  const id = String(Date.now());
  const newSite = {
    url,
    createdAt: new Date().toISOString(),
    lastRun: null,
    lastScores: null,
    lastStatus: "PENDING",
    notes: "",
    tags: [],
    group: "Ungrouped",
    keywords: [],
  };
  await setDoc(doc(db, "websites", id), newSite);
  return { id, ...newSite };
};

export const deleteWebsite = async (id) => {
  // Simplistic delete (Cloud function should handle cascading deletes like reports)
  await deleteDoc(doc(db, "websites", String(id)));
  return { message: "Deleted" };
};

export const updateWebsiteDetails = async (id, updates) => {
  const ref = doc(db, "websites", String(id));
  await updateDoc(ref, updates);
  const updated = await getDoc(ref);
  return { id: updated.id, ...updated.data() };
};

// Groups
export const getGroups = async () => {
  const sites = await getAllWebsites();
  return [...new Set(sites.map((w) => w.group || "Ungrouped"))];
};

// Reports
export const getReportsForSite = async (id) => {
  const q = query(
    collection(db, "reports"),
    where("websiteId", "==", Number(id)),
    orderBy("timestamp", "desc"),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Backlinks
export const getBacklinks = async (id) => {
  const q = query(collection(db, "backlinks"), where("siteId", "==", String(id)));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const active = all.filter((b) => b.active);
  const lost = all.filter((b) => !b.active);
  return { active, lost, total: active.length };
};

// Uptime
export const getUptime = async (id) => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const q = query(
    collection(db, "uptime"),
    where("siteId", "==", String(id)),
    where("timestamp", ">", twentyFourHoursAgo),
    orderBy("timestamp", "desc")
  );
  const snapshot = await getDocs(q);
  // Reversing to match old backend's sort
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
};

// Keywords
export const getKeywords = async (id) => {
  const siteDoc = await getDoc(doc(db, "websites", String(id)));
  const keywords = siteDoc.exists() ? siteDoc.data().keywords || [] : [];
  
  const q = query(collection(db, "keyword_ranks"), where("siteId", "==", String(id)));
  const snapshot = await getDocs(q);
  const ranks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  
  return { keywords, ranks };
};

export const addKeywordsForSite = async (id, keywordsArr) => {
  const ref = doc(db, "websites", String(id));
  const siteDoc = await getDoc(ref);
  const existing = siteDoc.exists() ? siteDoc.data().keywords || [] : [];
  const merged = [...new Set([...existing, ...keywordsArr])];
  await updateDoc(ref, { keywords: merged });
  return { keywords: merged };
};

export const deleteKeywordForSite = async (id, keyword) => {
  const ref = doc(db, "websites", String(id));
  const siteDoc = await getDoc(ref);
  const existing = siteDoc.exists() ? siteDoc.data().keywords || [] : [];
  const updated = existing.filter((k) => k !== decodeURIComponent(keyword));
  await updateDoc(ref, { keywords: updated });
  return { message: "Keyword removed" };
};

// Alerts
export const getAlerts = async () => {
  const q = query(collection(db, "alerts"), where("dismissed", "==", false));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const dismissAlert = async (id) => {
  await updateDoc(doc(db, "alerts", String(id)), { dismissed: true });
  return { message: "Alert dismissed" };
};

export const dismissAllAlerts = async () => {
  // Need to get all undismissed and batch update
  const q = query(collection(db, "alerts"), where("dismissed", "==", false));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.forEach((alertDoc) => {
    batch.update(alertDoc.ref, { dismissed: true });
  });
  await batch.commit();
  return { message: "All alerts dismissed" };
};

// Settings
const DEFAULT_SETTINGS = {
  cronSchedule: "0 0 * * *",
  scoreDropThreshold: 5,
  uptimeCheckInterval: 5,
  maxReportsPerSite: 30,
};

export const getSettings = async () => {
  const sDoc = await getDoc(doc(db, "config", "settings"));
  if (!sDoc.exists()) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...sDoc.data() };
};

export const updateSettings = async (updates) => {
  const current = await getSettings();
  const merged = { ...current, ...updates };
  await setDoc(doc(db, "config", "settings"), merged);
  return merged;
};

// Server functions placeholders (Must be replaced by HTTP Callable Cloud Functions later)
export const requestManualAudit = async (id) => {
  const ref = doc(db, "websites", String(id));
  await updateDoc(ref, { lastStatus: "PENDING" });
  return { message: "Audit started" };
};

export const requestCompetitorAudit = async (url) => {
  const fn = httpsCallable(functions, "requestCompetitorAudit");
  const result = await fn({ url });
  return result.data;
};

export const checkKeywordRanks = async () => {
  const fn = httpsCallable(functions, "checkKeywordRanksData");
  const result = await fn();
  return result.data;
};

export const sendTestEmail = async () => {
  const fn = httpsCallable(functions, "testEmail");
  const result = await fn();
  return result.data;
};

export const sendWeeklyReport = async () => {
  const fn = httpsCallable(functions, "weeklyReportTask");
  const result = await fn();
  return result.data;
};

export const sendWhatsAppTest = async () => {
  const fn = httpsCallable(functions, "testWhatsApp");
  const result = await fn();
  return result.data;
};

export const getActionPlan = async (id) => {
  const fn = httpsCallable(functions, "getActionPlanData");
  const result = await fn({ siteId: String(id) });
  return result.data;
};

export const getLinkSuggestions = async () => {
  const fn = httpsCallable(functions, "getLinkSuggestionsData");
  const result = await fn();
  return result.data;
};

export const getFleetPlan = async () => {
  const fn = httpsCallable(functions, "getFleetPlanData");
  const result = await fn();
  return result.data;
};

export const getAnalyticsData = async (id) => {
  const fn = httpsCallable(functions, "getAnalyticsData");
  const result = await fn({ siteId: String(id) });
  return result.data;
};

export const getSummaryPdf = async () => {
  const fn = httpsCallable(functions, "generateSummaryPdfData");
  const result = await fn();
  return result.data;
};

export const getSitePdf = async (id) => {
  const fn = httpsCallable(functions, "generateSitePdf");
  const result = await fn({ siteId: String(id) });
  return result.data;
};
