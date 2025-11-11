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

  // Trades endpoint
  app.get("/api/trades", async (_req, res) => {
    try {
      const trades = await storage.getTrades();
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
