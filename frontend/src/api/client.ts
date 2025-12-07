import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const tokenStorageKey = 'stocksense_token';

export const api = axios.create({
  baseURL,
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem(tokenStorageKey, token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem(tokenStorageKey);
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(tokenStorageKey);
}
