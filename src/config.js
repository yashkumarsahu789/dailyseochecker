// Central API config — used by all components
// In dev: Vite proxy forwards /api to Firebase emulator
// In prod: Set VITE_API_URL to your Firebase Functions URL
export const API_BASE = import.meta.env.VITE_API_URL || "/api";
