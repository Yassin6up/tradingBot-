import type { Trade, StrategyType, TradingMode, PriceData, ChartDataPoint, AIDecision, Position } from "@shared/schema";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { strategyAI } from "./services/strategy-ai";
import { getRiskManagementService, type RiskMetrics } from "./services/risk-management";
import { getBinanceService } from "./services/binance";

interface StrategyConfig {
  riskPerTrade: number;
  profitTarget: number;
  minProfit: number;
  maxProfit: number;
  minTradeAmount: number;
  tradeFrequency: number;
}

// Enhanced strategies for low budgets and higher profits
const strategies: Record<string, StrategyConfig> = {
  // Base strategies - INCREASED PROFIT TARGETS
  safe: {
    riskPerTrade: 0.012,
    profitTarget: 0.035,
    minProfit: 0.020,
    maxProfit: 0.045,
    minTradeAmount: 15,
    tradeFrequency: 0.6,
  },
  balanced: {
    riskPerTrade: 0.018,
    profitTarget: 0.055,
    minProfit: 0.035,
    maxProfit: 0.065,
    minTradeAmount: 20,
    tradeFrequency: 0.7,
  },
  aggressive: {
    riskPerTrade: 0.030,
    profitTarget: 0.080,
    minProfit: 0.045,
    maxProfit: 0.095,
    minTradeAmount: 25,
    tradeFrequency: 0.8,
  },
  
  // AI Strategies - ENHANCED for higher returns
  trend: {
    riskPerTrade: 0.015,
    profitTarget: 0.060,
    minProfit: 0.030,
    maxProfit: 0.070,
    minTradeAmount: 18,
    tradeFrequency: 0.65,
  },
  breakout: {
    riskPerTrade: 0.022,
    profitTarget: 0.065,
    minProfit: 0.035,
    maxProfit: 0.075,
    minTradeAmount: 20,
    tradeFrequency: 0.60,
  },
  mean_reversion: {
    riskPerTrade: 0.012,
    profitTarget: 0.040,
    minProfit: 0.020,
    maxProfit: 0.050,
    minTradeAmount: 15,
    tradeFrequency: 0.55,
  },
  scalping: {
    riskPerTrade: 0.010,
    profitTarget: 0.030,
    minProfit: 0.015,
    maxProfit: 0.035,
    minTradeAmount: 25,
    tradeFrequency: 0.75,
  },
  momentum: {
    riskPerTrade: 0.025,
    profitTarget: 0.080,
    minProfit: 0.040,
    maxProfit: 0.090,
    minTradeAmount: 20,
    tradeFrequency: 0.70,
  },
  swing: {
    riskPerTrade: 0.020,
    profitTarget: 0.120,
    minProfit: 0.050,
    maxProfit: 0.140,
    minTradeAmount: 25,
    tradeFrequency: 0.50,
  },
  arbitrage: {
    riskPerTrade: 0.008,
    profitTarget: 0.025,
    minProfit: 0.015,
    maxProfit: 0.030,
    minTradeAmount: 30,
    tradeFrequency: 0.40,
  },
  pair: {
    riskPerTrade: 0.010,
    profitTarget: 0.030,
    minProfit: 0.015,
    maxProfit: 0.035,
    minTradeAmount: 25,
    tradeFrequency: 0.45,
  },
  sentiment: {
    riskPerTrade: 0.015,
    profitTarget: 0.050,
    minProfit: 0.025,
    maxProfit: 0.060,
    minTradeAmount: 18,
    tradeFrequency: 0.60,
  },
  news: {
    riskPerTrade: 0.028,
    profitTarget: 0.085,
    minProfit: 0.045,
    maxProfit: 0.095,
    minTradeAmount: 22,
    tradeFrequency: 0.55,
  }
};

// REAL BINANCE COINS - Top 50+ popular trading pairs with USDT
const symbols = [
  // Major coins
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  
  // Large cap alts
  'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT', 'LTC/USDT',
  'MATIC/USDT', 'ATOM/USDT', 'UNI/USDT', 'ALGO/USDT', 'XLM/USDT',
  
  // Mid cap coins
  'VET/USDT', 'FIL/USDT', 'ETC/USDT', 'EOS/USDT', 'AAVE/USDT',
  'MKR/USDT', 'COMP/USDT', 'SNX/USDT', 'YFI/USDT', 'SAND/USDT',
  
  // Affordable coins for small budgets
  'DOGE/USDT', 'SHIB/USDT', 'TRX/USDT', 'APE/USDT', 'GALA/USDT',
  'MANA/USDT', 'ENJ/USDT', 'CHZ/USDT', 'HOT/USDT', 'BAT/USDT',
  
  // More popular coins
  'NEAR/USDT', 'FTM/USDT', 'GRT/USDT', 'CRV/USDT', '1INCH/USDT',
  'ZIL/USDT', 'IOTA/USDT', 'WAVES/USDT', 'DASH/USDT', 'ZEC/USDT',
  
  // Additional active trading pairs
  'AXS/USDT', 'SUSHI/USDT', 'CELO/USDT', 'KAVA/USDT', 'RVN/USDT',
  'IOST/USDT', 'STORJ/USDT', 'ONT/USDT', 'SC/USDT', 'DGB/USDT'
];

