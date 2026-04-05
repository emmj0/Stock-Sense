"""
Technical Updater — Fetches today's stock prices from MongoDB (market_watch)
and appends them to the master CSV with computed technical indicators.

The market_watch collection is updated by ChromeScrapper.py (via GitHub Actions)
with live prices from dps.psx.com.pk main page — which is always current,
unlike the /historical page which has a 2-3 day delay.

Usage:
    python scrappers/technical_updater.py
"""

import pandas as pd
import numpy as np
import os
import sys
import io
from datetime import date, datetime, timedelta

import yfinance as yf
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

# Fix Unicode output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ==========================================
# 1. CONFIGURATION
# ==========================================
MASTER_CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'processed', 'stocksense_tft_final.csv')
MASTER_CSV_PATH = os.path.normpath(MASTER_CSV_PATH)

MONGO_URI = os.getenv("MONGO_URI", "")
DB_NAME = os.getenv("MONGO_DB_NAME", os.getenv("DB_NAME", "psx"))

KSE30_STOCKS = [
    'OGDC', 'PPL', 'POL', 'HUBC', 'ENGRO', 'FFC', 'EFERT', 'LUCK', 'MCB', 'UBL',
    'HBL', 'BAHL', 'MEBL', 'NBP', 'FABL', 'BAFL', 'DGKC', 'MLCF', 'FCCL', 'CHCC',
    'PSO', 'SHEL', 'ATRL', 'PRL', 'SYS', 'SEARL', 'ILP', 'TGL', 'INIL', 'PAEL'
]

SECTOR_MAP = {
    'OGDC': 'Energy', 'PPL': 'Energy', 'POL': 'Energy', 'HUBC': 'Power',
    'ENGRO': 'Fertilizer', 'FFC': 'Fertilizer', 'EFERT': 'Fertilizer',
    'LUCK': 'Cement', 'DGKC': 'Cement', 'MLCF': 'Cement', 'FCCL': 'Cement', 'CHCC': 'Cement',
    'MCB': 'Banking', 'UBL': 'Banking', 'HBL': 'Banking', 'BAHL': 'Banking',
    'MEBL': 'Banking', 'NBP': 'Banking', 'FABL': 'Banking', 'BAFL': 'Banking',
    'PSO': 'OMC', 'SHEL': 'OMC', 'ATRL': 'Refinery', 'PRL': 'Refinery',
    'SYS': 'Tech', 'SEARL': 'Pharma', 'ILP': 'Textile', 'TGL': 'Glass',
    'INIL': 'Engineering', 'PAEL': 'Engineering'
}


def safe_float(val):
    """Convert string like '7,450.25' to float."""
    if val is None:
        return 0.0
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def safe_int(val):
    """Convert string like '23,241,207' to int."""
    if val is None:
        return 0
    try:
        return int(float(str(val).replace(",", "").strip()))
    except (ValueError, TypeError):
        return 0


# ==========================================
# 2. FETCH FROM MONGODB
# ==========================================
def fetch_from_mongodb():
    """
    Read KSE-30 stock prices from MongoDB market_watch collection.
    This data is scraped daily by ChromeScrapper.py from the live PSX page.

    Returns list of dicts with: Ticker, Open, High, Low, Close, Volume
    """
    if not MONGO_URI:
        print("ERROR: MONGO_URI not set in environment")
        return []

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
        client.admin.command("ping")
        db = client[DB_NAME]
    except Exception as e:
        print(f"ERROR: Could not connect to MongoDB: {e}")
        return []

    collection = db["market_watch"]
    stocks = []

    for ticker in KSE30_STOCKS:
        doc = collection.find_one({"SYMBOL": ticker}, {"_id": 0})
        if not doc:
            print(f"  WARNING: {ticker} not found in market_watch")
            continue

        stocks.append({
            "Ticker": ticker,
            "Open": safe_float(doc.get("OPEN")),
            "High": safe_float(doc.get("HIGH")),
            "Low": safe_float(doc.get("LOW")),
            "Close": safe_float(doc.get("CURRENT")),  # CURRENT = today's close/last price
            "Volume": safe_int(doc.get("VOLUME")),
        })

    # Also fetch KSE100 index if available
    kse100_doc = collection.find_one({"SYMBOL": "KSE100"}, {"_id": 0})
    if not kse100_doc:
        # Try alternate names
        for name in ["KSE-100", "KSE 100", "KSE100 INDEX"]:
            kse100_doc = collection.find_one({"SYMBOL": name}, {"_id": 0})
            if kse100_doc:
                break

    kse100_value = None
    if kse100_doc:
        kse100_value = safe_float(kse100_doc.get("CURRENT"))
        print(f"  KSE-100 index: {kse100_value}")

    client.close()
    return stocks, kse100_value


