export type Preferences = {
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  sectors?: string[];
  investmentHorizon?: string;
  marketCapFocus?: string;
  dividendPreference?: string;
};

export type PortfolioItem = {
  symbol: string;
  quantity: number;
  averageCost?: number;
  addedAt?: string;
};

export type User = {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  preferences?: Preferences;
  portfolio?: PortfolioItem[];
};

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export type Stock = {
  id: string;
  symbol: string;
  change: string;
  changePercent: string;
  current: string;
  high: string;
  ldcp: string;
  low: string;
  open: string;
  volume: string;
};
