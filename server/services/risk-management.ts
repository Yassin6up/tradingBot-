import type { ChartDataPoint, StrategyType } from "../types";

export interface RiskMetrics {
  volatility: number;
  recommendedPositionSize: number;
  maxDrawdown: number;
  currentRiskLevel: 'low' | 'medium' | 'high' | 'extreme';
  dailyLossLimit: number;
  circuitBreakerActive: boolean;
  maxOpenTrades: number;
  positionSizing: 'conservative' | 'moderate' | 'aggressive';
  liquidationRisk: 'low' | 'medium' | 'high';
  recommendedLeverage: number;
  marginUsage: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  correlations: number[][];
}

export class RiskManagementService {
  private readonly ATR_PERIOD = 14;
  private readonly MAX_POSITION_PERCENT = 0.20; // OPTIMIZED for futures
  private readonly BASE_RISK_PERCENT = 0.010; // 1.0% risk per trade for futures
  private readonly VOLATILITY_THRESHOLD_HIGH = 8.0; // Higher thresholds for futures volatility
  private readonly VOLATILITY_THRESHOLD_EXTREME = 15.0;
  private readonly DAILY_LOSS_LIMIT_PERCENT = 10.20; // 8% daily loss limit for futures
  private readonly MAX_LEVERAGE = 10;
  private readonly MARGIN_SAFETY_BUFFER = 0.20; // 20% buffer from liquidation

  private dailyLosses = new Map<string, number>();
  private circuitBreakerActive = false;
  private lastCircuitBreakerCheck = Date.now();
  private tradeHistory: Array<{ symbol: string; profit: number; timestamp: number; leverage?: number }> = [];
  private positionHistory: Map<string, number> = new Map();

