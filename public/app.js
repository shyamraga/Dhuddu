// App State & Globals
let equityChart = null;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initMarketPulse();
  initScanner();
  initDeepAnalysis();
  initOptionsAnalysis();
  initScalpingScanner();
  initGoldAnalyst();
  initMutualFunds();

  // Modern mouse hover spotlight effect for glass cards
  document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.glass-card, .session-clock');
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
});

// Sidebar Toggle for Mobile Drawer
window.toggleSidebar = function() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
};

// Close sidebar drawer helper
function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

// Tab switch function (used by sidebar nav)
function switchTab(tabId) {
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  // Deactivate all
  navItems.forEach(nav => nav.classList.remove('active'));
  tabContents.forEach(tab => tab.classList.remove('active'));

  // Activate sidebar nav item
  navItems.forEach(nav => {
    if (nav.getAttribute('data-tab') === tabId) nav.classList.add('active');
  });

  // Activate tab content
  const targetEl = document.getElementById(tabId);
  if (targetEl) targetEl.classList.add('active');

  // Close drawer on mobile
  closeSidebar();

  // Scroll to top on tab switch (mobile UX)
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 1. Navigation Controller
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(item.getAttribute('data-tab'));
    });
  });
}

// Helper to make API Calls
async function callMCPTool(toolName, args = {}) {
  try {
    const response = await fetch('/api/tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: toolName,
        arguments: args
      })
    });
    
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Server error occurred');
    }
    return data.result;
  } catch (error) {
    console.error(`Error calling ${toolName}:`, error);
    throw error;
  }
}

// Helper to animate progress bar smooth-glow
function animateProgressBar(barId, textId, durationMs) {
  const bar = document.getElementById(barId);
  const text = document.getElementById(textId);
  if (!bar) return null;
  
  bar.style.width = '0%';
  if (text) text.textContent = '0%';
  
  let start = null;
  let animationFrameId = null;
  let hasFinished = false;
  
  function step(timestamp) {
    if (hasFinished) return;
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / durationMs, 0.98); // hold at 98%
    const pct = Math.floor(progress * 100);
    
    bar.style.width = `${pct}%`;
    if (text) text.textContent = `${pct}%`;
    
    if (progress < 0.98) {
      animationFrameId = requestAnimationFrame(step);
    }
  }
  
  animationFrameId = requestAnimationFrame(step);
  
  return {
    finish: () => {
      hasFinished = true;
      cancelAnimationFrame(animationFrameId);
      bar.style.width = '100%';
      if (text) text.textContent = '100%';
    },
    cancel: () => {
      hasFinished = true;
      cancelAnimationFrame(animationFrameId);
    }
  };
}

// Helper to add loading indicator
function setLoading(elementId, isLoading) {
  const element = document.getElementById(elementId);
  if (element) {
    if (isLoading) {
      element.classList.add('loading');
    } else {
      element.classList.remove('loading');
    }
  }
}

// 2. Tab: Market Pulse
async function initMarketPulse() {
  await refreshMarketPulse();
  // Auto-refresh live tickers every 60 seconds to keep market data fresh
  setInterval(refreshMarketPulse, 60000);
}

