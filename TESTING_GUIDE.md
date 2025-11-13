# Trading Bot - Testing Guide

## 🧪 How to Test All Features

### Prerequisites
- Application running at: https://3000-iw5h6vqedjqkhusbdc812-8f57ffe2.sandbox.novita.ai
- Browser with JavaScript enabled
- Binance API credentials (optional for testing with real data)

---

## 📋 Testing Checklist

### 1. Basic Navigation ✅
- [ ] Access dashboard at `/`
- [ ] Navigate to Analytics at `/analytics`
- [ ] Navigate to AI Logs at `/ai-logs`
- [ ] Navigate to Settings at `/settings`
- [ ] Verify all navigation links work

### 2. Dashboard Features ✅
- [ ] Portfolio balance displays correctly
- [ ] Daily profit/loss shows accurate data
- [ ] Win rate statistics are visible
- [ ] Coin price slider works (BTC, ETH, BNB, SOL, ADA)
- [ ] Price chart renders with data
- [ ] Trade history loads

### 3. AI Logs Page (NEW) ✅
**Test URL:** `/ai-logs`

#### Latest AI Decision Card
- [ ] Shows selected strategy (e.g., "SCALPING", "TREND")
- [ ] Displays confidence score (0-100%)
- [ ] Shows market regime badge (Bull/Bear/Neutral/Volatile)
- [ ] Volatility percentage visible
- [ ] Trend strength with up/down arrow
- [ ] AI Reasoning list displays (bullet points)
- [ ] Top 5 strategy scores shown in grid

#### Real-time Activity Stream
- [ ] Live logs appear when bot is running
- [ ] Each log has icon (Brain, Activity, Target, AlertCircle)
- [ ] Timestamp shows in HH:mm:ss format
- [ ] Strategy badges display correctly
- [ ] Market conditions show for each decision
- [ ] Confidence badges color-coded (green/yellow/red)
- [ ] Auto-scroll toggle works

#### Historical Decisions
- [ ] Past 20 decisions load
- [ ] Sorted by timestamp (newest first)
- [ ] Each decision shows strategy, confidence, regime
- [ ] Volatility data displays

### 4. Open Positions Tracking (NEW) ✅
**Location:** Dashboard (should have a new Open Positions card)

#### Position List
- [ ] Shows count "X / 10 positions"
- [ ] Total P&L displays at top
- [ ] Each position shows:
  - [ ] Symbol (e.g., BTC/USDT)
  - [ ] Strategy badge (uppercase)
  - [ ] Mode badge (REAL or PAPER)
  - [ ] Current P&L in USDT
  - [ ] P&L percentage
  - [ ] Entry price
  - [ ] Current price
  - [ ] Quantity
  - [ ] Holding time (e.g., "2h 15m")
  - [ ] Cost basis
  - [ ] Current value
  - [ ] Stop Loss with distance
  - [ ] Take Profit with distance
  - [ ] Progress bar (SL to TP)
  - [ ] Opened timestamp

#### Real-time Updates
- [ ] Prices update every ~3 seconds via WebSocket
- [ ] P&L recalculates automatically
- [ ] New positions appear when trades execute
- [ ] Positions disappear when closed

### 5. Enhanced Trade History ✅
**Location:** Dashboard - Trade History card

#### Trade Detail Display
- [ ] Each trade shows:
  - [ ] Symbol with BUY/SELL badge
  - [ ] Strategy badge
  - [ ] Price per unit (e.g., $45,200.0000)
  - [ ] Multiplication symbol (×)
  - [ ] Quantity (e.g., 0.000221)
  - [ ] Equals symbol (=)
  - [ ] Total cost/value (e.g., $9.99)
  - [ ] Date and time separately
  - [ ] Profit/Loss with + or -
  - [ ] Profit percentage

#### Filters
- [ ] Symbol filter works
- [ ] Strategy filter works
- [ ] Time filter works (24h, 7d, 30d, all)
- [ ] "Clear Filters" button appears when filtered
- [ ] Active filters display as badges

### 6. Bot Controls & Settings ✅

#### Start/Stop Bot
- [ ] Strategy selector works (Safe/Balanced/Aggressive)
- [ ] Mode selector works (Paper/Real)
- [ ] Start button enables bot
- [ ] Stop button disables bot
- [ ] Status shows "Running" or "Stopped"

#### API Configuration
- [ ] Can enter Binance API Key
- [ ] Can enter Binance Secret Key
- [ ] "Use Testnet" toggle works
- [ ] "Test Connection" button responds
- [ ] Success/error messages display

### 7. Multi-Timeframe AI (Backend) ✅
**Test by observing console logs:**

```bash
pm2 logs trading-bot --nostream
```

