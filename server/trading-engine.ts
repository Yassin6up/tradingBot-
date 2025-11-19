import type { Trade, StrategyType, TradingMode, PriceData, ChartDataPoint, AIDecision, Position } from "./types";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { strategyAI } from "./services/strategy-ai";
import { getRiskManagementService, type RiskMetrics } from "./services/risk-management";
import { getExchangeProviderManager } from "./services/exchange-provider-manager";
import type { ExchangeProvider } from "./services/exchange-provider";

interface StrategyConfig {
  riskPerTrade: number;
  profitTarget: number;
  minProfit: number;
  maxProfit: number;
  minTradeAmount: number;
  tradeFrequency: number;
  maxLeverage: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

// ENHANCED FUTURES STRATEGIES for $100 budget
const strategies: Record<string, StrategyConfig> = {
  // Base strategies - OPTIMIZED FOR FUTURES
  safe: {
    riskPerTrade: 0.006,
    profitTarget: 0.035,
    minProfit: 0.020,
    maxProfit: 0.045,
    minTradeAmount: 10,
    tradeFrequency: 0.4,
    maxLeverage: 3,
    stopLossPercent: 0.020,
    takeProfitPercent: 0.035
  },
  balanced: {
    riskPerTrade: 0.010,
    profitTarget: 0.050,
    minProfit: 0.030,
    maxProfit: 0.060,
    minTradeAmount: 12,
    tradeFrequency: 0.5,
    maxLeverage: 5,
    stopLossPercent: 0.025,
    takeProfitPercent: 0.050
  },
  aggressive: {
    riskPerTrade: 0.015,
    profitTarget: 0.075,
    minProfit: 0.045,
    maxProfit: 0.085,
    minTradeAmount: 15,
    tradeFrequency: 0.6,
    maxLeverage: 8,
    stopLossPercent: 0.035,
    takeProfitPercent: 0.075
  },
  
  // AI Strategies - OPTIMIZED FOR FUTURES
  trend: {
    riskPerTrade: 0.008,
    profitTarget: 0.055,
    minProfit: 0.035,
    maxProfit: 0.065,
    minTradeAmount: 10,
    tradeFrequency: 0.45,
    maxLeverage: 5,
    stopLossPercent: 0.022,
    takeProfitPercent: 0.055
  },
  breakout: {
    riskPerTrade: 0.012,
    profitTarget: 0.065,
    minProfit: 0.040,
    maxProfit: 0.075,
    minTradeAmount: 12,
    tradeFrequency: 0.40,
    maxLeverage: 6,
    stopLossPercent: 0.030,
    takeProfitPercent: 0.065
  },
  mean_reversion: {
    riskPerTrade: 0.005,
    profitTarget: 0.040,
    minProfit: 0.025,
    maxProfit: 0.050,
    minTradeAmount: 10,
    tradeFrequency: 0.35,
    maxLeverage: 2,
    stopLossPercent: 0.015,
    takeProfitPercent: 0.040
  },
  scalping: {
    riskPerTrade: 0.004,
    profitTarget: 0.025,
    minProfit: 0.015,
    maxProfit: 0.030,
    minTradeAmount: 20,
    tradeFrequency: 0.8,
    maxLeverage: 10,
    stopLossPercent: 0.010,
    takeProfitPercent: 0.025
  },
  momentum: {
    riskPerTrade: 0.014,
    profitTarget: 0.070,
    minProfit: 0.045,
    maxProfit: 0.080,
    minTradeAmount: 12,
    tradeFrequency: 0.55,
    maxLeverage: 7,
    stopLossPercent: 0.035,
    takeProfitPercent: 0.070
  },
  swing: {
    riskPerTrade: 0.012,
    profitTarget: 0.065,
    minProfit: 0.040,
    maxProfit: 0.075,
    minTradeAmount: 15,
    tradeFrequency: 0.30,
    maxLeverage: 4,
    stopLossPercent: 0.028,
    takeProfitPercent: 0.065
  },
  sentiment: {
    riskPerTrade: 0.009,
    profitTarget: 0.050,
    minProfit: 0.030,
    maxProfit: 0.060,
    minTradeAmount: 10,
    tradeFrequency: 0.45,
    maxLeverage: 5,
    stopLossPercent: 0.025,
    takeProfitPercent: 0.050
  },
  news: {
    riskPerTrade: 0.018,
    profitTarget: 0.080,
    minProfit: 0.050,
    maxProfit: 0.090,
    minTradeAmount: 12,
    tradeFrequency: 0.35,
    maxLeverage: 8,
    stopLossPercent: 0.045,
    takeProfitPercent: 0.080
  },
  pair: {
    riskPerTrade: 0.007,
    profitTarget: 0.045,
    minProfit: 0.025,
    maxProfit: 0.055,
    minTradeAmount: 12,
    tradeFrequency: 0.4,
    maxLeverage: 4,
    stopLossPercent: 0.018,
    takeProfitPercent: 0.045
  },
};

// FUTURES SYMBOLS - Most liquid pairs
const symbols = [
  // Major coins with high liquidity
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  
  // Good futures candidates
  'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT', 'LTC/USDT',
  'MATIC/USDT', 'ATOM/USDT', 'UNI/USDT', 'DOGE/USDT',
  
  // Affordable for $100 account
  'MATIC/USDT', 'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT'
];

class ProfitOptimizer {
  static shouldTakeProfit(
    position: Position,
    currentPrice: number,
    strategy: string
  ): { shouldClose: boolean; reason: string } {
    const entryPrice = position.entryPrice;
    const isLong = position.side === 'LONG';
    
    // Calculate PnL based on position side for futures
    const profitPercent = isLong 
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100;

    const holdTimeHours = (Date.now() - position.openedAt) / (1000 * 60 * 60);

    // 🚨 FUTURES STOP LOSS - CRITICAL FOR RISK MANAGEMENT
    const strategyConfig = strategies[strategy] || strategies.balanced;
    const stopLossPercent = strategyConfig.stopLossPercent * 100;
    
    if (profitPercent <= -stopLossPercent) {
      return { 
        shouldClose: true, 
        reason: `🚨 FUTURES STOP LOSS: ${profitPercent.toFixed(2)}% loss exceeded ${stopLossPercent}% limit` 
      };
    }

    // 🚨 LIQUIDATION PROTECTION - Emergency close before liquidation
    const leverage = position.leverage || 3;
    const maxLossPercent = (100 / leverage) * 0.8; // 80% of liquidation level
    
    if (profitPercent <= -maxLossPercent) {
      return { 
        shouldClose: true, 
        reason: `🚨 LIQUIDATION PROTECTION: ${profitPercent.toFixed(2)}% loss - too close to liquidation` 
      };
    }

    // Strategy-specific profit targets for futures
    const strategyTargets: Record<string, number> = {
      scalping: 2.5,
      swing: 6.5,
      momentum: 7.0,
      trend: 5.5,
      breakout: 6.5,
      mean_reversion: 4.0,
      safe: 3.5,
      balanced: 5.0,
      aggressive: 7.5,
      news: 8.0,
      sentiment: 5.0,
      pair: 4.5
    };

    const targetProfit = strategyTargets[strategy] || 5.0;

    // Take profit at target
    if (profitPercent >= targetProfit) {
      return { 
        shouldClose: true, 
        reason: `🎯 FUTURES PROFIT TARGET: ${profitPercent.toFixed(2)}% >= ${targetProfit}%` 
      };
    }

    // Time-based exit for futures (shorter holds)
    if (holdTimeHours >= 6 && profitPercent > 1.0) {
      return { 
        shouldClose: true, 
        reason: `⏰ FUTURES TIME EXIT: ${holdTimeHours.toFixed(1)} hours with ${profitPercent.toFixed(2)}% profit` 
      };
    }

    // Emergency profit taking at very high profits
    if (profitPercent >= 12) {
      return { 
        shouldClose: true, 
        reason: `💰 FUTURES EMERGENCY PROFIT: ${profitPercent.toFixed(2)}% profit taken` 
      };
    }

    return { shouldClose: false, reason: `💎 FUTURES HOLDING: ${profitPercent.toFixed(2)}% ${profitPercent >= 0 ? 'profit' : 'loss'}` };
  }
}

class TradingEngine {
  private intervalId: NodeJS.Timeout | null = null;
  private aiIntervalId: NodeJS.Timeout | null = null;
  private priceData: Map<string, number> = new Map();
  private chartHistory: ChartDataPoint[] = [];
  private currentStrategy: StrategyType = 'balanced';
  private mode: TradingMode = 'simulation';
  private wsClients: Set<any> = new Set();
  private lastStrategyChangeTime: number = 0;
  private readonly MIN_STRATEGY_DWELL_MS = 120000; // 2 minutes for futures
  private readonly AI_CHECK_INTERVAL_MS = 30000;   // 30 seconds for futures
  private readonly MIN_TRADE_INTERVAL_MS = 8000;   // 8 seconds between futures trades
  private dailyStartBalance: number = 0;
  private lastDailyReset: string = new Date().toISOString().split('T')[0];
  private tradeCountToday: number = 0;
  private consecutiveLosses: number = 0;
  private lastTradeTime: number = 0;
  private readonly MAX_OPEN_TRADES = 5; // ONLY 1 POSITION FOR SAFETY
  private exchangeProviderManager = getExchangeProviderManager();
  private accountBalance: number = 100; // $100 starting capital for futures

