import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { tradingEngine } from "./trading-engine";
import { startBotSchema, changeStrategySchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Portfolio endpoint
  app.get("/api/portfolio", async (_req, res) => {
    try {
      const portfolio = await storage.getPortfolio();
      res.json(portfolio);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio' });
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

  // Chart data endpoint
  app.get("/api/chart", async (_req, res) => {
    try {
      const chartData = tradingEngine.getChartHistory();
      res.json(chartData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      res.status(500).json({ error: 'Failed to fetch chart data' });
    }
  });

  // Prices endpoint
  app.get("/api/prices", async (_req, res) => {
    try {
      const prices = tradingEngine.getCurrentPrices();
      res.json(prices);
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
