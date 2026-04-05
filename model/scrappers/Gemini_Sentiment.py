"""
Tavily + Groq News Sentiment Scorer (with multi-key rotation)
==============================================================
Uses Tavily Search API to find news, then Groq Llama 3.3 70B to analyze sentiment.
When a key hits rate limits (429), automatically rotates to the next key.

Keys in .env:
  GROQ_API_KEY_1, GROQ_API_KEY_2
  TAVILY_API_KEY_1, TAVILY_API_KEY_2
  GEMINI_API_KEY_1, GEMINI_API_KEY_2

Run:
    python scrappers/Gemini_Sentiment.py --ticker OGDC
    python scrappers/Gemini_Sentiment.py --all
"""

import sys
import json
import time
import re
import argparse

sys.path.insert(0, str(__file__).replace("/scrappers/Gemini_Sentiment.py", "").replace("\\scrappers\\Gemini_Sentiment.py", ""))
from config import (
    TAVILY_API_KEYS, GROQ_API_KEYS, GEMINI_API_KEYS,
    TAVILY_API_KEY, GROQ_API_KEY,
    KSE30_STOCKS, COMPANY_NAMES,
)


# ── Key rotation state ────────────────────────────────────────────────────

_current_key_idx = {
    "tavily": 0,
    "groq": 0,
    "gemini": 0,
}

def _get_key(provider: str) -> str:
    """Get the current active key for a provider."""
    keys_map = {"tavily": TAVILY_API_KEYS, "groq": GROQ_API_KEYS, "gemini": GEMINI_API_KEYS}
    keys = keys_map.get(provider, [])
    if not keys:
        return ""
    idx = _current_key_idx.get(provider, 0) % len(keys)
    return keys[idx]

def _rotate_key(provider: str) -> str:
    """Rotate to the next key for a provider. Returns the new key, or "" if exhausted."""
    keys_map = {"tavily": TAVILY_API_KEYS, "groq": GROQ_API_KEYS, "gemini": GEMINI_API_KEYS}
    keys = keys_map.get(provider, [])
    if len(keys) <= 1:
        return ""
    old_idx = _current_key_idx.get(provider, 0)
    new_idx = old_idx + 1
    if new_idx >= len(keys):
        return ""  # all keys exhausted
    _current_key_idx[provider] = new_idx
    print(f"  [key-rotate] {provider}: switched to key #{new_idx + 1}")
    return keys[new_idx]

def _is_rate_limit_error(e) -> bool:
    """Check if an exception is a 429 rate limit error."""
    err_str = str(e).lower()
    return "429" in err_str or "rate_limit" in err_str or "resource_exhausted" in err_str or "quota" in err_str


# ── JSON extraction helper ─────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {}


# ── Tavily Search ──────────────────────────────────────────────────────────

def _search_news(ticker: str, company_name: str) -> str:
    """Search for recent news using Tavily. Rotates keys on rate limit."""
    for attempt in range(len(TAVILY_API_KEYS)):
        key = _get_key("tavily")
        if not key:
            break
        try:
            from tavily import TavilyClient
            client = TavilyClient(api_key=key)
            results = client.search(
                query=f"{company_name} {ticker} stock PSX news",
                include_answer=False,
                days=7,
                max_results=5,
            )
            if not results.get("results"):
                return "No recent news found."
            news_context = []
            for i, result in enumerate(results["results"], 1):
                title = result.get("title", "")
                snippet = result.get("content", "")
                if title:
                    news_context.append(f"{i}. {title}\n   {snippet[:200]}")
            return "\n".join(news_context) if news_context else "No relevant news found."
        except Exception as e:
            if _is_rate_limit_error(e):
                new_key = _rotate_key("tavily")
                if new_key:
                    continue
            print(f"  [tavily] {ticker}: error ({str(e)[:60]})")
            return None
    return None


# ── Groq Sentiment Analysis ───────────────────────────────────────────────

def _analyze_sentiment(ticker: str, company_name: str, news_context: str) -> dict:
    """Analyze sentiment with Groq. Rotates keys on rate limit."""
    prompt = f"""You are a financial analyst for Pakistan Stock Exchange (PSX).

Analyze this news about {company_name} ({ticker}) for stock sentiment impact.

NEWS CONTEXT (last 7 days):
{news_context}

Return ONLY valid JSON:
{{"sentiment_score": float(-1.0 to 1.0), "confidence": float(0.0 to 1.0), "headline_count": int, "key_headlines": [list of headlines], "reasoning": "1 sentence"}}

Rules: 0.0 = neutral/no news. Return score: 0.0, confidence: 0.0, count: 0 if no relevant news."""

    for attempt in range(len(GROQ_API_KEYS)):
        key = _get_key("groq")
        if not key:
            break
        try:
            from groq import Groq
            client = Groq(api_key=key)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=512,
            )
            raw_text = response.choices[0].message.content or ""
            parsed = _extract_json(raw_text)
            if not parsed:
                print(f"  [groq] {ticker}: could not parse JSON")
                return None
            result = {
                "ticker":          ticker,
                "sentiment_score": max(-1.0, min(1.0, float(parsed.get("sentiment_score", 0.0)))),
                "confidence":      float(parsed.get("confidence", 0.0)),
                "headline_count":  int(parsed.get("headline_count", 0)),
                "key_headlines":   parsed.get("key_headlines", []),
                "reasoning":       parsed.get("reasoning", ""),
                "source":          "groq_tavily",
                "weight":          1.2,
            }
            return result
        except Exception as e:
            if _is_rate_limit_error(e):
                new_key = _rotate_key("groq")
                if new_key:
                    continue
                print(f"  [groq] {ticker}: all keys exhausted")
            else:
                print(f"  [groq] {ticker}: error ({str(e)[:60]})")
            return None
    return None


