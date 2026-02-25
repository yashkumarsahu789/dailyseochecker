// Central API config — used by all components
// Set VITE_API_URL in .env or Vercel env vars for production
export const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";