class ProfitOptimizer {
  static shouldTakeProfit(
    position: Position,
    currentPrice: number,
    strategy: string
  ): { shouldClose: boolean; reason: string } {
    const profitPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    const holdTimeHours = (Date.now() - position.openedAt) / (1000 * 60 * 60);

    // 🚨 NEVER SELL AT LOSS - CORE REQUIREMENT
    if (profitPercent < 0) {
      return { shouldClose: false, reason: `Holding at ${profitPercent.toFixed(2)}% loss` };
    }

    // Strategy-specific profit targets
    const strategyTargets: Record<string, number> = {
      scalping: 3.0,
      swing: 12.0,
      momentum: 10.0,
      trend: 8.0,
      breakout: 9.0,
      mean_reversion: 6.0,
      safe: 3.5,
      balanced: 5.5,
      aggressive: 8.0,
      news: 8.5,
      sentiment: 5.0,
      arbitrage: 2.5,
      pair: 3.0
    };

    const targetProfit = strategyTargets[strategy] || 8.0;

    // Take profit at target
    if (profitPercent >= targetProfit) {
      return { 
        shouldClose: true, 
        reason: `Strategy target reached: ${profitPercent.toFixed(2)}% >= ${targetProfit}%` 
      };
    }

    // Time-based exit (max 24 hours)
    if (holdTimeHours >= 24 && profitPercent > 2) {
      return { 
        shouldClose: true, 
        reason: `Time-based exit after ${holdTimeHours.toFixed(1)} hours with ${profitPercent.toFixed(2)}% profit` 
      };
    }

    // Emergency profit taking at very high profits
    if (profitPercent >= 25) {
      return { 
        shouldClose: true, 
        reason: `Emergency profit taking at ${profitPercent.toFixed(2)}% profit` 
      };
    }

    return { shouldClose: false, reason: `Holding with ${profitPercent.toFixed(2)}% profit` };
  }
}

class TradingEngine {
  private intervalId: NodeJS.Timeout | null = null;
  private aiIntervalId: NodeJS.Timeout | null = null;
  private priceData: Map<string, number> = new Map();
  private chartHistory: ChartDataPoint[] = [];
  private currentStrategy: StrategyType = 'balanced';
  private mode: TradingMode = 'paper';
  private wsClients: Set<any> = new Set();
  private lastStrategyChangeTime: number = 0;
  private readonly MIN_STRATEGY_DWELL_MS = 180000;
  private readonly AI_CHECK_INTERVAL_MS = 45000;
  private readonly MIN_TRADE_INTERVAL_MS = 8000;
  private dailyStartBalance: number = 0;
  private lastDailyReset: string = new Date().toISOString().split('T')[0];
  private tradeCountToday: number = 0;
  private consecutiveLosses: number = 0;
  private lastTradeTime: number = 0;
  private readonly MAX_OPEN_TRADES = 10;
  private binanceService: any;
  private testnetBinanceService: any;

  constructor() {
    this.initializeBinanceServices();
    this.initializeDailyBalance();
    this.initializePriceData();
    this.initializeChartHistory();
  }

  private async initializeBinanceServices() {
    try {
      // Initialize Testnet Binance Service for paper trading

      const keys = await storage.getApiKeys("binance")

      this.testnetBinanceService = getBinanceService({
        testnet: true,
        apiKey: process.env.BINANCE_API_KEY ||keys?.apiKey || 'testnet-api-key',
        secret: process.env.BINANCE_SECRET || keys?.secretKey || 'testnet-secret'
      });

      await this.testnetBinanceService.connect();
      console.log('✅ Binance Testnet connected for paper trading');

      // Initialize Real Binance Service for real trading
      this.binanceService = getBinanceService({
        testnet: false,
        apiKey: process.env.BINANCE_API_KEY || keys?.apiKey || 'real-api-key',
        secret: process.env.BINANCE_SECRET || keys?.secretKey || 'real-secret'
      });

      await this.binanceService.connect();
      console.log('✅ Real Binance Spot connected for real trading');

    } catch (error) {
      console.warn('⚠️ Binance services initialization failed:', error);
      this.binanceService = null;
      this.testnetBinanceService = null;
    }
  }

  private async initializeDailyBalance() {
    try {
      const portfolio = await storage.getPortfolio();
      this.dailyStartBalance = portfolio.balance;
      this.tradeCountToday = 0;
      this.consecutiveLosses = 0;
    } catch (error) {
      console.error('Failed to initialize daily balance:', error);
      this.dailyStartBalance = 100;
    }
  }