Look for:
- [ ] "🤖 AI Analysis:" messages
- [ ] "📊 Top 3 Strategies:" with scores
- [ ] "🟢 TREND BUY Signal" or similar
- [ ] "📈 Open Positions: X/10"
- [ ] No errors about NaN or undefined values

### 8. Trade Execution (Paper Mode) ✅

#### Execute Test Trade
1. **Setup:**
   - [ ] Go to Settings
   - [ ] Enable "Use Testnet"
   - [ ] Save configuration
   - [ ] Return to Dashboard

2. **Start Bot:**
   - [ ] Select "Scalping" strategy
   - [ ] Select "Paper" mode
   - [ ] Click "Start Bot"
   - [ ] Wait 10-30 seconds

3. **Verify Trade:**
   - [ ] Check console: `pm2 logs trading-bot --nostream`
   - [ ] Look for "🛒 BUYING" messages
   - [ ] Verify quantity calculation is valid
   - [ ] Check for "📍 BINANCE TESTNET POSITION OPENED"
   - [ ] Confirm no NaN or Infinity errors

4. **Check Dashboard:**
   - [ ] New position appears in Open Positions
   - [ ] Trade history shows BUY entry
   - [ ] Portfolio balance updated
   - [ ] Exact amounts displayed (Price × Qty = Total)

5. **Wait for SELL:**
   - [ ] Let bot run for 5-10 minutes
   - [ ] Watch for profit taking
   - [ ] Verify SELL appears in trade history
   - [ ] Check final P&L calculation

### 9. Reddit News Integration ✅
**Test via console logs:**

```bash
pm2 logs trading-bot --nostream | grep "Reddit"
```

Look for:
- [ ] "📰 Fetching Reddit crypto news..."
- [ ] "📊 Found X posts in /r/CryptoCurrency"
- [ ] "🔗 Mapped Reddit post to BTC/USDT"
- [ ] "✅ Reddit news processing complete"

### 10. Max 10 Trades Limit ✅

#### Test Limit Enforcement
1. **Setup:**
   - [ ] Start bot in Paper mode
   - [ ] Use Aggressive strategy for faster trades
   - [ ] Let it run until 10 positions open

2. **Verify Limit:**
   - [ ] Check console logs
   - [ ] Look for: "⏸️ Maximum open trades reached (10/10)"
   - [ ] Verify no new BUY trades execute
   - [ ] Confirm bot waits for positions to close

3. **Dashboard Check:**
   - [ ] Open Positions shows "10 / 10 positions"
   - [ ] No new positions added beyond 10
   - [ ] Bot continues monitoring existing positions

---

## 🔍 Detailed Testing Scenarios

### Scenario A: Complete Trading Cycle (Paper Mode)
**Time Required:** 15-30 minutes

1. Clean slate:
   ```bash
   # Stop bot if running
   curl -X POST http://localhost:3000/api/bot/stop
   
   # Reset data (optional)
   curl -X POST http://localhost:3000/api/reset-data
   ```

2. Configure Paper Trading:
   - Go to Settings → Enable "Use Testnet" → Save

3. Start Bot:
   - Strategy: Scalping (for faster trades)
   - Mode: Paper
   - Click "Start Bot"

4. Monitor Progress:
   - Watch AI Logs page for decisions
   - Check Open Positions for new entries
   - Observe Trade History for executions

5. Verify Multi-Timeframe AI:
   ```bash
   pm2 logs trading-bot --nostream --lines 50
   ```
   - Look for different timeframe analyses
   - Verify trend alignment calculations

6. Wait for Complete Cycle:
   - BUY executed → Position opens
   - Monitor P&L in Open Positions
   - Wait for profit target (3-5% for scalping)
   - SELL executed → Position closes
   - Check final P&L in Trade History

### Scenario B: Real Trading Simulation (Testnet)
**Prerequisites:** Binance Testnet account

1. Get Testnet Credentials:
   - Visit: https://testnet.binance.vision/
   - Create account and generate API keys

2. Configure:
   - Settings → Enter Testnet API Key
   - Enter Testnet Secret Key
   - Enable "Use Testnet"
   - Click "Test Connection" → Should succeed
   - Save

3. Start Trading:
   - Select strategy (recommend Safe for first test)
   - Select Paper mode
   - Start bot

4. Verify Real API Integration:
   ```bash
   pm2 logs trading-bot --nostream
   ```
   - Look for: "✅ Binance Testnet connected"
   - Check for actual API calls to testnet
   - Verify real balance queries

### Scenario C: AI Strategy Switching
**Time Required:** 10-15 minutes

1. Start with one strategy (e.g., Safe)
2. Watch AI Logs page
3. Observe AI analyzing market conditions
4. Wait for AI to recommend different strategy
5. Verify bot switches strategy automatically
6. Check console for: "🔄 AI: Changing strategy from X to Y"

