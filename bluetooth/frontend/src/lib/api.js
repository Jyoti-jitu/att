// Centralized API URL — supports mobile testing via local network IP
// Set VITE_API_URL in .env to your machine's local IP, e.g: http://192.168.1.5:5000
export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
