import asyncio
import json
import os
import inspect
import urllib.request
import urllib.parse
import urllib.error
from starlette.applications import Starlette
from starlette.responses import JSONResponse, FileResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
import uvicorn

# Import the server functions
from tradingview_mcp import server

TELEGRAM_BOT_TOKEN = "8792555308:AAF3rDGto-Ufr6At8nve7S3FkZ0r7PtWyO4"

async def send_telegram_endpoint(request):
    try:
        body = await request.json()
        report = body.get("report")
        if not report or "primary_objective" not in report:
            return JSONResponse({"error": "No valid report data provided"}, status_code=400)
            
        # 1. Fetch latest updates to get a chat_id
        updates_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
        def fetch_updates():
            with urllib.request.urlopen(urllib.request.Request(updates_url, method="GET"), timeout=10) as res:
                return json.loads(res.read().decode("utf-8"))
        
        updates_data = await asyncio.to_thread(fetch_updates)
        updates = updates_data.get("result", [])
        
        if not updates:
            return JSONResponse({"error": "No active chats found. Please send a message like 'hello' to @Elitetradejarvisbot on Telegram first!"}, status_code=400)
            
        # Get the chat ID of the most recent message
        chat_id = updates[-1]["message"]["chat"]["id"]
        
        # 2. Format the message with HTML escaping to prevent Telegram 400 Bad Request
        import html
        def esc(val, max_len=180):
            if val is None:
                return ""
            s = str(val)
            if len(s) > max_len:
                s = s[:max_len-3] + "..."
            return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

        mode = body.get("mode", "full")

        obj = report["primary_objective"]
        verdict = obj.get("verdict", "WAIT")
        emoji = "🐻" if verdict == "SELL" else "🚀" if verdict == "BUY" else "🥱"
        action_msg = "Bears are feasting!" if verdict == "SELL" else "Bulls are charging!" if verdict == "BUY" else "Sit on your hands."
        
        if mode == "scalping":
            msg = f"🚨 <b>ELITE TRADE JARVIS SETUP</b> 🚨\n\n"
            msg += f"<b>Timeframe:</b> {esc(obj.get('selected_timeframe', '15m'))}\n"
            msg += f"<b>Verdict:</b> {esc(verdict)} {emoji} <i>({esc(action_msg)})</i>\n"
            msg += f"<b>Bias:</b> {esc(obj.get('bias', 'Neutral'))}\n\n"
            
            msg += f"🎯 <b>THE SETUP</b>\n"
            msg += f"<b>Entry:</b> ${esc(obj.get('entry'))} <i>(Don't jump the gun)</i>\n"
            msg += f"<b>Stop Loss:</b> ${esc(obj.get('sl'))} <i>(Protect ya neck)</i>\n"
            msg += f"<b>TP 1:</b> ${esc(obj.get('tp1'))} 💰\n"
            msg += f"<b>TP 2:</b> ${esc(obj.get('tp2'))} 💸\n"
            msg += f"<b>TP 3:</b> ${esc(obj.get('tp3'))} 🤑\n\n"
            
            msg += f"<b>Risk:</b> {esc(obj.get('risk', '1%'))} <i>(Don't bet the farm)</i>\n"
            msg += f"<b>Win Prob:</b> {esc(obj.get('probability', '50%'))} <i>(May the odds be in your favor)</i>\n"
            msg += f"<b>R:R:</b> {esc(obj.get('reward_ratio', '1:2'))}\n"
        else:
            setup_msg = f"🚨 <b>ELITE TRADE JARVIS REPORT</b> 🚨\n\n"
            setup_msg += f"<b>Timeframe:</b> {esc(obj.get('selected_timeframe', '15m'))}\n"
            setup_msg += f"<b>Verdict:</b> {esc(verdict)} {emoji} <i>({esc(action_msg)})</i>\n"
            setup_msg += f"<b>Bias:</b> {esc(obj.get('bias', 'Neutral'))}\n\n"
            
            setup_msg += f"🎯 <b>THE SETUP</b>\n"
            setup_msg += f"<b>Entry:</b> ${esc(obj.get('entry'))} <i>(Don't jump the gun)</i>\n"
            setup_msg += f"<b>Stop Loss:</b> ${esc(obj.get('sl'))} <i>(Protect ya neck)</i>\n"
            setup_msg += f"<b>TP 1:</b> ${esc(obj.get('tp1'))} 💰\n"
            setup_msg += f"<b>TP 2:</b> ${esc(obj.get('tp2'))} 💸\n"
            setup_msg += f"<b>TP 3:</b> ${esc(obj.get('tp3'))} 🤑\n\n"
            
            setup_msg += f"<b>Risk:</b> {esc(obj.get('risk', '1%'))} <i>(Don't bet the farm)</i>\n"
            setup_msg += f"<b>Win Prob:</b> {esc(obj.get('probability', '50%'))} <i>(May the odds be in your favor)</i>\n"
            setup_msg += f"<b>R:R:</b> {esc(obj.get('reward_ratio', '1:2'))}\n\n"
            
            summary_msg = ""
            if "part_14_final_verdict" in report:
                p14 = report["part_14_final_verdict"]
                summary_msg += f"📝 <b>FINAL SUMMARY</b>\n"
                summary_msg += f"{esc(p14.get('summary', ''), max_len=1500)}\n\n"
                
            if "final_notes" in report:
                summary_msg += f"📝 <b>FINAL NOTES</b>\n"
                summary_msg += f"{esc(report['final_notes'], max_len=1000)}"

            # Pre-compute optional details list
            parts_list = []
            
            if "part_1_market_structure" in report:
                p1 = report["part_1_market_structure"]
                sec = f"🏗 <b>MARKET STRUCTURE</b>\n"
                sec += f"• Daily: {esc(p1.get('daily_trend', ''), max_len=350)}\n"
                sec += f"• 4H: {esc(p1.get('trend_4h', ''), max_len=350)}\n"
                sec += f"• 1H: {esc(p1.get('trend_1h', ''), max_len=350)}\n"
                sec += f"• 15m: {esc(p1.get('trend_15m', ''), max_len=350)}\n"
                sec += f"• Highs/Lows: {esc(p1.get('highs_lows', ''), max_len=350)}\n\n"
                parts_list.append(sec)
                
            if "part_2_technical_analysis" in report:
                p2 = report["part_2_technical_analysis"]
                sec = f"📈 <b>TECHNICALS</b>\n"
                sec += f"• MAs: {esc(p2.get('moving_averages', ''), max_len=350)}\n"
                sec += f"• Oscillators: {esc(p2.get('oscillators', ''), max_len=350)}\n"
                sec += f"• Bollinger Bands: {esc(p2.get('bollinger_bands', ''), max_len=350)}\n"
                sec += f"• Pivots: {esc(p2.get('pivots', ''), max_len=350)}\n"
                sec += f"• FVG & OBs: {esc(p2.get('fvg_orderblocks', ''), max_len=350)}\n\n"
                parts_list.append(sec)
                
            if "part_3_smart_money_analysis" in report:
                p3 = report["part_3_smart_money_analysis"]
                sec = f"🧱 <b>SMART MONEY (SMC)</b>\n"
                sec += f"• Liquidity: {esc(p3.get('liquidity', ''), max_len=350)}\n"
                sec += f"• Order Flow: {esc(p3.get('order_flow', ''), max_len=350)}\n"
                sec += f"• Power of 3: {esc(p3.get('power_of_three', ''), max_len=350)}\n\n"
                parts_list.append(sec)

            if "part_4_price_action" in report:
                p4 = report["part_4_price_action"]
                sec = f"📊 <b>PRICE ACTION</b>\n"
                sec += f"• Candlesticks: {esc(p4.get('candlestick_patterns', ''), max_len=350)}\n"
                sec += f"• Chart Patterns: {esc(p4.get('chart_patterns', ''), max_len=350)}\n\n"
                parts_list.append(sec)

            if "part_5_volume_analysis" in report:
                p5 = report["part_5_volume_analysis"]
                sec = f"🔊 <b>VOLUME ANALYSIS</b>\n"
                sec += f"• Profile: {esc(p5.get('volume_profile', ''), max_len=350)}\n"
                sec += f"• Pressure: {esc(p5.get('buying_selling_pressure', ''), max_len=350)}\n\n"
                parts_list.append(sec)

            if "part_6_fundamental_analysis" in report:
                p6 = report["part_6_fundamental_analysis"]
                sec = f"🌍 <b>FUNDAMENTALS</b>\n"
                sec += f"• Macro: {esc(p6.get('macro_summary', ''), max_len=350)}\n"
                sec += f"• Yields & DXY: {esc(p6.get('yields_dxy', ''), max_len=350)}\n\n"
                parts_list.append(sec)

            if "part_7_market_sentiment" in report:
                p7 = report["part_7_market_sentiment"]
                sec = f"🧠 <b>SENTIMENT</b>\n"
                sec += f"• Summary: {esc(p7.get('sentiment_summary', ''), max_len=350)}\n"
                sec += f"• Fear/Greed: {esc(p7.get('fear_greed', ''), max_len=350)}\n\n"
                parts_list.append(sec)

            if "part_8_intermarket_analysis" in report:
                p8 = report["part_8_intermarket_analysis"]
                sec = f"🔄 <b>INTERMARKET</b>\n"
                sec += f"• Correlations: {esc(p8.get('correlations', ''), max_len=350)}\n\n"
                parts_list.append(sec)

            # Build middle details dynamically based on remaining character budget
            MAX_TELEGRAM_LEN = 3950
            msg = setup_msg
            truncated_detail = False
            
            for part in parts_list:
                if len(msg) + len(part) + len(summary_msg) + 100 <= MAX_TELEGRAM_LEN:
                    msg += part
                else:
                    truncated_detail = True
                    break
            
            if truncated_detail:
                msg += "⚠️ <i>Some mid-level details omitted to fit Telegram limits.</i>\n\n"
                
            # Append final summary
            msg += summary_msg
        
        # 3. Send the message
        send_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        req_data = json.dumps({
            "chat_id": chat_id,
            "text": msg,
            "parse_mode": "HTML"
        }).encode('utf-8')
        
        req = urllib.request.Request(send_url, data=req_data, headers={'Content-Type': 'application/json'})
        def send_message():
            with urllib.request.urlopen(req, timeout=10) as res:
                return json.loads(res.read().decode("utf-8"))
                
        await asyncio.to_thread(send_message)
        
        return JSONResponse({"success": True, "message": "Report yeeted to Telegram successfully!"})
    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8")
        print(f"Telegram HTTPError: {he.code} {he.reason} - Body: {err_body}")
        try:
            err_json = json.loads(err_body)
            err_msg = err_json.get("description", err_body)
        except Exception:
            err_msg = err_body
        return JSONResponse({"error": f"Telegram API error: {err_msg}"}, status_code=500)
    except Exception as e:
        print(f"Telegram error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

async def market_news_endpoint(request):
    try:
        tavily_api_key = os.environ.get("TAVILY_API_KEY", "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")
        req_data = json.dumps({
            "api_key": tavily_api_key,
            "query": "latest global financial market news stock market gold bitcoin",
            "search_depth": "basic",
            "topic": "news",
            "max_results": 4
        }).encode('utf-8')
        
        req = urllib.request.Request("https://api.tavily.com/search", data=req_data, headers={'Content-Type': 'application/json'})
        
        def fetch_sync():
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode('utf-8'))
                
        data = await asyncio.to_thread(fetch_sync)
        return JSONResponse({"news": data.get("results", [])})
    except Exception as e:
        print(f"News fetch error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

async def gemini_analysis_endpoint(request):
    try:
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_api_key:
            return JSONResponse({"error": "Gemini API key is not configured in .env"}, status_code=400)
            
        body = await request.json()
        symbol = body.get("symbol", "UNKNOWN")
        data = body.get("data", {})
        
        # Prepare the prompt
        prompt = f"""You are an elite, highly experienced institutional trader and market analyst.
Please review the following quantitative market data for {symbol} and synthesize a professional, concise, deep analysis report. 

Output your analysis in beautiful, styled HTML using <h4> headers, bullet points, and clean <div> wrappers. 

CRITICAL THEME INSTRUCTIONS:
- The dashboard is in DARK MODE. 
- DO NOT use white or light backgrounds. Use transparent backgrounds (`background: transparent;`) or very dark backgrounds (`background: rgba(30, 41, 59, 0.4);`).
- Ensure all text is highly readable in dark mode (use light/silver/white text colors like `#f8fafc`, `#cbd5e1`, or `#94a3b8` for body/list text, and white or bold headers).
- Use some emojis to make it lively but keep it highly professional.
- Do not wrap the HTML in markdown blocks like ```html. Just return the raw HTML string.

Data payload for {symbol}:
{json.dumps(data, indent=2)}

Include:
1. Executive Summary
2. Technical Breakdown
3. Sentiment & Narrative Synthesis
4. Key Actionable Levels (Support/Resistance)
5. Final Verdict (Bullish/Bearish/Neutral & Trading Recommendation)
"""

        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"
        req_data = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4}
        }).encode('utf-8')
        
        req = urllib.request.Request(gemini_url, data=req_data, headers={'Content-Type': 'application/json'})
        
        def call_gemini():
            import time
            last_err = None
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(req, timeout=30) as response:
                        return json.loads(response.read().decode('utf-8'))
                except urllib.error.HTTPError as he:
                    last_err = he
                    print(f"Gemini API attempt {attempt + 1} failed: HTTPError {he.code} {he.reason}")
                    if he.code in (503, 429, 500, 502, 504):
                        time.sleep(1.5 * (attempt + 1))
                        continue
                    raise he
                except Exception as e:
                    last_err = e
                    print(f"Gemini API attempt {attempt + 1} failed: {e}")
                    time.sleep(1.5 * (attempt + 1))
                    continue
            raise last_err
                
        result = await asyncio.to_thread(call_gemini)
        
        # Extract the generated text
        generated_html = result["candidates"][0]["content"]["parts"][0]["text"]
        
        # Remove any markdown code blocks if the model ignored the instruction
        if generated_html.startswith("```html"):
            generated_html = generated_html[7:]
        if generated_html.startswith("```"):
            generated_html = generated_html[3:]
        if generated_html.endswith("```"):
            generated_html = generated_html[:-3]
            
        return JSONResponse({"success": True, "html": generated_html.strip()})
        
    except Exception as e:
        print(f"Gemini API error: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

# Get all tools from server
def get_available_tools():
    tools = []
    for name in dir(server):
        if name.startswith('_') or name in ('main', 'mcp'):
            continue
        func = getattr(server, name)
        if inspect.isroutine(func):
            sig = inspect.signature(func)
            params = []
            for p_name, p_param in sig.parameters.items():
                params.append({
                    "name": p_name,
                    "type": str(p_param.annotation) if p_param.annotation != inspect.Parameter.empty else "any",
                    "default": str(p_param.default) if p_param.default != inspect.Parameter.empty else None,
                    "required": p_param.default == inspect.Parameter.empty
                })
            tools.append({
                "name": name,
                "description": func.__doc__ or "No description available",
                "parameters": params,
                "is_async": asyncio.iscoroutinefunction(func)
            })
    return tools

async def list_tools_endpoint(request):
    tools = get_available_tools()
    return JSONResponse({"tools": tools})

async def execute_tool_endpoint(request):
    try:
        body = await request.json()
    except Exception:
        body = {}
        
    tool_name = body.get("tool")
    arguments = body.get("arguments", {})
    
    if not tool_name:
        return JSONResponse({"error": "Missing 'tool' parameter"}, status_code=400)
        
    func = getattr(server, tool_name, None)
    if not func or not inspect.isroutine(func) or tool_name.startswith('_') or tool_name in ('main', 'mcp'):
        return JSONResponse({"error": f"Tool '{tool_name}' not found"}, status_code=404)
        
    try:
        # Run function
        if asyncio.iscoroutinefunction(func):
            result = await func(**arguments)
        else:
            # Run sync function in a thread pool to avoid blocking
            result = await asyncio.to_thread(func, **arguments)
            
        # Fallback to Tavily News/Sentiment if Marketaux token is not set
        if tool_name == "combined_analysis" and isinstance(result, dict):
            sentiment = result.get("sentiment", {})
            news = result.get("news", {})
            if (not isinstance(sentiment, dict) or sentiment.get("error") or news.get("count", 0) == 0):
                try:
                    tavily_api_key = os.environ.get("TAVILY_API_KEY", "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")
                    symbol = arguments.get("symbol", "crypto")
                    query = f"latest financial news and market sentiment for {symbol}"
                    req_data = json.dumps({
                        "api_key": tavily_api_key,
                        "query": query,
                        "search_depth": "basic",
                        "topic": "news",
                        "max_results": 5
                    }).encode('utf-8')
                    
                    req = urllib.request.Request("https://api.tavily.com/search", data=req_data, headers={'Content-Type': 'application/json'})
                    
                    def fetch_tavily_news():
                        with urllib.request.urlopen(req, timeout=10) as response:
                            return json.loads(response.read().decode('utf-8'))
                            
                    tavily_data = await asyncio.to_thread(fetch_tavily_news)
                    results = tavily_data.get("results", [])
                    if results:
                        items = []
                        for res in results:
                            items.append({
                                "title": res.get("title", ""),
                                "url": res.get("url", ""),
                                "published": res.get("published_date", ""),
                                "summary": res.get("content", "")[:300],
                                "source": urllib.parse.urlparse(res.get("url", "")).netloc or "News"
                            })
                        result["news"] = {
                            "count": len(items),
                            "latest": items[:3]
                        }
                        
                        # Estimate basic sentiment score
                        positive_words = ["bullish", "long", "rise", "gain", "surge", "up", "buy", "growth", "positive", "high"]
                        negative_words = ["bearish", "short", "fall", "loss", "drop", "down", "sell", "decline", "negative", "low"]
                        pos_count = 0
                        neg_count = 0
                        for item in items:
                            text = (item["title"] + " " + item["summary"]).lower()
                            for pw in positive_words:
                                pos_count += text.count(pw)
                            for nw in negative_words:
                                neg_count += text.count(nw)
                        
                        score = 0.0
                        total = pos_count + neg_count
                        if total > 0:
                            score = round((pos_count - neg_count) / total, 2)
                        
                        label = "NEUTRAL"
                        if score > 0.15:
                            label = "BULLISH"
                        elif score < -0.15:
                            label = "BEARISH"
                            
                        result["sentiment"] = {
                            "symbol": symbol,
                            "sentiment_score": score,
                            "sentiment_label": label,
                            "posts_analyzed": len(items),
                            "bullish_count": pos_count,
                            "bearish_count": neg_count,
                            "neutral_count": max(0, len(items) - pos_count - neg_count),
                            "top_posts": [],
                            "provider": "tavily"
                        }
                        # Re-calculate confluence
                        tech = result.get("technical", {})
                        tech_momentum = tech.get("market_sentiment", {}).get("momentum", "") if isinstance(tech, dict) else ""
                        tech_bullish = tech_momentum == "Bullish"
                        sent_bullish = score > 0.1
                        signals_agree = tech_bullish == sent_bullish
                        confidence = "HIGH" if signals_agree else "MIXED"
                        tech_signal = tech.get("market_sentiment", {}).get("buy_sell_signal", "N/A") if isinstance(tech, dict) else "N/A"
                        result["confluence"] = {
                            "signals_agree": signals_agree,
                            "confidence": confidence,
                            "recommendation": (
                                f"Technical {tech_signal} "
                                f"{'confirmed by' if signals_agree else 'conflicts with'} "
                                f"{label} news sentiment "
                                f"({len(items)} articles analyzed)"
                            )
                        }
                except Exception as ex:
                    print(f"Tavily news fallback error: {ex}")
                    
        return JSONResponse({"success": True, "result": result})
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return JSONResponse({
            "success": False, 
            "error": str(e),
            "details": error_details
        }, status_code=500)

async def index_endpoint(request):
    return FileResponse("public/index.html")

async def gold_endpoint(request):
    return FileResponse("public/gold.html")

async def generate_gold_report_endpoint(request):
    try:
        try:
            body = await request.json()
        except Exception:
            body = {}
        timeframe = body.get("timeframe", "15m")

        # Run gold_analyst.py as a subprocess asynchronously with selected timeframe
        process = await asyncio.create_subprocess_exec(
            "uv", "run", "python", "gold_analyst.py", "--timeframe", str(timeframe),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise Exception(stderr.decode())
            
        # Load the generated JSON file
        with open("public/gold_report.json", "r") as f:
            report_data = json.load(f)
            
        return JSONResponse({"success": True, "report": report_data})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

async def generate_scalping_scan_endpoint(request):
    try:
        process = await asyncio.create_subprocess_exec(
            "uv", "run", "python", "scalping_scanner.py",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise Exception(stderr.decode())
            
        # Load the generated JSON file
        with open("public/scalping_report.json", "r") as f:
            report_data = json.load(f)
            
        return JSONResponse({"success": True, "report": report_data})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

# Create Starlette app
routes = [
    Route("/", index_endpoint),
    Route("/gold", gold_endpoint),
    Route("/api/tools", list_tools_endpoint),
    Route("/api/tool", execute_tool_endpoint, methods=["POST"]),
    Route("/api/generate-gold-report", generate_gold_report_endpoint, methods=["POST"]),
    Route("/api/generate-scalping-scan", generate_scalping_scan_endpoint, methods=["POST"]),
    Route("/api/send-telegram", send_telegram_endpoint, methods=["POST"]),
    Route("/api/market-news", market_news_endpoint, methods=["GET", "POST"]),
    Route("/api/gemini-analysis", gemini_analysis_endpoint, methods=["POST"]),
    Mount("/static", app=StaticFiles(directory="public"), name="static")
]

middleware = [
    Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
]

app = Starlette(debug=True, routes=routes, middleware=middleware)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting server on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