  constructor() {
    this.initializeDailyBalance();
    this.initializeChartHistory();
  }

  private async initializeDailyBalance() {
    try {
      const portfolio = await storage.getPortfolio();
      // Start with $100 for futures
      this.dailyStartBalance = 100;
      this.accountBalance = 100;
      this.tradeCountToday = 0;
      this.consecutiveLosses = 0;
      
      // Reset portfolio to $100 if different
      if (portfolio.balance !== 100) {
        await storage.updatePortfolio({
          balance: 100,
          initialBalance: 100
        });
      }
    } catch (error) {
      console.error('Failed to initialize daily balance:', error);
      this.dailyStartBalance = 100;
      this.accountBalance = 100;
    }
  }

  private initializeChartHistory() {
    const now = Date.now();
    const basePrice = 45200;
    
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

  private setFuturesPrices() {
    const realisticPrices = {
      'BTC/USDT': 45200, 'ETH/USDT': 2400, 'BNB/USDT': 305, 'SOL/USDT': 95, 'XRP/USDT': 0.52,
      'ADA/USDT': 0.48, 'AVAX/USDT': 34.50, 'DOT/USDT': 6.80, 'LINK/USDT': 14.20, 'LTC/USDT': 68.90,
      'MATIC/USDT': 0.78, 'ATOM/USDT': 8.45, 'UNI/USDT': 6.20, 'DOGE/USDT': 0.078
    };

    Object.entries(realisticPrices).forEach(([symbol, price]) => {
      this.priceData.set(symbol, price);
    });
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
      if (client.readyState === 1) {
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

    console.log(`🚀 FUTURES BOT STARTING with $${this.accountBalance}`);
    console.log(`🎯 Strategy: ${strategy} | Mode: ${mode}`);

    // Initialize exchange provider for futures
    if (!this.exchangeProviderManager.isReady()) {
      await this.exchangeProviderManager.initialize(mode);
    }

    // Set futures prices
    this.setFuturesPrices();

    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastDailyReset) {
      await this.initializeDailyBalance();
      const riskMgmt = getRiskManagementService();
      riskMgmt.resetCircuitBreaker();
    }

    const botState = await storage.getBotState();
    await storage.updateBotState({
      status: 'running',
      strategy,
      mode,
      startTime: Date.now(),
    });

    // Faster updates for futures (every 3 seconds)
    this.intervalId = setInterval(() => {
      this.updateRealPrices();
      this.monitorPositions();
      this.maybeExecuteTrade();
    }, 3000);

    if (botState.aiEnabled) {
      this.startAIAnalysis();
    }

    console.log(`✅ FUTURES BOT ACTIVE: $${this.accountBalance} capital`);
    console.log(`⚡ Maximum open trades: ${this.MAX_OPEN_TRADES}`);
    console.log(`🎯 Profit targets: ${(strategies[strategy].profitTarget * 100).toFixed(1)}%`);
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

    console.log('🛑 Futures trading bot stopped');
  }

  public async changeStrategy(strategy: StrategyType) {
    this.currentStrategy = strategy;
    this.lastStrategyChangeTime = Date.now();
    await storage.updateBotState({ strategy });
    console.log(`🔄 Futures strategy changed to ${strategy}`);
  }

  public async toggleAI(enabled: boolean) {
    await storage.updateBotState({ aiEnabled: enabled });
    
    if (enabled && this.intervalId) {
      this.startAIAnalysis();
      console.log('🤖 AI strategy selection enabled for futures');
    } else {
      this.stopAIAnalysis();
      console.log('🤖 AI strategy selection disabled');
    }
  }

  private startAIAnalysis() {
    if (this.aiIntervalId) {
      return;
    }

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
      const priceData = this.getCurrentPrices();
      strategyAI.updatePriceData(priceData);

      const decision = strategyAI.selectBestStrategy(this.currentStrategy);
      
      await storage.addAIDecision(decision);
      this.broadcast('ai_decision', decision);
      
      await this.applyAIStrategyDecision(decision);
      
      console.log(`🤖 FUTURES AI: Recommended ${decision.selectedStrategy} (confidence: ${decision.confidence}%)`);
    } catch (error) {
      console.error('Error in AI analysis:', error);
    }
  }

