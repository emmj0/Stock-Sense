"""
KSE-30 Stock Price Prediction - Advanced ML Model
Optimized for 20+ years of historical data (2000-2025)
Final Year Project Implementation
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import lightgbm as lgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, mean_absolute_percentage_error
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

class KSEStockPredictor:
    """
    Advanced stock prediction system leveraging 20+ years of KSE-30 historical data
    Optimized for accuracy with historical patterns and regime detection
    """
    
    def __init__(self, prediction_days=7):
        """
        Args:
            prediction_days: Number of days ahead to predict (default: 7)
        """
        self.prediction_days = prediction_days
        self.models = {}
        self.feature_cols = []
        self.data_dict = {}
        self.scalers = {}
        self.regime_scalers = {}  # Separate scalers for different market regimes
        
    def load_data(self, csv_path):
        """
        Load and validate historical data from 2000 onwards
        """
        print("Loading historical KSE-30 data...")
        
        df_all = pd.read_csv(csv_path)
        
        # Try multiple date formats
        for date_format in ['%d/%m/%Y', '%Y-%m-%d', '%m/%d/%Y']:
            try:
                df_all['Date'] = pd.to_datetime(df_all['Date'], format=date_format)
                break
            except:
                continue
        
        if df_all['Date'].dtype != 'datetime64[ns]':
            df_all['Date'] = pd.to_datetime(df_all['Date'])
        
        # Data quality checks
        print("\n" + "="*70)
        print("DATA VALIDATION REPORT")
        print("="*70)
        print(f"Total records: {len(df_all):,}")
        print(f"Date range: {df_all['Date'].min().strftime('%Y-%m-%d')} to {df_all['Date'].max().strftime('%Y-%m-%d')}")
        print(f"Missing values: {df_all.isnull().sum().sum()}")
        print(f"Duplicate rows: {df_all.duplicated().sum()}")
        
        # Remove duplicates and sort
        df_all = df_all.drop_duplicates(subset=['Date', 'Ticker'], keep='first')
        df_all = df_all.sort_values('Date').reset_index(drop=True)
        
        # Split by ticker
        tickers = df_all['Ticker'].unique()
        print(f"\nFound {len(tickers)} unique stocks\n")
        
        for ticker in sorted(tickers):
            ticker_df = df_all[df_all['Ticker'] == ticker].copy()
            ticker_df = ticker_df.sort_values('Date').reset_index(drop=True)
            
            # Data quality per stock
            years_covered = (ticker_df['Date'].max() - ticker_df['Date'].min()).days / 365.25
            
            print(f"  {ticker:6s}: {len(ticker_df):6,d} records | {years_covered:5.1f} years | {ticker_df['Date'].min().strftime('%Y-%m-%d')} to {ticker_df['Date'].max().strftime('%Y-%m-%d')}")
            
            self.data_dict[ticker] = ticker_df
        
        print(f"\n✓ Successfully loaded {len(self.data_dict)} stocks with historical data\n")
        return self.data_dict
    
    def detect_market_regime(self, df, window=252):
        """
        Detect market regime (bull, bear, sideways)
        Based on 1-year rolling returns and volatility
        """
        df = df.copy()
        df['Returns'] = df['Close'].pct_change()
        
        # 1-year rolling metrics
        df['Annual_Return'] = df['Close'].pct_change(window).fillna(0)
        df['Annual_Volatility'] = df['Returns'].rolling(window, min_periods=1).std()
        
        # Regime classification
        df['Regime'] = 'Sideways'  # Default
        df.loc[df['Annual_Return'] > 0.1, 'Regime'] = 'Bull'      # > 10% annual return
        df.loc[df['Annual_Return'] < -0.1, 'Regime'] = 'Bear'     # < -10% annual return
        
        return df
    
    def calculate_advanced_indicators(self, df):
        """
        Calculate 50+ advanced technical indicators
        Optimized for deep historical data patterns
        """
        df = df.copy()
        df = df.sort_values('Date').reset_index(drop=True)
        
        # ===== PRICE-BASED FEATURES =====
        df['Returns'] = df['Close'].pct_change()
        df['Log_Returns'] = np.log(df['Close'] / df['Close'].shift(1))
        
        # ===== MOVING AVERAGES - Multiple Timeframes =====
        for period in [3, 5, 10, 20, 50, 100, 200]:
            df[f'SMA_{period}'] = df['Close'].rolling(window=period, min_periods=1).mean()
            df[f'EMA_{period}'] = df['Close'].ewm(span=period, adjust=False).mean()
        
        # MA crossovers
        df['SMA_5_20_Cross'] = np.where(df['SMA_5'] > df['SMA_20'], 1, -1)
        df['SMA_20_50_Cross'] = np.where(df['SMA_20'] > df['SMA_50'], 1, -1)
        df['SMA_50_200_Cross'] = np.where(df['SMA_50'] > df['SMA_200'], 1, -1)
        df['SMA_5_200_Cross'] = np.where(df['SMA_5'] > df['SMA_200'], 1, -1)
        
        # Price-to-MA ratios (normalized)
        for period in [20, 50, 200]:
            df[f'Price_SMA{period}_Ratio'] = df['Close'] / (df[f'SMA_{period}'] + 1e-10)
            df[f'Price_EMA{period}_Ratio'] = df['Close'] / (df[f'EMA_{period}'] + 1e-10)
        
        # ===== MOMENTUM INDICATORS =====
        # RSI - Multiple periods for better momentum capture
        for period in [5, 14, 21]:
            df[f'RSI_{period}'] = self.calculate_rsi(df['Close'], period)
        
        # MACD - Full histogram
        ema_12 = df['Close'].ewm(span=12, adjust=False).mean()
        ema_26 = df['Close'].ewm(span=26, adjust=False).mean()
        df['MACD'] = ema_12 - ema_26
        df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
        df['MACD_Diff'] = df['MACD'] - df['MACD_Signal']
        df['MACD_Histogram'] = np.sign(df['MACD_Diff'])
        
        # Stochastic Oscillator
        df['Stoch_K'], df['Stoch_D'] = self.calculate_stochastic(df['Close'], period=14)
        
        # Rate of Change (ROC)
        for period in [5, 10, 20]:
            df[f'ROC_{period}'] = ((df['Close'] - df['Close'].shift(period)) / 
                                    (df['Close'].shift(period) + 1e-10)) * 100
        
        # Momentum (multiple timeframes)
        for period in [1, 3, 5, 10, 20]:
            df[f'Momentum_{period}'] = df['Close'].diff(period)
        
        # ===== VOLATILITY MEASURES =====
        df['Volatility_5'] = df['Returns'].rolling(window=5, min_periods=1).std()
        df['Volatility_10'] = df['Returns'].rolling(window=10, min_periods=1).std()
        df['Volatility_20'] = df['Returns'].rolling(window=20, min_periods=1).std()
        df['Volatility_60'] = df['Returns'].rolling(window=60, min_periods=1).std()
        
        # Average True Range (ATR)
        df['ATR'] = self.calculate_atr(df, period=14)
        df['ATR_Percent'] = df['ATR'] / (df['Close'] + 1e-10)
        
        # ===== BOLLINGER BANDS =====
        for period in [20, 50]:
            bb_mid = df['Close'].rolling(window=period, min_periods=1).mean()
            bb_std = df['Close'].rolling(window=period, min_periods=1).std()
            df[f'BB_{period}_Upper'] = bb_mid + (bb_std * 2)
            df[f'BB_{period}_Lower'] = bb_mid - (bb_std * 2)
            df[f'BB_{period}_Mid'] = bb_mid
            df[f'BB_{period}_Width'] = df[f'BB_{period}_Upper'] - df[f'BB_{period}_Lower']
            
            # BB position (0 = lower band, 1 = upper band)
            bb_position = (df['Close'] - df[f'BB_{period}_Lower']) / (df[f'BB_{period}_Width'] + 1e-10)
            df[f'BB_{period}_Position'] = bb_position.clip(0, 1)
            
            # Squeeze indicator (BB narrowing)
            df[f'BB_{period}_Squeeze'] = df[f'BB_{period}_Width'] / (df['Close'] * 0.02)
        
        # ===== VOLUME ANALYSIS =====
        df['Volume_SMA_5'] = df['Volume'].rolling(window=5, min_periods=1).mean()
        df['Volume_SMA_20'] = df['Volume'].rolling(window=20, min_periods=1).mean()
        df['Volume_Ratio'] = df['Volume'] / (df['Volume_SMA_20'] + 1e-10)
        df['Volume_Trend'] = df['Volume_SMA_5'] / (df['Volume_SMA_20'] + 1e-10)
        
        # On-Balance Volume
        df['OBV'] = self.calculate_obv(df)
        df['OBV_SMA'] = df['OBV'].rolling(window=20, min_periods=1).mean()
        df['OBV_Signal'] = np.sign(df['OBV'] - df['OBV_SMA'])
        
        # Price-Volume Trend
        df['PVT'] = (df['Returns'] * df['Volume']).rolling(window=20, min_periods=1).sum()
        df['PVT_SMA'] = df['PVT'].rolling(window=20, min_periods=1).mean()
        
        # ===== PRICE ACTION FEATURES =====
        df['High_Low_Range'] = (df['High'] - df['Low']) / df['Low']
        df['Close_Position'] = (df['Close'] - df['Low']) / (df['High'] - df['Low'] + 1e-10)
        df['Open_Close_Ratio'] = (df['Close'] - df['Open']) / (df['Open'] + 1e-10)
        df['High_Close_Ratio'] = (df['High'] - df['Close']) / df['Close']
        df['Low_Close_Ratio'] = (df['Close'] - df['Low']) / df['Close']
        
        # ===== TREND INDICATORS =====
        # ADX (Average Directional Index)
        df['ADX'] = self.calculate_adx(df, period=14)
        
        # SuperTrend
        df['SuperTrend'] = self.calculate_supertrend(df, period=10, multiplier=3)
        
        # ===== LAG FEATURES - Critical for time series =====
        for lag in [1, 2, 3, 5, 7, 10, 20, 30]:
            df[f'Close_Lag_{lag}'] = df['Close'].shift(lag)
            df[f'Return_Lag_{lag}'] = df['Returns'].shift(lag)
            if f'RSI_14' in df.columns:
                df[f'RSI_Lag_{lag}'] = df['RSI_14'].shift(lag)
        
        # ===== CUMULATIVE FEATURES =====
        # Cumulative returns for different periods
        for period in [5, 10, 20, 60]:
            df[f'Cumulative_Return_{period}'] = df['Returns'].rolling(period, min_periods=1).sum()
        
        # ===== INTERACTION FEATURES =====
        df['Bullish_Signal'] = ((df['SMA_5'] > df['SMA_20']).astype(int) + 
                                (df['RSI_14'] < 70).astype(int) + 
                                (df['MACD_Diff'] > 0).astype(int))
        df['Bearish_Signal'] = ((df['SMA_5'] < df['SMA_20']).astype(int) + 
                                (df['RSI_14'] > 30).astype(int) + 
                                (df['MACD_Diff'] < 0).astype(int))
        df['Volume_Price_Trend'] = df['Volume_Ratio'] * df['Volatility_20']
        
        # ===== HISTORICAL REFERENCE POINTS =====
        # 52-week high/low
        df['High_52W'] = df['Close'].rolling(window=252, min_periods=1).max()
        df['Low_52W'] = df['Close'].rolling(window=252, min_periods=1).min()
        df['Position_52W'] = (df['Close'] - df['Low_52W']) / (df['High_52W'] - df['Low_52W'] + 1e-10)
        
        # ===== STATISTICAL FEATURES =====
        # Skewness and Kurtosis
        for period in [20, 60]:
            df[f'Skewness_{period}'] = df['Returns'].rolling(period, min_periods=1).skew()
            df[f'Kurtosis_{period}'] = df['Returns'].rolling(period, min_periods=1).kurt()
        
        return df
    
    def calculate_rsi(self, prices, period=14):
        """Calculate RSI with improved numerics"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period, min_periods=1).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period, min_periods=1).mean()
        rs = gain / (loss + 1e-10)
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(50)
    
    def calculate_stochastic(self, prices, period=14):
        """Calculate Stochastic Oscillator"""
        lowest_low = prices.rolling(window=period, min_periods=1).min()
        highest_high = prices.rolling(window=period, min_periods=1).max()
        k = 100 * (prices - lowest_low) / (highest_high - lowest_low + 1e-10)
        d = k.rolling(window=3, min_periods=1).mean()
        return k.fillna(50), d.fillna(50)
    
    def calculate_atr(self, df, period=14):
        """Calculate Average True Range"""
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        atr = true_range.rolling(period, min_periods=1).mean()
        return atr
    
    def calculate_obv(self, df):
        """Calculate On-Balance Volume"""
        obv = np.zeros(len(df))
        for i in range(len(df)):
            if i == 0:
                obv[i] = df['Volume'].iloc[i]
            else:
                if df['Close'].iloc[i] > df['Close'].iloc[i-1]:
                    obv[i] = obv[i-1] + df['Volume'].iloc[i]
                elif df['Close'].iloc[i] < df['Close'].iloc[i-1]:
                    obv[i] = obv[i-1] - df['Volume'].iloc[i]
                else:
                    obv[i] = obv[i-1]
        return pd.Series(obv, index=df.index)
    
    def calculate_adx(self, df, period=14):
        """Calculate Average Directional Index"""
        high_diff = df['High'].diff()
        low_diff = -df['Low'].diff()
        
        plus_dm = np.where((high_diff > low_diff) & (high_diff > 0), high_diff, 0)
        minus_dm = np.where((low_diff > high_diff) & (low_diff > 0), low_diff, 0)
        
        atr = self.calculate_atr(df, period)
        
        plus_di = 100 * pd.Series(plus_dm, index=df.index).rolling(period, min_periods=1).mean() / (atr + 1e-10)
        minus_di = 100 * pd.Series(minus_dm, index=df.index).rolling(period, min_periods=1).mean() / (atr + 1e-10)
        
        dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di + 1e-10)
        adx = dx.rolling(period, min_periods=1).mean()
        
        return adx.fillna(50)
    
    def calculate_supertrend(self, df, period=10, multiplier=3):
        """Calculate SuperTrend indicator"""
        hl2 = (df['High'] + df['Low']) / 2
        atr = self.calculate_atr(df, period)
        
        matr = multiplier * atr
        upperband = hl2 + matr
        lowerband = hl2 - matr
        
        supertrend = np.zeros(len(df))
        for i in range(len(df)):
            if i == 0:
                supertrend[i] = hl2.iloc[i]
            else:
                if df['Close'].iloc[i] <= upperband.iloc[i-1]:
                    supertrend[i] = upperband.iloc[i]
                else:
                    supertrend[i] = lowerband.iloc[i]
        
        return pd.Series(supertrend, index=df.index)
    
    def prepare_features(self, df, ticker, fit_scaler=False):
        """
        Prepare features with market regime-aware scaling
        """
        # Detect market regime
        df = self.detect_market_regime(df)
        
        # Calculate indicators
        df = self.calculate_advanced_indicators(df)
        
        # Create target
        df['Target'] = df['Close'].shift(-self.prediction_days)
        df['Target_Return'] = (df['Target'] - df['Close']) / (df['Close'] + 1e-10) * 100
        
        # Remove NaN
        df = df.dropna()
        
        if len(df) == 0:
            raise ValueError(f"No valid data for {ticker}")
        
        # Select features
        exclude_cols = ['Date', 'Ticker', 'Target', 'Target_Return', 'Open', 'High', 'Low', 'Close', 'Volume', 'Regime', 'Annual_Return', 'Annual_Volatility']
        self.feature_cols = [col for col in df.columns if col not in exclude_cols]
        
        X = df[self.feature_cols].copy()
        
        # Fit scaler on entire dataset (training mode)
        if fit_scaler:
            self.scalers[ticker] = StandardScaler()
            X_scaled = self.scalers[ticker].fit_transform(X)
        else:
            if ticker not in self.scalers:
                raise ValueError(f"No scaler for {ticker}. Train first.")
            X_scaled = self.scalers[ticker].transform(X)
        
        df_scaled = pd.DataFrame(X_scaled, columns=self.feature_cols, index=df.index)
        df_scaled['Target'] = df['Target'].values
        df_scaled['Target_Return'] = df['Target_Return'].values
        df_scaled['Date'] = df['Date'].values
        df_scaled['Regime'] = df['Regime'].values
        
        return df_scaled
    
    def train_model(self, ticker):
        """
        Train LightGBM with 20 years of data
        Optimized hyperparameters for historical patterns
        """
        if ticker not in self.data_dict:
            raise ValueError(f"No data for {ticker}")
        
        print(f"\n{'='*70}")
        print(f"Training ADVANCED model for {ticker}")
        print(f"{'='*70}")
        
        df = self.data_dict[ticker].copy()
        df_prepared = self.prepare_features(df, ticker, fit_scaler=True)
        
        X = df_prepared[self.feature_cols]
        y = df_prepared['Target']
        
        print(f"Training data: {len(df_prepared):,} samples")
        print(f"Features: {len(self.feature_cols)}")
        print(f"Data span: {df_prepared['Date'].min().strftime('%Y-%m-%d')} to {df_prepared['Date'].max().strftime('%Y-%m-%d')}")
        print(f"Target range: {y.min():.2f} - {y.max():.2f} PKR")
        
        # Enhanced cross-validation with more folds on historical data
        tscv = TimeSeriesSplit(n_splits=10)  # More folds for better validation
        
        mae_scores = []
        rmse_scores = []
        r2_scores = []
        mape_scores = []
        
        best_params = None
        best_score = float('-inf')
        
        print("\nCross-validating (10-fold time series)...")
        
        for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
            
            # Hyperparameters optimized for 20+ years of data
            params = {
                'objective': 'regression',
                'metric': ['rmse', 'mae'],
                'boosting_type': 'gbdt',
                'num_leaves': 60,  # Increased capacity for complex patterns
                'learning_rate': 0.02,  # Slower for stability
                'feature_fraction': 0.8,
                'bagging_fraction': 0.8,
                'bagging_freq': 5,
                'verbose': -1,
                'min_child_samples': 15,  # More conservative splits
                'min_child_weight': 0.001,
                'subsample_for_bin': 200000,
                'lambda_l1': 0.8,  # Increased regularization
                'lambda_l2': 0.8,
                'max_depth': 10,  # Deeper trees for complex interactions
                'min_split_gain': 0.00001,
                'extra_trees': False,
                'tree_learner': 'serial',
                'boost_from_average': True,
                'is_unbalance': False,
            }
            
            train_data = lgb.Dataset(X_train, label=y_train)
            val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
            
            model = lgb.train(
                params,
                train_data,
                num_boost_round=2000,  # More rounds with early stopping
                valid_sets=[val_data],
                callbacks=[
                    lgb.early_stopping(stopping_rounds=150, verbose=False),
                    lgb.log_evaluation(period=0)
                ]
            )
            
            y_pred = model.predict(X_val)
            
            mae = mean_absolute_error(y_val, y_pred)
            rmse = np.sqrt(mean_squared_error(y_val, y_pred))
            r2 = r2_score(y_val, y_pred)
            mape = mean_absolute_percentage_error(y_val, y_pred)
            
            mae_scores.append(mae)
            rmse_scores.append(rmse)
            r2_scores.append(r2)
            mape_scores.append(mape)
            
            if r2 > best_score:
                best_score = r2
                best_params = params
            
            print(f"  Fold {fold+1}/10: R²={r2:.4f}, MAPE={mape:.2f}%, MAE={mae:.2f}")
        
        # Print validation summary
        print(f"\n{'─'*70}")
        print(f"Cross-Validation Results:")
        print(f"  MAE:  {np.mean(mae_scores):.4f} ± {np.std(mae_scores):.4f} PKR")
        print(f"  RMSE: {np.mean(rmse_scores):.4f} ± {np.std(rmse_scores):.4f} PKR")
        print(f"  MAPE: {np.mean(mape_scores):.4f} ± {np.std(mape_scores):.4f} %")
        print(f"  R²:   {np.mean(r2_scores):.4f} ± {np.std(r2_scores):.4f}")
        
        # Train final model
        print(f"\nTraining final model on full dataset...")
        final_train_data = lgb.Dataset(X, label=y)
        final_model = lgb.train(
            best_params,
            final_train_data,
            num_boost_round=int(np.mean([model.num_trees() for _ in range(1)])) + 200,
            callbacks=[lgb.log_evaluation(period=0)]
        )
        
        # Feature importance
        importance = pd.DataFrame({
            'feature': self.feature_cols,
            'importance': final_model.feature_importance()
        }).sort_values('importance', ascending=False)
        
        print(f"\nTop 10 Most Important Features:")
        for idx, row in importance.head(10).iterrows():
            print(f"  {row['feature']:30s}: {row['importance']:6.0f}")
        
        # Store model
        self.models[ticker] = {
            'model': final_model,
            'metrics': {
                'mae': np.mean(mae_scores),
                'rmse': np.mean(rmse_scores),
                'r2': np.mean(r2_scores),
                'mape': np.mean(mape_scores)
            },
            'feature_importance': importance.head(20)
        }
        
        print(f"\n✓ Model trained for {ticker}\n")
        
        return final_model
    
    def train_all_models(self):
        """Train models for all stocks"""
        if not self.data_dict:
            raise ValueError("No data loaded")
        
        print(f"\n{'='*70}")
        print(f"BATCH TRAINING: {len(self.data_dict)} STOCKS")
        print(f"{'='*70}")
        
        trained = 0
        failed = 0
        
        for ticker in sorted(self.data_dict.keys()):
            try:
                self.train_model(ticker)
                trained += 1
            except Exception as e:
                print(f"✗ {ticker} failed: {str(e)}")
                failed += 1
        
        print(f"\n{'='*70}")
        print(f"TRAINING SUMMARY: {trained} trained, {failed} failed")
        print(f"{'='*70}\n")
    
    def predict(self, ticker):
        """Make prediction for a stock"""
        if ticker not in self.models:
            raise ValueError(f"No model for {ticker}")
        
        if ticker not in self.data_dict:
            raise ValueError(f"No data for {ticker}")
        
        df = self.data_dict[ticker].copy()
        df_prepared = self.prepare_features(df, ticker, fit_scaler=False)
        
        latest_data = df_prepared[self.feature_cols].iloc[-1:].copy()
        current_price = self.data_dict[ticker]['Close'].iloc[-1]
        current_date = df_prepared['Date'].iloc[-1]
        
        model = self.models[ticker]['model']
        predicted_price = model.predict(latest_data)[0]
        predicted_return = ((predicted_price - current_price) / current_price) * 100
        
        df_full = self.detect_market_regime(self.data_dict[ticker].copy())
        df_full = self.calculate_advanced_indicators(df_full)
        latest_row = df_full.iloc[-1]
        
        rsi = latest_row['RSI_14']
        volatility = latest_row['Volatility_20']
        regime = latest_row['Regime']
        
        confidence = self.calculate_confidence(ticker, predicted_return, volatility, rsi, regime)
        signal = self.generate_signal(predicted_return, confidence, rsi, volatility, regime)
        
        return {
            'ticker': ticker,
            'current_price': round(current_price, 2),
            'predicted_price': round(predicted_price, 2),
            'predicted_return': round(predicted_return, 2),
            'prediction_horizon_days': self.prediction_days,
            'current_date': current_date.strftime('%Y-%m-%d'),
            'prediction_date': (current_date + timedelta(days=self.prediction_days)).strftime('%Y-%m-%d'),
            'signal': signal['action'],
            'confidence': round(signal['confidence'], 2),
            'reasoning': signal['reasoning'],
            'technical_indicators': {
                'rsi_14': round(rsi, 2),
                'rsi_5': round(latest_row['RSI_5'], 2),
                'volatility': round(volatility * 100, 2),
                'macd_diff': round(latest_row['MACD_Diff'], 2),
                'bb_position': round(latest_row['BB_20_Position'], 2),
                'market_regime': regime,
                'adx': round(latest_row['ADX'], 2)
            },
            'model_metrics': self.models[ticker]['metrics']
        }
    
    def calculate_confidence(self, ticker, predicted_return, volatility, rsi, regime):
        """
        Calculate confidence considering market regime
        """
        r2 = self.models[ticker]['metrics']['r2']
        mape = self.models[ticker]['metrics']['mape']
        
        # Base confidence from R²
        if r2 < 0:
            base_confidence = 30
        elif r2 < 0.05:
            base_confidence = 38
        elif r2 < 0.1:
            base_confidence = 45
        elif r2 < 0.15:
            base_confidence = 52
        elif r2 < 0.2:
            base_confidence = 58
        elif r2 < 0.3:
            base_confidence = 65
        elif r2 < 0.5:
            base_confidence = 72
        else:
            base_confidence = min(90, 60 + (r2 * 80))
        
        # MAPE adjustment
        if mape < 1:
            mape_boost = 25
        elif mape < 2:
            mape_boost = 20
        elif mape < 5:
            mape_boost = 15
        elif mape < 10:
            mape_boost = 10
        elif mape < 15:
            mape_boost = 5
        elif mape < 25:
            mape_boost = 0
        else:
            mape_boost = -10
        
        confidence = base_confidence + mape_boost
        
        # Market regime adjustment
        regime_adjust = 0
        if regime == 'Bull':
            regime_adjust = 3  # Slight boost in bull market
        elif regime == 'Bear':
            regime_adjust = -2  # Slight penalty in bear market
        
        confidence += regime_adjust
        
        # Volatility penalty
        if volatility < 0.005:
            vol_penalty = 0
        elif volatility < 0.015:
            vol_penalty = -2
        elif volatility < 0.03:
            vol_penalty = -5
        elif volatility < 0.05:
            vol_penalty = -8
        else:
            vol_penalty = -15
        
        confidence += vol_penalty
        
        # RSI extremes
        if rsi > 80 or rsi < 20:
            confidence -= 3  # Extreme RSI less reliable
        
        # Magnitude penalty
        if abs(predicted_return) < 0.3:
            mag_adjust = 2
        elif abs(predicted_return) < 2:
            mag_adjust = 1
        elif abs(predicted_return) < 5:
            mag_adjust = 0
        elif abs(predicted_return) < 10:
            mag_adjust = -5
        else:
            mag_adjust = -15
        
        confidence += mag_adjust
        
        confidence = max(20, min(95, confidence))
        
        return confidence
    
    def generate_signal(self, predicted_return, confidence, rsi, volatility, regime):
        """
        Generate trading signal with regime awareness
        """
        reasoning = []
        
        vol_pct = volatility * 100
        buy_threshold = 1.2 + (vol_pct * 0.4)
        sell_threshold = -1.2 - (vol_pct * 0.4)
        
        action = "HOLD"
        sig_conf = confidence
        
        if predicted_return > buy_threshold:
            if confidence > 38:
                reasoning.append(f"Upward: {predicted_return:+.2f}% | Conf: {confidence:.0f}%")
                
                if predicted_return > (buy_threshold * 2):
                    reasoning.append("STRONG BULLISH")
                    if rsi < 75:
                        action = "BUY"
                        sig_conf = min(95, confidence + 5)
                    else:
                        reasoning.append("RSI overbought")
                        sig_conf = confidence * 0.75
                else:
                    if rsi < 65:
                        action = "BUY"
                        sig_conf = confidence
                    else:
                        reasoning.append("RSI elevated")
                        sig_conf = confidence * 0.85
            else:
                reasoning.append(f"Weak bullish - low confidence")
        
        elif predicted_return < sell_threshold:
            if confidence > 38:
                reasoning.append(f"Downward: {predicted_return:.2f}% | Conf: {confidence:.0f}%")
                
                if predicted_return < (sell_threshold * 2):
                    reasoning.append("STRONG BEARISH")
                    if rsi > 25:
                        action = "SELL"
                        sig_conf = min(95, confidence + 5)
                    else:
                        reasoning.append("RSI oversold")
                        sig_conf = confidence * 0.75
                else:
                    if rsi > 35:
                        action = "SELL"
                        sig_conf = confidence
                    else:
                        reasoning.append("RSI depressed")
                        sig_conf = confidence * 0.85
            else:
                reasoning.append(f"Weak bearish - low confidence")
        
        else:
            reasoning.append(f"Neutral: {predicted_return:+.2f}%")
            if regime == 'Bull':
                reasoning.append("Bull regime - wait for dips")
            elif regime == 'Bear':
                reasoning.append("Bear regime - wait for bounces")
            sig_conf = confidence * 0.6
        
        return {
            'action': action,
            'confidence': max(15, sig_conf),
            'reasoning': ' | '.join(reasoning) if reasoning else "No signal"
        }
    
    def predict_all(self):
        """Predict for all trained models"""
        predictions = {}
        for ticker in sorted(self.models.keys()):
            try:
                predictions[ticker] = self.predict(ticker)
            except Exception as e:
                predictions[ticker] = {'ticker': ticker, 'error': str(e)}
        return predictions
    
    def get_top_recommendations(self, top_n=5):
        """Get top BUY/SELL recommendations"""
        all_preds = self.predict_all()
        
        buys = [p for p in all_preds.values() if 'error' not in p and p['signal'] == 'BUY']
        sells = [p for p in all_preds.values() if 'error' not in p and p['signal'] == 'SELL']
        
        buys.sort(key=lambda x: x['confidence'], reverse=True)
        sells.sort(key=lambda x: x['confidence'], reverse=True)
        
        return {'top_buys': buys[:top_n], 'top_sells': sells[:top_n]}


