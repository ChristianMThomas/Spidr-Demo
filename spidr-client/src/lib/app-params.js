// Stub — Base44 app-params replaced by JWT auth + .env
// Kept so any stray import doesn't break compilation
export const appParams = {
  appId: 'spidr',
  token: null,
  functionsVersion: null,
  appBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
};