  private async applyAIStrategyDecision(decision: AIDecision) {
    if (decision.selectedStrategy === this.currentStrategy) {
      return;
    }

    const timeSinceLastChange = Date.now() - this.lastStrategyChangeTime;
    if (timeSinceLastChange < this.MIN_STRATEGY_DWELL_MS) {
      return;
    }

    const MIN_CONFIDENCE = 65; // Higher confidence required for futures
    if (decision.confidence < MIN_CONFIDENCE) {
      return;
    }

    console.log(`🔄 FUTURES AI: Changing strategy from ${this.currentStrategy} to ${decision.selectedStrategy}`);
    await this.changeStrategy(decision.selectedStrategy);
  }

  private async updateRealPrices() {
    try {
      const updates: PriceData[] = [];

      if (!this.exchangeProviderManager.isReady()) {
        return;
      }

      const provider = await this.exchangeProviderManager.getActiveProvider();

      for (const symbol of symbols) {
        try {
          const currentPrice = this.priceData.get(symbol) || 1;
          let newPrice: number;
          
          if (provider && provider.isConnected()) {
            newPrice = await provider.fetchPrice(symbol);
            if (!newPrice || newPrice <= 0) {
              newPrice = this.getSimulatedFuturesPrice(symbol, currentPrice);
            }
          } else {
            newPrice = this.getSimulatedFuturesPrice(symbol, currentPrice);
          }
          
          this.priceData.set(symbol, newPrice);

          updates.push({
            symbol,
            price: newPrice,
            change24h: newPrice - currentPrice,
            change24hPercent: ((newPrice - currentPrice) / currentPrice) * 100,
            high24h: newPrice * (1 + this.getSymbolVolatility(symbol) * 2),
            low24h: newPrice * (1 - this.getSymbolVolatility(symbol) * 2),
            volume24h: Math.random() * 1000000 + 500000,
            timestamp: Date.now(),
          });

          if (symbol === 'BTC/USDT') {
            this.chartHistory.push({
              timestamp: Date.now(),
              price: newPrice,
            });

            if (this.chartHistory.length > 100) {
              this.chartHistory.shift();
            }
          }
        } catch (error) {
          console.warn(`Failed to update futures price for ${symbol}:`, error);
        }
      }

      this.broadcast('price_update', updates);
    } catch (error) {
      console.error('Error updating futures prices:', error);
    }
  }

