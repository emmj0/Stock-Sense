"""
LLM fusion service — enhances TFT signals with Groq/Gemini reasoning.

TFT numeric outputs (prices, confidence, action) are NEVER changed.
The LLM adds:
  - llm_reasoning: richer prose incorporating recent news headlines
  - llm_confidence_adjustment: small float in [-0.05, +0.05] (informational)
  - risk_factors: list of 2-3 risk strings

Primary:  Groq Llama-3.3-70b-versatile (fast, ~2-3s)
Fallback: Gemini 2.0 Flash
Timeout:  8 seconds per LLM call — degrades gracefully on failure.
"""

import asyncio
import json
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)


# ── Sector / company context ──────────────────────────────────────────────

SECTOR_CONTEXT = {
    "Banking": "Pakistani commercial bank, sensitive to interest rate changes and SBP monetary policy.",
    "Energy": "Oil & gas exploration company, correlated with global crude prices and PKR/USD rate.",
    "OMC": "Oil marketing company, margins affected by petroleum prices and government pricing policy.",
    "Refinery": "Petroleum refinery, impacted by crude-product spread and refinery margins.",
    "Cement": "Cement manufacturer, cyclical with construction activity and infrastructure spending.",
    "Fertilizer": "Fertilizer producer, subject to gas price subsidies and agricultural policy volatility.",
    "Power": "Power generation, dependent on fuel costs and CPPA-G receivables.",
    "Pharma": "Pharmaceutical company, sensitive to drug pricing regulations.",
    "Tech": "Technology/IT services company, exposed to PKR depreciation and global IT spending.",
    "Glass": "Glass manufacturer, cyclical with construction and consumer demand.",
    "Engineering": "Engineering/electronics company, sensitive to import costs and industrial activity.",
}


# ── Main public function ──────────────────────────────────────────────────

async def enhance_signal_with_llm(
    base_signal: dict,
    sentiment_result: dict,
    sector: str,
    trust_level: str,
    company_name: str,
) -> dict:
    """
    Enhance base TFT signal with LLM-generated reasoning.
    Always returns base_signal (with llm fields added).
    LLM failure degrades gracefully — base reasoning is used as fallback.

    Args:
        base_signal:      Dict from tft.signals.generate_signal()
        sentiment_result: Dict from scrappers.Gemini_Sentiment.get_sentiment()
        sector:           Ticker's sector string
        trust_level:      "high" / "medium" / "low"
        company_name:     Full company name

    Returns:
        base_signal dict enriched with llm_reasoning, llm_confidence_adjustment, risk_factors
    """
    prompt = _build_prompt(base_signal, sentiment_result, sector, trust_level, company_name)

    llm_result = None
    try:
        llm_result = await asyncio.wait_for(_call_groq(prompt), timeout=8.0)
    except asyncio.TimeoutError:
        logger.warning(f"[{base_signal['ticker']}] Groq timed out — trying Gemini fallback.")
    except Exception as e:
        logger.warning(f"[{base_signal['ticker']}] Groq failed: {e} — trying Gemini fallback.")

    if llm_result is None:
        try:
            llm_result = await asyncio.wait_for(_call_gemini(prompt), timeout=8.0)
        except asyncio.TimeoutError:
            logger.warning(f"[{base_signal['ticker']}] Gemini also timed out — using base reasoning.")
        except Exception as e:
            logger.warning(f"[{base_signal['ticker']}] Gemini failed: {e} — using base reasoning.")

    if llm_result:
        base_signal["llm_reasoning"] = llm_result.get("enhanced_reasoning") or base_signal["reasoning"]
        raw_adj = llm_result.get("confidence_adjustment", 0.0)
        base_signal["llm_confidence_adjustment"] = float(max(-0.05, min(0.05, raw_adj)))
        raw_risks = llm_result.get("risk_factors", [])
        base_signal["risk_factors"] = [str(r) for r in raw_risks[:3]]
    else:
        # Full graceful degradation
        base_signal["llm_reasoning"] = base_signal["reasoning"]
        base_signal["llm_confidence_adjustment"] = 0.0
        base_signal["risk_factors"] = []

    return base_signal


# ── Prompt builder ────────────────────────────────────────────────────────

