import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { tradingEngine } from "./trading-engine";
import { startBotSchema, changeStrategySchema, saveApiKeysSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Portfolio endpoint - returns real Binance balance in real mode
  app.get("/api/portfolio", async (_req, res) => {
    try {
      // Check current trading mode
      const tradingMode = await storage.getTradingMode();
      
      // If in real mode and Binance is connected, return real balance
      if (tradingMode.mode === 'real') {
        const { getBinanceService } = await import("./services/binance");
        const binanceService = getBinanceService();
        
        if (binanceService.isApiConnected()) {
          try {
            const realBalance = await binanceService.getTotalBalanceUSDT();
            const simplifiedBalance = await binanceService.getSimplifiedBalance();
            
            // Get simulated portfolio stats for comparison
            const simulatedPortfolio = await storage.getPortfolio();
            
            // Return real balance with some stats from trades
            res.json({
              balance: realBalance,
              initialBalance: realBalance, // Real balance is the current state
              totalProfit: 0, // Real mode shows actual Binance balance, not simulated profit
              totalProfitPercent: 0,
              dailyProfit: 0,
              dailyProfitPercent: 0,
              openPositions: 0,
              winRate: simulatedPortfolio.winRate, // Keep stats from simulated trades
              totalTrades: simulatedPortfolio.totalTrades,
              winningTrades: simulatedPortfolio.winningTrades,
              losingTrades: simulatedPortfolio.losingTrades,
              bestPerformingCoin: simulatedPortfolio.bestPerformingCoin,
              realMode: true,
              assets: simplifiedBalance.assets,
            });
            return;
          } catch (binanceError) {
            console.error('Failed to fetch real Binance balance:', binanceError);
            // Fall through to simulated balance
          }
        }
      }
      
      // Paper mode or Binance not connected - return simulated balance
      const portfolio = await storage.getPortfolio();
      res.json({ ...portfolio, realMode: false });
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
  });

  // Open positions endpoint
  app.get("/api/positions/open", async (_req, res) => {
    try {
      const positions = await storage.getOpenPositions();
      res.json(positions);
    } catch (error) {
      console.error('Error fetching open positions:', error);
      res.status(500).json({ error: 'Failed to fetch open positions' });
    }
  });

  // Trades endpoint with optional filtering
  app.get("/api/trades", async (req, res) => {
    try {
      const { symbol, strategy, timeRange, startDate, endDate } = req.query;
      
      const filters: any = {};
      
      if (symbol && typeof symbol === 'string') {
        filters.symbol = symbol;
      }
      
      if (strategy && typeof strategy === 'string' && ['safe', 'balanced', 'aggressive'].includes(strategy)) {
        filters.strategy = strategy;
      }
      
      if (timeRange && typeof timeRange === 'string' && ['24h', '7d', '30d', 'all'].includes(timeRange)) {
        filters.timeRange = timeRange;
      }
      
      if (startDate && typeof startDate === 'string') {
        const parsed = parseInt(startDate, 10);
        if (!isNaN(parsed)) {
          filters.startDate = parsed;
        }
      }
      
      if (endDate && typeof endDate === 'string') {
        const parsed = parseInt(endDate, 10);
        if (!isNaN(parsed)) {
          filters.endDate = parsed;
        }
      }
      
      const trades = await storage.getTrades(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(trades);
    } catch (error) {
      console.error('Error fetching trades:', error);
      res.status(500).json({ error: 'Failed to fetch trades' });
    }
  });

  // Bot status endpoint
  app.get("/api/bot/status", async (_req, res) => {
    try {
      const botState = await storage.getBotState();
      res.json(botState);
    } catch (error) {
      console.error('Error fetching bot status:', error);
      res.status(500).json({ error: 'Failed to fetch bot status' });
    }
  });

  // Start bot endpoint
  app.post("/api/bot/start", async (req, res) => {
    try {
      // Check if Binance API is connected before starting bot
      const { getBinanceService } = await import("./services/binance");
      const binanceService = getBinanceService();
      
      if (!binanceService.isApiConnected()) {
        return res.status(400).json({ 
          error: 'Binance API connection required', 
          message: 'Please configure your Binance API key and secret in Settings before starting the bot.' 
        });
      }
      
      const data = startBotSchema.parse(req.body);
      await tradingEngine.start(data.strategy, data.mode);
      const botState = await storage.getBotState();
      res.json(botState);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request data', details: error.errors });
      } else {
        console.error('Error starting bot:', error);
        res.status(500).json({ error: 'Failed to start bot' });
      }
    }
  });

  // Stop bot endpoint
  app.post("/api/bot/stop", async (_req, res) => {
    try {
      await tradingEngine.stop();
      const botState = await storage.getBotState();
      res.json(botState);
    } catch (error) {
      console.error('Error stopping bot:', error);
      res.status(500).json({ error: 'Failed to stop bot' });
    }
  });

  // Change strategy endpoint
  app.post("/api/bot/strategy", async (req, res) => {
    try {
      const data = changeStrategySchema.parse(req.body);
      await tradingEngine.changeStrategy(data.strategy);
      const botState = await storage.getBotState();
      res.json(botState);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request data', details: error.errors });
      } else {
        console.error('Error changing strategy:', error);
        res.status(500).json({ error: 'Failed to change strategy' });
      }
    }
  });

  // Chart data endpoint with symbol support and technical indicators
  app.get("/api/chart/:symbol?", async (req, res) => {
    try {
      const symbol = req.params.symbol || 'BTC/USDT';
      const timeframe = (req.query.timeframe as string) || '5m';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const indicators = req.query.indicators ? (req.query.indicators as string).split(',') : [];
      
      // Validate timeframe
      const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
      if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({ 
          error: 'Invalid timeframe', 
          message: `Timeframe must be one of: ${validTimeframes.join(', ')}` 
        });
      }
      
      // Fetch real data from Binance if connected, otherwise use simulated data
      const { getBinanceService } = await import("./services/binance");
      const binanceService = getBinanceService();
      
      let chartData: any[] = [];
      
      if (binanceService.isApiConnected()) {
        try {
          // Fetch real historical OHLCV data from Binance
          chartData = await binanceService.fetchOHLCV(symbol, timeframe, Math.min(limit, 1000));
        } catch (binanceError) {
          console.warn('Failed to fetch real chart data, using simulated:', binanceError);
          // Fall through to simulated data
        }
      }
      
      // Generate simulated data if Binance not connected or failed
      if (chartData.length === 0) {
        const now = Date.now();
        const timeframeMs = timeframe === '1m' ? 60000 : timeframe === '5m' ? 300000 : timeframe === '15m' ? 900000 : timeframe === '1h' ? 3600000 : timeframe === '4h' ? 14400000 : 86400000;
        const basePrice = 50000;
        
        for (let i = limit; i >= 0; i--) {
          const timestamp = now - (i * timeframeMs);
          const volatility = basePrice * 0.01;
          const open = basePrice + (Math.random() - 0.5) * volatility * 2;
          const close = open + (Math.random() - 0.5) * volatility;
          const high = Math.max(open, close) + Math.random() * volatility * 0.5;
          const low = Math.min(open, close) - Math.random() * volatility * 0.5;
          const volume = Math.random() * 1000;
          
          chartData.push({
            timestamp,
            open,
            high,
            low,
            close,
            price: close,
            volume,
          });
        }
      }
      
      // Apply technical indicators if requested
      if (indicators.length > 0) {
        const { SMA, EMA, RSI, MACD, BollingerBands } = await import('technicalindicators');
        const closes = chartData.map((c: any) => c.close);
        const result: any = { candles: chartData };
        
        // Calculate indicators
        if (indicators.includes('sma20')) {
          const sma20 = SMA.calculate({ period: 20, values: closes });
          result.sma20 = sma20;
        }
        
        if (indicators.includes('sma50')) {
          const sma50 = SMA.calculate({ period: 50, values: closes });
          result.sma50 = sma50;
        }
        
        if (indicators.includes('ema12')) {
          const ema12 = EMA.calculate({ period: 12, values: closes });
          result.ema12 = ema12;
        }
        
        if (indicators.includes('ema26')) {
          const ema26 = EMA.calculate({ period: 26, values: closes });
          result.ema26 = ema26;
        }
        
        if (indicators.includes('rsi')) {
          const rsi = RSI.calculate({ period: 14, values: closes });
          result.rsi = rsi;
        }
        
        if (indicators.includes('macd')) {
          const macd = MACD.calculate({
            values: closes,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
          });
          result.macd = macd;
        }
        
        if (indicators.includes('bb')) {
          const bb = BollingerBands.calculate({
            period: 20,
            values: closes,
            stdDev: 2,
          });
          
          // Transform from array of objects to object with arrays
          result.bollingerBands = {
            upper: bb.map(b => b?.upper ?? null),
            middle: bb.map(b => b?.middle ?? null),
            lower: bb.map(b => b?.lower ?? null),
          };
        }
        
        return res.json(result);
      }
      
      return res.json(chartData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      res.status(500).json({ error: 'Failed to fetch chart data' });
    }
  });

  // Prices endpoint - Returns real prices if Binance connected, otherwise simulated
  app.get("/api/prices", async (_req, res) => {
    try {
      const { getBinanceService } = await import("./services/binance");
      const binanceService = getBinanceService();
      
      // Try to get real prices if Binance is connected
      if (binanceService.isApiConnected()) {
        try {
          const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'ADA/USDT'];
          const pricesMap = await binanceService.fetchPrices(symbols);
          
          // Convert Map to object
          const prices: Record<string, number> = {};
          pricesMap.forEach((price, symbol) => {
            prices[symbol] = price;
          });
          
          return res.json(prices);
        } catch (binanceError) {
          console.warn('Failed to fetch real prices, falling back to simulated:', binanceError);
          // Fall through to simulated prices
        }
      }
      
      // Return simulated prices for paper trading
      const simulatedPrices = {
        'BTC/USDT': 50000 + (Math.random() - 0.5) * 2000,
        'ETH/USDT': 3000 + (Math.random() - 0.5) * 200,
        'BNB/USDT': 400 + (Math.random() - 0.5) * 20,
        'SOL/USDT': 100 + (Math.random() - 0.5) * 10,
        'ADA/USDT': 0.5 + (Math.random() - 0.5) * 0.05,
      };
      
      res.json(simulatedPrices);
    } catch (error) {
      console.error('Error fetching prices:', error);
      res.status(500).json({ error: 'Failed to fetch prices' });
    }
  });

  // AI Decision endpoints
  app.get("/api/ai/decisions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const decisions = await storage.getAIDecisions(limit);
      res.json(decisions);
    } catch (error) {
      console.error('Error fetching AI decisions:', error);
      res.status(500).json({ error: 'Failed to fetch AI decisions' });
    }
  });

  app.get("/api/ai/latest", async (_req, res) => {
    try {
      const decision = await storage.getLatestAIDecision();
      if (decision) {
        res.json(decision);
      } else {
        res.status(404).json({ error: 'No AI decisions yet' });
      }
    } catch (error) {
      console.error('Error fetching latest AI decision:', error);
      res.status(500).json({ error: 'Failed to fetch latest AI decision' });
    }
  });

  app.post("/api/ai/toggle", async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid enabled value' });
      }
      
      await tradingEngine.toggleAI(enabled);
      const botState = await storage.getBotState();
      res.json(botState);
    } catch (error) {
      console.error('Error toggling AI:', error);
      res.status(500).json({ error: 'Failed to toggle AI' });
    }
  });

  // Strategies endpoint
  app.get("/api/strategies", async (_req, res) => {
    try {
      const strategies = [
        {
          id: 'safe',
          name: 'Safe',
          type: 'safe',
          riskPerTrade: 0.015,
          profitTarget: 0.035,
          description: '1-2% risk per trade, 3-4% profit targets',
        },
        {
          id: 'balanced',
          name: 'Balanced',
          type: 'balanced',
          riskPerTrade: 0.025,
          profitTarget: 0.055,
          description: '2-3% risk per trade, 5-6% profit targets',
        },
        {
          id: 'aggressive',
          name: 'Aggressive',
          type: 'aggressive',
          riskPerTrade: 0.04,
          profitTarget: 0.085,
          description: '3-5% risk per trade, 7-10% profit targets',
        },
      ];
      res.json(strategies);
    } catch (error) {
      console.error('Error fetching strategies:', error);
      res.status(500).json({ error: 'Failed to fetch strategies' });
    }
  });

  // Binance API Integration endpoints
  app.post("/api/binance/test", async (req, res) => {
    try {
      const { createTemporaryBinanceService } = await import("./services/binance");
      
      // Create a temporary service instance with provided config for testing
      // This doesn't affect the singleton instance
      const testService = createTemporaryBinanceService(req.body);
      
      // Try to connect and test
      const result = await testService.testConnection();
      
      // If test is successful and credentials were provided, update the singleton
      if (result.success && (req.body.apiKey || req.body.secret)) {
        const { getBinanceService } = await import("./services/binance");
        // Reconfigure the singleton with the new credentials and connect
        const service = getBinanceService(req.body);
        await service.connect();
      }
      
      res.json(result);
    } catch (error) {
      console.error('Binance test connection error:', error);
      res.json({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      });
    }
  });

  app.post("/api/binance/save-credentials", async (req, res) => {
    try {
      // Validate request body with Zod
      const validatedData = saveApiKeysSchema.parse(req.body);
      
      // Save encrypted credentials to database
      await storage.saveApiKeys(validatedData.exchange, validatedData.apiKey, validatedData.secret);
      
      // Also update the active Binance service instance
      const { getBinanceService } = await import("./services/binance");
      const service = getBinanceService({ 
        apiKey: validatedData.apiKey, 
        secret: validatedData.secret 
      });
      await service.connect();
      
      res.json({ 
        success: true,
        message: 'Binance API credentials saved successfully',
        connected: service.isApiConnected()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.errors[0]?.message || 'Invalid request data',
          details: error.errors
        });
      }
      
      console.error('Failed to save Binance credentials:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save credentials',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/binance/status", async (_req, res) => {
    try {
      const { getBinanceService } = await import("./services/binance");
      const binanceService = getBinanceService();
      
      res.json({
        connected: binanceService.isApiConnected(),
        message: binanceService.isApiConnected() ? 'Connected to Binance' : 'Not connected',
      });
    } catch (error) {
      res.json({ connected: false, message: 'Error checking status' });
    }
  });

  app.get("/api/binance/prices", async (req, res) => {
    try {
      const { getBinanceService } = await import("./services/binance");
      const binanceService = getBinanceService();
      
      if (!binanceService.isApiConnected()) {
        return res.status(503).json({ error: 'Binance not connected' });
      }

      const symbols = req.query.symbols ? 
        (req.query.symbols as string).split(',') : 
        ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];

      const prices = await binanceService.fetchPrices(symbols);
      
      // Convert Map to object
      const pricesObj: Record<string, number> = {};
      prices.forEach((price, symbol) => {
        pricesObj[symbol] = price;
      });

      res.json(pricesObj);
    } catch (error) {
      console.error('Error fetching Binance prices:', error);
      res.status(500).json({ error: 'Failed to fetch prices from Binance' });
    }
  });

  // Get real Binance balance
  app.get("/api/binance/balance", async (_req, res) => {
    try {
      const { getBinanceService } = await import("./services/binance");
      const binanceService = getBinanceService();
      
      if (!binanceService.isApiConnected()) {
        return res.status(400).json({ 
          error: 'Binance not connected',
          message: 'Please configure your Binance API credentials first'
        });
      }

      const balance = await binanceService.getSimplifiedBalance();
      
      // Update cached balance in database
      await storage.updateRealBalance(balance.total);
      
      res.json(balance);
    } catch (error) {
      console.error('Error fetching Binance balance:', error);
      res.status(500).json({ error: 'Failed to fetch balance from Binance' });
    }
  });

  // Trading Mode endpoints
  app.get("/api/trading-mode", async (_req, res) => {
    try {
      const modeSettings = await storage.getTradingMode();
      res.json(modeSettings);
    } catch (error) {
      console.error('Error fetching trading mode:', error);
      res.status(500).json({ error: 'Failed to fetch trading mode' });
    }
  });

  app.post("/api/trading-mode", async (req, res) => {
    try {
      const { changeTradingModeSchema } = await import("@shared/schema");
      const data = changeTradingModeSchema.parse(req.body);
      
      // Prepare trading mode settings
      const modeSettings: any = {
        mode: data.mode,
        maxPositionSize: data.maxPositionSize ? parseFloat(data.maxPositionSize) : 1000,
        dailyLossLimit: data.dailyLossLimit ? parseFloat(data.dailyLossLimit) : 500,
      };
      
      // Add confirmation timestamp if switching to real mode
      if (data.mode === 'real') {
        if (!data.confirmation) {
          return res.status(400).json({ 
            error: 'Confirmation required',
            message: 'You must explicitly confirm switching to real trading mode. This is a safety feature to prevent accidental real money trading.'
          });
        }
        modeSettings.confirmedAt = new Date();
      }
      
      await storage.setTradingMode(modeSettings);
      
      // Update bot state to match
      await storage.updateBotState({ mode: data.mode });
      
      res.json({ success: true, mode: data.mode });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request data', details: error.errors });
      } else {
        console.error('Error changing trading mode:', error);
        res.status(500).json({ 
          error: 'Failed to change trading mode',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  // Risk Management endpoints
  app.get("/api/risk/metrics", async (_req, res) => {
    try {
      const metrics = await tradingEngine.getRiskMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching risk metrics:', error);
      res.status(500).json({ error: 'Failed to fetch risk metrics' });
    }
  });

  app.post("/api/risk/circuit-breaker/reset", async (_req, res) => {
    try {
      tradingEngine.resetCircuitBreaker();
      res.json({ message: 'Circuit breaker reset successfully' });
    } catch (error) {
      console.error('Error resetting circuit breaker:', error);
      res.status(500).json({ error: 'Failed to reset circuit breaker' });
    }

    
  });

  app.post("/api/reset-data", async (_req, res) => {
    try {
      await storage.resetStorage();
      res.json({ message: 'All data reset successfully' });
    } catch (error) {
      console.error('Error resetting data:', error);
      res.status(500).json({ error: 'Failed to reset data' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // WebSocket server setup on /ws path
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    
    // Add client to trading engine for broadcasts
    tradingEngine.addWebSocketClient(ws);

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);

        // Handle different message types
        if (data.type === 'subscribe_prices') {
          // Client subscribed to price updates
          ws.send(JSON.stringify({ 
            event: 'subscribed', 
            data: { type: 'prices' } 
          }));
        } else if (data.type === 'subscribe_trades') {
          // Client subscribed to trade updates
          ws.send(JSON.stringify({ 
            event: 'subscribed', 
            data: { type: 'trades' } 
          }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      tradingEngine.removeWebSocketClient(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      tradingEngine.removeWebSocketClient(ws);
    });
  });

  return httpServer;
}