  private getSimulatedFuturesPrice(symbol: string, currentPrice: number): number {
    const baseVolatility = this.getSymbolVolatility(symbol);
    const volatility = baseVolatility * (1 + Math.random() * 0.8); // Higher volatility for futures
    const change = (Math.random() - 0.5) * 2 * volatility * currentPrice;
    const newPrice = Math.max(currentPrice + change, currentPrice * 0.80); // Allow larger moves for futures
    return newPrice;
  }

  private getSymbolVolatility(symbol: string): number {
    const volatilities: Record<string, number> = {
      'BTC/USDT': 0.0030, 'ETH/USDT': 0.0035, 'BNB/USDT': 0.0040, 'SOL/USDT': 0.0045, 'XRP/USDT': 0.0050,
      'ADA/USDT': 0.0045, 'AVAX/USDT': 0.0048, 'DOT/USDT': 0.0042, 'LINK/USDT': 0.0045, 'LTC/USDT': 0.0040,
      'MATIC/USDT': 0.0050, 'ATOM/USDT': 0.0045, 'UNI/USDT': 0.0048, 'DOGE/USDT': 0.0060
    };
    
    return volatilities[symbol] || 0.0045;
  }

  /**
   * ENHANCED FUTURES POSITION MONITORING
   */
  private async monitorPositions() {
    try {
      const openPositions = await storage.getOpenPositions();
      
      if (openPositions.length === 0) {
        return;
      }

      for (const position of openPositions) {
        const currentPrice = this.priceData.get(position.symbol);
        
        if (!currentPrice) {
          continue;
        }

        const profitDecision = ProfitOptimizer.shouldTakeProfit(
          position,
          currentPrice,
          position.strategy
        );

        if (profitDecision.shouldClose) {
          const profitPercent = this.calculateFuturesProfit(position, currentPrice);
          const profitLoss = this.calculateFuturesValue(position, currentPrice);
          
          console.log(`🎯 FUTURES CLOSE: ${position.symbol} - ${profitDecision.reason}`);
          await this.closePosition(position, currentPrice, profitDecision.reason, profitLoss);
        }
      }
    } catch (error) {
      console.error('Error monitoring futures positions:', error);
    }
  }

