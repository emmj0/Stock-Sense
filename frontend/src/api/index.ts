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

export async function fetchIndexes(): Promise<any[]> {
  const { data } = await api.get('/api/market/indexes');
  return data.indexes || [];
}

export async function fetchSectors(): Promise<any[]> {
  const { data } = await api.get('/api/market/sectors');
  return data.sectors || [];
}

export async function fetchMarketWatch(filterType?: string, filterValue?: string): Promise<any[]> {
  const params = filterType && filterValue ? { [filterType]: filterValue } : undefined;
  const { data } = await api.get('/api/market/watch', { params });
  return data.stocks || [];
}

export async function fetchSectorByCode(code: string): Promise<any> {
  const { data } = await api.get(`/api/market/sectors/${code}`);
  return data.sector;
}

export async function fetchIndexByName(name: string): Promise<any> {
  const { data } = await api.get(`/api/market/indexes/${name}`);
  return data.index;
}

// Courses API
export async function fetchCourses(): Promise<any> {
  const { data } = await api.get('/api/courses');
  return data;
}

export async function fetchCourse(courseId: string): Promise<any> {
  const { data } = await api.get(`/api/courses/${courseId}`);
  return data;
}

export async function startCourse(courseId: string): Promise<any> {
  const { data } = await api.post(`/api/courses/${courseId}/start`);
  return data;
}

export async function markReadingComplete(courseId: string): Promise<any> {
  const { data } = await api.post(`/api/courses/${courseId}/reading-complete`);
  return data;
}

export async function markPracticeComplete(courseId: string): Promise<any> {
  const { data } = await api.post(`/api/courses/${courseId}/practice-complete`);
  return data;
}

export async function submitQuiz(courseId: string, answers: { quizId: string; selectedAnswer: string }[]): Promise<any> {
  const { data } = await api.post(`/api/courses/${courseId}/submit-quiz`, { answers });
  return data;
}

export async function fetchUserProgress(): Promise<any> {
  const { data } = await api.get('/api/courses/user/progress');
  return data;
}