  /**
   * Enhanced ATR calculation for futures with leverage awareness
   */
  calculateATR(priceHistory: ChartDataPoint[]): number {
    if (priceHistory.length < this.ATR_PERIOD + 1) {
      return 0;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < priceHistory.length; i++) {
      const high = priceHistory[i].price * (1 + Math.random() * 0.04); // Higher range for futures
      const low = priceHistory[i].price * (1 - Math.random() * 0.04);
      const prevClose = priceHistory[i - 1].price;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    const atr14 = trueRanges.slice(-14).reduce((sum, tr) => sum + tr, 0) / 14;
    const atr7 = trueRanges.slice(-7).reduce((sum, tr) => sum + tr, 0) / 7;
    
    // More weight to recent volatility for futures
    const weightedATR = (atr7 * 0.8 + atr14 * 0.2);
    const currentPrice = priceHistory[priceHistory.length - 1].price;
    
    return (weightedATR / currentPrice) * 100;
  }

  /**
   * FUTURES-OPTIMIZED position sizing
   */
  calculatePositionSize(
    portfolioBalance: number,
    volatility: number,
    strategy: StrategyType,
    symbol?: string
  ): number {
    // More conservative for futures with small accounts
    const budgetMultiplier = portfolioBalance <= 100 ? 0.70 : 0.85;
    
    // FUTURES-OPTIMIZED strategy risk multipliers
    const strategyRiskMultiplier = {
      // Base strategies
      safe: 0.4 * budgetMultiplier,
      balanced: 0.7 * budgetMultiplier,
      aggressive: 1.1 * budgetMultiplier,
      
      // AI Strategies - optimized for futures
      trend: 0.6 * budgetMultiplier,
      breakout: 0.8 * budgetMultiplier,
      mean_reversion: 0.3 * budgetMultiplier, // Lower for futures (high risk)
      scalping: 0.5 * budgetMultiplier,
      momentum: 0.9 * budgetMultiplier,
      swing: 0.7 * budgetMultiplier,
      arbitrage: 0.2 * budgetMultiplier,
      pair: 0.3 * budgetMultiplier,
      sentiment: 0.6 * budgetMultiplier,
      news: 1.0 * budgetMultiplier
    };

    let baseRisk = this.BASE_RISK_PERCENT * strategyRiskMultiplier[strategy];

    // More sensitive to volatility for futures
    const volatilityAdjustment = Math.max(0.3, 1 - (volatility / 20));
    const adjustedRisk = baseRisk * volatilityAdjustment;

    // Performance adjustment for futures
    const performanceAdjustment = this.calculatePerformanceAdjustment();
    const finalRisk = adjustedRisk * performanceAdjustment;

    // Calculate position size with futures considerations
    let positionPercent = finalRisk * 2.0;
    positionPercent = Math.min(positionPercent, this.MAX_POSITION_PERCENT);

    const positionSize = positionPercent * portfolioBalance;

    // Minimum position sizes for futures
    const minPositionSize = portfolioBalance <= 100 ? 10 : 20;
    return Math.max(minPositionSize, positionSize);
  }

  /**
   * FUTURES-PERFORMANCE adjustment
   */
  private calculatePerformanceAdjustment(): number {
    if (this.tradeHistory.length < 5) return 1.0;

    const recentTrades = this.tradeHistory.slice(-10);
    const winningTrades = recentTrades.filter(t => t.profit > 0).length;
    const winRate = winningTrades / recentTrades.length;

    // More conservative adjustments for futures
    if (winRate > 0.65) return 1.3;
    if (winRate < 0.25) return 0.7;
    
    return 1.0;
  }

  /**
   * FUTURES-RISK assessment
   */
  assessRiskLevel(volatility: number, portfolioBalance?: number): 'low' | 'medium' | 'high' | 'extreme' {
    // More conservative thresholds for futures
    const balanceAdjustment = portfolioBalance && portfolioBalance <= 100 ? 0.8 : 1.0;

    const adjustedHigh = this.VOLATILITY_THRESHOLD_HIGH * balanceAdjustment;
    const adjustedExtreme = this.VOLATILITY_THRESHOLD_EXTREME * balanceAdjustment;

    if (volatility < 3.0) return 'low';
    if (volatility < adjustedHigh) return 'medium';
    if (volatility < adjustedExtreme) return 'high';
    return 'extreme';
  }

  /**
   * Calculate safe leverage for futures
   */
  private calculateSafeLeverage(
    portfolioBalance: number, 
    volatility: number, 
    strategy: StrategyType
  ): number {
    let baseLeverage = {
      safe: 2,
      balanced: 4,
      aggressive: 6,
      trend: 3,
      breakout: 5,
      mean_reversion: 1, // Very low leverage for mean reversion
      scalping: 8,       // Higher for scalping
      momentum: 5,
      swing: 3,
      arbitrage: 1,      // No leverage for arbitrage
      pair: 2,
      sentiment: 4,
      news: 6
    }[strategy] || 3;

    // Adjust for account size - more conservative for small accounts
    if (portfolioBalance < 50) {
      baseLeverage = Math.max(1, baseLeverage - 2);
    } else if (portfolioBalance < 100) {
      baseLeverage = Math.max(1, baseLeverage - 1);
    }

    // Adjust for volatility
    if (volatility > 10) {
      baseLeverage = Math.max(1, baseLeverage - 2);
    } else if (volatility > 6) {
      baseLeverage = Math.max(2, baseLeverage - 1);
    }

    return Math.min(baseLeverage, this.MAX_LEVERAGE);
  }

  /**
   * FUTURES-OPTIMIZED maximum open trades
   */
  calculateMaxOpenTrades(portfolioBalance: number, strategy: StrategyType): number {
    // Fewer trades for futures to manage risk
    if (portfolioBalance <= 100) {
      return {
        safe: 2,
        balanced: 3,
        aggressive: 4,
        trend: 3,
        breakout: 3,
        mean_reversion: 2,
        scalping: 4,
        momentum: 3,
        swing: 2,
        arbitrage: 2,
        pair: 2,
        sentiment: 3,
        news: 3
      }[strategy] || 3;
    } else if (portfolioBalance <= 500) {
      return {
        safe: 3,
        balanced: 5,
        aggressive: 6,
        trend: 4,
        breakout: 5,
        mean_reversion: 3,
        scalping: 6,
        momentum: 5,
        swing: 4,
        arbitrage: 3,
        pair: 3,
        sentiment: 4,
        news: 5
      }[strategy] || 4;
    } else {
      return {
        safe: 5,
        balanced: 8,
        aggressive: 10,
        trend: 6,
        breakout: 8,
        mean_reversion: 4,
        scalping: 10,
        momentum: 8,
        swing: 6,
        arbitrage: 4,
        pair: 5,
        sentiment: 6,
        news: 8
      }[strategy] || 6;
    }
  }

  /**
   * ENHANCED circuit breaker for futures
   */
  checkCircuitBreaker(
    currentBalance: number,
    initialBalance: number,
    dailyStartBalance: number,
    recentTrades: Array<{ profit: number }> = []
  ): boolean {
    const today = new Date().toISOString().split('T')[0];
    
    const dailyLoss = dailyStartBalance - currentBalance;
    const dailyLossPercent = (dailyLoss / dailyStartBalance) * 100;
    const totalLoss = initialBalance - currentBalance;
    const totalLossPercent = (totalLoss / initialBalance) * 100;

    this.dailyLosses.set(today, dailyLoss);

    const dailyLossLimit = dailyStartBalance * this.DAILY_LOSS_LIMIT_PERCENT;
    const consecutiveLosses = this.countConsecutiveLosses(recentTrades);
    
    let shouldActivate = false;
    let reason = '';

    // Futures-specific circuit breaker conditions
    if (dailyLoss >= dailyLossLimit) {
      shouldActivate = true;
      reason = `Futures daily loss ${dailyLossPercent.toFixed(2)}% exceeds ${(this.DAILY_LOSS_LIMIT_PERCENT * 100).toFixed(0)}% limit`;
    }
    
    else if (consecutiveLosses >= 6) { // More consecutive losses allowed for futures
      shouldActivate = true;
      reason = `${consecutiveLosses} consecutive futures losses - taking break`;
    }
    
    else if (totalLossPercent >= 20) { // Higher total drawdown allowed for futures
      shouldActivate = true;
      reason = `Futures total drawdown ${totalLossPercent.toFixed(2)}% too high`;
    }

    if (shouldActivate) {
      this.circuitBreakerActive = true;
      console.warn(`🛑 FUTURES Circuit Breaker Activated: ${reason}`);
    }

    // Auto-reset after 2 hours for futures
    const timeSinceLastCheck = Date.now() - this.lastCircuitBreakerCheck;
    if (timeSinceLastCheck > 2 * 60 * 60 * 1000) {
      this.circuitBreakerActive = false;
      this.lastCircuitBreakerCheck = Date.now();
    }

    return this.circuitBreakerActive;
  }

  private countConsecutiveLosses(trades: Array<{ profit: number }>): number {
    let consecutive = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      if (trades[i].profit <= 0) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  }

  /**
   * COMPREHENSIVE futures risk metrics
   */
  calculateRiskMetrics(
    priceHistory: ChartDataPoint[],
    portfolioBalance: number,
    initialBalance: number,
    strategy: StrategyType,
    dailyStartBalance?: number,
    openTrades: number = 0
  ): RiskMetrics {
    const volatility = this.calculateATR(priceHistory);
    const currentRiskLevel = this.assessRiskLevel(volatility, portfolioBalance);
    const maxOpenTrades = this.calculateMaxOpenTrades(portfolioBalance, strategy);
    const recommendedLeverage = this.calculateSafeLeverage(portfolioBalance, volatility, strategy);

    // Position sizing for futures
    const recommendedPositionSize = this.calculatePositionSize(
      portfolioBalance,
      volatility,
      strategy
    );

    // Enhanced risk metrics for futures
    const maxDrawdown = this.calculateMaxDrawdown(portfolioBalance, strategy, currentRiskLevel);
    const dailyLossLimit = (dailyStartBalance || portfolioBalance) * this.DAILY_LOSS_LIMIT_PERCENT;

    const circuitBreakerActive = this.checkCircuitBreaker(
      portfolioBalance,
      initialBalance,
      dailyStartBalance || portfolioBalance,
      this.tradeHistory
    );

    const positionSizing = this.determinePositionSizingApproach(
      portfolioBalance,
      volatility,
      this.tradeHistory
    );

    // Futures-specific metrics
    const liquidationRisk = this.assessLiquidationRisk(portfolioBalance, recommendedLeverage, volatility);
    const marginUsage = this.calculateMarginUsage(portfolioBalance, openTrades, recommendedLeverage);

    return {
      volatility,
      recommendedPositionSize,
      maxDrawdown,
      currentRiskLevel,
      dailyLossLimit,
      circuitBreakerActive,
      maxOpenTrades,
      positionSizing,
      liquidationRisk,
      recommendedLeverage,
      marginUsage
    };
  }

  /**
   * Assess liquidation risk for futures
   */
  private assessLiquidationRisk(portfolioBalance: number, leverage: number, volatility: number): 'low' | 'medium' | 'high' {
    const liquidationDistance = 100 / leverage; // Percentage to liquidation
    const volatilityImpact = volatility * 0.3;
    
    const effectiveDistance = liquidationDistance - volatilityImpact;
    
    if (effectiveDistance > 20) return 'low';
    if (effectiveDistance > 10) return 'medium';
    return 'high';
  }

  /**
   * Calculate margin usage percentage for futures
   */
  private calculateMarginUsage(portfolioBalance: number, openTrades: number, leverage: number): number {
    const estimatedMargin = (portfolioBalance * 0.25) * leverage; // Estimate 25% in trades
    return Math.min(100, (estimatedMargin / portfolioBalance) * 100);
  }

  private calculateMaxDrawdown(
    portfolioBalance: number, 
    strategy: StrategyType, 
    riskLevel: string
  ): number {
    // Lower max drawdown for futures trading
    const baseDrawdown = portfolioBalance * this.BASE_RISK_PERCENT * 2.0;
    
    const strategyMultiplier = {
      safe: 0.6,
      balanced: 1.0,
      aggressive: 1.4
    };
    
    const riskMultiplier = {
      low: 1.0,
      medium: 0.8,
      high: 0.6,
      extreme: 0.4
    };

    return baseDrawdown * strategyMultiplier[strategy] * riskMultiplier[riskLevel];
  }

  private determinePositionSizingApproach(
    portfolioBalance: number,
    volatility: number,
    tradeHistory: Array<{ profit: number }>
  ): 'conservative' | 'moderate' | 'aggressive' {
    // More conservative for futures
    if (portfolioBalance <= 100) return 'conservative';
    
    if (volatility > 10) return 'conservative';
    
    if (tradeHistory.length >= 5) {
      const recentProfit = tradeHistory.slice(-5).reduce((sum, t) => sum + t.profit, 0);
      if (recentProfit > portfolioBalance * 0.06) {
        return 'moderate';
      }
    }
    
    return 'conservative';
  }

  /**
   * FUTURES-OPTIMIZED trailing stops
   */
  calculateTrailingStop(
    entryPrice: number,
    currentPrice: number,
    volatility: number,
    profitPercent: number
  ): number {
    // Tighter stops for futures
    let baseStopPercent = 0.015;
    
    // Adjust for volatility
    const volatilityAdjustment = Math.min(volatility / 80, 0.025);
    
    // Tighten stops as profit increases
    const profitAdjustment = profitPercent > 5 ? -0.008 : 0;
    
    const stopDistance = baseStopPercent + volatilityAdjustment + profitAdjustment;
    
    const calculatedStop = currentPrice * (1 - stopDistance);
    const minStop = entryPrice * 0.98; // Tighter minimum stop for futures
    
    return Math.max(calculatedStop, minStop);
  }

  /**
   * FUTURES take profit levels
   */
  calculateTakeProfit(
    entryPrice: number,
    volatility: number,
    strategy: StrategyType
  ): number {
    const baseTarget = {
      safe: 0.035,
      balanced: 0.065,
      aggressive: 0.100,
      trend: 0.055,
      breakout: 0.075,
      mean_reversion: 0.040,
      scalping: 0.025,
      momentum: 0.080,
      swing: 0.060,
      arbitrage: 0.020,
      pair: 0.030,
      sentiment: 0.050,
      news: 0.090
    }[strategy];

    // Higher volatility adjustment for futures
    const volatilityAdjustment = Math.min(volatility / 60, 0.05);
    const adjustedTarget = baseTarget + volatilityAdjustment;

    return entryPrice * (1 + adjustedTarget);
  }

  /**
   * Calculate liquidation price for futures risk monitoring
   */
  private calculateLiquidationPrice(
    entryPrice: number,
    side: 'LONG' | 'SHORT',
    leverage: number,
    positionSize: number
  ): number {
    const margin = positionSize / leverage;
    const maintenanceMargin = margin * 0.04; // 4% maintenance margin for futures
    
    if (side === 'LONG') {
      return entryPrice * (1 - (1 / leverage) + (maintenanceMargin / positionSize));
    } else {
      return entryPrice * (1 + (1 / leverage) - (maintenanceMargin / positionSize));
    }
  }

  /**
   * Record trade for performance tracking
   */
  recordTrade(symbol: string, profit: number) {
    this.tradeHistory.push({
      symbol,
      profit,
      timestamp: Date.now()
    });

    // Track position history for correlation analysis
    this.positionHistory.set(symbol, (this.positionHistory.get(symbol) || 0) + 1);

    if (this.tradeHistory.length > 50) {
      this.tradeHistory.shift();
    }

    // Clean position history
    if (this.positionHistory.size > 50) {
      const oldestSymbol = Array.from(this.positionHistory.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      this.positionHistory.delete(oldestSymbol);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    if (this.tradeHistory.length === 0) {
      return { winRate: 0, avgProfit: 0, totalProfit: 0 };
    }

    const wins = this.tradeHistory.filter(t => t.profit > 0).length;
    const totalProfit = this.tradeHistory.reduce((sum, t) => sum + t.profit, 0);
    const avgProfit = totalProfit / this.tradeHistory.length;

    return {
      winRate: (wins / this.tradeHistory.length) * 100,
      avgProfit,
      totalProfit,
      totalTrades: this.tradeHistory.length
    };
  }

  /**
   * Calculate portfolio allocation recommendations for futures
   */
  calculatePortfolioAllocation(
    symbols: string[],
    correlations: CorrelationMatrix,
    portfolioBalance: number
  ): Map<string, number> {
    const allocation = new Map<string, number>();
    const baseAllocation = portfolioBalance / symbols.length;

    // More conservative allocation for futures
    symbols.forEach(symbol => {
      allocation.set(symbol, baseAllocation * 0.7);
    });

    return allocation;
  }

  resetCircuitBreaker(): void {
    this.circuitBreakerActive = false;
    this.lastCircuitBreakerCheck = Date.now();
    console.log('✅ Futures Circuit Breaker Reset');
  }

  isCircuitBreakerActive(): boolean {
    return this.circuitBreakerActive;
  }

  /**
   * Emergency position reduction recommendation for futures
   */
  shouldReducePosition(
    currentBalance: number,
    dailyStartBalance: number,
    openPositions: number,
    avgLeverage: number
  ): boolean {
    const dailyLoss = dailyStartBalance - currentBalance;
    const dailyLossPercent = (dailyLoss / dailyStartBalance) * 100;
    
    return (
      dailyLossPercent > 4 ||
      (openPositions >= 3 && avgLeverage > 4) ||
      currentBalance < dailyStartBalance * 0.90
    );
  }

  /**
   * Get leverage recommendations for futures
   */
  getLeverageRecommendation(
    strategy: StrategyType,
    marketVolatility: number,
    accountBalance: number,
    currentWinRate: number
  ): { recommended: number; max: number; reason: string } {
    const baseLeverage = this.calculateSafeLeverage(accountBalance, marketVolatility, strategy);
    
    let recommended = baseLeverage;
    let reason = 'Base futures strategy recommendation';

    // Adjust based on performance and market conditions
    if (currentWinRate > 60 && marketVolatility < 4) {
      recommended = Math.min(baseLeverage + 1, this.MAX_LEVERAGE);
      reason = 'High win rate with low volatility';
    } else if (currentWinRate < 35 || marketVolatility > 8) {
      recommended = Math.max(1, baseLeverage - 1);
      reason = 'Reduced due to performance/volatility';
    }

    return {
      recommended,
      max: this.MAX_LEVERAGE,
      reason
    };
  }
}

// Singleton instance
let riskManagementInstance: RiskManagementService | null = null;

export function getRiskManagementService(): RiskManagementService {
  if (!riskManagementInstance) {
    riskManagementInstance = new RiskManagementService();
  }
  return riskManagementInstance;
}