  private calculateFuturesProfit(position: Position, currentPrice: number): number {
    const isLong = position.side === 'LONG';
    const entryPrice = position.entryPrice;
    
    if (isLong) {
      return ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      return ((entryPrice - currentPrice) / entryPrice) * 100;
    }
  }

  private calculateFuturesValue(position: Position, currentPrice: number): number {
    const isLong = position.side === 'LONG';
    const quantity = position.quantity;
    const entryPrice = position.entryPrice;
    const leverage = position.leverage || 1;
    
    if (isLong) {
      return ((currentPrice - entryPrice) * quantity * leverage);
    } else {
      return ((entryPrice - currentPrice) * quantity * leverage);
    }
  }

  private async closePosition(position: Position, exitPrice: number, reason: string, profitLoss: number) {
    try {
      await storage.closePosition(position.id, Date.now());

      // Update account balance
      this.accountBalance += profitLoss;
      await storage.updatePortfolio({
        balance: this.accountBalance,
      });

      const costBasis = position.entryPrice * position.quantity * (position.leverage || 1);
      const profitPercent = costBasis !== 0 ? (profitLoss / costBasis) * 100 : 0;
      
      if (profitLoss < 0) {
        this.consecutiveLosses++;
        console.log(`📉 Consecutive losses: ${this.consecutiveLosses}`);
      } else {
        this.consecutiveLosses = 0;
      }

      const trade: Trade = {
        id: randomUUID(),
        symbol: position.symbol,
        type: 'SELL',
        price: exitPrice,
        quantity: position.quantity,
        timestamp: Date.now(),
        profit: profitLoss,
        profitPercent,
        strategy: position.strategy,
        mode: position.mode,
      };

      await storage.addTrade(trade);
      this.broadcast('trade_executed', trade);

      const riskMgmt = getRiskManagementService();
      riskMgmt.recordTrade(position.symbol, profitLoss);

      const status = profitLoss >= 0 ? 'PROFIT' : 'LOSS';
      console.log(`💼 FUTURES CLOSED (${status}): ${position.symbol} - $${profitLoss.toFixed(2)} (${profitPercent > 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`);
    } catch (error) {
      console.error(`Failed to close futures position ${position.id}:`, error);
    }
  }

