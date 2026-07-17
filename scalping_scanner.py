import sys
import os
import json
import time
from datetime import datetime

# Patch requests.post globally to avoid User-Agent blocking by TradingView
try:
    import requests
    orig_post = requests.post
    def patched_post(url, *args, **kwargs):
        headers = kwargs.get("headers", {}) or {}
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        kwargs["headers"] = headers
        return orig_post(url, *args, **kwargs)
    requests.post = patched_post
except Exception:
    pass

# Setup path
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))
from tradingview_mcp.core.services.screener_service import analyze_coin

SYMBOLS = [
    # Crypto
    {"symbol": "BTCUSDT", "exchange": "binance", "category": "Crypto"},
    {"symbol": "ETHUSDT", "exchange": "binance", "category": "Crypto"},
    {"symbol": "SOLUSDT", "exchange": "binance", "category": "Crypto"},
    {"symbol": "XRPUSDT", "exchange": "binance", "category": "Crypto"},
    {"symbol": "ADAUSDT", "exchange": "binance", "category": "Crypto"},
    {"symbol": "DOGEUSDT", "exchange": "binance", "category": "Crypto"},
    # Metals
    {"symbol": "GOLD", "exchange": "tvc", "category": "Metal"},
    {"symbol": "SILVER", "exchange": "tvc", "category": "Metal"},
    {"symbol": "PLATINUM", "exchange": "tvc", "category": "Metal"},
    # Forex
    {"symbol": "EURUSD", "exchange": "oanda", "category": "Forex"},
    {"symbol": "GBPUSD", "exchange": "oanda", "category": "Forex"},
    {"symbol": "USDJPY", "exchange": "oanda", "category": "Forex"},
    {"symbol": "AUDUSD", "exchange": "oanda", "category": "Forex"},
    {"symbol": "USDCAD", "exchange": "oanda", "category": "Forex"},
    {"symbol": "USDCHF", "exchange": "oanda", "category": "Forex"},
    {"symbol": "GBPJPY", "exchange": "oanda", "category": "Forex"}
]

def format_price(val, category):
    if val is None:
        return 0.0
    val_f = float(val)
    if category == "Forex":
        return round(val_f, 5)
    elif category == "Crypto" and val_f < 1.0:
        return round(val_f, 5)
    else:
        return round(val_f, 2)

def scan():
    results = []
    print("Starting scalping scan...")
    for item in SYMBOLS:
        sym = item["symbol"]
        exc = item["exchange"]
        cat = item["category"]
        print(f"Analyzing {exc}:{sym} ({cat})...")
        try:
            # Analyze on 15m timeframe
            analysis = analyze_coin(symbol=sym, exchange=exc, timeframe="15m")
            if "error" in analysis:
                print(f"Error analyzing {sym}: {analysis['error']}")
                continue
                
            # Extract indicators
            price_data = analysis.get("price_data", {})
            close_val = price_data.get("close") or price_data.get("current_price")
            if not close_val:
                continue
                
            close_val = float(close_val)
            
            # Recommendation
            sentiment = analysis.get("market_sentiment", {})
            rec = sentiment.get("buy_sell_signal", "NEUTRAL")
            
            # ATR (14)
            atr_data = analysis.get("atr", {})
            atr = atr_data.get("value")
            if not atr:
                # fallback ATR
                atr = close_val * 0.001
            else:
                atr = float(atr)
                
            # Signal Score & Confidence
            is_buy = "BUY" in rec
            is_sell = "SELL" in rec
            
            confidence = 50
            if is_buy or is_sell:
                # MACD
                macd_cross = analysis.get("macd", {}).get("crossover", "")
                if (is_buy and macd_cross == "Bullish") or (is_sell and macd_cross == "Bearish"):
                    confidence += 10
                    
                # RSI
                rsi_val = float(analysis.get("rsi", {}).get("value", 50))
                if is_buy and rsi_val < 45:
                    confidence += 10
                elif is_sell and rsi_val > 55:
                    confidence += 10
                    
                # ADX Trend Strength
                adx_strength = analysis.get("adx", {}).get("trend_strength", "Weak")
                if adx_strength in ("Strong", "Very Strong"):
                    confidence += 15
                elif adx_strength == "Moderate":
                    confidence += 5
                    
                # MAs alignment
                ema_signals = analysis.get("ema", {}).get("signals", [])
                above_ema50 = any("above EMA50" in sig for sig in ema_signals)
                below_ema50 = any("below EMA50" in sig for sig in ema_signals)
                if (is_buy and above_ema50) or (is_sell and below_ema50):
                    confidence += 15
                    
                # Overall rating strength
                rating = abs(float(sentiment.get("overall_rating", 0)))
                confidence += min(10, int(rating * 2))
            
            confidence = max(45, min(95, confidence))
            
            # Calculate Scalping levels
            # Standard scalping risk: 1.5 * ATR, reward: 1.0 * ATR for TP1, 2.0 * ATR for TP2
            if is_buy:
                direction = "BUY"
                entry = close_val
                sl = entry - (1.5 * atr)
                tp1 = entry + (1.0 * atr)
                tp2 = entry + (2.0 * atr)
            elif is_sell:
                direction = "SELL"
                entry = close_val
                sl = entry + (1.5 * atr)
                tp1 = entry - (1.0 * atr)
                tp2 = entry - (2.0 * atr)
            else:
                direction = "NEUTRAL"
                entry = close_val
                sl = entry - (1.5 * atr)
                tp1 = entry + (1.0 * atr)
                tp2 = entry + (2.0 * atr)
                
            results.append({
                "symbol": sym,
                "exchange": exc.upper(),
                "category": cat,
                "price": format_price(entry, cat),
                "direction": direction,
                "entry": format_price(entry, cat),
                "sl": format_price(sl, cat),
                "tp1": format_price(tp1, cat),
                "tp2": format_price(tp2, cat),
                "confidence": confidence,
                "rec_text": rec.replace("_", " ")
            })
            time.sleep(0.3)  # Rate limiting safety margin
        except Exception as e:
            print(f"Error scanning {sym}: {e}")
            
    # Sort: non-neutral signals first, ordered by indicator confidence strength desc
    results.sort(key=lambda x: (x["direction"] == "NEUTRAL", -x["confidence"]))
    
    # Keep top 15 results
    top_15 = results[:15]
    
    output = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "pairs": top_15
    }
    
    # Write to public/scalping_report.json
    out_path = "public/scalping_report.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
        
    print(f"Scan complete. Wrote {len(top_15)} pairs to {out_path}")

if __name__ == "__main__":
    scan()