  private async initializePriceData() {
    try {
      console.log('📊 Fetching real prices from Binance...');
      
      const activeService = this.binanceService || this.testnetBinanceService;
      
      if (activeService && activeService.isApiConnected()) {
        // Fetch real prices from Binance
        for (const symbol of symbols) {
          try {
            const price = await activeService.fetchPrice(symbol);
            if (price && price > 0) {
              this.priceData.set(symbol, price);
              console.log(`✅ ${symbol}: $${price}`);
            }
          } catch (error) {
            console.warn(`⚠️ Could not fetch price for ${symbol}:`, error);
            this.setRealisticFallbackPrice(symbol);
          }
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        console.log('📊 Using fallback prices');
        this.setAllRealisticPrices();
      }
    } catch (error) {
      console.error('Failed to initialize price data:', error);
      this.setAllRealisticPrices();
    }
  }

  private setRealisticFallbackPrice(symbol: string) {
    const realisticPrices: Record<string, number> = {
      'BTC/USDT': 45200, 'ETH/USDT': 2400, 'BNB/USDT': 305, 'SOL/USDT': 95, 'XRP/USDT': 0.52,
      'ADA/USDT': 0.48, 'AVAX/USDT': 34.50, 'DOT/USDT': 6.80, 'LINK/USDT': 14.20, 'LTC/USDT': 68.90,
      'MATIC/USDT': 0.78, 'ATOM/USDT': 8.45, 'UNI/USDT': 6.20, 'ALGO/USDT': 0.18, 'XLM/USDT': 0.11,
      'VET/USDT': 0.028, 'FIL/USDT': 4.80, 'ETC/USDT': 26.30, 'EOS/USDT': 0.72, 'AAVE/USDT': 88.90,
      'MKR/USDT': 1450, 'COMP/USDT': 52.30, 'SNX/USDT': 2.45, 'YFI/USDT': 7850, 'SAND/USDT': 0.45,
      'DOGE/USDT': 0.078, 'SHIB/USDT': 0.0000085, 'TRX/USDT': 0.11, 'APE/USDT': 1.45, 'GALA/USDT': 0.025,
      'MANA/USDT': 0.42, 'ENJ/USDT': 0.30, 'CHZ/USDT': 0.10, 'HOT/USDT': 0.0015, 'BAT/USDT': 0.22,
      'NEAR/USDT': 3.20, 'FTM/USDT': 0.35, 'GRT/USDT': 0.15, 'CRV/USDT': 0.55, '1INCH/USDT': 0.38,
      'ZIL/USDT': 0.020, 'IOTA/USDT': 0.25, 'WAVES/USDT': 2.10, 'DASH/USDT': 28.90, 'ZEC/USDT': 22.50,
      'AXS/USDT': 7.20, 'SUSHI/USDT': 1.05, 'CELO/USDT': 0.65, 'KAVA/USDT': 0.75, 'RVN/USDT': 0.018,
      'IOST/USDT': 0.008, 'STORJ/USDT': 0.60, 'ONT/USDT': 0.25, 'SC/USDT': 0.004, 'DGB/USDT': 0.010
    };
    
    const price = realisticPrices[symbol] || 1.00;
    this.priceData.set(symbol, price);
  }

  private setAllRealisticPrices() {
    const realisticPrices = {
      'BTC/USDT': 45200, 'ETH/USDT': 2400, 'BNB/USDT': 305, 'SOL/USDT': 95, 'XRP/USDT': 0.52,
      'ADA/USDT': 0.48, 'AVAX/USDT': 34.50, 'DOT/USDT': 6.80, 'LINK/USDT': 14.20, 'LTC/USDT': 68.90,
      'MATIC/USDT': 0.78, 'ATOM/USDT': 8.45, 'UNI/USDT': 6.20, 'ALGO/USDT': 0.18, 'XLM/USDT': 0.11,
      'VET/USDT': 0.028, 'FIL/USDT': 4.80, 'ETC/USDT': 26.30, 'EOS/USDT': 0.72, 'AAVE/USDT': 88.90,
      'MKR/USDT': 1450, 'COMP/USDT': 52.30, 'SNX/USDT': 2.45, 'YFI/USDT': 7850, 'SAND/USDT': 0.45,
      'DOGE/USDT': 0.078, 'SHIB/USDT': 0.0000085, 'TRX/USDT': 0.11, 'APE/USDT': 1.45, 'GALA/USDT': 0.025,
      'MANA/USDT': 0.42, 'ENJ/USDT': 0.30, 'CHZ/USDT': 0.10, 'HOT/USDT': 0.0015, 'BAT/USDT': 0.22,
      'NEAR/USDT': 3.20, 'FTM/USDT': 0.35, 'GRT/USDT': 0.15, 'CRV/USDT': 0.55, '1INCH/USDT': 0.38,
      'ZIL/USDT': 0.020, 'IOTA/USDT': 0.25, 'WAVES/USDT': 2.10, 'DASH/USDT': 28.90, 'ZEC/USDT': 22.50,
      'AXS/USDT': 7.20, 'SUSHI/USDT': 1.05, 'CELO/USDT': 0.65, 'KAVA/USDT': 0.75, 'RVN/USDT': 0.018,
      'IOST/USDT': 0.008, 'STORJ/USDT': 0.60, 'ONT/USDT': 0.25, 'SC/USDT': 0.004, 'DGB/USDT': 0.010
    };

    Object.entries(realisticPrices).forEach(([symbol, price]) => {
      this.priceData.set(symbol, price);
    });
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

    // Initialize Binance services if not already done
    if (!this.binanceService || !this.testnetBinanceService) {
      await this.initializeBinanceServices();
    }

    const portfolio = await storage.getPortfolio();
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastDailyReset) {
      this.dailyStartBalance = portfolio.balance;
      this.lastDailyReset = today;
      this.tradeCountToday = 0;
      this.consecutiveLosses = 0;
      const riskMgmt = getRiskManagementService();
      riskMgmt.resetCircuitBreaker();
    } else if (this.dailyStartBalance === 0) {
      this.dailyStartBalance = portfolio.balance;
    }

    const botState = await storage.getBotState();
    await storage.updateBotState({
      status: 'running',
      strategy,
      mode,
      startTime: Date.now(),
    });

    // Update prices every 3 seconds
    this.intervalId = setInterval(() => {
      this.updateRealPrices();
      this.monitorPositions();
      this.maybeExecuteTrade();
    }, 3000);

    if (botState.aiEnabled) {
      this.startAIAnalysis();
    }

    console.log(`💰 Trading bot started with ${strategy} strategy in ${mode} mode`);
    console.log(`📊 Initial balance: $${this.dailyStartBalance.toFixed(2)}`);
    console.log(`🎯 Trading ${symbols.length} real Binance coins`);
    console.log(`📈 Maximum open trades: ${this.MAX_OPEN_TRADES}`);
    
    if (mode === 'real' && this.binanceService) {
      console.log('🔗 Connected to REAL Binance Spot trading');
    } else if (mode === 'paper' && this.testnetBinanceService) {
      console.log('🔗 Connected to Binance Testnet for paper trading');
    }
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

    console.log('🛑 Trading bot stopped');
  }

  public async changeStrategy(strategy: StrategyType) {
    this.currentStrategy = strategy;
    this.lastStrategyChangeTime = Date.now();
    await storage.updateBotState({ strategy });
    console.log(`🔄 Strategy changed to ${strategy}`);
  }