# ==========================================
# 3. CALCULATE INDICATORS
# ==========================================
def calculate_indicators(df, master_max_idx_map):
    """Calculate SMA-20, SMA-50, RSI-14, Vol-20 and continue time_idx."""
    df = df.sort_values(['Ticker', 'Date'])

    def get_rsi(series, window=14):
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window).mean()
        return 100 - (100 / (1 + (gain / (loss + 1e-9))))

    results = []
    for ticker, group in df.groupby('Ticker'):
        g = group.copy()
        g['sma_20'] = g['Close'].rolling(20).mean()
        g['sma_50'] = g['Close'].rolling(50).mean()
        g['rsi_14'] = get_rsi(g['Close'])
        g['vol_20'] = g['Close'].pct_change().rolling(20).std()

        # Continue time_idx from where master left off
        start_idx = master_max_idx_map.get(ticker, -1) + 1
        mask_new = g['time_idx'].isna()
        if mask_new.any():
            new_count = mask_new.sum()
            g.loc[mask_new, 'time_idx'] = np.arange(start_idx, start_idx + new_count)

        results.append(g)

    return pd.concat(results)


# ==========================================
# 4. MAIN
# ==========================================
def main():
    if not os.path.exists(MASTER_CSV_PATH):
        print(f"Error: Could not find {MASTER_CSV_PATH}. Please run technical_pipeline.py first.")
        return

    print("--- Reading Master Data ---")
    master_df = pd.read_csv(MASTER_CSV_PATH)
    master_df['Date'] = pd.to_datetime(master_df['Date']).dt.date

    last_date = master_df['Date'].max()
    today = date.today()

    # Skip weekends (PSX is closed Sat/Sun)
    if today.weekday() >= 5:
        print(f"Today is {today.strftime('%A')} — PSX is closed. No update needed.")
        return

    if last_date >= today:
        print(f"Data is already up to date (last date: {last_date}). No new records to fetch.")
        return

    print(f"--- Last date in CSV: {last_date} | Today: {today} ---")
    print(f"--- Fetching live prices from MongoDB (market_watch) ---")

    result = fetch_from_mongodb()
    if not result:
        print("ERROR: Could not fetch data from MongoDB")
        return

    stocks_data, kse100_value = result

    if not stocks_data:
        print("WARNING: No stock data returned from MongoDB")
        return

    print(f"  Fetched {len(stocks_data)} KSE-30 stocks from MongoDB")

    # Build new rows DataFrame with today's date
    new_df = pd.DataFrame(stocks_data)
    new_df['Date'] = today

    # Add KSE-100 index value
    if kse100_value:
        new_df['market_index'] = kse100_value
    else:
        # Forward-fill from last master row
        last_market_idx = master_df[master_df['market_index'].notna()]['market_index'].iloc[-1] if 'market_index' in master_df.columns else 0
        new_df['market_index'] = last_market_idx
        print(f"  WARNING: KSE-100 not in MongoDB, using last value: {last_market_idx}")

    # Fetch USD/PKR rate
    print("  Fetching USD/PKR exchange rate...")
    try:
        usd = yf.download("PKR=X", start=today - timedelta(days=5), end=today + timedelta(days=1), progress=False)
        if not usd.empty:
            usd_rate = float(usd['Close'].iloc[-1])
            new_df['USD_PKR'] = usd_rate
            print(f"  USD/PKR: {usd_rate:.2f}")
        else:
            last_usd = master_df[master_df['USD_PKR'].notna()]['USD_PKR'].iloc[-1] if 'USD_PKR' in master_df.columns else 0
            new_df['USD_PKR'] = last_usd
            print(f"  WARNING: USD/PKR not available, using last value: {last_usd}")
    except Exception as e:
        last_usd = master_df[master_df['USD_PKR'].notna()]['USD_PKR'].iloc[-1] if 'USD_PKR' in master_df.columns else 0
        new_df['USD_PKR'] = last_usd
        print(f"  WARNING: USD/PKR fetch failed ({e}), using last value: {last_usd}")

    # Add sector, day_of_week, month
    new_df['Sector'] = new_df['Ticker'].map(SECTOR_MAP)
    new_df['day_of_week'] = pd.to_datetime(new_df['Date']).apply(lambda d: d.weekday())
    new_df['month'] = pd.to_datetime(new_df['Date']).apply(lambda d: d.month)

    # --- Calculate indicators using historical buffer ---
    print("--- Calculating Indicators (using 70-day lookback buffer) ---")
    buffer_date = last_date - timedelta(days=70)
    history_buffer = master_df[master_df['Date'] >= buffer_date].copy()

    # Map the max time_idx per ticker
    max_idx_map = master_df.groupby('Ticker')['time_idx'].max().to_dict()

    # Combine buffer + new data
    combined = pd.concat([history_buffer, new_df], ignore_index=True).drop_duplicates(subset=['Date', 'Ticker'])
    calculated = calculate_indicators(combined, max_idx_map)

    # Isolate ONLY the new rows
    final_new_rows = calculated[calculated['Date'] == today].copy()

    if final_new_rows.empty:
        print("WARNING: No new rows after calculation")
        return

    # --- Forward-fill macro columns from master ---
    print("--- Forward-filling macro columns ---")
    macro_cols = [
        'oil_price', 'fx_volatility', 'market_volatility', 'inflation_proxy',
        'market_momentum', 'market_strength', 'sentiment_quality', 'sentiment_ma_5',
        'days_since_announcement', 'blended_sentiment', 'proxy_sentiment',
        'relative_momentum', 'fx_risk', 'announcement_flag', 'announcement_type',
        'volume_ma_20', 'volume_ratio', 'volume_trend', 'volume_signal',
        'obv_signal', 'vpt', 'price_direction', 'rsi_sentiment', 'momentum_signal',
        'sentiment_score', 'sentiment_count',
    ]

    # Get the last row per ticker from master for forward-filling
    last_rows = master_df.sort_values('Date').groupby('Ticker').last()

    for col in macro_cols:
        if col in master_df.columns and col not in final_new_rows.columns:
            final_new_rows[col] = np.nan
        if col in master_df.columns:
            for ticker in final_new_rows['Ticker'].unique():
                if ticker in last_rows.index and col in last_rows.columns:
                    val = last_rows.loc[ticker, col]
                    final_new_rows.loc[final_new_rows['Ticker'] == ticker, col] = val

    # --- Merge and save ---
    print("--- Saving Updated Master File ---")
    final_master = pd.concat([master_df, final_new_rows], ignore_index=True)
    final_master = final_master.sort_values(['Ticker', 'Date']).reset_index(drop=True)

    # Ensure all columns from master exist
    for col in master_df.columns:
        if col not in final_master.columns:
            final_master[col] = np.nan

    # Final forward-fill for any remaining gaps
    for col in macro_cols:
        if col in final_master.columns:
            final_master[col] = final_master.groupby('Ticker')[col].transform(lambda x: x.ffill())

    final_master.to_csv(MASTER_CSV_PATH, index=False)

    print(f"\nAppended {len(final_new_rows)} new records (today: {today})")
    print(f"Master CSV now has {len(final_master)} total rows")
    print(f"Tickers updated: {', '.join(sorted(final_new_rows['Ticker'].unique()))}")


if __name__ == "__main__":
    main()