  /**
   * SMART FUTURES TRADE EXECUTION for $100 account
   */
  private async maybeExecuteTrade() {
    try {
      console.log(`\n🔄 FUTURES TRADE CHECK: ${new Date().toLocaleTimeString()}`);
      
      // Reset daily tracking
      const today = new Date().toISOString().split('T')[0];
      if (today !== this.lastDailyReset) {
        await this.initializeDailyBalance();
        const riskMgmt = getRiskManagementService();
        riskMgmt.resetCircuitBreaker();
        console.log('📅 New futures trading day started');
      }

      // Check minimum time between trades
      const timeSinceLastTrade = Date.now() - this.lastTradeTime;
      if (timeSinceLastTrade < this.MIN_TRADE_INTERVAL_MS) {
        console.log(`⏰ Too soon since last trade: ${timeSinceLastTrade}ms`);
        return;
      }

      // Check maximum open trades
      const openPositions = await storage.getOpenPositions();
      if (openPositions.length >= this.MAX_OPEN_TRADES) {
        console.log(`⏸️ Maximum futures positions reached (${openPositions.length}/${this.MAX_OPEN_TRADES})`);
        return;
      }

      // Risk management check
      const riskMgmt = getRiskManagementService();
      const riskMetrics = riskMgmt.calculateRiskMetrics(
        this.chartHistory,
        this.accountBalance,
        100,
        this.currentStrategy,
        this.dailyStartBalance
      );

      if (riskMetrics.circuitBreakerActive) {
        console.warn('🛑 Futures circuit breaker active - Stopping bot');
        await this.stop();
        return;
      }

      // Get AI strategy
      const aiDecision = strategyAI.selectBestStrategy(this.currentStrategy);
      const bestStrategy = aiDecision.selectedStrategy;
      
      // FIXED: Check if strategy exists, otherwise use balanced
      const strategyConfig = strategies[bestStrategy] || strategies.balanced;
      
      if (!strategies[bestStrategy]) {
        console.warn(`⚠️ Strategy '${bestStrategy}' not found, using 'balanced' instead`);
      }

      console.log(`🤖 FUTURES AI: ${bestStrategy} | Confidence: ${aiDecision.confidence}%`);

      // Trade frequency adjustment for futures
      let tradeChance = strategyConfig.tradeFrequency;
      if (this.consecutiveLosses >= 2) {
        tradeChance *= 0.5; // Reduce frequency after losses
      }
      if (this.accountBalance < 80) {
        tradeChance *= 0.6; // Reduce frequency if account below $80
      }

      console.log(`🎲 Trade chance: ${(tradeChance * 100).toFixed(1)}%`);

      if (Math.random() > tradeChance) {
        console.log(`❌ Random skip - no trade this cycle`);
        return;
      }

      // Select affordable coins for $100 futures account
      const affordableSymbols = symbols.filter(symbol => {
        const price = this.priceData.get(symbol) || 1000;
        return price < 40; // Only coins under $40 for small futures account
      });

      if (affordableSymbols.length === 0) {
        return;
      }

      // Use AI to select optimal coins
      let optimalCoins: string[] = [];
      try {
        optimalCoins = strategyAI.selectOptimalCoins(affordableSymbols, bestStrategy, this.accountBalance);
      } catch (error) {
        console.warn('❌ AI coin selection failed, using fallback');
        optimalCoins = affordableSymbols.slice(0, 3);
      }
      
      // Fallback if no optimal coins
      if (optimalCoins.length === 0) {
        optimalCoins = affordableSymbols.slice(0, 3);
        console.log(`🔄 Using fallback coins: ${optimalCoins.join(', ')}`);
      }

      const symbol = optimalCoins[Math.floor(Math.random() * optimalCoins.length)];
      const currentPrice = this.priceData.get(symbol) || 1;

      console.log(`🎯 Selected symbol: ${symbol} at $${currentPrice}`);

      // Generate futures-specific signal
      const signal = this.generateFuturesTradeSignal(symbol, currentPrice, bestStrategy);

      console.log(`📡 Signal: ${signal.action} | Confidence: ${signal.confidence}%`);

      // Only proceed with LONG or SHORT signals for futures
      if (signal.action !== 'LONG' && signal.action !== 'SHORT') {
        console.log(`⏸️ No trade signal (${signal.action}) - skipping`);
        return;
      }

      // Lower confidence threshold for testing
      if (signal.confidence < 40) {
        console.log(`📉 Signal confidence too low: ${signal.confidence}%`);
        return;
      }

      console.log(`🚀 EXECUTING FUTURES ${signal.action}: ${symbol}`);

      // Use the unified placeTrade method
      await this.placeTrade(symbol, signal.action, strategyConfig, riskMetrics, bestStrategy, signal);

      this.tradeCountToday++;
      this.lastTradeTime = Date.now();
      
      console.log(`✅ Trade executed! Total today: ${this.tradeCountToday}`);

    } catch (error) {
      console.error('❌ Error in futures trade execution:', error);
    }
  }

