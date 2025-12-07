import { api } from './client';
import type { AuthResponse, Preferences, PortfolioItem, Stock, User } from '../types';

export async function signup(payload: { name: string; email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/signup', payload);
  return data;
}

export async function login(payload: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/login', payload);
  return data;
}

export async function googleLogin(idToken: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/google', { idToken });
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/api/auth/me');
  return data.user;
}

export async function fetchPreferences(): Promise<Preferences | undefined> {
  const { data } = await api.get<{ preferences: Preferences | undefined }>('/api/user/preferences');
  return data.preferences;
}

export async function savePreferences(preferences: Preferences): Promise<Preferences | undefined> {
  const { data } = await api.put<{ preferences: Preferences | undefined }>(
    '/api/user/preferences',
    preferences
  );
  return data.preferences;
}

export async function fetchStocks(search?: string): Promise<Stock[]> {
  const params = search ? { search } : undefined;
  const { data } = await api.get<{ stocks: Stock[] }>('/api/stocks', { params });
  return data.stocks;
}

export async function fetchPortfolio(): Promise<PortfolioItem[]> {
  const { data } = await api.get<{ portfolio: PortfolioItem[] }>('/api/user/portfolio');
  return data.portfolio;
}

export async function upsertPortfolioItem(item: PortfolioItem): Promise<PortfolioItem[]> {
  const { data } = await api.post<{ portfolio: PortfolioItem[] }>('/api/user/portfolio', item);
  return data.portfolio;
}

export async function removePortfolioItem(symbol: string): Promise<PortfolioItem[]> {
  const { data } = await api.delete<{ portfolio: PortfolioItem[] }>(`/api/user/portfolio/${symbol}`);
  return data.portfolio;
}