# ── Gemini Fallback ────────────────────────────────────────────────────────

def _call_gemini_fallback(ticker: str, company_name: str) -> dict:
    """Fallback to Gemini. Rotates keys on rate limit."""
    prompt = f"""You are a financial analyst for Pakistan Stock Exchange (PSX).

Analyze recent news (last 7 days) about {company_name} ({ticker}) for stock sentiment impact.

Return ONLY valid JSON:
{{"sentiment_score": float(-1.0 to 1.0), "confidence": float(0.0 to 1.0), "headline_count": int, "key_headlines": [max 3 headlines], "reasoning": "1 sentence"}}

Rules: 0.0 = neutral/no news. Return score: 0.0, confidence: 0.0, count: 0 if no relevant news."""

    for attempt in range(len(GEMINI_API_KEYS)):
        key = _get_key("gemini")
        if not key:
            break
        try:
            from google import genai
            from google.genai import types as genai_types
            client = genai.Client(api_key=key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                    temperature=0.1,
                    max_output_tokens=512,
                ),
            )
            raw_text = response.text or ""
            parsed = _extract_json(raw_text)
            if not parsed:
                return None
            result = {
                "ticker":          ticker,
                "sentiment_score": max(-1.0, min(1.0, float(parsed.get("sentiment_score", 0.0)))),
                "confidence":      float(parsed.get("confidence", 0.0)),
                "headline_count":  int(parsed.get("headline_count", 0)),
                "key_headlines":   parsed.get("key_headlines", []),
                "reasoning":       parsed.get("reasoning", ""),
                "source":          "gemini_news",
                "weight":          1.2,
            }
            return result
        except Exception as e:
            if _is_rate_limit_error(e):
                new_key = _rotate_key("gemini")
                if new_key:
                    continue
                print(f"  [gemini] {ticker}: all keys exhausted")
            else:
                print(f"  [gemini] {ticker}: error ({str(e)[:60]})")
            return None
    return None


# ── Main public function ───────────────────────────────────────────────────

def get_sentiment(ticker: str, company_name: str = None) -> dict:
    """
    Get sentiment for a ticker. Tries Tavily+Groq first, falls back to Gemini.
    All providers rotate keys automatically on 429 rate limits.
    """
    if company_name is None:
        company_name = COMPANY_NAMES.get(ticker, ticker)

    # Step 1: Search for news using Tavily
    news_context = _search_news(ticker, company_name)
    if news_context is None:
        print(f"  [fallback] {ticker}: Tavily failed, trying Gemini...")
        result = _call_gemini_fallback(ticker, company_name)
        return result if result else _neutral(ticker, error="all_providers_failed")

    # Step 2: Analyze with Groq
    result = _analyze_sentiment(ticker, company_name, news_context)
    if result:
        return result

    # Fallback to Gemini if Groq fails
    print(f"  [fallback] {ticker}: Groq failed, trying Gemini...")
    result = _call_gemini_fallback(ticker, company_name)
    return result if result else _neutral(ticker, error="all_providers_failed")


def _neutral(ticker: str, error: str = "") -> dict:
    return {
        "ticker":          ticker,
        "sentiment_score": 0.0,
        "confidence":      0.0,
        "headline_count":  0,
        "key_headlines":   [],
        "reasoning":       f"No data (error: {error})" if error else "No relevant news found.",
        "source":          "neutral",
        "weight":          1.0,
    }


# ── Batch scorer ───────────────────────────────────────────────────────────

def score_all_tickers(tickers: list = None, delay_seconds: float = 1.5) -> list:
    if tickers is None:
        tickers = KSE30_STOCKS

    results = []
    for i, ticker in enumerate(tickers, 1):
        company = COMPANY_NAMES.get(ticker, ticker)
        print(f"  [{i}/{len(tickers)}] Scoring {ticker} ({company})...")
        result = get_sentiment(ticker, company)
        results.append(result)
        print(f"    source={result['source']:15} score={result['sentiment_score']:+.2f}  "
              f"conf={result['confidence']:.2f}  headlines={result['headline_count']}")
        if i < len(tickers):
            time.sleep(delay_seconds)

    return results


# ── CLI entry point ────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PSX News Sentiment Scorer (Tavily + Groq)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--ticker", help="Single ticker to score (e.g. OGDC)")
    group.add_argument("--all",    action="store_true", help="Score all 30 KSE tickers")
    args = parser.parse_args()

    import io
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if args.ticker:
        print(f"\n=== Sentiment Score: {args.ticker} ===")
        r = get_sentiment(args.ticker)
        print(f"  Source          : {r['source']}")
        print(f"  Sentiment score : {r['sentiment_score']:+.2f}")
        print(f"  Confidence      : {r['confidence']:.2f}")
        print(f"  Headlines found : {r['headline_count']}")
        print(f"  Key headlines   :")
        for h in r.get("key_headlines", []):
            print(f"    - {h}")
        print(f"  Reasoning       : {r['reasoning']}")
    else:
        print("\n=== Sentiment Score: All KSE30 Tickers ===")
        results = score_all_tickers()
        print(f"\nSummary: {len(results)} tickers scored")
        positive = [r for r in results if r["sentiment_score"] > 0.1]
        negative = [r for r in results if r["sentiment_score"] < -0.1]
        neutral  = [r for r in results if abs(r["sentiment_score"]) <= 0.1]
        print(f"  Positive: {len(positive)}  Negative: {len(negative)}  Neutral: {len(neutral)}")