  public async toggleAI(enabled: boolean) {
    await storage.updateBotState({ aiEnabled: enabled });
    
    if (enabled && this.intervalId) {
      this.startAIAnalysis();
      console.log('🤖 AI strategy selection enabled');
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
      
      console.log(`🤖 AI Analysis: Recommended ${decision.selectedStrategy} (confidence: ${decision.confidence}%)`);
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

    const MIN_CONFIDENCE = 60;
    if (decision.confidence < MIN_CONFIDENCE) {
      return;
    }

    console.log(`🔄 AI: Changing strategy from ${this.currentStrategy} to ${decision.selectedStrategy}`);
    await this.changeStrategy(decision.selectedStrategy);
  }

  private async updateRealPrices() {
    try {
      const updates: PriceData[] = [];

      // Use appropriate Binance service based on mode
      const activeService = this.mode === 'real' ? this.binanceService : this.testnetBinanceService;

      // Fetch prices in batches
      for (let i = 0; i < symbols.length; i += 10) {
        const batch = symbols.slice(i, i + 10);
        
        await Promise.all(batch.map(async (symbol) => {
          try {
            const currentPrice = this.priceData.get(symbol) || 1;
            let newPrice: number;
            
            if (activeService && activeService.isApiConnected()) {
              newPrice = await activeService.fetchPrice(symbol);
              if (!newPrice || newPrice <= 0) {
                newPrice = this.getSimulatedPrice(symbol, currentPrice);
              }
            } else {
              newPrice = this.getSimulatedPrice(symbol, currentPrice);
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
            console.warn(`Failed to update price for ${symbol}:`, error);
          }
        }));

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      this.broadcast('price_update', updates);
    } catch (error) {
      console.error('Error updating real prices:', error);
    }
  }

  private getSimulatedPrice(symbol: string, currentPrice: number): number {
    const baseVolatility = this.getSymbolVolatility(symbol);
    const volatility = baseVolatility * (1 + Math.random() * 0.4);
    const change = (Math.random() - 0.5) * 2 * volatility * currentPrice;
    const newPrice = Math.max(currentPrice + change, currentPrice * 0.9);
    return newPrice;
  }

  private getSymbolVolatility(symbol: string): number {
    const volatilities: Record<string, number> = {
      'BTC/USDT': 0.0018, 'ETH/USDT': 0.0022, 'BNB/USDT': 0.0028, 'SOL/USDT': 0.0032, 'XRP/USDT': 0.0035,
      'ADA/USDT': 0.0035, 'AVAX/USDT': 0.0038, 'DOT/USDT': 0.0030, 'LINK/USDT': 0.0032, 'LTC/USDT': 0.0028,
      'MATIC/USDT': 0.0030, 'ATOM/USDT': 0.0032, 'UNI/USDT': 0.0035, 'ALGO/USDT': 0.0040, 'XLM/USDT': 0.0038,
      'VET/USDT': 0.0042, 'FIL/USDT': 0.0038, 'ETC/USDT': 0.0032, 'EOS/USDT': 0.0035, 'AAVE/USDT': 0.0045,
      'MKR/USDT': 0.0040, 'COMP/USDT': 0.0042, 'SNX/USDT': 0.0045, 'YFI/USDT': 0.0048, 'SAND/USDT': 0.0040,
      'DOGE/USDT': 0.0050, 'SHIB/USDT': 0.0060, 'TRX/USDT': 0.0035, 'APE/USDT': 0.0045, 'GALA/USDT': 0.0055,
      'MANA/USDT': 0.0042, 'ENJ/USDT': 0.0040, 'CHZ/USDT': 0.0038, 'HOT/USDT': 0.0050, 'BAT/USDT': 0.0035,
      'NEAR/USDT': 0.0040, 'FTM/USDT': 0.0042, 'GRT/USDT': 0.0045, 'CRV/USDT': 0.0040, '1INCH/USDT': 0.0042,
      'ZIL/USDT': 0.0045, 'IOTA/USDT': 0.0038, 'WAVES/USDT': 0.0040, 'DASH/USDT': 0.0035, 'ZEC/USDT': 0.0038,
      'AXS/USDT': 0.0042, 'SUSHI/USDT': 0.0040, 'CELO/USDT': 0.0038, 'KAVA/USDT': 0.0035, 'RVN/USDT': 0.0045,
      'IOST/USDT': 0.0048, 'STORJ/USDT': 0.0040, 'ONT/USDT': 0.0038, 'SC/USDT': 0.0050, 'DGB/USDT': 0.0045
    };
    
    return volatilities[symbol] || 0.003;
  }

  /**
   * ENHANCED position monitoring - NEVER sell at loss
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
          const profitPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
          const profitLoss = (currentPrice - position.entryPrice) * position.quantity;
          
          let safeProfitLoss = profitLoss;
          if (isNaN(profitLoss) || !isFinite(profitLoss)) {
            console.warn(`⚠️ Invalid profitLoss calculation for ${position.symbol}`);
            const safeEntryPrice = isNaN(position.entryPrice) ? 0 : position.entryPrice;
            const safeQuantity = isNaN(position.quantity) ? 0 : position.quantity;
            const safeCurrentPrice = isNaN(currentPrice) ? safeEntryPrice : currentPrice;
            safeProfitLoss = (safeCurrentPrice - safeEntryPrice) * safeQuantity;
          }

          console.log(`✅ SMART PROFIT TAKING: ${position.symbol} - ${profitDecision.reason}`);
          await this.closePosition(position, currentPrice, profitDecision.reason, safeProfitLoss);
        } else {
          console.log(`💎 HOLDING: ${position.symbol} - ${profitDecision.reason}`);
          
          const profitPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
          if (profitPercent < 0) {
            const widerStopLoss = position.entryPrice * 0.90;
            if (position.stopLoss > widerStopLoss) {
              await storage.updatePositionStopLoss(position.id, widerStopLoss);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring positions:', error);
    }
  }

  private async closePosition(position: Position, exitPrice: number, reason: string, profitLoss: number) {
    try {
      const safeExitPrice = isNaN(exitPrice) ? position.entryPrice : exitPrice;
      const safeProfitLoss = isNaN(profitLoss) ? 0 : profitLoss;
      
      console.log("🔍 CLOSE POSITION VALIDATION:", {
        symbol: position.symbol,
        entryPrice: position.entryPrice,
        quantity: position.quantity,
        exitPrice: safeExitPrice,
        profitLoss: safeProfitLoss,
        allValuesValid: !isNaN(position.entryPrice) && !isNaN(position.quantity) && !isNaN(safeExitPrice) && !isNaN(safeProfitLoss)
      });

      await storage.closePosition(position.id, Date.now());

      const portfolio = await storage.getPortfolio();
      await storage.updatePortfolio({
        balance: portfolio.balance + safeProfitLoss,
      });

      const costBasis = position.entryPrice * position.quantity;
      const profitPercent = costBasis !== 0 ? (safeProfitLoss / costBasis) * 100 : 0;
      
      if (safeProfitLoss < 0) {
        this.consecutiveLosses++;
        console.log(`📉 Consecutive losses: ${this.consecutiveLosses}`);
      } else {
        this.consecutiveLosses = 0;
      }

      console.log("================== Trade SELL ========================");
      console.log("profit:", safeProfitLoss);
      console.log("profitPercent:", profitPercent);
      console.log("=======================================================");

      const trade: Trade = {
        id: randomUUID(),
        symbol: position.symbol,
        type: 'SELL',
        price: safeExitPrice,
        quantity: position.quantity,
        timestamp: Date.now(),
        profit: safeProfitLoss,
        profitPercent,
        strategy: position.strategy,
        mode: position.mode,
      };

      await storage.addTrade(trade);
      this.broadcast('trade_executed', trade);

      const riskMgmt = getRiskManagementService();
      riskMgmt.recordTrade(position.symbol, safeProfitLoss);

      console.log(`💼 CLOSED (${reason}): ${position.symbol} - $${safeProfitLoss.toFixed(2)} (${profitPercent > 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`);
    } catch (error) {
      console.error(`Failed to close position ${position.id}:`, error);
    }
  }

  /**
   * IMPROVED trade execution with MAX OPEN TRADES limit
   */
  private async maybeExecuteTrade() {
    try {
      // Reset daily tracking
      const today = new Date().toISOString().split('T')[0];
      if (today !== this.lastDailyReset) {
        const portfolio = await storage.getPortfolio();
        this.dailyStartBalance = portfolio.balance;
        this.lastDailyReset = today;
        this.tradeCountToday = 0;
        this.consecutiveLosses = 0;
        
        const riskMgmt = getRiskManagementService();
        riskMgmt.resetCircuitBreaker();
        console.log('📅 New trading day started');
      }

      // Check minimum time between trades
      const timeSinceLastTrade = Date.now() - this.lastTradeTime;
      if (timeSinceLastTrade < this.MIN_TRADE_INTERVAL_MS) {
        return;
      }

      // 🚨 CRITICAL: Check maximum open trades limit
      const openPositions = await storage.getOpenPositions();
      if (openPositions.length >= this.MAX_OPEN_TRADES) {
        console.log(`⏸️ Maximum open trades reached (${openPositions.length}/${this.MAX_OPEN_TRADES}) - waiting for positions to close`);
        return;
      }

      // Check risk management
      const portfolio = await storage.getPortfolio();
      const riskMgmt = getRiskManagementService();
      const riskMetrics = riskMgmt.calculateRiskMetrics(
        this.chartHistory,
        portfolio.balance,
        portfolio.initialBalance,
        this.currentStrategy,
        this.dailyStartBalance
      );

      if (riskMetrics.circuitBreakerActive) {
        console.warn('🛑 Circuit breaker active - Stopping bot');
        await this.stop();
        return;
      }

      // Get AI strategy recommendation
      const aiDecision = strategyAI.selectBestStrategy(this.currentStrategy);
      const bestStrategy = aiDecision.selectedStrategy;
      
      const bestStrategyConfig = strategies[bestStrategy];
      if (!bestStrategyConfig) {
        console.error('❌ Invalid strategy configuration');
        return;
      }

      // Trade frequency
      let tradeChance = bestStrategyConfig.tradeFrequency * 1.2;
      if (this.consecutiveLosses >= 3) {
        tradeChance *= 0.8;
      }

      if (Math.random() > tradeChance) {
        return;
      }

      console.log(`🤖 AI Selected Strategy: ${bestStrategy} (confidence: ${aiDecision.confidence}%)`);
      console.log(`📊 Top 3 Strategies: ${aiDecision.strategyScores.slice(0, 3).map(s => `${s.strategy}(${s.score})`).join(', ')}`);
      console.log(`📈 Open Positions: ${openPositions.length}/${this.MAX_OPEN_TRADES}`);

      // For small budgets, use affordable coins
      let availableSymbols = symbols;
      if (portfolio.balance < 200) {
        availableSymbols = symbols.filter(symbol => {
          const price = this.priceData.get(symbol) || 1000;
          return price < 15;
        });
        console.log(`💰 Small budget mode: ${availableSymbols.length} affordable coins`);
      }

      // Check existing positions for SELL signals first
      if (openPositions.length > 0) {
        for (const position of openPositions) {
          const currentPrice = this.priceData.get(position.symbol);
          if (!currentPrice) continue;

          const positionSignal = strategyAI.generateTradeSignals(
            position.symbol, 
            currentPrice, 
            position.strategy, 
            position.entryPrice
          );

          const profitPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
          if (positionSignal.action === 'SELL' && profitPercent > 0) {
            console.log(`💰 Profit-taking opportunity: ${position.symbol} at ${profitPercent.toFixed(2)}% profit`);
            
            const tradeConfig = this.getStrategyConfig(position.strategy);
            if (this.mode === 'real') {
              await this.executeRealTrade(position.symbol, 'SELL', tradeConfig, riskMetrics, position.strategy, positionSignal);
            } else {
              await this.executeTestnetTrade(position.symbol, 'SELL', tradeConfig, riskMetrics, position.strategy, positionSignal);
            }
            
            this.tradeCountToday++;
            this.lastTradeTime = Date.now();
            return;
          }
        }
      }

      // 🚨 Only proceed with BUY if we have capacity
      if (openPositions.length >= this.MAX_OPEN_TRADES) {
        console.log(`⏸️ Maximum open positions reached (${openPositions.length}/${this.MAX_OPEN_TRADES}) - waiting for some to close`);
        return;
      }

      // Use primary strategy to pick coins for BUY
      let optimalCoins = strategyAI.selectOptimalCoins(availableSymbols, bestStrategy, portfolio.balance);
      
      // FALLBACK SYSTEM
      if (optimalCoins.length === 0) {
        console.log(`🤖 No coins found for ${bestStrategy} - trying alternative strategies`);
        
        const alternativeStrategies = aiDecision.strategyScores
          .slice(1, 4)
          .filter(score => score.score >= 40);
        
        for (const altStrategy of alternativeStrategies) {
          optimalCoins = strategyAI.selectOptimalCoins(availableSymbols, altStrategy.strategy, portfolio.balance);
          if (optimalCoins.length > 0) {
            console.log(`🤖 Using alternative strategy: ${altStrategy.strategy} (score: ${altStrategy.score})`);
            break;
          }
        }
      }

      // ULTIMATE FALLBACK: If still no coins, use dynamic selection
      if (optimalCoins.length === 0) {
        console.log('🤖 No optimal coins found - using dynamic fallback selection');
        optimalCoins = this.getFallbackCoins(availableSymbols, portfolio.balance, aiDecision.strategyScores);
      }

      if (optimalCoins.length === 0) {
        console.log('❌ No suitable coins found across all strategies');
        return;
      }

      // Select random coin from optimal coins
      const symbol = optimalCoins[Math.floor(Math.random() * optimalCoins.length)];
      
      // Determine which strategy to use for this specific trade
      const tradeStrategy = this.selectTradeStrategy(symbol, aiDecision.strategyScores, portfolio.balance);
      
      // Generate BUY signal
      const currentPrice = this.priceData.get(symbol) || 1000;
      const signal = strategyAI.generateTradeSignals(symbol, currentPrice, tradeStrategy, undefined);

      // 🚨 CRITICAL SAFETY CHECK: Only execute BUY signals for new positions
      if (signal.action !== 'BUY') {
        console.log(`⏸️ AI suggested ${signal.action} for ${symbol} - but no position exists. Skipping.`);
        if (signal.reasons.length > 0) {
          console.log(`   Reasons: ${signal.reasons.join(', ')}`);
        }
        return;
      }

      console.log(`🟢 ${tradeStrategy.toUpperCase()} BUY Signal for ${symbol}: ${signal.confidence}% confidence`);
      if (signal.reasons.length > 0) {
        console.log(`   Reasons: ${signal.reasons.join(', ')}`);
      }

      // Get the CORRECT strategy configuration for the selected trade strategy
      const tradeConfig = this.getStrategyConfig(tradeStrategy);
      
      if (this.mode === 'real') {
        await this.executeRealTrade(symbol, 'BUY', tradeConfig, riskMetrics, tradeStrategy, signal);
      } else {
        await this.executeTestnetTrade(symbol, 'BUY', tradeConfig, riskMetrics, tradeStrategy, signal);
      }

      this.tradeCountToday++;
      this.lastTradeTime = Date.now();
    } catch (error) {
      console.error('Error in trade execution:', error);
    }
  }

  /**
   * REAL BINANCE SPOT TRADING
   */
  private async executeRealTrade(
    symbol: string, 
    type: 'BUY' | 'SELL', 
    config: StrategyConfig,
    riskMetrics: RiskMetrics,
    strategy: string,
    signal?: any
  ) {
    console.log(`\n==================== REAL BINANCE SPOT TRADE ====================`);
    console.log(`🎯 ${type} ${symbol} | Strategy: ${strategy}`);
    
    try {
      if (!this.binanceService || !this.binanceService.isApiConnected()) {
        console.error('❌ Real Binance Spot not connected');
        return;
      }

      // Get REAL balance from Binance Spot
      const realBalance = await this.binanceService.getTotalBalanceUSDT();
      
      // Position sizing
      const basePositionSize = riskMetrics.recommendedPositionSize;
      let tradeAmount = Math.min(basePositionSize * 1.3, realBalance * config.riskPerTrade * 1.2);
      tradeAmount = Math.max(tradeAmount, config.minTradeAmount);
      tradeAmount = Math.min(tradeAmount, realBalance * 0.90);

      console.log(`💰 Real Binance Balance: $${realBalance.toFixed(2)} | Trade: $${tradeAmount.toFixed(2)}`);
      console.log(`🎯 Strategy: ${strategy} | Target: ${(config.profitTarget * 100).toFixed(1)}%`);

      if (tradeAmount < config.minTradeAmount) {
        console.warn(`⚠️ Trade amount too small: $${tradeAmount.toFixed(2)}`);
        return;
      }

      let order: any;
      let quantity: number;
      const currentPrice = await this.binanceService.fetchPrice(symbol);

      if (type === 'BUY') {
        console.log(`🛒 BUYING ${symbol} on Real Binance Spot...`);
        order = await this.binanceService.placeBuyOrder(symbol, tradeAmount);
        quantity = order.filled || (tradeAmount / currentPrice);
        
        if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
          console.error(`❌ Invalid quantity from Binance for ${symbol}`);
          quantity = tradeAmount / currentPrice;
          if (isNaN(quantity) || quantity <= 0) {
            console.error(`❌ REAL: Invalid quantity (${quantity}) for ${symbol}, aborting trade`);
            return;
          }
        }
        
        const entryPrice = order.average || currentPrice;
        
        const stopLossPrice = signal?.suggestedStopLoss || entryPrice * (1 - config.riskPerTrade);
        const takeProfitPrice = signal?.suggestedTakeProfit || entryPrice * (1 + config.profitTarget);

        const position: Position = {
          id: randomUUID(),
          symbol,
          side: 'LONG',
          entryPrice,
          quantity,
          stopLoss: stopLossPrice,
          takeProfit: takeProfitPrice,
          mode: 'real',
          strategy: strategy,
          openedAt: Date.now(),
        };

        await storage.addPosition(position);
        
        const trade: Trade = {
          id: randomUUID(),
          symbol,
          type: 'BUY',
          price: entryPrice,
          quantity,
          timestamp: Date.now(),
          profit: 0,
          profitPercent: 0,
          strategy: strategy,
          mode: 'real',
        };
        
        await storage.addTrade(trade);
        this.broadcast('trade_executed', trade);

        console.log(`📍 REAL BINANCE POSITION OPENED: ${symbol} at $${entryPrice.toFixed(2)}`);
        console.log(`   Stop-Loss: $${stopLossPrice.toFixed(2)} | Take-Profit: $${takeProfitPrice.toFixed(2)}`);
        
        const openPositions = await storage.getOpenPositions();
        console.log(`📈 Open Positions: ${openPositions.length}/${this.MAX_OPEN_TRADES}`);
      } else {
        const asset = symbol.split('/')[0];
        const assetBalance = await this.binanceService.getAssetBalance(asset);
        
        if (assetBalance === 0) {
          console.warn(`⚠️ No ${asset} to sell`);
          return;
        }
        
        quantity = Math.min(assetBalance, tradeAmount / currentPrice);
        
        if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
          console.error(`❌ Invalid sell quantity for ${symbol}`);
          return;
        }
        
        order = await this.binanceService.placeSellOrder(symbol, quantity);
        
        const trade: Trade = {
          id: randomUUID(),
          symbol,
          type: 'SELL',
          price: order.average || currentPrice,
          quantity,
          timestamp: Date.now(),
          profit: 0,
          profitPercent: 0,
          strategy: strategy,
          mode: 'real',
        };
        
        await storage.addTrade(trade);
        this.broadcast('trade_executed', trade);

        console.log(`✅ REAL BINANCE SELL COMPLETED: ${quantity.toFixed(6)} ${symbol}`);
      }

      console.log(`✅ REAL BINANCE ${type} COMPLETED: ${quantity.toFixed(6)} ${symbol}`);
      console.log('==========================================================\n');
    } catch (error) {
      console.error(`\n❌ REAL BINANCE TRADE FAILED:`, error);
      this.broadcast('trade_error', {
        message: `Real Binance trade failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        symbol,
        type,
        strategy,
      });
    }
  }

  /**
   * BINANCE TESTNET TRADING (Paper Trading)
   */
  private async executeTestnetTrade(
    symbol: string, 
    type: 'BUY' | 'SELL', 
    config: StrategyConfig,
    riskMetrics: RiskMetrics,
    strategy: string,
    signal?: any
  ) {
    console.log(`\n==================== BINANCE TESTNET TRADE ====================`);
    console.log(`🎯 ${type} ${symbol} | Strategy: ${strategy}`);
    
    try {
      if (!this.testnetBinanceService || !this.testnetBinanceService.isApiConnected()) {
        console.error('❌ Binance Testnet not connected');
        return;
      }

      // Get Testnet balance from Binance
      const testnetBalance = await this.testnetBinanceService.getTotalBalanceUSDT();
      
      // Position sizing
      const basePositionSize = riskMetrics.recommendedPositionSize;
      let tradeAmount = Math.min(basePositionSize * 1.3, testnetBalance * config.riskPerTrade * 1.2);
      tradeAmount = Math.max(tradeAmount, config.minTradeAmount);
      tradeAmount = Math.min(tradeAmount, testnetBalance * 0.90);

      console.log(`💰 Binance Testnet Balance: $${testnetBalance.toFixed(2)} | Trade: $${tradeAmount.toFixed(2)}`);
      console.log(`🎯 Strategy: ${strategy} | Target: ${(config.profitTarget * 100).toFixed(1)}%`);

      if (tradeAmount < config.minTradeAmount) {
        console.warn(`⚠️ Trade amount too small: $${tradeAmount.toFixed(2)}`);
        return;
      }

      let order: any;
      let quantity: number;
      const currentPrice = await this.testnetBinanceService.fetchPrice(symbol);
console.log(`Current Price for ${symbol} on Testnet: $${currentPrice}`);
      if (type === 'BUY') {
        console.log(`🛒 BUYING ${symbol} on Binance Testnet...`);
        order = await this.testnetBinanceService.placeBuyOrder(symbol, tradeAmount);
        quantity = order.filled || (tradeAmount / currentPrice);
        
        if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
          console.error(`❌ Invalid quantity from Binance Testnet for ${symbol}`);
          quantity = tradeAmount / currentPrice;
          if (isNaN(quantity) || quantity <= 0) {
            console.error(`❌ TESTNET: Invalid quantity (${quantity}) for ${symbol}, aborting trade`);
            return;
          }
        }
        
        const entryPrice = order.average || currentPrice;
        
        const stopLossPrice = signal?.suggestedStopLoss || entryPrice * (1 - config.riskPerTrade);
        const takeProfitPrice = signal?.suggestedTakeProfit || entryPrice * (1 + config.profitTarget);

        const position: Position = {
          id: randomUUID(),
          symbol,
          side: 'LONG',
          entryPrice,
          quantity,
          stopLoss: stopLossPrice,
          takeProfit: takeProfitPrice,
          mode: 'paper',
          strategy: strategy,
          openedAt: Date.now(),
        };

        await storage.addPosition(position);
        
        const trade: Trade = {
          id: randomUUID(),
          symbol,
          type: 'BUY',
          price: entryPrice,
          quantity,
          timestamp: Date.now(),
          profit: 0,
          profitPercent: 0,
          strategy: strategy,
          mode: 'paper',
        };
        
        await storage.addTrade(trade);
        this.broadcast('trade_executed', trade);

        console.log(`📍 BINANCE TESTNET POSITION OPENED: ${symbol} at $${entryPrice.toFixed(2)}`);
        console.log(`   Stop-Loss: $${stopLossPrice.toFixed(2)} | Take-Profit: $${takeProfitPrice.toFixed(2)}`);
        
        const openPositions = await storage.getOpenPositions();
        console.log(`📈 Open Positions: ${openPositions.length}/${this.MAX_OPEN_TRADES}`);
      } else {
        const asset = symbol.split('/')[0];
        const assetBalance = await this.testnetBinanceService.getAssetBalance(asset);
        
        console.log(`Current ${asset} Balance on Testnet: ${assetBalance}`);
        if (assetBalance === 0) {
          console.warn(`⚠️ No ${asset} to sell`);
          return;
        }
        
        quantity = Math.min(assetBalance, tradeAmount / currentPrice);
        
        if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
          console.error(`❌ Invalid sell quantity for ${symbol}`);
          return;
        }
        
        order = await this.testnetBinanceService.placeSellOrder(symbol, quantity);
        
        const trade: Trade = {
          id: randomUUID(),
          symbol,
          type: 'SELL',
          price: order.average || currentPrice,
          quantity,
          timestamp: Date.now(),
          profit: 0,
          profitPercent: 0,
          strategy: strategy,
          mode: 'paper',
        };
        
        await storage.addTrade(trade);
        this.broadcast('trade_executed', trade);

        console.log(`✅ BINANCE TESTNET SELL COMPLETED: ${quantity.toFixed(6)} ${symbol}`);
      }

      console.log(`✅ BINANCE TESTNET ${type} COMPLETED: ${quantity.toFixed(6)} ${symbol}`);
      console.log('==========================================================\n');
    } catch (error) {
      console.error(`\n❌ BINANCE TESTNET TRADE FAILED:`, error);
      this.broadcast('trade_error', {
        message: `Binance Testnet trade failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        symbol,
        type,
        strategy,
      });
    }
  }

  /**
   * Fallback coin selection when no optimal coins found
   */
  private getFallbackCoins(availableSymbols: string[], budget: number, strategyScores: any[]): string[] {
    // Get coins with recent price movement
    const activeCoins = availableSymbols.filter(symbol => {
      const history = this.priceData.get(symbol);
      if (!history) return false;
      
      // Check for recent activity (price change > 1%)
      const prices = Array.from(this.priceData.values()).slice(-5);
      if (prices.length < 2) return true;
      
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const change = ((maxPrice - minPrice) / minPrice) * 100;
      return change > 1;
    });

    // If we have active coins, use them
    if (activeCoins.length > 0) {
      return activeCoins.slice(0, 8);
    }

    // Otherwise, use affordable coins based on budget
    const priceLimit = budget < 200 ? 10 : budget < 1000 ? 50 : 100;
    return availableSymbols.filter(symbol => {
      const price = this.priceData.get(symbol) || 1000;
      return price < priceLimit;
    }).slice(0, 10);
  }

  /**
   * Select the best strategy for a specific symbol
   */
  private selectTradeStrategy(symbol: string, strategyScores: any[], budget: number): string {
    const history = this.priceData.get(symbol);
    if (!history) return strategyScores[0].strategy;

    // Try each strategy to see which works best for this coin
    const strategySuitability = new Map<string, number>();
    
    strategyScores.slice(0, 5).forEach(score => {
      const optimalCoins = strategyAI.selectOptimalCoins([symbol], score.strategy, budget);
      if (optimalCoins.length > 0) {
        strategySuitability.set(score.strategy, score.score);
      }
    });

    if (strategySuitability.size > 0) {
      // Return the highest scoring suitable strategy
      const bestStrategy = Array.from(strategySuitability.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      return bestStrategy;
    }

    // Default to the overall best strategy
    return strategyScores[0].strategy;
  }

  /**
   * Get strategy-specific configuration
   */
  private getStrategyConfig(strategy: string): StrategyConfig {
    // First check if it's one of our base strategies
    if (strategies[strategy as StrategyType]) {
      return strategies[strategy as StrategyType];
    }

    // If it's an AI strategy, use balanced as base and modify
    const baseConfig = strategies.balanced;
    
    const strategyConfigs: Record<string, Partial<StrategyConfig>> = {
      trend: {
        profitTarget: baseConfig.profitTarget * 1.15,
        riskPerTrade: baseConfig.riskPerTrade * 1.1,
      },
      breakout: {
        profitTarget: baseConfig.profitTarget * 1.25,
        riskPerTrade: baseConfig.riskPerTrade * 1.2,
      },
      mean_reversion: {
        profitTarget: baseConfig.profitTarget * 0.9,
        riskPerTrade: baseConfig.riskPerTrade * 0.9,
      },
      scalping: {
        profitTarget: baseConfig.profitTarget * 0.8,
        riskPerTrade: baseConfig.riskPerTrade * 0.8,
        minTradeAmount: Math.max(baseConfig.minTradeAmount, 25),
      },
      momentum: {
        profitTarget: baseConfig.profitTarget * 1.2,
        riskPerTrade: baseConfig.riskPerTrade * 1.15,
      },
      swing: {
        profitTarget: baseConfig.profitTarget * 1.4,
        riskPerTrade: baseConfig.riskPerTrade * 1.1,
      },
      arbitrage: {
        profitTarget: baseConfig.profitTarget * 0.8,
        riskPerTrade: baseConfig.riskPerTrade * 0.7,
      },
    };

    const configOverride = strategyConfigs[strategy] || {};
    return { ...baseConfig, ...configOverride };
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
        volume24h: Math.random() * 1000000 + 500000,
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
    this.consecutiveLosses = 0;
    console.log('🔄 Circuit breaker reset');
  }

  public getTradingStats() {
    return {
      tradeCountToday: this.tradeCountToday,
      consecutiveLosses: this.consecutiveLosses,
      dailyStartBalance: this.dailyStartBalance,
      totalCoins: symbols.length,
      maxOpenTrades: this.MAX_OPEN_TRADES,
      usingRealBinance: this.binanceService !== null,
      usingTestnet: this.testnetBinanceService !== null
    };
  }

  /**
   * Test Binance connection
   */
  public async testBinanceConnection(mode: 'real' | 'paper'): Promise<{ success: boolean; message: string }> {
    try {
      const service = mode === 'real' ? this.binanceService : this.testnetBinanceService;
      
      if (!service) {
        return {
          success: false,
          message: `${mode === 'real' ? 'Real Binance' : 'Testnet'} service not initialized`
        };
      }

      const result = await service.testConnection();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get Binance balance
   */
  public async getBinanceBalance(mode: 'real' | 'paper'): Promise<{ total: number; assets: Record<string, number> }> {
    try {
      const service = mode === 'real' ? this.binanceService : this.testnetBinanceService;
      
      if (!service) {
        throw new Error(`${mode === 'real' ? 'Real Binance' : 'Testnet'} service not initialized`);
      }

      const balance = await service.getSimplifiedBalance();
      return balance;
    } catch (error) {
      console.error(`Failed to get ${mode} balance:`, error);
      return { total: 0, assets: {} };
    }
  }
}

export const tradingEngine = new TradingEngine();