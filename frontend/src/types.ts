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

export type Prediction = {
  id?: string;
  symbol: string;
  predictedPrice?: number;
  predictedReturn?: number;
  signal?: 'BUY' | 'SELL' | 'HOLD' | string;
  confidence?: number;
  currentPrice?: number;
  predictionDate?: string;
  horizonDays?: number;
  ensembleAgreement?: number;
  modelPredictions?: Record<string, number>;
  technicalIndicators?: Record<string, any>;
  reasoning?: string;
  updatedAt?: string;
};

export type PortfolioResponse = {
  portfolio: PortfolioItem[];
  predictions?: Record<string, Prediction>;
};

export type Recommendations = {
  id?: string;
  topBuys: any[];
  topSells: any[];
  summary?: {
    total_buys?: number;
    total_sells?: number;
  };
  topN?: number;
  sourceTimestamp?: string;
  updatedAt?: string;
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
