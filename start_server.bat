@echo off
title TradingView Analysis Engine Server
echo Starting TradingView Analysis Engine Server...
set PORT=8081
uv run python web_server.py
pause
