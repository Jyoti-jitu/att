// Centralized API URL — supports mobile testing via local network IP
export const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