# ============================================================================
# USAGE FUNCTIONS
# ============================================================================

def create_advanced_predictor(csv_path, prediction_days=7):
    """
    Create and train advanced predictor on historical data
    """
    print("\n" + "="*70)
    print("INITIALIZING ADVANCED KSE PREDICTOR")
    print("="*70)
    
    predictor = KSEStockPredictor(prediction_days=prediction_days)
    predictor.load_data(csv_path)
    predictor.train_all_models()
    
    return predictor


def test_advanced_predictor(csv_path, prediction_days=7):
    """
    Comprehensive testing and validation
    """
    print("\n" + "="*70)
    print("ADVANCED KSE PREDICTOR - VALIDATION")
    print("="*70)
    
    predictor = create_advanced_predictor(csv_path, prediction_days)
    all_preds = predictor.predict_all()
    
    valid = {k: v for k, v in all_preds.items() if 'error' not in v}
    errors = {k: v for k, v in all_preds.items() if 'error' in v}
    
    buys = [p for p in valid.values() if p['signal'] == 'BUY']
    sells = [p for p in valid.values() if p['signal'] == 'SELL']
    holds = [p for p in valid.values() if p['signal'] == 'HOLD']
    
    confs = [p['confidence'] for p in valid.values()]
    
    print(f"\nRESULTS:")
    print(f"  Successful: {len(valid)}/{len(all_preds)}")
    print(f"  BUY: {len(buys)} ({len(buys)/len(valid)*100:.1f}%)")
    print(f"  SELL: {len(sells)} ({len(sells)/len(valid)*100:.1f}%)")
    print(f"  HOLD: {len(holds)} ({len(holds)/len(valid)*100:.1f}%)")
    
    print(f"\nCONFIDENCE:")
    print(f"  Mean: {np.mean(confs):.1f}%")
    print(f"  Range: {min(confs):.1f}% - {max(confs):.1f}%")
    
    if buys:
        print(f"\n{'─'*70}")
        print("TOP BUY SIGNALS")
        print(f"{'─'*70}")
        buys.sort(key=lambda x: x['confidence'], reverse=True)
        for i, p in enumerate(buys[:5], 1):
            print(f"{i}. {p['ticker']}: {p['predicted_return']:+.2f}% @ {p['confidence']:.0f}% | {p['reasoning']}")
    
    if sells:
        print(f"\n{'─'*70}")
        print("TOP SELL SIGNALS")
        print(f"{'─'*70}")
        sells.sort(key=lambda x: x['confidence'], reverse=True)
        for i, p in enumerate(sells[:5], 1):
            print(f"{i}. {p['ticker']}: {p['predicted_return']:.2f}% @ {p['confidence']:.0f}% | {p['reasoning']}")
    
    print(f"\n{'='*70}\n")
    
    return predictor, all_preds


if __name__ == "__main__":
    print("Advanced KSE Predictor loaded!")
    print("Use: test_advanced_predictor('kse30_historical_complete.csv')")