### Scenario D: Stress Test (Max Positions)
**Time Required:** 30-60 minutes

1. Use Aggressive strategy
2. Monitor position count
3. Watch as bot opens trades
4. Verify strict 10-position limit
5. Observe bot behavior when limit reached
6. Check that bot resumes after positions close

---

## 🚨 Common Issues & Solutions

### Issue 1: No Trades Executing
**Symptoms:** Bot running but no BUY signals

**Check:**
```bash
pm2 logs trading-bot --nostream --lines 50
```

**Possible Causes:**
- Market conditions not favorable
- AI confidence too low
- Maximum positions reached
- Insufficient simulated balance

**Solution:**
- Try Aggressive strategy
- Wait longer (5-10 minutes)
- Check AI Logs for reasoning
- Reset data if needed

### Issue 2: NaN in Calculations
**Symptoms:** "NaN" appears in P&L or prices

**Check Console:**
```bash
pm2 logs trading-bot --nostream | grep "NaN"
```

**Solution:**
- Should be fixed in latest version
- If still occurs, report the exact log line
- Check for division by zero
- Verify quantity calculations

### Issue 3: WebSocket Disconnections
**Symptoms:** Real-time updates stop

**Check Browser Console:**
- F12 → Console tab
- Look for WebSocket errors

**Solution:**
- Refresh page
- Check server is running: `pm2 list`
- Verify port 3000 is accessible

### Issue 4: Binance API 451 Error
**Symptoms:** "Service unavailable from restricted location"

**This is Normal:**
- Binance blocks certain regions
- Bot uses fallback simulated prices
- Testnet also affected
- Trading still works with simulated data

**No Action Needed:**
- Bot functions correctly in fallback mode
- All features work
- Only affects real API price fetching

---

## 📊 Expected Results

### After 30 Minutes of Testing:
- [ ] At least 2-5 trades executed
- [ ] AI Logs shows 40+ decision entries
- [ ] Open Positions displays 1-3 active positions
- [ ] Trade History shows BUY and SELL entries
- [ ] All calculations show valid numbers (no NaN)
- [ ] Multi-timeframe data accumulating
- [ ] Reddit news cache populated

### After 1 Hour of Testing:
- [ ] 5-10+ completed trade cycles
- [ ] Multiple strategy switches
- [ ] AI confidence scores varying
- [ ] Some profitable, some break-even
- [ ] Never selling at loss (verify this!)
- [ ] Max 10 positions limit tested
- [ ] All timeframes have data (5m, 15m, 30m)

### After 6 Hours of Testing:
- [ ] 20+ trades
- [ ] Full multi-timeframe history (1h candles ready)
- [ ] Strategy performance comparison available
- [ ] Win rate statistics meaningful
- [ ] Reddit news impacting decisions
- [ ] Portfolio balance changed (up or down)

---

## ✅ Success Criteria

All features are working correctly if:

1. ✅ No console errors (except Binance 451 - expected)
2. ✅ No NaN or undefined in calculations
3. ✅ Trades execute with valid quantities
4. ✅ P&L calculations accurate
5. ✅ Stop-loss and take-profit set correctly
6. ✅ Maximum 10 positions enforced
7. ✅ AI Logs show reasoning
8. ✅ Real-time updates via WebSocket
9. ✅ Trade history shows exact amounts
10. ✅ Open positions track real-time P&L

---

## 🎯 Final Verification

Run this complete check:

```bash
# Check application status
pm2 list

# View recent logs
pm2 logs trading-bot --nostream --lines 100

# Test API endpoints
curl http://localhost:3000/api/bot/status
curl http://localhost:3000/api/positions/open
curl http://localhost:3000/api/trades
curl http://localhost:3000/api/ai/latest
curl http://localhost:3000/api/prices

# Check for errors
pm2 logs trading-bot --nostream --err --lines 50
```

All endpoints should return valid JSON with data (or empty arrays if no trades yet).

---

## 📞 Support

If any test fails:

1. Check PM2 logs: `pm2 logs trading-bot --nostream`
2. Check browser console (F12)
3. Verify application URL is accessible
4. Restart if needed: `pm2 restart trading-bot`
5. Reset data if corrupted: `curl -X POST http://localhost:3000/api/reset-data`

---

## 🎉 Congratulations!

If all tests pass, your comprehensive crypto trading bot is fully functional with:
- ✅ Advanced AI with multi-timeframe analysis
- ✅ Real-time decision logging
- ✅ Complete position tracking
- ✅ Accurate trade history
- ✅ Reddit news integration
- ✅ Maximum position limits
- ✅ Safe trading modes

**Happy testing! 🚀**