async function refreshMarketPulse() {
  setLoading('btc-pulse-card', true);
  setLoading('gold-pulse-card', true);
  setLoading('dxy-pulse-card', true);
  setLoading('fng-card', true);
  setLoading('market-snapshot-data', true);
  
  try {
    // 1. Get Bitcoin Pulse
    let btcPulse = null;
    try {
      btcPulse = await callMCPTool('bitcoin_market_pulse');
    } catch (e) {
      console.warn("BTC Pulse backend call failed, attempting client-side fallback:", e);
    }

    let price = null;
    let change = null;
    let volume = null;
    let cap = null;

    if (btcPulse && btcPulse.bitcoin && btcPulse.bitcoin.price_usd !== null) {
      price = btcPulse.bitcoin.price_usd;
      change = btcPulse.bitcoin.change_24h_pct || 0;
      volume = btcPulse.bitcoin.volume_24h_usd || 0;
      cap = btcPulse.bitcoin.market_cap_usd || 0;
    } else {
      // Client-side fallback to Coinbase & Binance (direct from user's residential IP)
      try {
        const cbRes = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot");
        const cbData = await cbRes.json();
        price = parseFloat(cbData.data.amount);
        
        const biRes = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
        const biData = await biRes.json();
        change = parseFloat(biData.priceChangePercent);
        volume = parseFloat(biData.volume) * price;
        cap = price * 19700000; // Estimated circulating supply
      } catch (err) {
        console.error("Client-side BTC fallback failed:", err);
      }
    }

    if (price !== null && change !== null) {
      document.getElementById('btc-price').textContent = `$${price.toLocaleString()}`;
      
      const changeEl = document.getElementById('btc-change');
      changeEl.className = 'change-badge';
      if (change >= 0) {
        changeEl.classList.add('positive');
        changeEl.innerHTML = `<i class="fa-solid fa-caret-up"></i> +${change.toFixed(2)}%`;
      } else {
        changeEl.classList.add('negative');
        changeEl.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${change.toFixed(2)}%`;
      }
      
      const btcVol = document.getElementById('btc-volume');
      if (btcVol) btcVol.textContent = volume ? `$${(volume / 1e9).toFixed(2)}B` : '--';
      
      const btcCap = document.getElementById('btc-cap');
      if (btcCap) btcCap.textContent = cap ? `$${(cap / 1e9).toFixed(2)}B` : '--';
    }
    
    
    // 2. Get Gold (XAUUSD) Price
    const goldData = await callMCPTool('yahoo_price', { symbol: 'GC=F' });
    if (goldData) {
      const price = goldData.price || 0;
      const change = goldData.change_pct || 0;
      const high = goldData["52w_high"] || 0;
      const low = goldData["52w_low"] || 0;
      
      document.getElementById('gold-pulse-price').textContent = `$${price.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}`;
      
      const changeEl = document.getElementById('gold-pulse-change');
      changeEl.className = 'change-badge';
      if (change >= 0) {
        changeEl.classList.add('positive');
        changeEl.innerHTML = `<i class="fa-solid fa-caret-up"></i> +${change.toFixed(2)}%`;
      } else {
        changeEl.classList.add('negative');
        changeEl.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${change.toFixed(2)}%`;
      }
      
      const highEl = document.getElementById('gold-pulse-high');
      if (highEl) highEl.textContent = `$${high.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}`;
      
      const lowEl = document.getElementById('gold-pulse-low');
      if (lowEl) lowEl.textContent = `$${low.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}`;
    }
    
    // 3. Get US Dollar Index (DXY)
    const dxyData = await callMCPTool('yahoo_price', { symbol: 'DX-Y.NYB' });
    if (dxyData) {
      const price = dxyData.price || 0;
      const change = dxyData.change_pct || 0;
      const high = dxyData["52w_high"] || 0;
      const low = dxyData["52w_low"] || 0;
      
      document.getElementById('dxy-pulse-price').textContent = price.toFixed(3);
      
      const changeEl = document.getElementById('dxy-pulse-change');
      changeEl.className = 'change-badge';
      if (change >= 0) {
        changeEl.classList.add('positive');
        changeEl.innerHTML = `<i class="fa-solid fa-caret-up"></i> +${change.toFixed(2)}%`;
      } else {
        changeEl.classList.add('negative');
        changeEl.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${change.toFixed(2)}%`;
      }
      
      const dxyHighEl = document.getElementById('dxy-pulse-high');
      if (dxyHighEl) dxyHighEl.textContent = high.toFixed(2);
      
      const dxyLowEl = document.getElementById('dxy-pulse-low');
      if (dxyLowEl) dxyLowEl.textContent = low.toFixed(2);
    }
    
    // 4. Get Crypto Fear & Greed Index
    try {
      const fngResponse = await fetch('https://api.alternative.me/fng/');
      const fngData = await fngResponse.json();
      if (fngData && fngData.data && fngData.data[0]) {
        const fng = fngData.data[0];
        const value = parseInt(fng.value);
        const classification = fng.value_classification;
        const timeUntilUpdate = parseInt(fng.time_until_update);
        
        const fngValueEl = document.getElementById('fng-value');
        if (fngValueEl) fngValueEl.textContent = value;
        
        const fngClassEl = document.getElementById('fng-class');
        if (fngClassEl) {
          fngClassEl.textContent = classification.toUpperCase();
          fngClassEl.className = 'change-badge';
          
          let color = 'var(--accent-cyan)';
          if (value >= 75) {
            fngClassEl.classList.add('positive');
            color = 'var(--accent-green)';
          } else if (value >= 55) {
            fngClassEl.classList.add('positive');
            color = '#81c784';
          } else if (value <= 25) {
            fngClassEl.classList.add('negative');
            color = 'var(--accent-red)';
          } else if (value <= 45) {
            fngClassEl.classList.add('negative');
            color = '#e57373';
          } else {
            fngClassEl.classList.add('neutral');
            color = '#ffb74d';
          }
          
          const progressBar = document.getElementById('fng-progress-bar');
          if (progressBar) {
            progressBar.style.width = `${value}%`;
            progressBar.style.background = color;
          }
        }
        
        const updateHours = Math.floor(timeUntilUpdate / 3600);
        const updateMins = Math.floor((timeUntilUpdate % 3600) / 60);
        const updateTimeEl = document.getElementById('fng-update-time');
        if (updateTimeEl) updateTimeEl.textContent = `${updateHours}h ${updateMins}m remaining`;
      }
    } catch (fngErr) {
      console.error('Failed to fetch Fear & Greed:', fngErr);
      const fngValueEl = document.getElementById('fng-value');
      if (fngValueEl) fngValueEl.textContent = 'N/A';
      const fngClassEl = document.getElementById('fng-class');
      if (fngClassEl) fngClassEl.textContent = 'ERROR';
      const fngUpdateEl = document.getElementById('fng-update-time');
      if (fngUpdateEl) fngUpdateEl.textContent = 'Failed to load';
    }
    
    // 5. Get Global Market Snapshot
    const snapshot = await callMCPTool('market_snapshot');
    const indicesContainer = document.getElementById('market-snapshot-data');
    if (indicesContainer) {
      indicesContainer.innerHTML = '';
      
      if (snapshot && snapshot.indices) {
        snapshot.indices.forEach(idx => {
          const isPos = idx.change_pct >= 0;
          const changeClass = isPos ? 'positive' : 'negative';
          const changeIcon = isPos ? '<i class="fa-solid fa-caret-up"></i>' : '<i class="fa-solid fa-caret-down"></i>';
          const sign = isPos ? '+' : '';
          
          const card = document.createElement('div');
          card.className = 'index-card';
          card.innerHTML = `
            <span class="index-title">${idx.name}</span>
            <span class="index-price">${idx.price.toLocaleString()}</span>
            <span class="index-change ${changeClass}">${changeIcon} ${sign}${idx.change_pct.toFixed(2)}%</span>
          `;
          indicesContainer.appendChild(card);
        });
      } else {
        indicesContainer.innerHTML = '<div class="placeholder-text">No global indices found.</div>';
      }
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    setLoading('btc-pulse-card', false);
    setLoading('gold-pulse-card', false);
    setLoading('dxy-pulse-card', false);
    setLoading('fng-card', false);
    setLoading('market-snapshot-data', false);
  }
}

// 3. Tab: Scanner
function initScanner() {
  const runScanBtn = document.getElementById('run-scan-btn');
  runScanBtn.addEventListener('click', async () => {
    await runScanner();
  });
}

async function runScanner() {
  const exchange = document.getElementById('scanner-exchange').value;
  const timeframe = document.getElementById('scanner-timeframe').value;
  const type = document.getElementById('scanner-type').value;
  
  const resultsTitle = document.getElementById('scan-results-title');
  const resultsCount = document.getElementById('scan-results-count');
  const table = document.getElementById('scanner-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  
  resultsTitle.textContent = `${type.replace('_', ' ').toUpperCase()} Results`;
  resultsCount.textContent = 'Scanning...';
  
  // Show and animate progress bar
  const progressContainer = document.getElementById('scanner-progress-container');
  if (progressContainer) progressContainer.style.display = 'block';
  const progress = animateProgressBar('scanner-progress-bar', 'scanner-progress-text', 1500);
  
  setLoading('scanner', true);
  
  tbody.innerHTML = '';
  thead.innerHTML = '';
  
  try {
    let result = [];
    if (type === 'top_gainers') {
      result = await callMCPTool('top_gainers', { exchange, timeframe, limit: 25 });
      
      // Render Headers
      thead.innerHTML = `
        <tr>
          <th>Symbol</th>
          <th>Change 24h</th>
          <th>Close Price</th>
          <th>RSI</th>
          <th>SMA20</th>
          <th>EMA50</th>
          <th>Volume</th>
        </tr>
      `;
      
      // Render Rows
      if (Array.isArray(result) && result.length > 0) {
        resultsCount.textContent = `${result.length} assets`;
        result.forEach(row => {
          const change = row.changePercent || 0;
          const isPos = change >= 0;
          const sign = isPos ? '+' : '';
          const changeClass = isPos ? 'positive' : 'negative';
          const rsi = row.indicators?.RSI ? row.indicators.RSI.toFixed(1) : '-';
          const volume = row.indicators?.volume ? row.indicators.volume.toLocaleString() : '-';
          
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="sym-cell">${row.symbol}</td>
            <td class="${changeClass}">${sign}${change.toFixed(2)}%</td>
            <td>${row.indicators?.close || '-'}</td>
            <td>${rsi}</td>
            <td>${row.indicators?.SMA20 ? row.indicators.SMA20.toLocaleString() : '-'}</td>
            <td>${row.indicators?.EMA50 ? row.indicators.EMA50.toLocaleString() : '-'}</td>
            <td>${volume}</td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="100%" class="placeholder-text">No records found.</td></tr>`;
        resultsCount.textContent = '0 assets';
      }
      
    } else if (type === 'top_losers') {
      result = await callMCPTool('top_losers', { exchange, timeframe, limit: 25 });
      
      thead.innerHTML = `
        <tr>
          <th>Symbol</th>
          <th>Change 24h</th>
          <th>Close Price</th>
          <th>RSI</th>
          <th>SMA20</th>
          <th>EMA50</th>
          <th>Volume</th>
        </tr>
      `;
      
      if (Array.isArray(result) && result.length > 0) {
        resultsCount.textContent = `${result.length} assets`;
        result.forEach(row => {
          const change = row.changePercent || 0;
          const isPos = change >= 0;
          const sign = isPos ? '+' : '';
          const changeClass = isPos ? 'positive' : 'negative';
          const rsi = row.indicators?.RSI ? row.indicators.RSI.toFixed(1) : '-';
          const volume = row.indicators?.volume ? row.indicators.volume.toLocaleString() : '-';
          
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="sym-cell">${row.symbol}</td>
            <td class="${changeClass}">${sign}${change.toFixed(2)}%</td>
            <td>${row.indicators?.close || '-'}</td>
            <td>${rsi}</td>
            <td>${row.indicators?.SMA20 ? row.indicators.SMA20.toLocaleString() : '-'}</td>
            <td>${row.indicators?.EMA50 ? row.indicators.EMA50.toLocaleString() : '-'}</td>
            <td>${volume}</td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="100%" class="placeholder-text">No records found.</td></tr>`;
        resultsCount.textContent = '0 assets';
      }
      
    } else if (type === 'bollinger_scan') {
      result = await callMCPTool('bollinger_scan', { exchange, timeframe, bbw_threshold: 0.04, limit: 50 });
      
      thead.innerHTML = `
        <tr>
          <th>Symbol</th>
          <th>Bollinger Band Width</th>
          <th>Close Price</th>
          <th>RSI</th>
          <th>Upper BB</th>
          <th>Lower BB</th>
        </tr>
      `;
      
      if (Array.isArray(result) && result.length > 0) {
        resultsCount.textContent = `${result.length} assets`;
        result.forEach(row => {
          const tr = document.createElement('tr');
          const ind = row.indicators || {};
          const bbUpper = ind.BB_upper || 0;
          const bbLower = ind.BB_lower || 0;
          const sma20 = ind.SMA20 || 1;
          const bbw = sma20 > 0 ? (bbUpper - bbLower) / sma20 : 0;
          const rsi = ind.RSI ? ind.RSI.toFixed(1) : '-';
          tr.innerHTML = `
            <td class="sym-cell">${row.symbol}</td>
            <td>${(bbw * 100).toFixed(4)}%</td>
            <td>${ind.close || '-'}</td>
            <td>${rsi}</td>
            <td>${bbUpper ? bbUpper.toLocaleString() : '-'}</td>
            <td>${bbLower ? bbLower.toLocaleString() : '-'}</td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="100%" class="placeholder-text">No records found.</td></tr>`;
        resultsCount.textContent = '0 assets';
      }
      
    } else if (type === 'volume_breakout' || type === 'volume_breakout_scanner') {
      result = await callMCPTool('volume_breakout_scanner', { exchange, timeframe, volume_multiplier: 2.0, price_change_min: 3.0, limit: 50 });
      
      thead.innerHTML = `
        <tr>
          <th>Symbol</th>
          <th>Volume Ratio</th>
          <th>Strength</th>
          <th>Close Price</th>
          <th>Change %</th>
          <th>Type</th>
        </tr>
      `;
      
      if (Array.isArray(result) && result.length > 0) {
        resultsCount.textContent = `${result.length} assets`;
        result.forEach(row => {
          const ratio = row.volume_ratio || 0;
          const strength = row.volume_strength || 0;
          const change = row.changePercent || 0;
          const isPos = change >= 0;
          const bType = row.breakout_type || (isPos ? 'bullish' : 'bearish');
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="sym-cell">${row.symbol}</td>
            <td class="positive" style="font-weight: 700;">${ratio.toFixed(2)}x</td>
            <td>${strength.toFixed(1)}</td>
            <td>${row.indicators?.close?.toLocaleString() || '-'}</td>
            <td class="${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${change.toFixed(2)}%</td>
            <td class="${bType === 'bullish' ? 'positive' : 'negative'}" style="text-transform:uppercase; font-weight:600;">${bType}</td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="100%" class="placeholder-text">No records found.</td></tr>`;
        resultsCount.textContent = '0 assets';
      }
    }
  } catch (err) {
    console.error(err);
    const isRateLimit = /transient|JSONDecodeError|empty.body|Analysis failed|upstream|scanner\.tradingview/i.test(err.message);
    if (isRateLimit) {
      tbody.innerHTML = `<tr><td colspan="100%" style="text-align:center; padding:30px;">
        <div style="color: var(--accent-amber); font-weight:600; margin-bottom:8px;">
          <i class="fa-solid fa-triangle-exclamation"></i> TradingView rate limit hit
        </div>
        <div style="color: var(--text-secondary); font-size:12px; margin-bottom:14px;">
          The upstream scanner is temporarily throttling requests. This usually resolves in 30–60 seconds.
        </div>
        <button onclick="runScanner()" class="primary-btn" style="font-size:12px; padding:8px 18px;">
          <i class="fa-solid fa-rotate-right"></i> Retry Scan
        </button>
      </td></tr>`;
    } else {
      tbody.innerHTML = `<tr><td colspan="100%" class="placeholder-text error" style="color: var(--accent-red)">Error: ${err.message}</td></tr>`;
    }
    resultsCount.textContent = 'Error';
  } finally {
    setLoading('scanner', false);
    if (progress) progress.finish();
    setTimeout(() => {
      const progressContainer = document.getElementById('scanner-progress-container');
      if (progressContainer) progressContainer.style.display = 'none';
    }, 600);
  }
}

// 4. Tab: Deep Analysis
function initDeepAnalysis() {
  const runAnalysisBtn = document.getElementById('run-analysis-btn');
  runAnalysisBtn.addEventListener('click', async () => {
    await runAnalysis();
  });
}

async function runAnalysis() {
  const symbol = document.getElementById('analysis-symbol').value.trim();
  const exchange = document.getElementById('analysis-exchange').value;
  
  if (!symbol) return;
  
  const grid = document.getElementById('analysis-grid');
  const placeholder = document.getElementById('analysis-placeholder');
  
  grid.style.display = 'grid';
  placeholder.style.display = 'none';
  
  // Show and animate progress bar
  const progressContainer = document.getElementById('analysis-progress-container');
  if (progressContainer) progressContainer.style.display = 'block';
  const progress = animateProgressBar('analysis-progress-bar', 'analysis-progress-text', 2500);
  
  updateAnalysisChartWidget(symbol, exchange);
  
  setLoading('tech-metrics-body', true);
  setLoading('sentiment-news-body', true);
  setLoading('mtf-matrix-body', true);
  setLoading('gemini-synthesis-body', true);
  document.getElementById('gemini-content').innerHTML = '';
  
  try {
    // Call combined_analysis
    const data = await callMCPTool('combined_analysis', { symbol, exchange });
    
    // Update Technical indicators UI
    const techBody = document.getElementById('tech-metrics-body');
    techBody.innerHTML = '';
    
    if (data && data.technical) {
      const tech = data.technical;
      const sentiment = tech.market_sentiment || {};
      
      const rec = sentiment.buy_sell_signal || 'NEUTRAL';
      const recClass = rec.toLowerCase().includes('buy') ? 'positive' : (rec.toLowerCase().includes('sell') ? 'negative' : 'neutral');
      
      const rsiVal = tech.rsi?.value;
      const macdVal = tech.macd?.macd_line;
      const stochVal = tech.stochastic?.k;
      const adxVal = tech.adx?.value;
      const emaVal = tech.ema?.ema50;
      const smaVal = tech.sma?.sma200;
      
      techBody.innerHTML = `
        <div class="report-section">
          <h4>Summary Rating</h4>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="indicator-val ${recClass}" style="font-size: 20px; padding: 6px 14px; border-radius: 4px;">${rec}</span>
            <div style="font-size: 13px; color: var(--text-secondary);">
              Volatility: <strong>${sentiment.volatility || 'N/A'}</strong> | Momentum: <strong>${sentiment.momentum || 'N/A'}</strong>
            </div>
          </div>
        </div>
        
        <div class="report-section">
          <h4>Key Indicator Values</h4>
          <div class="tech-grid">
            <div class="indicator-item">
              <span class="indicator-name">RSI (14)</span>
              <span class="indicator-val ${rsiVal > 70 ? 'red' : (rsiVal < 30 ? 'green' : '')}">${rsiVal !== undefined && rsiVal !== null ? rsiVal.toFixed(1) : '-'}</span>
            </div>
            <div class="indicator-item">
              <span class="indicator-name">MACD Line</span>
              <span class="indicator-val">${macdVal !== undefined && macdVal !== null ? macdVal.toFixed(4) : '-'}</span>
            </div>
            <div class="indicator-item">
              <span class="indicator-name">Stoch %K</span>
              <span class="indicator-val">${stochVal !== undefined && stochVal !== null ? stochVal.toFixed(1) : '-'}</span>
            </div>
            <div class="indicator-item">
              <span class="indicator-name">ADX Trend</span>
              <span class="indicator-val">${adxVal !== undefined && adxVal !== null ? adxVal.toFixed(1) : '-'}</span>
            </div>
            <div class="indicator-item">
              <span class="indicator-name">EMA 50</span>
              <span class="indicator-val">${emaVal !== undefined && emaVal !== null ? Math.round(emaVal).toLocaleString() : '-'}</span>
            </div>
            <div class="indicator-item">
              <span class="indicator-name">SMA 200</span>
              <span class="indicator-val">${smaVal !== undefined && smaVal !== null ? Math.round(smaVal).toLocaleString() : '-'}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      techBody.innerHTML = '<p class="placeholder-text">No technical indicators found.</p>';
    }
    
    // Update Sentiment & News
    const sentBody = document.getElementById('sentiment-news-body');
    sentBody.innerHTML = '';
    
    if (data) {
      const sentimentScore = data.sentiment?.sentiment_score !== undefined ? data.sentiment.sentiment_score : 'N/A';
      const label = data.sentiment?.sentiment_label || 'NEUTRAL';
      const labelClass = label === 'BULLISH' ? 'positive' : (label === 'BEARISH' ? 'negative' : 'neutral');
      
      let newsHtml = '';
      const newsArticles = data.news?.latest || data.news?.articles || [];
      if (newsArticles && newsArticles.length > 0) {
        newsHtml = '<div class="news-list">';
        newsArticles.slice(0, 3).forEach(article => {
          const url = article.url || article.link || '#';
          newsHtml += `
            <div class="news-item">
              <a href="${url}" target="_blank" class="news-title">${article.title}</a>
              ${article.summary ? `<p class="news-summary" style="font-size: 12px; color: var(--text-secondary); margin: 4px 0 6px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${article.summary}</p>` : ''}
              <div class="news-meta">
                <span><i class="fa-solid fa-newspaper" style="color: var(--accent-amber); margin-right: 4px;"></i> ${article.source || 'News'}</span>
                <span><i class="fa-regular fa-clock" style="margin-right: 4px;"></i> ${article.published || ''}</span>
              </div>
            </div>
          `;
        });
        newsHtml += '</div>';
      } else {
        newsHtml = '<p class="placeholder-text">No news available.</p>';
      }
      
      sentBody.innerHTML = `
        <div class="report-section">
          <h4>Social & Market Sentiment</h4>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="indicator-val ${labelClass}" style="font-size: 18px;">${label}</span>
            <span class="indicator-val" style="font-size: 18px; font-family: var(--font-mono)">Score: ${sentimentScore}</span>
          </div>
        </div>
        
        <div class="report-section">
          <h4>Latest Market News</h4>
          ${newsHtml}
        </div>
      `;
    }
    
    // Update Multi-Timeframe Matrix
    const mtfBody = document.getElementById('mtf-matrix-body');
    mtfBody.innerHTML = '';
    
    if (data && data.multi_timeframe) {
      let matrixCards = '';
      Object.keys(data.multi_timeframe).forEach(tf => {
        const tfData = data.multi_timeframe[tf] || {};
        const rec = tfData.bias || tfData.market_structure || tfData.recommendation || 'NEUTRAL';
        const recClass = rec.toLowerCase().includes('buy') ? 'positive' : (rec.toLowerCase().includes('sell') ? 'negative' : 'neutral');
        const rsi = tfData.rsi?.value || tfData.rsi || null;
        
        matrixCards += `
          <div class="matrix-card">
            <div class="matrix-tf">${tf}</div>
            <div class="matrix-rec ${recClass}">${rec}</div>
            <div style="font-size: 12px; margin-top: 10px; color: var(--text-secondary)">
              RSI: <strong>${rsi !== null && rsi !== undefined ? rsi.toFixed(1) : '-'}</strong>
            </div>
          </div>
        `;
      });
      
      mtfBody.innerHTML = `
        <div class="matrix-grid">
          ${matrixCards}
        </div>
      `;
    } else {
      // Fallback: check if we have a simple multi_timeframe tool call
      const mtfData = await callMCPTool('multi_timeframe_analysis', { symbol, exchange });
      if (mtfData && mtfData.timeframes) {
        let matrixCards = '';
        Object.keys(mtfData.timeframes).forEach(tf => {
          const tfData = mtfData.timeframes[tf] || {};
          const rec = tfData.bias || tfData.market_structure || tfData.recommendation || 'NEUTRAL';
          const recClass = rec.toLowerCase().includes('buy') ? 'positive' : (rec.toLowerCase().includes('sell') ? 'negative' : 'neutral');
          const rsi = tfData.rsi?.value || tfData.rsi || null;
          
          matrixCards += `
            <div class="matrix-card">
              <div class="matrix-tf">${tf}</div>
              <div class="matrix-rec ${recClass}">${rec}</div>
              <div style="font-size: 12px; margin-top: 10px; color: var(--text-secondary)">
                RSI: <strong>${rsi !== null && rsi !== undefined ? rsi.toFixed(1) : '-'}</strong>
              </div>
            </div>
          `;
        });
        mtfBody.innerHTML = `
          <div class="matrix-grid">
            ${matrixCards}
          </div>
        `;
      } else {
        mtfBody.innerHTML = '<p class="placeholder-text">No multi-timeframe data available.</p>';
      }
    }
    
    // Call Gemini API for deep synthesis
    try {
      const response = await fetch('/api/gemini-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, data })
      });
      const geminiResult = await response.json();
      if (geminiResult.success) {
        document.getElementById('gemini-content').innerHTML = geminiResult.html;
      } else {
        document.getElementById('gemini-content').innerHTML = `<p class="placeholder-text error" style="color: var(--accent-red)">Gemini AI failed: ${geminiResult.error}</p>`;
      }
    } catch (gErr) {
      console.error('Gemini error:', gErr);
      document.getElementById('gemini-content').innerHTML = '<p class="placeholder-text error">Failed to connect to Gemini AI.</p>';
    }
    
  } catch (err) {
    console.error(err);
    document.getElementById('tech-metrics-body').innerHTML = `<p class="placeholder-text error" style="color: var(--accent-red)">Error: ${err.message}</p>`;
    document.getElementById('sentiment-news-body').innerHTML = '<p class="placeholder-text">Failed to fetch data.</p>';
    document.getElementById('mtf-matrix-body').innerHTML = '<p class="placeholder-text">Failed to fetch data.</p>';
  } finally {
    setLoading('tech-metrics-body', false);
    setLoading('sentiment-news-body', false);
    setLoading('mtf-matrix-body', false);
    setLoading('gemini-synthesis-body', false);
    if (progress) progress.finish();
    setTimeout(() => {
      const progressContainer = document.getElementById('analysis-progress-container');
      if (progressContainer) progressContainer.style.display = 'none';
    }, 600);
  }
}

// 5. Tab: Options Analysis
function initOptionsAnalysis() {
  // Can load defaults or initialize event listeners if needed
}

async function fetchOptionsData() {
  const symbolInput = document.getElementById('options-symbol-input');
  const symbol = symbolInput ? symbolInput.value.trim().toUpperCase() : 'SPY';
  if (!symbol) return;

  const dashboard = document.getElementById('options-dashboard');
  const placeholder = document.getElementById('options-placeholder');
  const overlay = document.getElementById('options-loading-overlay');
  
  if (overlay) overlay.style.display = 'flex';
  const progress = animateProgressBar('options-progress-bar', 'options-progress-text', 4000);

  try {
    // 1. Fetch Unusual Options Activity
    const unusualResult = await callMCPTool('stock_options_unusual_activity', { symbol, top_n: 12 });
    
    // 2. Fetch Expiries list via standard chain tool
    const chainResult = await callMCPTool('stock_options_chain', { symbol });
    
    if (placeholder) placeholder.style.display = 'none';
    if (dashboard) dashboard.style.display = 'grid';

    // Update Spot Price
    const spot = chainResult.underlying_price || unusualResult.underlying_price || 0;
    document.getElementById('options-spot-price').innerText = `$${spot.toFixed(2)}`;

    // Render Unusual Table
    const unusualTbody = document.getElementById('unusual-options-table').querySelector('tbody');
    unusualTbody.innerHTML = '';
    
    if (unusualResult && Array.isArray(unusualResult.unusual) && unusualResult.unusual.length > 0) {
      unusualResult.unusual.forEach(row => {
        const tr = document.createElement('tr');
        const sideClass = row.side === 'call' || row.side === 'CALL' ? 'positive' : 'negative';
        const moneyness = row.in_the_money ? 'ITM' : 'OTM';
        const moneynessClass = row.in_the_money ? 'positive' : 'neutral';
        
        tr.innerHTML = `
          <td style="font-family: var(--font-mono); font-size:12px; font-weight:700; color:var(--accent-amber);">
            <div style="display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="copyContractSymbol('${row.contract_symbol}', this)" title="Click to copy contract symbol">
              <span>${row.contract_symbol}</span> <i class="fa-solid fa-copy" style="font-size: 9px; color:var(--text-muted);"></i>
            </div>
          </td>
          <td style="font-family: var(--font-mono); font-weight:700;">$${row.strike} <span class="indicator-val ${sideClass}" style="font-size: 11px; margin-left: 4px;">${row.side.toUpperCase()}</span></td>
          <td>${row.expiration}</td>
          <td style="font-family: var(--font-mono); font-size:12px;">${row.volume.toLocaleString()} <span style="color:var(--text-muted); font-size:10px;">/ ${row.open_interest.toLocaleString()}</span></td>
          <td class="positive" style="font-weight: 700; font-family: var(--font-mono);">${row.v_oi_ratio.toFixed(2)}x</td>
          <td><span class="indicator-val ${moneynessClass}" style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">${moneyness} (${(typeof row.strike_vs_spot_pct === 'number' && !isNaN(row.strike_vs_spot_pct)) ? (row.strike_vs_spot_pct >= 0 ? '+' : '') + row.strike_vs_spot_pct.toFixed(1) + '%' : '--'})</span></td>
          <td style="font-family: var(--font-mono); font-weight: 600;">$${row.last_price.toFixed(2)} <span style="color:var(--accent-amber); font-size:10px; margin-left:4px;">(${(row.implied_volatility * 100).toFixed(0)}%)</span></td>
        `;
        unusualTbody.appendChild(tr);
      });
    } else {
      unusualTbody.innerHTML = `<tr><td colspan="100%" class="placeholder-text">No unusual options activity detected.</td></tr>`;
    }

    // Render Flow Sentiment
    const callsVol = unusualResult.total_call_volume || 0;
    const putsVol = unusualResult.total_put_volume || 0;
    document.getElementById('options-call-vol').innerText = callsVol.toLocaleString();
    document.getElementById('options-put-vol').innerText = putsVol.toLocaleString();

    const totalVol = callsVol + putsVol;
    if (totalVol > 0) {
      const callPct = (callsVol / totalVol) * 100;
      const putPct = (putsVol / totalVol) * 100;
      document.getElementById('options-call-bar').style.width = `${callPct}%`;
      document.getElementById('options-put-bar').style.width = `${putPct}%`;
    } else {
      document.getElementById('options-call-bar').style.width = `50%`;
      document.getElementById('options-put-bar').style.width = `50%`;
    }

    const ratio = unusualResult.put_call_volume_ratio || 1.0;
    const sentimentVerdict = document.getElementById('options-sentiment-verdict');
    if (ratio < 0.7) {
      sentimentVerdict.innerText = "Strongly Bullish";
      sentimentVerdict.className = "badge-large positive";
    } else if (ratio < 0.95) {
      sentimentVerdict.innerText = "Bullish";
      sentimentVerdict.className = "badge-large positive";
    } else if (ratio > 1.4) {
      sentimentVerdict.innerText = "Strongly Bearish";
      sentimentVerdict.className = "badge-large negative";
    } else if (ratio > 1.05) {
      sentimentVerdict.innerText = "Bearish";
      sentimentVerdict.className = "badge-large negative";
    } else {
      sentimentVerdict.innerText = "Neutral";
      sentimentVerdict.className = "badge-large neutral";
    }

    // Populate Expiries Dropdown
    const select = document.getElementById('options-expiry-select');
    select.innerHTML = '';
    
    if (chainResult.available_expiries && chainResult.available_expiries.length > 0) {
      chainResult.available_expiries.forEach(exp => {
        const opt = document.createElement('option');
        opt.value = exp;
        opt.innerText = exp;
        select.appendChild(opt);
      });
      
      select.value = chainResult.requested_expiry || chainResult.available_expiries[0];
    }
    
    // 3. Compute Suggested Options Setups (ATM / near-OTM)
    const calls = chainResult.calls || [];
    const puts = chainResult.puts || [];
    
    let bestCall = null;
    let minCallDiff = Infinity;
    calls.forEach(c => {
      // Find Call closest to spot price that is at-the-money or slightly out-of-the-money
      if (c.strike >= spot && (c.strike - spot) < minCallDiff) {
        minCallDiff = c.strike - spot;
        bestCall = c;
      }
    });
    
    let bestPut = null;
    let minPutDiff = Infinity;
    puts.forEach(p => {
      // Find Put closest to spot price that is at-the-money or slightly out-of-the-money
      if (p.strike <= spot && (spot - p.strike) < minPutDiff) {
        minPutDiff = spot - p.strike;
        bestPut = p;
      }
    });

    // Populate Suggested setups inside HTML
    if (bestCall) {
      document.getElementById('call-setup-strike').innerText = `$${bestCall.strike} Call`;
      document.getElementById('call-setup-symbol').innerHTML = `
        <span>${bestCall.contract_symbol}</span> 
        <i class="fa-solid fa-copy" style="font-size:9px; cursor:pointer;" onclick="copyContractSymbol('${bestCall.contract_symbol}', this.parentElement)" title="Copy Contract"></i>
      `;
      document.getElementById('call-setup-ask').innerText = `$${bestCall.ask.toFixed(2)}`;
      document.getElementById('call-setup-be').innerText = `$${(bestCall.strike + bestCall.ask).toFixed(2)}`;
    } else {
      document.getElementById('call-setup-strike').innerText = 'No Setup Available';
      document.getElementById('call-setup-symbol').innerText = '-';
      document.getElementById('call-setup-ask').innerText = '-';
      document.getElementById('call-setup-be').innerText = '-';
    }
    
    if (bestPut) {
      document.getElementById('put-setup-strike').innerText = `$${bestPut.strike} Put`;
      document.getElementById('put-setup-symbol').innerHTML = `
        <span>${bestPut.contract_symbol}</span> 
        <i class="fa-solid fa-copy" style="font-size:9px; cursor:pointer;" onclick="copyContractSymbol('${bestPut.contract_symbol}', this.parentElement)" title="Copy Contract"></i>
      `;
      document.getElementById('put-setup-ask').innerText = `$${bestPut.ask.toFixed(2)}`;
      document.getElementById('put-setup-be').innerText = `$${(bestPut.strike - bestPut.ask).toFixed(2)}`;
    } else {
      document.getElementById('put-setup-strike').innerText = 'No Setup Available';
      document.getElementById('put-setup-symbol').innerText = '-';
      document.getElementById('put-setup-ask').innerText = '-';
      document.getElementById('put-setup-be').innerText = '-';
    }
    
    renderOptionsChainTable(chainResult, spot);

  } catch (err) {
    console.error(err);
    alert(`Failed to fetch options data for ${symbol}: ${err.message}`);
  } finally {
    if (progress) progress.finish();
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
    }, 600);
  }
}

async function fetchOptionsChainOnly() {
  const symbolInput = document.getElementById('options-symbol-input');
  const symbol = symbolInput ? symbolInput.value.trim().toUpperCase() : 'SPY';
  const expiry = document.getElementById('options-expiry-select').value;
  if (!symbol || !expiry) return;

  const overlay = document.getElementById('options-loading-overlay');
  if (overlay) overlay.style.display = 'flex';
  const progress = animateProgressBar('options-progress-bar', 'options-progress-text', 3000);

  try {
    const chainResult = await callMCPTool('stock_options_chain', { symbol, expiry });
    const spotPriceText = document.getElementById('options-spot-price').innerText;
    const spot = parseFloat(spotPriceText.replace('$', '')) || chainResult.underlying_price || 0;
    
    renderOptionsChainTable(chainResult, spot);
  } catch (err) {
    console.error(err);
    alert(`Failed to fetch options chain for expiry ${expiry}: ${err.message}`);
  } finally {
    if (progress) progress.finish();
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
    }, 600);
  }
}

function renderOptionsChainTable(chain, spot) {
  const tbody = document.getElementById('options-chain-table').querySelector('tbody');
  tbody.innerHTML = '';
  
  const calls = chain.calls || [];
  const puts = chain.puts || [];
  
  const strikeMap = {};
  
  calls.forEach(c => {
    const strike = c.strike;
    if (!strikeMap[strike]) strikeMap[strike] = { strike, call: null, put: null };
    strikeMap[strike].call = c;
  });
  
  puts.forEach(p => {
    const strike = p.strike;
    if (!strikeMap[strike]) strikeMap[strike] = { strike, call: null, put: null };
    strikeMap[strike].put = p;
  });
  
  const rows = Object.values(strikeMap);
  rows.sort((a, b) => a.strike - b.strike);
  
  rows.forEach(item => {
    const tr = document.createElement('tr');
    
    const c = item.call;
    const cLast = c ? `$${c.last_price.toFixed(2)}` : '-';
    const cBidAsk = c ? `$${c.bid.toFixed(2)} / $${c.ask.toFixed(2)}` : '-';
    const cVol = c ? c.volume.toLocaleString() : '-';
    const cIv = c ? `${(c.implied_volatility * 100).toFixed(1)}%` : '-';
    const cItmClass = c && c.in_the_money ? 'style="background: rgba(16, 185, 129, 0.05); font-weight: 500;"' : '';
    
    const p = item.put;
    const pLast = p ? `$${p.last_price.toFixed(2)}` : '-';
    const pBidAsk = p ? `$${p.bid.toFixed(2)} / $${p.ask.toFixed(2)}` : '-';
    const pVol = p ? p.volume.toLocaleString() : '-';
    const pIv = p ? `${(p.implied_volatility * 100).toFixed(1)}%` : '-';
    const pItmClass = p && p.in_the_money ? 'style="background: rgba(239, 68, 68, 0.05); font-weight: 500;"' : '';
    
    const isAtTheMoney = Math.abs(item.strike - spot) / spot < 0.01;
    const strikeClass = isAtTheMoney ? 'style="background: rgba(245, 158, 11, 0.15); font-weight: 800; color: var(--accent-amber); border-right: 1px solid var(--border-color);"' : 'style="background: rgba(0, 0, 0, 0.3); font-weight: 700; border-right: 1px solid var(--border-color);"';

    tr.innerHTML = `
      <td ${cItmClass} style="font-family: var(--font-mono); padding: 12px 14px;">
        <div style="font-weight: 700;">${cLast}</div>
        ${c ? `
        <div style="font-size: 9px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 2px;" onclick="copyContractSymbol('${c.contract_symbol}', this)" title="Click to copy contract symbol">
          <span>${c.contract_symbol}</span> <i class="fa-solid fa-copy" style="font-size: 8px;"></i>
        </div>
        ` : ''}
      </td>
      <td ${cItmClass} style="font-family: var(--font-mono); font-size:11px; color: var(--text-secondary);">${cBidAsk}</td>
      <td ${cItmClass} style="font-family: var(--font-mono);">${cVol}</td>
      <td ${cItmClass} style="font-family: var(--font-mono); color: var(--accent-amber); border-right: 1px solid var(--border-color);">${cIv}</td>
      <td ${strikeClass}>$${item.strike}</td>
      <td ${pItmClass} style="font-family: var(--font-mono); padding: 12px 14px;">
        <div style="font-weight: 700;">${pLast}</div>
        ${p ? `
        <div style="font-size: 9px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 2px;" onclick="copyContractSymbol('${p.contract_symbol}', this)" title="Click to copy contract symbol">
          <span>${p.contract_symbol}</span> <i class="fa-solid fa-copy" style="font-size: 8px;"></i>
        </div>
        ` : ''}
      </td>
      <td ${pItmClass} style="font-family: var(--font-mono); font-size:11px; color: var(--text-secondary);">${pBidAsk}</td>
      <td ${pItmClass} style="font-family: var(--font-mono);">${pVol}</td>
      <td ${pItmClass} style="font-family: var(--font-mono); color: var(--accent-amber);">${pIv}</td>
    `;
    tbody.appendChild(tr);
  });
}

window.copyContractSymbol = function(symbol, element) {
  navigator.clipboard.writeText(symbol).then(() => {
    const icon = element.querySelector('i');
    const span = element.querySelector('span');
    const originalText = span.innerText;
    span.innerText = "COPIED!";
    span.style.color = "var(--accent-green)";
    if (icon) {
      icon.className = "fa-solid fa-check";
      icon.style.color = "var(--accent-green)";
    }
    setTimeout(() => {
      span.innerText = originalText;
      span.style.color = "";
      if (icon) {
        icon.className = "fa-solid fa-copy";
        icon.style.color = "";
      }
    }, 1200);
  });
};

// 6. Tab: Scalping Scanner
function initScalpingScanner() {
  loadScalpingReport(false);
}

async function loadScalpingReport(forceScan = false) {
  setLoading('scalping-scanner-body', true);
  const tbody = document.getElementById('scalping-table-body');
  tbody.innerHTML = '';
  
  const btn = document.getElementById('run-scalping-btn');
  const originalHtml = btn.innerHTML;
  const overlay = document.getElementById('scalping-loading-overlay');
  
  let progress = null;
  if (forceScan) {
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Scanning...';
    btn.disabled = true;
    if (overlay) overlay.style.display = 'flex';
    progress = animateProgressBar('scalping-progress-bar', 'scalping-progress-text', 10000);
  }
  
  try {
    const url = forceScan ? '/api/generate-scalping-scan' : '/static/scalping_report.json';
    const res = await fetch(url, {
      method: forceScan ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    // If we fetched the static file on load, and it doesn't exist yet, run a scan!
    if (!res.ok && !forceScan) {
      loadScalpingReport(true);
      return;
    }
    
    const data = await res.json();
    const report = forceScan ? data.report : data;
    
    if (report && Array.isArray(report.pairs) && report.pairs.length > 0) {
      document.getElementById('scalping-timestamp').innerText = `Last Updated: ${report.timestamp || 'Just now'}`;
      tbody.innerHTML = '';
      
      const safeBtoa = (str) => btoa(unescape(encodeURIComponent(str)));
      
      report.pairs.forEach(pair => {
        const isBuy = pair.direction === 'BUY';
        const isSell = pair.direction === 'SELL';
        const dirClass = isBuy ? 'positive' : (isSell ? 'negative' : 'neutral');
        const dirIcon = isBuy ? '<i class="fa-solid fa-circle-up"></i>' : (isSell ? '<i class="fa-solid fa-circle-down"></i>' : '<i class="fa-solid fa-circle-minus"></i>');
        
        let catBadge = '';
        if (pair.category === 'Crypto') {
          catBadge = '<span style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--accent-green); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;"><i class="fa-brands fa-bitcoin"></i> Crypto</span>';
        } else if (pair.category === 'Metal') {
          catBadge = '<span style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: var(--accent-amber); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;"><i class="fa-solid fa-coins"></i> Metal</span>';
        } else {
          catBadge = '<span style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: var(--accent-blue); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;"><i class="fa-solid fa-earth-americas"></i> Forex</span>';
        }
        
        const tr = document.createElement('tr');
        tr.style.transition = 'background 0.2s';
        
        // Copy target text
        const copyText = `🚨 SCALPING SETUP (${pair.category}) 🚨\nSymbol: ${pair.symbol}\nDirection: ${pair.direction}\nEntry: ${pair.entry}\nSL: ${pair.sl}\nTP1: ${pair.tp1}\nTP2: ${pair.tp2}\nConfidence: ${pair.confidence}%`;
        
        tr.innerHTML = `
          <td>${catBadge}</td>
          <td class="sym-cell" style="font-weight:700;">${pair.symbol}</td>
          <td>
            <span class="indicator-val ${dirClass}" style="font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
              ${dirIcon} ${pair.direction}
            </span>
          </td>
          <td style="font-family: var(--font-mono); font-weight: 600;">${pair.price}</td>
          <td style="font-family: var(--font-mono); color: var(--accent-amber); font-weight: 600;">${pair.entry}</td>
          <td style="font-family: var(--font-mono); color: var(--accent-red); font-weight: 600;">${pair.sl}</td>
          <td style="font-family: var(--font-mono); color: var(--accent-green); font-weight: 600;">${pair.tp1}</td>
          <td style="font-family: var(--font-mono); color: var(--accent-green); font-weight: 600;">${pair.tp2}</td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <div style="flex-grow:1; background:rgba(255,255,255,0.05); height:6px; border-radius:3px; min-width: 50px;">
                <div style="background:var(--accent-amber); height:100%; width:${pair.confidence}%; border-radius:3px; box-shadow:0 0 8px var(--accent-amber);"></div>
              </div>
              <span style="font-weight:700; font-size:12px; color:var(--text-secondary); min-width:28px;">${pair.confidence}%</span>
            </div>
          </td>
          <td style="text-align: center;">
            <button class="primary-btn" onclick="copyToClipboard('${safeBtoa(copyText)}', this)" style="padding: 4px 8px; font-size: 11px; border-radius: 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary);">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = `<tr><td colspan="100%" class="placeholder-text">No active scalping setups. Click 'Scan Markets' to start a new scan.</td></tr>`;
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="100%" class="placeholder-text error" style="color: var(--accent-red)">Error: ${err.message}</td></tr>`;
  } finally {
    setLoading('scalping-scanner-body', false);
    if (progress) progress.finish();
    if (forceScan) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
      }, 800);
    }
  }
}

// Global copy helper
window.copyToClipboard = function(base64Text, btn) {
  const text = atob(base64Text);
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
    btn.style.color = 'var(--accent-green)';
    btn.style.borderColor = 'var(--accent-green)';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1500);
  });
};

// 7. Tab: Gold Analyst
function initGoldAnalyst() {
  updateMarketClocks();
  setInterval(updateMarketClocks, 1000);
  loadGoldReportData();
  initTradingViewWidgets();
  
  const goldBtn = document.getElementById('generate-gold-report-btn');
  if (goldBtn) {
    goldBtn.addEventListener('click', generateLiveGoldReport);
  }
}

async function generateLiveGoldReport() {
  const overlay = document.getElementById('gold-loading-overlay');
  if (overlay) overlay.style.display = 'flex';
  
  const tfSelect = document.getElementById('gold-timeframe');
  const timeframe = tfSelect ? tfSelect.value : '15m';

  // Gold report takes 30-60s — use 45s progress duration
  const progress = animateProgressBar('gold-progress-bar', 'gold-progress-text', 45000);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout
    
    const response = await fetch('/api/generate-gold-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeframe }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if (data.success) {
      await loadGoldReportData(data.report);
    } else {
      console.error('Report generation failed:', data.error);
      const verdictBadge = document.getElementById('verdict-badge');
      if (verdictBadge) {
        verdictBadge.textContent = "ERROR";
        verdictBadge.className = "badge-large neutral";
      }
    }
  } catch (err) {
    console.error('Network error or timeout:', err);
    const verdictBadge = document.getElementById('verdict-badge');
    if (verdictBadge) {
      verdictBadge.textContent = "TIMEOUT";
      verdictBadge.className = "badge-large neutral";
    }
  } finally {
    if (progress) progress.finish();
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
    }, 800);
  }
}

async function loadGoldReportData(report = null) {
  try {
    if (!report) {
      const response = await fetch('/static/gold_report.json');
      if (!response.ok) return; // Silent return if file doesn't exist yet
      report = await response.json();
    }
    
    // Sync timeframe dropdown if report specifies it
    const selectedTf = report.primary_objective.selected_timeframe;
    if (selectedTf) {
      const tfSelect = document.getElementById('gold-timeframe');
      if (tfSelect) tfSelect.value = selectedTf;
    }
    
    // Save report globally for Telegram
    window.currentGoldReport = report;

    // 1. Verdict Card
    const verdict = report.primary_objective.verdict || 'WAIT';
    const verdictBadge = document.getElementById('verdict-badge');
    if (verdictBadge) {
      verdictBadge.textContent = verdict;
      verdictBadge.className = `badge-large ${verdict.toLowerCase()}`;
    }
    
    const successPct = document.getElementById('success-pct');
    if (successPct) {
      const tfLabel = selectedTf ? ` • ${selectedTf.toUpperCase()} TF` : '';
      successPct.textContent = `Success Probability: ${report.primary_objective.probability}${tfLabel}`;
    }
    
    const tgBtn = document.getElementById('send-telegram-btn');
    if (tgBtn) tgBtn.style.display = 'inline-block';
    
    const tgBtnHeader = document.getElementById('send-telegram-btn-header');
    if (tgBtnHeader) tgBtnHeader.style.display = 'inline-flex';
    
    const vEntry = document.getElementById('v-entry');
    if (vEntry) vEntry.textContent = report.primary_objective.entry !== "N/A" ? `$${report.primary_objective.entry}` : 'N/A';
    
    const vSl = document.getElementById('v-sl');
    if (vSl) vSl.textContent = report.primary_objective.sl !== "N/A" ? `$${report.primary_objective.sl}` : 'N/A';
    
    const vRr = document.getElementById('v-rr');
    if (vRr) vRr.textContent = report.primary_objective.reward_ratio;
    
    const vTp1 = document.getElementById('v-tp1');
    if (vTp1) vTp1.textContent = report.primary_objective.tp1 !== "N/A" ? `$${report.primary_objective.tp1}` : 'N/A';
    
    const vTp2 = document.getElementById('v-tp2');
    if (vTp2) vTp2.textContent = report.primary_objective.tp2 !== "N/A" ? `$${report.primary_objective.tp2}` : 'N/A';
    
    const vTp3 = document.getElementById('v-tp3');
    if (vTp3) vTp3.textContent = report.primary_objective.tp3 !== "N/A" ? `$${report.primary_objective.tp3}` : 'N/A';
    
    // 2. Part 1 - Market Structure
    const msD = document.getElementById('ms-d');
    if (msD) msD.textContent = report.part_1_market_structure.daily_trend;
    
    const ms4h = document.getElementById('ms-4h');
    if (ms4h) ms4h.textContent = report.part_1_market_structure.trend_4h;
    
    const ms1h = document.getElementById('ms-1h');
    if (ms1h) ms1h.textContent = report.part_1_market_structure.trend_1h;
    
    const ms15m = document.getElementById('ms-15m');
    if (ms15m) ms15m.textContent = report.part_1_market_structure.trend_15m;
    
    const msHighsLows = document.getElementById('ms-highs-lows');
    if (msHighsLows) msHighsLows.textContent = report.part_1_market_structure.highs_lows;
    
    const msShifts = document.getElementById('ms-shifts');
    if (msShifts) msShifts.textContent = report.part_1_market_structure.structure_shifts;
    
    const msCharacter = document.getElementById('ms-character');
    if (msCharacter) msCharacter.textContent = report.part_1_market_structure.character_changes;
    
    // 3. Part 2 - Technicals
    const taMas = document.getElementById('ta-mas');
    if (taMas) taMas.textContent = report.part_2_technical_analysis.moving_averages;
    
    const taOsc = document.getElementById('ta-oscillators');
    if (taOsc) taOsc.textContent = report.part_2_technical_analysis.oscillators;
    
    const taBb = document.getElementById('ta-bb');
    if (taBb) taBb.textContent = report.part_2_technical_analysis.bollinger_bands;
    
    const taSr = document.getElementById('ta-sr');
    if (taSr) taSr.textContent = report.part_2_technical_analysis.pivots;
    
    const taFvg = document.getElementById('ta-fvg');
    if (taFvg) taFvg.textContent = report.part_2_technical_analysis.fvg_orderblocks;
    
    // 4. Part 3 - SMC
    const smLiq = document.getElementById('sm-liquidity');
    if (smLiq) smLiq.textContent = report.part_3_smart_money_analysis.liquidity;
    
    const smFlow = document.getElementById('sm-flow');
    if (smFlow) smFlow.textContent = report.part_3_smart_money_analysis.order_flow;
    
    const smAmd = document.getElementById('sm-amd');
    if (smAmd) smAmd.textContent = report.part_3_smart_money_analysis.power_of_three;
    
    // 5. Part 4 & 5 - PA & Vol
    const paCandles = document.getElementById('pa-candlesticks');
    if (paCandles) paCandles.textContent = report.part_4_price_action.candlestick_patterns;
    
    const paPat = document.getElementById('pa-patterns');
    if (paPat) paPat.textContent = report.part_4_price_action.chart_patterns;
    
    const volProf = document.getElementById('vol-profile');
    if (volProf) volProf.textContent = report.part_5_volume_analysis.volume_profile;
    
    const volDelta = document.getElementById('vol-delta');
    if (volDelta) volDelta.textContent = report.part_5_volume_analysis.buying_selling_pressure;
    
    // 6. Part 6 - Macro
    const fndYields = document.getElementById('fnd-yields');
    if (fndYields) fndYields.textContent = report.part_6_fundamental_analysis.yields_dxy;
    
    const fndMacro = document.getElementById('fnd-macro');
    if (fndMacro) fndMacro.textContent = report.part_6_fundamental_analysis.macro_summary;
    
    const fndSpeeches = document.getElementById('fnd-speeches');
    if (fndSpeeches) fndSpeeches.textContent = report.part_6_fundamental_analysis.speeches_events;
    
    // 7. Part 7 & 8 - Sentiment
    const sentCot = document.getElementById('sent-cot');
    if (sentCot) sentCot.textContent = report.part_7_market_sentiment.sentiment_summary;
    
    const sentFear = document.getElementById('sent-fear');
    if (sentFear) sentFear.textContent = report.part_7_market_sentiment.fear_greed;
    
    const intermarketCorr = document.getElementById('intermarket-corr');
    if (intermarketCorr) intermarketCorr.textContent = report.part_8_intermarket_analysis.correlations;
    
    // 8. Part 9 - Options
    const optExp = document.getElementById('opt-exposure');
    if (optExp) optExp.textContent = report.part_9_options_futures.comex_options;
    
    // 9. Part 10, 11, 13 - Risk & Invalidation
    const riskVol = document.getElementById('risk-vol');
    if (riskVol) riskVol.textContent = report.part_10_risk_analysis.volatility;
    
    const riskInv = document.getElementById('risk-invalidation');
    if (riskInv) riskInv.textContent = `$${report.part_13_invalidation.price}`;
    
    const riskNews = document.getElementById('risk-news');
    if (riskNews) riskNews.textContent = report.part_13_invalidation.news_event;
    
    const execSizing = document.getElementById('exec-sizing');
    if (execSizing) execSizing.textContent = report.part_11_trade_execution_plan.position_sizing;
    
    // 10. Part 12 - Pros vs Cons Lists
    const prosList = document.getElementById('trade-pros');
    if (prosList) {
      prosList.innerHTML = '';
      report.part_12_reasons_for_trade.pros.forEach(pro => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${pro}`;
        prosList.appendChild(li);
      });
    }
    
    const consList = document.getElementById('trade-cons');
    if (consList) {
      consList.innerHTML = '';
      report.part_12_reasons_for_trade.cons.forEach(con => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${con}`;
        consList.appendChild(li);
      });
    }
    
  } catch (err) {
    console.error('Error rendering report:', err);
  }
}

function updateMarketClocks() {
  const now = new Date();
  
  // Tokyo: 00:00 to 09:00 UTC
  updateClock('tokyo', now, 0, 0, 9, 0);
  
  // London: 07:00 to 15:30 UTC
  updateClock('london', now, 7, 0, 15, 30);
  
  // New York: 13:30 to 20:00 UTC
  updateClock('ny', now, 13, 30, 20, 0);
}

function updateClock(elementPrefix, nowUtc, openHour, openMin, closeHour, closeMin) {
  // Create today's open and close dates in UTC
  const todayOpen = new Date(nowUtc);
  todayOpen.setUTCHours(openHour, openMin, 0, 0);
  
  const todayClose = new Date(nowUtc);
  todayClose.setUTCHours(closeHour, closeMin, 0, 0);
  
  let status = 'CLOSED';
  let diffMs = 0;
  let textPrefix = 'Opens in';
  
  // Determine if currently open
  const isOpen = nowUtc >= todayOpen && nowUtc < todayClose;
  
  if (isOpen) {
    status = 'OPEN';
    textPrefix = 'Closes in';
    diffMs = todayClose - nowUtc;
  } else {
    status = 'CLOSED';
    textPrefix = 'Opens in';
    
    if (nowUtc >= todayClose) {
      // Next open is tomorrow
      const tomorrowOpen = new Date(todayOpen);
      tomorrowOpen.setUTCDate(tomorrowOpen.getUTCDate() + 1);
      diffMs = tomorrowOpen - nowUtc;
    } else {
      // Next open is today
      diffMs = todayOpen - nowUtc;
    }
  }
  
  // Format diffMs as HH:MM:SS
  const diffSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSecs / 3600);
  const mins = Math.floor((diffSecs % 3600) / 60);
  const secs = diffSecs % 60;
  
  const timeStr = `${textPrefix} ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  
  const timeEl = document.getElementById(`${elementPrefix}-time`);
  if (timeEl) {
    timeEl.textContent = timeStr;
  }
  
  const statusEl = document.getElementById(`${elementPrefix}-status`);
  if (statusEl) {
    statusEl.textContent = status;
    const parentClockCard = statusEl.closest('.session-clock');
    if (status === 'OPEN') {
      statusEl.className = 'status open';
      if (parentClockCard) parentClockCard.classList.add('active');
    } else {
      statusEl.className = 'status closed';
      if (parentClockCard) parentClockCard.classList.remove('active');
    }
  }
}

// 8. TradingView Interactive Widgets
function initTradingViewWidgets() {
  if (typeof TradingView !== 'undefined' && document.getElementById('tradingview_gold_chart')) {
    new TradingView.widget({
      "width": "100%",
      "height": "100%",
      "symbol": "TVC:GOLD",
      "interval": "D",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "toolbar_bg": "#020617",
      "enable_publishing": false,
      "hide_side_toolbar": false,
      "allow_symbol_change": true,
      "container_id": "tradingview_gold_chart"
    });
  }
}

function updateAnalysisChartWidget(symbol, exchange) {
  if (typeof TradingView !== 'undefined' && document.getElementById('tradingview_analysis_chart')) {
    document.getElementById('tradingview_analysis_chart').innerHTML = '';
    
    let widgetSymbol = symbol;
    if (!symbol.includes(':') && exchange) {
      widgetSymbol = `${exchange}:${symbol}`;
    }
    
    document.getElementById('analysis-chart-title').innerHTML = `<i class="fa-solid fa-chart-line"></i> ${widgetSymbol} Live Interactive Chart`;
    
    new TradingView.widget({
      "width": "100%",
      "height": "100%",
      "symbol": widgetSymbol,
      "interval": "60",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "toolbar_bg": "#020617",
      "enable_publishing": false,
      "hide_side_toolbar": false,
      "allow_symbol_change": true,
      "container_id": "tradingview_analysis_chart"
    });
  }
}

// --- Market News ---
async function fetchMarketNews() {
  const container = document.getElementById('news-container');
  if (!container) return;
  
  container.innerHTML = '<div class="card glass-card" style="padding: 24px; text-align: center; grid-column: span 2; color: var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching latest global market news...</div>';
  
  try {
    const res = await fetch('/api/market-news', { method: 'POST' });
    const data = await res.json();
    
    if (data.news && data.news.length > 0) {
      container.innerHTML = '';
      data.news.forEach(item => {
        const domain = new URL(item.url).hostname.replace('www.', '');
        const card = document.createElement('a');
        card.href = item.url;
        card.target = "_blank";
        card.className = "card glass-card news-card";
        card.innerHTML = `
          <div class="news-card-title">${item.title}</div>
          <div style="font-size: 13px; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.content}</div>
          <div class="news-card-meta">
            <span style="color: var(--accent-amber); font-weight: 600;">${domain}</span>
            <span><i class="fa-solid fa-arrow-up-right-from-square"></i> Read</span>
          </div>
        `;
        container.appendChild(card);
      });
    } else {
      container.innerHTML = '<div class="card glass-card" style="padding: 24px; text-align: center; grid-column: span 2; color: var(--text-muted);">No major news found at the moment.</div>';
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="card glass-card" style="padding: 24px; text-align: center; grid-column: span 2; color: var(--accent-red);">Failed to fetch news. Please try again.</div>';
  }
}

// Add it to the initial load
setTimeout(() => {
  if (document.getElementById('market-pulse') && document.getElementById('market-pulse').classList.contains('active')) {
    fetchMarketNews();
  }
}, 1500);

// --- Telegram Integration ---
async function sendToTelegram(btnElement) {
  if (!window.currentGoldReport) {
    alert("No report generated yet! Please run the Analyst Engine first.");
    return;
  }
  
  // Default to the old button if no element is passed
  const btn = btnElement || document.getElementById('send-telegram-btn');
  const mode = btn.id === 'send-telegram-btn-header' ? 'full' : 'scalping';
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';
  btn.disabled = true;
  
  try {
    const res = await fetch('/api/send-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: window.currentGoldReport, mode: mode })
    });
    const data = await res.json();
    
    if (res.ok) {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Sent!';
      btn.style.background = 'rgba(16, 185, 129, 0.1)';
      btn.style.borderColor = 'var(--accent-green)';
      btn.style.color = 'var(--accent-green)';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = 'rgba(59, 130, 246, 0.1)';
        btn.style.borderColor = 'var(--accent-blue)';
        btn.style.color = 'var(--accent-blue)';
        btn.disabled = false;
      }, 3000);
    } else {
      throw new Error(data.error || "Failed to send to Telegram");
    }
  } catch (err) {
    console.error(err);
    alert("Error sending to Telegram: " + err.message + "\n\nMake sure you have sent a message to the bot first!");
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// 8. Tab: Mutual Funds Dashboard
let mfChartInstance = null;
let currentMfNavData = [];

async function loadTop10Navs() {
  const codes = [151165, 120586, 118989, 118834, 118778, 150677, 122639, 120334, 119609, 119091];
  
  await Promise.all(codes.map(async (code) => {
    try {
      const response = await fetch(`https://api.tigzig.com/mf/v1/nav?scheme_code=${code}`);
      const result = await response.json();
      if (result && result.data && result.data.length >= 2) {
        const data = result.data;
        const latest = data[data.length - 1];
        const prev = data[data.length - 2];
        const val = latest.nav;
        const chg = ((val - prev.nav) / prev.nav) * 100;
        
        const valEl = document.getElementById(`nav-val-${code}`);
        if (valEl) valEl.textContent = `NAV: ₹${val.toFixed(2)}`;
        
        const chgEl = document.getElementById(`nav-chg-${code}`);
        if (chgEl) {
          chgEl.className = 'change-badge';
          if (chg >= 0) {
            chgEl.classList.add('positive');
            chgEl.innerHTML = `<i class="fa-solid fa-caret-up"></i> +${chg.toFixed(2)}%`;
          } else {
            chgEl.classList.add('negative');
            chgEl.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${chg.toFixed(2)}%`;
          }
        }
      }
    } catch (err) {
      console.error(`Failed to load live NAV for code ${code}:`, err);
    }
  }));
}

function initMutualFunds() {
  const searchInput = document.getElementById('mf-search-input');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchMutualFunds();
      }
    });
  }
  // Load real-time NAV and change percentage for the Top 10 Picks
  loadTop10Navs();
}

async function searchMutualFunds() {
  const query = document.getElementById('mf-search-input').value.trim();
  if (!query) return;

  const select = document.getElementById('mf-search-results');
  select.style.display = 'none';
  select.innerHTML = '<option value="">Loading funds...</option>';
  select.style.display = 'block';

  try {
    const res = await fetch(`https://api.tigzig.com/mf/v1/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    select.innerHTML = '';
    
    if (data && Array.isArray(data.results) && data.results.length > 0) {
      const placeholderOpt = document.createElement('option');
      placeholderOpt.value = "";
      placeholderOpt.innerText = `-- Select Scheme (${data.results.length} found) --`;
      select.appendChild(placeholderOpt);

      data.results.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.scheme_code;
        opt.innerText = item.scheme_name;
        select.appendChild(opt);
      });
    } else {
      select.innerHTML = '<option value="">No funds found.</option>';
    }
  } catch (err) {
    console.error(err);
    select.innerHTML = '<option value="">Error searching funds.</option>';
  }
}

async function loadMutualFundDetails(schemeCode) {
  if (!schemeCode) return;

  const overlay = document.getElementById('mf-loading-overlay');
  if (overlay) overlay.style.display = 'flex';
  const progress = animateProgressBar('mf-progress-bar', 'mf-progress-text', 4000);

  try {
    const res = await fetch(`https://api.tigzig.com/mf/v1/nav?scheme_code=${schemeCode}`);
    const data = await res.json();

    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      alert("No NAV history available for this scheme.");
      return;
    }

    // Sort ascending by date
    currentMfNavData = data.data.map(d => ({
      date: new Date(d.date),
      dateStr: d.date,
      nav: parseFloat(d.nav)
    })).sort((a, b) => a.date - b.date);

    document.getElementById('mf-placeholder').style.display = 'none';
    document.getElementById('mf-dashboard').style.display = 'grid';

    // Update Info Card
    document.getElementById('mf-info-name').innerText = data.scheme_name || 'Mutual Fund Scheme';
    document.getElementById('mf-info-code').innerText = data.scheme_code || schemeCode;
    document.getElementById('mf-info-isin').innerText = data.isin || 'N/A';

    const latestVal = currentMfNavData[currentMfNavData.length - 1];
    document.getElementById('mf-info-nav').innerText = `₹${latestVal.nav.toFixed(4)}`;
    document.getElementById('mf-info-nav-date').innerText = `As of ${latestVal.dateStr}`;

    // Compute Trailing Trajectory Returns
    renderTrailingReturns();

    // Compute Volatility & Drawdown Risks
    calculateRiskMetrics();

    // Render historical Chart
    renderNAVChart();

    // Run dynamic SIP calculator
    backtestSIP();

  } catch (err) {
    console.error(err);
    alert(`Failed to retrieve mutual fund data: ${err.message}`);
  } finally {
    if (progress) progress.finish();
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
    }, 600);
  }
}

function renderTrailingReturns() {
  const tableBody = document.getElementById('mf-returns-table-body');
  tableBody.innerHTML = '';

  const latest = currentMfNavData[currentMfNavData.length - 1];
  const latestDate = latest.date;

  const periods = [
    { label: '1 Month', days: 30 },
    { label: '3 Months', days: 90 },
    { label: '6 Months', days: 180 },
    { label: '1 Year', days: 365 },
    { label: '3 Years', days: 365 * 3 },
    { label: '5 Years', days: 365 * 5 }
  ];

  periods.forEach(p => {
    // Find closest starting date
    const targetDate = new Date(latestDate.getTime() - p.days * 24 * 60 * 60 * 1000);
    let startIdx = 0;
    let minDiff = Infinity;
    
    currentMfNavData.forEach((d, idx) => {
      const diff = Math.abs(d.date - targetDate);
      if (diff < minDiff) {
        minDiff = diff;
        startIdx = idx;
      }
    });

    const startVal = currentMfNavData[startIdx];
    const totalReturn = ((latest.nav - startVal.nav) / startVal.nav) * 100;
    
    // CAGR calculation (if duration > 1Y)
    let cagr = totalReturn;
    const years = p.days / 365;
    if (years >= 1) {
      cagr = (Math.pow((latest.nav / startVal.nav), 1 / years) - 1) * 100;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.label}</strong></td>
      <td class="${totalReturn >= 0 ? 'positive' : 'negative'}">${totalReturn.toFixed(2)}%</td>
      <td class="${cagr >= 0 ? 'positive' : 'negative'}">${years >= 1 ? cagr.toFixed(2) + '%' : '-'}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function calculateRiskMetrics() {
  const dailyReturns = [];
  for (let i = 1; i < currentMfNavData.length; i++) {
    const prev = currentMfNavData[i - 1].nav;
    const curr = currentMfNavData[i].nav;
    dailyReturns.push((curr - prev) / prev);
  }

  if (dailyReturns.length === 0) return;

  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length;
  const sd = Math.sqrt(variance);
  const vol = sd * Math.sqrt(252);

  let maxDrawdown = 0;
  let peak = -Infinity;
  currentMfNavData.forEach(d => {
    if (d.nav > peak) peak = d.nav;
    const dd = (peak - d.nav) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  const dailyRfr = 0.06 / 252;
  const excessReturns = dailyReturns.map(r => r - dailyRfr);
  const excessMean = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
  const sharpe = sd > 0 ? (excessMean / sd) * Math.sqrt(252) : 0;

  const downsideReturns = dailyReturns.filter(r => r < dailyRfr);
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - dailyRfr, 2), 0) / dailyReturns.length;
  const downsideSd = Math.sqrt(downsideVariance);
  const sortino = downsideSd > 0 ? (excessMean / downsideSd) * Math.sqrt(252) : 0;

  document.getElementById('mf-risk-sd').innerText = (sd * 100).toFixed(4) + '%';
  document.getElementById('mf-risk-vol').innerText = (vol * 100).toFixed(2) + '%';
  document.getElementById('mf-risk-mdd').innerText = '-' + (maxDrawdown * 100).toFixed(2) + '%';
  document.getElementById('mf-risk-sharpe').innerText = sharpe.toFixed(2);
  document.getElementById('mf-risk-sortino').innerText = sortino.toFixed(2);
}

function renderNAVChart() {
  const ctx = document.getElementById('mf-nav-chart').getContext('2d');
  
  if (mfChartInstance) {
    mfChartInstance.destroy();
  }

  let sampledData = currentMfNavData;
  if (currentMfNavData.length > 1200) {
    const step = Math.ceil(currentMfNavData.length / 1000);
    sampledData = currentMfNavData.filter((_, idx) => idx % step === 0);
  }

  const labels = sampledData.map(d => d.dateStr);
  const prices = sampledData.map(d => d.nav);

  mfChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Net Asset Value (NAV)',
        data: prices,
        borderColor: '#00e5ff',
        borderWidth: 2,
        backgroundColor: 'rgba(0, 229, 255, 0.05)',
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#0d1423',
          titleColor: '#fff',
          bodyColor: '#909ab0',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#5e6b82', font: { size: 10 }, maxTicksLimit: 12 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#5e6b82', font: { size: 10 } }
        }
      }
    }
  });
}

function backtestSIP() {
  if (currentMfNavData.length === 0) return;

  const monthlyAmount = parseFloat(document.getElementById('mf-sip-amount').value) || 5000;
  const sipDay = parseInt(document.getElementById('mf-sip-day').value) || 5;
  const durationType = document.getElementById('mf-sip-years').value;

  const latest = currentMfNavData[currentMfNavData.length - 1];
  const latestDate = latest.date;

  let totalYears = 3;
  let filterStartDate = null;

  if (durationType === 'all') {
    filterStartDate = currentMfNavData[0].date;
    totalYears = (latestDate - filterStartDate) / (365 * 24 * 60 * 60 * 1000);
  } else {
    totalYears = parseInt(durationType);
    filterStartDate = new Date(latestDate.getTime() - totalYears * 365 * 24 * 60 * 60 * 1000);
  }

  const activeNAVData = currentMfNavData.filter(d => d.date >= filterStartDate);
  if (activeNAVData.length === 0) return;

  let totalInvested = 0;
  let totalUnits = 0;
  let lastMonthKey = "";
  
  activeNAVData.forEach(d => {
    const year = d.date.getFullYear();
    const month = d.date.getMonth();
    const monthKey = `${year}-${month}`;

    if (monthKey !== lastMonthKey) {
      const targetSipDate = new Date(year, month, sipDay);
      const monthData = activeNAVData.filter(x => x.date.getFullYear() === year && x.date.getMonth() === month);
      
      if (monthData.length > 0) {
        let bestDayData = monthData[0];
        let minDiff = Infinity;
        
        monthData.forEach(day => {
          const diff = Math.abs(day.date - targetSipDate);
          if (diff < minDiff) {
            minDiff = diff;
            bestDayData = day;
          }
        });

        totalInvested += monthlyAmount;
        totalUnits += monthlyAmount / bestDayData.nav;
        lastMonthKey = monthKey;
      }
    }
  });

  const latestNAV = latest.nav;
  const currentValue = totalUnits * latestNAV;
  const pnlPercent = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

  let sipCAGR = 0;
  if (totalInvested > 0 && totalYears > 0) {
    sipCAGR = (Math.pow((currentValue / totalInvested), 1 / (totalYears / 2)) - 1) * 100;
  }

  document.getElementById('mf-sip-invested').innerText = `₹${totalInvested.toLocaleString('en-IN')}`;
  document.getElementById('mf-sip-value').innerText = `₹${Math.round(currentValue).toLocaleString('en-IN')}`;
  
  const pnlElement = document.getElementById('mf-sip-pnl');
  pnlElement.innerText = `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (₹${Math.round(currentValue - totalInvested).toLocaleString('en-IN')})`;
  pnlElement.className = pnlPercent >= 0 ? 'positive' : 'negative';
  pnlElement.style.fontWeight = '700';

  const cagrElement = document.getElementById('mf-sip-cagr');
  cagrElement.innerText = `${sipCAGR.toFixed(2)}%`;
  cagrElement.className = sipCAGR >= 0 ? 'positive' : 'negative';
  cagrElement.style.fontWeight = '700';
}