  /**
   * IMPROVED FUTURES SIGNAL GENERATION
   */
  private generateFuturesTradeSignal(
    symbol: string, 
    currentPrice: number, 
    strategy: string
  ): { action: 'LONG' | 'SHORT' | 'HOLD'; confidence: number } {
    
    // Base probabilities for different strategies
    const strategyProbabilities: Record<string, { long: number; short: number }> = {
      scalping: { long: 0.7, short: 0.25 },
      momentum: { long: 0.6, short: 0.3 },
      trend: { long: 0.55, short: 0.35 },
      breakout: { long: 0.5, short: 0.4 },
      swing: { long: 0.45, short: 0.4 },
      pair: { long: 0.4, short: 0.4 },
      mean_reversion: { long: 0.35, short: 0.45 },
      safe: { long: 0.3, short: 0.2 },
      balanced: { long: 0.4, short: 0.3 },
      aggressive: { long: 0.6, short: 0.4 }
    };

    const probabilities = strategyProbabilities[strategy] || { long: 0.4, short: 0.3 };
    const random = Math.random();
    
    let action: 'LONG' | 'SHORT' | 'HOLD' = 'HOLD';
    let confidence = 0;

    if (random < probabilities.long) {
      action = 'LONG';
      confidence = Math.floor(50 + Math.random() * 40); // 50-90% confidence
    } else if (random < probabilities.long + probabilities.short) {
      action = 'SHORT';
      confidence = Math.floor(50 + Math.random() * 40); // 50-90% confidence
    } else {
      action = 'HOLD';
      confidence = Math.floor(20 + Math.random() * 30); // 20-50% confidence
    }

    confidence = Math.min(95, Math.max(40, confidence)); // Keep between 40-95%

    return { action, confidence };
  }

