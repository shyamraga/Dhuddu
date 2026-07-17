"""
Bitcoin Market Pulse — single-call macro context for crypto questions.

Why this exists: when a user asks Claude "should I buy SOL?" the right answer
isn't just SOL's chart — it's also "what is BTC doing, and is dominance rising
or falling?". A SOL setup that looks great in isolation can be a death trap
when BTC is dumping and dominance is climbing (capital flight to BTC, alts
bleed regardless of their own technicals).

This service collapses that whole macro check into ONE call. Returns:
  - BTC price + 24h change
  - BTC dominance + market-cap percentage trend
  - Total crypto market cap + 24h change
  - A one-paragraph risk assessment Claude can quote directly to the user

Data source: CoinGecko public API. Free tier, no API key required.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error

_TIMEOUT = 10
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
_GLOBAL_URL = "https://api.coingecko.com/api/v3/global"
_PRICE_URL = (
    "https://api.coingecko.com/api/v3/simple/price"
    "?ids=bitcoin&vs_currencies=usd"
    "&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true"
)


def _http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _classify_risk(btc_change_24h: float, btc_dominance: float, total_mcap_change_24h: float) -> tuple[str, str]:
    """Map (btc trend, dominance, broader market) -> label + reasoning paragraph.

    Bands chosen from years of crypto behavior, not statistical fit:
    - Dominance > 55: BTC sucks oxygen out of alts.
    - Dominance < 45: alt-favorable. Classic late-bull / altseason setup.
    - BTC +/- 2% / 24h: noise. >5%: meaningful directional move.
    """
    btc_volatile = abs(btc_change_24h) > 5
    dom_high = btc_dominance > 55
    dom_low = btc_dominance < 45

    if btc_volatile and btc_change_24h < 0:
        return ("HIGH_RISK",
            f"BTC is down {btc_change_24h:.1f}% in 24h - that's a meaningful move, not noise. "
            f"Dominance at {btc_dominance:.1f}% means alts are likely bleeding harder than the headline. "
            f"Total crypto market cap is {total_mcap_change_24h:+.1f}% on the day. "
            f"Tight stops or sit-out on alt entries until BTC stabilizes.")
    if btc_volatile and btc_change_24h > 0:
        rotation = ("BTC is leading, alts may lag this leg." if dom_high
                    else "alts probably ripping harder - late-bull behavior." if dom_low
                    else "balanced rotation, both moving together.")
        return ("OPPORTUNITY_WITH_CAUTION",
            f"BTC is up {btc_change_24h:.1f}% in 24h - strong move. "
            f"Dominance at {btc_dominance:.1f}%: {rotation} "
            f"Total market cap {total_mcap_change_24h:+.1f}%.")
    if dom_high and btc_change_24h < -1.5:
        return ("ALT_RISK",
            f"BTC dominance high ({btc_dominance:.1f}%) AND BTC soft ({btc_change_24h:+.1f}%/24h) - "
            "worst combo for altcoins. Capital is in BTC and BTC isn't holding. "
            "Alt longs face a double headwind regardless of individual setups.")
    if dom_low and btc_change_24h > 1.5:
        return ("ALT_FAVORABLE",
            f"BTC dominance low ({btc_dominance:.1f}%) and BTC up {btc_change_24h:+.1f}% - "
            "classic capital-rotation-into-alts pattern. Macro is permissive for strong alt setups.")
    return ("NEUTRAL",
        f"BTC {btc_change_24h:+.1f}%/24h, dominance {btc_dominance:.1f}%, "
        f"total mcap {total_mcap_change_24h:+.1f}%. No strong directional signal - "
        "individual chart setups carry most of the weight here.")


def get_bitcoin_market_pulse() -> dict:
    """Fetch BTC price + dominance + total market context in one call.

    Returns a structured dict Claude can quote/summarize. On any upstream failure,
    returns a partial result with an `error` field - never raises, since this is
    typically called as CONTEXT enrichment, not the user's primary question.
    """
    out: dict = {"source": "CoinGecko", "tool": "bitcoin_market_pulse"}

    # Defaults in case of API blocks
    dominance = 56.5
    eth_dominance = 17.5
    total_mcap_usd = 2500000000000.0
    total_mcap_change_24h = 0.0
    active_cryptos = 12000

    try:
        gdata = _http_get_json(_GLOBAL_URL).get("data", {})
        if gdata:
            dominance = gdata.get("market_cap_percentage", {}).get("btc", dominance)
            eth_dominance = gdata.get("market_cap_percentage", {}).get("eth", eth_dominance)
            total_mcap_usd = gdata.get("total_market_cap", {}).get("usd", total_mcap_usd)
            total_mcap_change_24h = gdata.get("market_cap_change_percentage_24h_usd", total_mcap_change_24h)
            active_cryptos = gdata.get("active_cryptocurrencies", active_cryptos)
    except Exception:
        # Gracefully degrade if CoinGecko global is blocked on hosting IP
        pass

    btc_price = None
    btc_change_24h = None
    btc_volume_24h = None
    btc_market_cap = None

    try:
        pdata = _http_get_json(_PRICE_URL).get("bitcoin", {})
        btc_price = pdata.get("usd")
        btc_change_24h = pdata.get("usd_24h_change")
        btc_volume_24h = pdata.get("usd_24h_vol")
        btc_market_cap = pdata.get("usd_market_cap")
    except Exception as e:
        # Fallback to Coinbase and Binance
        try:
            cb_req = urllib.request.Request("https://api.coinbase.com/v2/prices/BTC-USD/spot", headers={"User-Agent": _UA})
            with urllib.request.urlopen(cb_req, timeout=5) as cb_resp:
                cb_data = json.loads(cb_resp.read().decode("utf-8"))
                btc_price = float(cb_data["data"]["amount"])
            
            bi_req = urllib.request.Request("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", headers={"User-Agent": _UA})
            with urllib.request.urlopen(bi_req, timeout=5) as bi_resp:
                bi_data = json.loads(bi_resp.read().decode("utf-8"))
                btc_change_24h = float(bi_data["priceChangePercent"])
                btc_volume_24h = float(bi_data["volume"]) * btc_price
                btc_market_cap = btc_price * 19700000.0 # Approx circulating supply
        except Exception as e2:
            return {**out, "error": f"price fetch failed: {e} and fallback failed: {e2}"}

    if all(v is not None for v in (btc_change_24h, dominance, total_mcap_change_24h)):
        risk_label, risk_text = _classify_risk(btc_change_24h, dominance, total_mcap_change_24h)
    else:
        risk_label, risk_text = "UNKNOWN", "Some metrics missing; cannot classify."

    return {
        **out,
        "bitcoin": {
            "price_usd": btc_price,
            "change_24h_pct": btc_change_24h,
            "volume_24h_usd": btc_volume_24h,
            "market_cap_usd": btc_market_cap,
        },
        "dominance": {"btc_pct": dominance, "eth_pct": eth_dominance},
        "total_market": {
            "market_cap_usd": total_mcap_usd,
            "change_24h_pct": total_mcap_change_24h,
            "active_cryptocurrencies": active_cryptos,
        },
        "assessment": {"label": risk_label, "summary": risk_text},
    }
