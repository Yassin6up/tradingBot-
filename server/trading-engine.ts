import type { Trade, StrategyType, TradingMode, PriceData, ChartDataPoint } from "@shared/schema";
import { randomUUID } from "crypto";
import { storage } from "./storage";

interface StrategyConfig {
  riskPerTrade: number;
  profitTarget: number;
  minProfit: number;
  maxProfit: number;
}

const strategies: Record<StrategyType, StrategyConfig> = {
  safe: {
    riskPerTrade: 0.015,
    profitTarget: 0.035,
    minProfit: 0.02,
    maxProfit: 0.04,
  },
  balanced: {
    riskPerTrade: 0.025,
    profitTarget: 0.055,
    minProfit: 0.03,
    maxProfit: 0.07,
  },
  aggressive: {
    riskPerTrade: 0.04,
    profitTarget: 0.085,
    minProfit: 0.05,
    maxProfit: 0.12,
  },
};

const symbols = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'ADA/USDT',
];

class TradingEngine {
  private intervalId: NodeJS.Timeout | null = null;
  private priceData: Map<string, number> = new Map();
  private chartHistory: ChartDataPoint[] = [];
  private currentStrategy: StrategyType = 'balanced';
  private mode: TradingMode = 'sandbox';
  private wsClients: Set<any> = new Set();

  constructor() {
    // Initialize price data
    this.priceData.set('BTC/USDT', 50000);
    this.priceData.set('ETH/USDT', 3000);
    this.priceData.set('BNB/USDT', 400);
    this.priceData.set('SOL/USDT', 100);
    this.priceData.set('ADA/USDT', 0.5);

    // Initialize chart history
    this.initializeChartHistory();
  }

  private initializeChartHistory() {
    const now = Date.now();
    const basePrice = 50000;
    
    // Generate last 100 data points (5 minutes apart)
    for (let i = 100; i >= 0; i--) {
      const timestamp = now - (i * 5 * 60 * 1000);
      const randomWalk = (Math.random() - 0.5) * 1000;
      const price = basePrice + randomWalk * (100 - i) / 10;
      
      this.chartHistory.push({
        timestamp,
        price: Math.max(price, basePrice * 0.95),
      });
    }
  }

  public addWebSocketClient(client: any) {
    this.wsClients.add(client);
  }

  public removeWebSocketClient(client: any) {
    this.wsClients.delete(client);
  }

  private broadcast(event: string, data: any) {
    const message = JSON.stringify({ event, data });
    this.wsClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message);
        } catch (error) {
          console.error('Error broadcasting to client:', error);
        }
      }
    });
  }

  public async start(strategy: StrategyType, mode: TradingMode) {
    if (this.intervalId) {
      return;
    }

    this.currentStrategy = strategy;
    this.mode = mode;

    await storage.updateBotState({
      status: 'running',
      strategy,
      mode,
      startTime: Date.now(),
    });

    // Update prices every 2 seconds
    this.intervalId = setInterval(() => {
      this.updatePrices();
      this.maybeExecuteTrade();
    }, 2000);

    console.log(`Trading bot started with ${strategy} strategy in ${mode} mode`);
  }

  public async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await storage.updateBotState({
      status: 'stopped',
      startTime: null,
    });

    console.log('Trading bot stopped');
  }

  public async changeStrategy(strategy: StrategyType) {
    this.currentStrategy = strategy;
    await storage.updateBotState({ strategy });
    console.log(`Strategy changed to ${strategy}`);
  }

  private updatePrices() {
    const updates: PriceData[] = [];

    this.priceData.forEach((currentPrice, symbol) => {
      // Simulate price movement (random walk)
      const volatility = 0.002; // 0.2% volatility
      const change = (Math.random() - 0.5) * 2 * volatility * currentPrice;
      const newPrice = Math.max(currentPrice + change, currentPrice * 0.9);
      
      this.priceData.set(symbol, newPrice);

      updates.push({
        symbol,
        price: newPrice,
        change24h: change,
        change24hPercent: (change / currentPrice) * 100,
        high24h: newPrice * 1.05,
        low24h: newPrice * 0.95,
        volume24h: Math.random() * 1000000,
        timestamp: Date.now(),
      });

      // Update chart history for BTC
      if (symbol === 'BTC/USDT') {
        this.chartHistory.push({
          timestamp: Date.now(),
          price: newPrice,
        });

        // Keep only last 100 points
        if (this.chartHistory.length > 100) {
          this.chartHistory.shift();
        }
      }
    });

    // Broadcast price updates
    this.broadcast('price_update', updates);
  }

  private async maybeExecuteTrade() {
    // Random chance to execute a trade (30% chance every interval)
    if (Math.random() > 0.3) {
      return;
    }

    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const currentPrice = this.priceData.get(symbol) || 1000;
    const config = strategies[this.currentStrategy];

    // Randomly decide buy or sell
    const type: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';

    // Calculate trade details
    const portfolio = await storage.getPortfolio();
    const tradeAmount = portfolio.balance * config.riskPerTrade;
    const quantity = tradeAmount / currentPrice;

    // Simulate profit/loss (70% win rate for safe, 60% for balanced, 50% for aggressive)
    const winRate = this.currentStrategy === 'safe' ? 0.7 : 
                    this.currentStrategy === 'balanced' ? 0.6 : 0.5;
    
    const isWin = Math.random() < winRate;
    const profitPercent = isWin 
      ? config.minProfit + Math.random() * (config.maxProfit - config.minProfit)
      : -(config.minProfit + Math.random() * (config.riskPerTrade - config.minProfit));
    
    const profit = tradeAmount * profitPercent;

    const trade: Trade = {
      id: randomUUID(),
      symbol,
      type,
      price: currentPrice,
      quantity,
      timestamp: Date.now(),
      profit,
      profitPercent: profitPercent * 100,
      strategy: this.currentStrategy,
      mode: this.mode,
    };

    await storage.addTrade(trade);

    // Broadcast trade event
    this.broadcast('trade_executed', trade);

    console.log(`Trade executed: ${type} ${quantity.toFixed(6)} ${symbol} at $${currentPrice.toFixed(2)} - Profit: $${profit.toFixed(2)}`);
  }

  public getChartHistory(): ChartDataPoint[] {
    return [...this.chartHistory];
  }

  public getCurrentPrices(): PriceData[] {
    const prices: PriceData[] = [];
    this.priceData.forEach((price, symbol) => {
      prices.push({
        symbol,
        price,
        change24h: 0,
        change24hPercent: 0,
        high24h: price * 1.05,
        low24h: price * 0.95,
        volume24h: Math.random() * 1000000,
        timestamp: Date.now(),
      });
    });
    return prices;
  }
}

export const tradingEngine = new TradingEngine();