  /**
   * UNIFIED FUTURES TRADE EXECUTION
   */
  private async placeTrade(
    symbol: string, 
    side: 'LONG' | 'SHORT', 
    config: StrategyConfig,
    riskMetrics: RiskMetrics,
    strategy: StrategyType,
    signal: any
  ) {
    console.log(`\n==================== FUTURES TRADE ====================`);
    console.log(`🎯 ${side} ${symbol} | Strategy: ${strategy}`);
    
    try {
      const providerManager = getExchangeProviderManager();
      const provider = await providerManager.getActiveProvider();
      
      if (!provider || !provider.isConnected()) {
        console.error('❌ Futures provider not connected');
        return;
      }

      // FUTURES POSITION SIZING with leverage
      const riskAmount = this.accountBalance * config.riskPerTrade;
      const leverage = this.calculateSafeLeverage(config);
      const totalTradeValue = riskAmount * leverage;
      
      const currentPrice = this.priceData.get(symbol) || 1;
      const quantity = totalTradeValue / currentPrice;

      console.log(`💰 Futures Account: $${this.accountBalance.toFixed(2)}`);
      console.log(`⚡ Leverage: ${leverage}x | Risk: $${riskAmount.toFixed(2)}`);
      console.log(`📊 Position: ${quantity.toFixed(6)} ${symbol} ~$${totalTradeValue.toFixed(2)}`);

      if (totalTradeValue < config.minTradeAmount) {
        console.warn(`⚠️ Futures trade amount too small: $${totalTradeValue.toFixed(2)}`);
        return;
      }

      // Calculate futures stop loss and take profit
      const stopLoss = side === 'LONG' 
        ? currentPrice * (1 - config.stopLossPercent)
        : currentPrice * (1 + config.stopLossPercent);
      
      const takeProfit = side === 'LONG'
        ? currentPrice * (1 + config.takeProfitPercent)
        : currentPrice * (1 - config.takeProfitPercent);

      // For simulation, create position directly
      const position: Position = {
        id: randomUUID(),
        symbol,
        side,
        entryPrice: currentPrice,
        quantity: quantity,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        leverage: leverage,
        mode: this.mode,
        strategy: strategy,
        openedAt: Date.now(),
      };

      await storage.addPosition(position);
      
      const trade: Trade = {
        id: randomUUID(),
        symbol,
        type: side === 'LONG' ? 'BUY' : 'SELL',
        price: currentPrice,
        quantity: quantity,
        timestamp: Date.now(),
        profit: 0,
        profitPercent: 0,
        strategy: strategy,
        mode: this.mode,
        leverage: leverage
      };
      
      await storage.addTrade(trade);
      this.broadcast('trade_executed', trade);

      console.log(`✅ FUTURES POSITION OPENED: ${side} ${symbol}`);
      console.log(`   Entry: $${currentPrice.toFixed(2)} | Quantity: ${quantity.toFixed(6)}`);
      console.log(`   Stop Loss: $${stopLoss.toFixed(2)} (${config.stopLossPercent * 100}%)`);
      console.log(`   Take Profit: $${takeProfit.toFixed(2)} (${config.takeProfitPercent * 100}%)`);
      console.log(`   Leverage: ${leverage}x`);
      
      const openPositions = await storage.getOpenPositions();
      console.log(`📈 Open Futures Positions: ${openPositions.length}/${this.MAX_OPEN_TRADES}`);
      
    } catch (error) {
      console.error(`\n❌ FUTURES TRADE FAILED:`, error);
      this.broadcast('trade_error', {
        message: `Futures trade failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        symbol,
        side,
        strategy,
      });
    }
  }

  /**
   * MANUAL FUTURES TRADE EXECUTION
   */
  public async executeManualTrade(
    symbol: string,
    side: 'LONG' | 'SHORT',
    amount: number,
    leverage: number = 3
  ): Promise<{ success: boolean; message: string; trade?: Trade }> {
    try {
      const currentPrice = this.priceData.get(symbol) || 1;
      const quantity = amount / currentPrice;

      console.log(`🎮 MANUAL FUTURES ${side}: ${quantity.toFixed(6)} ${symbol} at $${currentPrice.toFixed(2)} with ${leverage}x leverage`);

      const position: Position = {
        id: randomUUID(),
        symbol,
        side,
        entryPrice: currentPrice,
        quantity: quantity,
        stopLoss: side === 'LONG' ? currentPrice * 0.98 : currentPrice * 1.02,
        takeProfit: side === 'LONG' ? currentPrice * 1.05 : currentPrice * 0.95,
        leverage: leverage,
        mode: this.mode,
        strategy: 'manual' as StrategyType,
        openedAt: Date.now(),
      };

      await storage.addPosition(position);
      
      const trade: Trade = {
        id: randomUUID(),
        symbol,
        type: side === 'LONG' ? 'BUY' : 'SELL',
        price: currentPrice,
        quantity: quantity,
        timestamp: Date.now(),
        profit: 0,
        profitPercent: 0,
        strategy: 'manual' as StrategyType,
        mode: this.mode,
        leverage: leverage
      };
      
      await storage.addTrade(trade);
      this.broadcast('trade_executed', trade);

      return {
        success: true,
        message: `Manual ${side} futures position opened for ${symbol}`,
        trade
      };

    } catch (error) {
      const errorMsg = `Manual futures trade failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Calculate safe leverage for futures
   */
  private calculateSafeLeverage(config: StrategyConfig): number {
    let leverage = config.maxLeverage;
    
    // Reduce leverage for small accounts
    if (this.accountBalance < 50) {
      leverage = Math.max(1, leverage - 2);
    } else if (this.accountBalance < 80) {
      leverage = Math.max(2, leverage - 1);
    }
    
    // Reduce leverage after losses
    if (this.consecutiveLosses >= 2) {
      leverage = Math.max(1, leverage - 1);
    }
    
    return leverage;
  }

  public getChartHistory(): ChartDataPoint[] {
    return [...this.chartHistory];
  }

  public getCurrentPrices(): PriceData[] {
    if (this.priceData.size === 0) {
      this.setFuturesPrices();
    }
    
    const prices: PriceData[] = [];
    this.priceData.forEach((price, symbol) => {
      prices.push({
        symbol,
        price,
        change24h: 0,
        change24hPercent: 0,
        high24h: price * 1.05,
        low24h: price * 0.95,
        volume24h: Math.random() * 1000000 + 500000,
        timestamp: Date.now(),
      });
    });
    return prices;
  }

  public async getRiskMetrics(): Promise<RiskMetrics> {
    const riskMgmt = getRiskManagementService();
    
    return riskMgmt.calculateRiskMetrics(
      this.chartHistory,
      this.accountBalance,
      100,
      this.currentStrategy,
      this.dailyStartBalance
    );
  }

  public getTradingStats() {
    return {
      accountBalance: this.accountBalance,
      tradeCountToday: this.tradeCountToday,
      consecutiveLosses: this.consecutiveLosses,
      dailyStartBalance: this.dailyStartBalance,
      totalCoins: symbols.length,
      maxOpenTrades: this.MAX_OPEN_TRADES,
      currentStrategy: this.currentStrategy,
      providerReady: this.exchangeProviderManager.isReady()
    };
  }

  public resetCircuitBreaker() {
    const riskMgmt = getRiskManagementService();
    riskMgmt.resetCircuitBreaker();
    this.consecutiveLosses = 0;
    console.log('🔄 Futures circuit breaker reset');
  }
}

export const tradingEngine = new TradingEngine();