def _build_prompt(
    signal: dict,
    sentiment: dict,
    sector: str,
    trust_level: str,
    company_name: str,
) -> str:
    ticker = signal["ticker"]
    action = signal["action"]
    ret_pct = signal["expected_return_7d_pct"]
    current_price = signal["current_price"]
    target_price = signal["target_price_7d"]
    confidence = signal["confidence"]
    bull_days = signal["forecast_days"]["bullish"]
    bear_days = signal["forecast_days"]["bearish"]

    sent_score = sentiment.get("sentiment_score", 0.0)
    headlines = sentiment.get("key_headlines", [])
    sent_reasoning = sentiment.get("reasoning", "No news context available.")
    sent_source = sentiment.get("source", "neutral")

    # Format headlines as bullet points (max 5)
    headlines_str = "\n".join(f"  - {h}" for h in headlines[:5]) if headlines else "  (No headlines available)"

    sector_ctx = SECTOR_CONTEXT.get(sector, "Pakistan-listed company on KSE-30.")

    trust_instruction = ""
    if trust_level == "low":
        trust_instruction = (
            "\nIMPORTANT: This ticker has a HIGH model error rate (MAPE > 20%). "
            "Mention this limitation in your reasoning and advise treating the signal directionally only."
        )
    elif trust_level == "high":
        trust_instruction = (
            "\nNote: This ticker has a LOW model error rate (MAPE < 10%) — reasonably reliable."
        )

    return f"""You are a Pakistan stock market analyst. Review this TFT (machine learning) signal for {ticker} ({company_name}), a {sector} company on KSE-30.

{sector_ctx}

=== TFT MODEL SIGNAL (DO NOT CHANGE THESE NUMBERS) ===
Action:              {action}
Expected 7-day return: {ret_pct:+.1f}%
Current price:       PKR {current_price:.2f}
Target price (7d):   PKR {target_price:.2f}
Model confidence:    {confidence:.2f}
Trust level:         {trust_level.upper()}
Bullish days (7d):   {bull_days}/7
Bearish days (7d):   {bear_days}/7
{trust_instruction}

=== LATEST NEWS SENTIMENT (last 7 days) ===
Sentiment score:     {sent_score:.2f}  (-1=very bearish, +1=very bullish)
Source:              {sent_source}
Top headlines:
{headlines_str}
Sentiment reasoning: {sent_reasoning[:300]}

=== YOUR TASK ===
1. Write an enhanced_reasoning paragraph (2-4 concise sentences) combining the TFT quantitative forecast with the news context. Reference specific headlines where relevant. Keep numbers consistent with the TFT signal above.
2. Suggest a confidence_adjustment float between -0.05 and +0.05:
   - Positive (+): recent news strongly SUPPORTS the TFT direction
   - Negative (-): recent news CONTRADICTS the TFT direction or adds significant uncertainty
   - Zero (0.00): news is neutral or irrelevant
3. Provide 2-3 risk_factors as short strings (e.g., "Rising input costs", "Regulatory headwinds").

Return ONLY valid JSON, no extra text:
{{
  "enhanced_reasoning": "...",
  "confidence_adjustment": 0.00,
  "risk_factors": ["...", "..."]
}}"""


# ── Key helpers ───────────────────────────────────────────────────────────

def _get_groq_keys():
    keys = [k for k in [
        os.getenv("GROQ_API_KEY_1", os.getenv("GROQ_API_KEY", "")),
        os.getenv("GROQ_API_KEY_2", ""),
    ] if k]
    return keys

def _get_gemini_keys():
    keys = [k for k in [
        os.getenv("GEMINI_API_KEY_1", ""),
        os.getenv("GEMINI_API_KEY_2", ""),
    ] if k]
    return keys

def _is_rate_limit(e) -> bool:
    s = str(e).lower()
    return "429" in s or "rate_limit" in s or "resource_exhausted" in s or "quota" in s


# ── LLM callers (with key rotation) ──────────────────────────────────────

async def _call_groq(prompt: str) -> Optional[dict]:
    """Call Groq with automatic key rotation on 429."""
    def _sync():
        from groq import Groq
        keys = _get_groq_keys()
        if not keys:
            raise ValueError("No GROQ_API_KEY set")
        last_err = None
        for key in keys:
            try:
                client = Groq(api_key=key)
                resp = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                    max_tokens=450,
                )
                return _parse_json_response(resp.choices[0].message.content)
            except Exception as e:
                last_err = e
                if _is_rate_limit(e):
                    logger.info("Groq key rate-limited, trying next key...")
                    continue
                raise
        raise last_err

    return await asyncio.to_thread(_sync)


async def _call_gemini(prompt: str) -> Optional[dict]:
    """Call Gemini with automatic key rotation on 429."""
    def _sync():
        from google import genai
        from google.genai import types as genai_types
        keys = _get_gemini_keys()
        if not keys:
            raise ValueError("No GEMINI_API_KEY set")
        last_err = None
        for key in keys:
            try:
                client = genai.Client(api_key=key)
                resp = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt,
                    config=genai_types.GenerateContentConfig(
                        temperature=0.2,
                        max_output_tokens=450,
                    ),
                )
                return _parse_json_response(resp.text)
            except Exception as e:
                last_err = e
                if _is_rate_limit(e):
                    logger.info("Gemini key rate-limited, trying next key...")
                    continue
                raise
        raise last_err

    return await asyncio.to_thread(_sync)


# ── JSON parsing ──────────────────────────────────────────────────────────

def _parse_json_response(text: str) -> Optional[dict]:
    """Extract and parse JSON from LLM response text."""
    if not text:
        return None
    try:
        # Try direct parse first
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Try to extract JSON block from markdown code fences or surrounding text
    patterns = [
        r"```(?:json)?\s*(\{.*?\})\s*```",
        r"(\{[^{}]*\"enhanced_reasoning\"[^{}]*\})",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                continue

    logger.debug(f"Could not parse JSON from LLM response: {text[:200]}")
    return None
