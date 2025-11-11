import type { Trade, StrategyType, TradingMode, PriceData, ChartDataPoint, AIDecision } from "@shared/schema";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { strategyAI } from "./services/strategy-ai";
import { getRiskManagementService, type RiskMetrics } from "./services/risk-management";

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
  private aiIntervalId: NodeJS.Timeout | null = null;
  private priceData: Map<string, number> = new Map();
  private chartHistory: ChartDataPoint[] = [];
  private currentStrategy: StrategyType = 'balanced';
  private mode: TradingMode = 'sandbox';
  private wsClients: Set<any> = new Set();
  private lastStrategyChangeTime: number = 0;
  private readonly MIN_STRATEGY_DWELL_MS = 300000; // 5 minutes minimum between strategy changes
  private readonly AI_CHECK_INTERVAL_MS = 60000; // Check AI every 60 seconds
  private dailyStartBalance: number = 0; // Will be initialized from portfolio
  private lastDailyReset: string = new Date().toISOString().split('T')[0];

  constructor() {
    // Initialize daily start balance from portfolio
    this.initializeDailyBalance();
    
    // Initialize price data
    this.priceData.set('BTC/USDT', 50000);
    this.priceData.set('ETH/USDT', 3000);
    this.priceData.set('BNB/USDT', 400);
    this.priceData.set('SOL/USDT', 100);
    this.priceData.set('ADA/USDT', 0.5);

    // Initialize chart history
    this.initializeChartHistory();
  }

  private async initializeDailyBalance() {
    try {
      const portfolio = await storage.getPortfolio();
      this.dailyStartBalance = portfolio.balance;
    } catch (error) {
      console.error('Failed to initialize daily balance:', error);
      this.dailyStartBalance = 10000; // Fallback
    }
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
    this.lastStrategyChangeTime = Date.now();

    // Initialize/refresh daily start balance when bot starts
    const portfolio = await storage.getPortfolio();
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastDailyReset) {
      this.dailyStartBalance = portfolio.balance;
      this.lastDailyReset = today;
      const riskMgmt = getRiskManagementService();
      riskMgmt.resetCircuitBreaker();
    } else if (this.dailyStartBalance === 0) {
      // First start or restart mid-day
      this.dailyStartBalance = portfolio.balance;
    }

    const botState = await storage.getBotState();
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

    // Start AI analysis if enabled
    if (botState.aiEnabled) {
      this.startAIAnalysis();
    }

    console.log(`Trading bot started with ${strategy} strategy in ${mode} mode${botState.aiEnabled ? ' (AI enabled)' : ''}`);
  }

  public async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.stopAIAnalysis();

    await storage.updateBotState({
      status: 'stopped',
      startTime: null,
    });

    console.log('Trading bot stopped');
  }

  public async changeStrategy(strategy: StrategyType) {
    this.currentStrategy = strategy;
    this.lastStrategyChangeTime = Date.now();
    await storage.updateBotState({ strategy });
    console.log(`Strategy changed to ${strategy}`);
  }

  public async toggleAI(enabled: boolean) {
    await storage.updateBotState({ aiEnabled: enabled });
    
    if (enabled && this.intervalId) {
      // Bot is running, start AI analysis
      this.startAIAnalysis();
      console.log('AI strategy selection enabled');
    } else {
      // Stop AI analysis
      this.stopAIAnalysis();
      console.log('AI strategy selection disabled');
    }
  }

  private startAIAnalysis() {
    if (this.aiIntervalId) {
      return; // Already running
    }

    // Run analysis immediately, then every 60 seconds
    this.runAIAnalysis();
    this.aiIntervalId = setInterval(() => {
      this.runAIAnalysis();
    }, this.AI_CHECK_INTERVAL_MS);
  }

  private stopAIAnalysis() {
    if (this.aiIntervalId) {
      clearInterval(this.aiIntervalId);
      this.aiIntervalId = null;
    }
  }

  private async runAIAnalysis() {
    try {
      // Feed current price data to AI
      const priceData = this.getCurrentPrices();
      strategyAI.updatePriceData(priceData);

      // Get AI recommendation
      const decision = strategyAI.selectBestStrategy(this.currentStrategy);
      
      // Store decision
      await storage.addAIDecision(decision);
      
      // Broadcast AI decision
      this.broadcast('ai_decision', decision);
      
      // Apply strategy change if recommended and guard-rails pass
      await this.applyAIStrategyDecision(decision);
      
      console.log(`AI Analysis: Recommended ${decision.selectedStrategy} (confidence: ${decision.confidence}%)`);
    } catch (error) {
      console.error('Error in AI analysis:', error);
    }
  }

  private async applyAIStrategyDecision(decision: AIDecision) {
    // Guard-rail: Check if strategy is different
    if (decision.selectedStrategy === this.currentStrategy) {
      return; // No change needed
    }

    // Guard-rail: Check minimum dwell time (prevent thrashing)
    const timeSinceLastChange = Date.now() - this.lastStrategyChangeTime;
    if (timeSinceLastChange < this.MIN_STRATEGY_DWELL_MS) {
      console.log(`AI: Delaying strategy change (${Math.round((this.MIN_STRATEGY_DWELL_MS - timeSinceLastChange) / 1000)}s remaining)`);
      return;
    }

    // Guard-rail: Check confidence threshold
    const MIN_CONFIDENCE = 60;
    if (decision.confidence < MIN_CONFIDENCE) {
      console.log(`AI: Confidence too low (${decision.confidence}% < ${MIN_CONFIDENCE}%)`);
      return;
    }

    // All guard-rails passed, apply strategy change
    console.log(`AI: Changing strategy from ${this.currentStrategy} to ${decision.selectedStrategy}`);
    await this.changeStrategy(decision.selectedStrategy);
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
    // Reset daily start balance if new day
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastDailyReset) {
      const portfolio = await storage.getPortfolio();
      this.dailyStartBalance = portfolio.balance;
      this.lastDailyReset = today;
      
      // Reset circuit breaker for new day
      const riskMgmt = getRiskManagementService();
      riskMgmt.resetCircuitBreaker();
      console.log('📅 New trading day: Daily loss limit reset');
    }

    // Check risk management circuit breaker
    const portfolio = await storage.getPortfolio();
    const riskMgmt = getRiskManagementService();
    const riskMetrics = riskMgmt.calculateRiskMetrics(
      this.chartHistory,
      portfolio.balance,
      portfolio.initialBalance,
      this.currentStrategy,
      this.dailyStartBalance
    );

    // Circuit breaker: Stop trading if daily loss limit exceeded
    if (riskMetrics.circuitBreakerActive) {
      console.warn('🛑 Circuit breaker active - Stopping bot due to daily loss limit');
      await this.stop();
      
      // Broadcast circuit breaker event
      this.broadcast('circuit_breaker', {
        message: 'Trading stopped: Daily loss limit exceeded',
        dailyLoss: this.dailyStartBalance - portfolio.balance,
        dailyLossLimit: riskMetrics.dailyLossLimit,
      });
      
      return;
    }

    // Random chance to execute a trade (30% chance every interval)
    if (Math.random() > 0.3) {
      return;
    }

    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const currentPrice = this.priceData.get(symbol) || 1000;
    const config = strategies[this.currentStrategy];

    // Randomly decide buy or sell
    const type: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';

    // Use risk-adjusted position sizing
    const positionSize = riskMetrics.recommendedPositionSize;
    const tradeAmount = Math.min(positionSize, portfolio.balance * config.riskPerTrade);
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

  public async getRiskMetrics(): Promise<RiskMetrics> {
    const portfolio = await storage.getPortfolio();
    const riskMgmt = getRiskManagementService();
    
    return riskMgmt.calculateRiskMetrics(
      this.chartHistory,
      portfolio.balance,
      portfolio.initialBalance,
      this.currentStrategy,
      this.dailyStartBalance
    );
  }

  public resetCircuitBreaker() {
    const riskMgmt = getRiskManagementService();
    riskMgmt.resetCircuitBreaker();
  }
}

export const tradingEngine = new TradingEngine();
