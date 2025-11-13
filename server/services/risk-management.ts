import type { ChartDataPoint, StrategyType } from "@shared/schema";

export interface RiskMetrics {
  volatility: number;
  recommendedPositionSize: number;
  maxDrawdown: number;
  currentRiskLevel: 'low' | 'medium' | 'high' | 'extreme';
  dailyLossLimit: number;
  circuitBreakerActive: boolean;
  maxOpenTrades: number;
  positionSizing: 'conservative' | 'moderate' | 'aggressive';
}

export interface CorrelationMatrix {
  symbols: string[];
  correlations: number[][];
}

export class RiskManagementService {
  private readonly ATR_PERIOD = 14;
  private readonly MAX_POSITION_PERCENT = 0.20; // INCREASED from 15% to 20%
  private readonly BASE_RISK_PERCENT = 0.015; // INCREASED from 1% to 1.5%
  private readonly VOLATILITY_THRESHOLD_HIGH = 5.0;
  private readonly VOLATILITY_THRESHOLD_EXTREME = 10.0;
  private readonly DAILY_LOSS_LIMIT_PERCENT = 0.08; // INCREASED from 5% to 8%

  private dailyLosses = new Map<string, number>();
  private circuitBreakerActive = false;
  private lastCircuitBreakerCheck = Date.now();
  private tradeHistory: Array<{ symbol: string; profit: number; timestamp: number }> = [];

  /**
   * Enhanced ATR calculation
   */
  calculateATR(priceHistory: ChartDataPoint[]): number {
    if (priceHistory.length < this.ATR_PERIOD + 1) {
      return 0;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < priceHistory.length; i++) {
      const high = priceHistory[i].price;
      const low = priceHistory[i].price * 0.98;
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
    
    const weightedATR = (atr7 * 0.6 + atr14 * 0.4);
    const currentPrice = priceHistory[priceHistory.length - 1].price;
    
    return (weightedATR / currentPrice) * 100;
  }

  /**
   * ENHANCED position sizing for higher returns
   */
  calculatePositionSize(
    portfolioBalance: number,
    volatility: number,
    strategy: StrategyType,
    symbol?: string
  ): number {
    // Less conservative for small accounts seeking growth
    const budgetMultiplier = portfolioBalance <= 100 ? 0.85 : 1.0; // Increased from 0.7
    
    // INCREASED strategy risk multipliers
    const strategyRiskMultiplier = {
      // Base strategies
      safe: 0.6 * budgetMultiplier, // Increased from 0.4
      balanced: 1.0 * budgetMultiplier, // Increased from 0.8
      aggressive: 1.5 * budgetMultiplier, // Increased from 1.2
      
      // AI Strategies
      trend: 0.8 * budgetMultiplier, // Increased
      breakout: 1.1 * budgetMultiplier, // Increased
      mean_reversion: 0.6 * budgetMultiplier, // Increased
      scalping: 0.7 * budgetMultiplier, // Increased
      momentum: 1.2 * budgetMultiplier, // Increased
      swing: 1.0 * budgetMultiplier, // Increased
      arbitrage: 0.4 * budgetMultiplier,
      pair: 0.5 * budgetMultiplier, // Increased
      sentiment: 0.9 * budgetMultiplier, // Increased
      news: 1.3 * budgetMultiplier // Increased
    };

    let baseRisk = this.BASE_RISK_PERCENT * strategyRiskMultiplier[strategy];

    // Less sensitive to volatility for higher returns
    const volatilityAdjustment = Math.max(0.3, 1 - (volatility / 30)); // Less reduction
    const adjustedRisk = baseRisk * volatilityAdjustment;

    // More aggressive performance adjustment
    const performanceAdjustment = this.calculatePerformanceAdjustment();
    const finalRisk = adjustedRisk * performanceAdjustment;

    // Calculate position size with higher limits
    let positionPercent = finalRisk * 2.2; // Increased from 2.0
    positionPercent = Math.min(positionPercent, this.MAX_POSITION_PERCENT);

    const positionSize = positionPercent * portfolioBalance;

    // Higher minimum position sizes
    const minPositionSize = portfolioBalance <= 100 ? 15 : 30; // Increased minimums
    return Math.max(minPositionSize, positionSize);
  }

  /**
   * MORE AGGRESSIVE performance adjustment
   */
  private calculatePerformanceAdjustment(): number {
    if (this.tradeHistory.length < 5) return 1.0;

    const recentTrades = this.tradeHistory.slice(-10);
    const winningTrades = recentTrades.filter(t => t.profit > 0).length;
    const winRate = winningTrades / recentTrades.length;

    // More aggressive adjustments
    if (winRate > 0.6) return 1.5; // INCREASED from 1.2 - bigger boost when winning
    if (winRate < 0.3) return 0.8; // INCREASED from 0.6 - less reduction when losing
    
    return 1.0;
  }

  /**
   * Adjusted risk level assessment for higher returns
   */
  assessRiskLevel(volatility: number, portfolioBalance?: number): 'low' | 'medium' | 'high' | 'extreme' {
    // Less conservative thresholds
    const balanceAdjustment = portfolioBalance && portfolioBalance <= 100 ? 0.8 : 1.0; // Increased from 0.7
    
    const adjustedHigh = this.VOLATILITY_THRESHOLD_HIGH * balanceAdjustment;
    const adjustedExtreme = this.VOLATILITY_THRESHOLD_EXTREME * balanceAdjustment;

    if (volatility < 2.0) return 'low'; // Higher threshold
    if (volatility < adjustedHigh) return 'medium';
    if (volatility < adjustedExtreme) return 'high';
    return 'extreme';
  }

  /**
   * Increased maximum open trades
   */
  calculateMaxOpenTrades(portfolioBalance: number, strategy: StrategyType): number {
    if (portfolioBalance <= 100) {
      // More positions for small accounts
      return strategy === 'safe' ? 3 : strategy === 'balanced' ? 4 : 6; // Increased
    } else if (portfolioBalance <= 1000) {
      return strategy === 'safe' ? 4 : strategy === 'balanced' ? 6 : 8; // Increased
    } else {
      return strategy === 'safe' ? 6 : strategy === 'balanced' ? 10 : 12; // Increased
    }
  }

  /**
   * Less restrictive circuit breaker
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

    // Higher loss limits
    if (dailyLoss >= dailyLossLimit) {
      shouldActivate = true;
      reason = `Daily loss ${dailyLossPercent.toFixed(2)}% exceeds ${(this.DAILY_LOSS_LIMIT_PERCENT * 100).toFixed(0)}% limit`;
    }
    
    // More consecutive losses allowed
    else if (consecutiveLosses >= 7) { // Increased from 5
      shouldActivate = true;
      reason = `${consecutiveLosses} consecutive losses - taking break`;
    }
    
    // Higher total drawdown allowed
    else if (totalLossPercent >= 20) { // Increased from 15%
      shouldActivate = true;
      reason = `Total drawdown ${totalLossPercent.toFixed(2)}% too high`;
    }

    if (shouldActivate) {
      this.circuitBreakerActive = true;
      console.warn(`🛑 Circuit Breaker Activated: ${reason}`);
    }

    const timeSinceLastCheck = Date.now() - this.lastCircuitBreakerCheck;
    if (timeSinceLastCheck > 24 * 60 * 60 * 1000) {
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
   * Enhanced risk metrics for higher returns
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

    // Larger position sizes
    const recommendedPositionSize = this.calculatePositionSize(
      portfolioBalance,
      volatility,
      strategy
    );

    // Adjusted max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(portfolioBalance, strategy, currentRiskLevel);

    const dailyLossLimit = (dailyStartBalance || portfolioBalance) * this.DAILY_LOSS_LIMIT_PERCENT;

    const circuitBreakerActive = this.checkCircuitBreaker(
      portfolioBalance,
      initialBalance,
      dailyStartBalance || portfolioBalance,
      this.tradeHistory
    );

    // More aggressive position sizing
    const positionSizing = this.determinePositionSizingApproach(
      portfolioBalance,
      volatility,
      this.tradeHistory
    );

    return {
      volatility,
      recommendedPositionSize,
      maxDrawdown,
      currentRiskLevel,
      dailyLossLimit,
      circuitBreakerActive,
      maxOpenTrades,
      positionSizing
    };
  }

  private calculateMaxDrawdown(
    portfolioBalance: number, 
    strategy: StrategyType, 
    riskLevel: string
  ): number {
    const baseDrawdown = portfolioBalance * this.BASE_RISK_PERCENT * 2.5; // Increased
    
    const strategyMultiplier = {
      safe: 0.6, // Increased
      balanced: 1.2, // Increased
      aggressive: 1.8 // Increased
    };
    
    const riskMultiplier = {
      low: 1.3, // Increased
      medium: 1.1, // Increased
      high: 0.8, // Increased
      extreme: 0.6 // Increased
    };

    return baseDrawdown * strategyMultiplier[strategy] * riskMultiplier[riskLevel];
  }

  private determinePositionSizingApproach(
    portfolioBalance: number,
    volatility: number,
    tradeHistory: Array<{ profit: number }>
  ): 'conservative' | 'moderate' | 'aggressive' {
    // Less conservative for small accounts
    if (portfolioBalance <= 100) return 'moderate'; // Changed from 'conservative'
    
    // Higher volatility tolerance
    if (volatility > 60) return 'conservative'; // Increased from 50
    
    // More aggressive based on performance
    if (tradeHistory.length >= 5) {
      const recentProfit = tradeHistory.slice(-5).reduce((sum, t) => sum + t.profit, 0);
      if (recentProfit > portfolioBalance * 0.05) { // 5% profit threshold
        return 'aggressive';
      }
    }
    
    return 'moderate'; // Default to moderate instead of conservative
  }

  /**
   * Tighter stop losses but higher take profits
   */
  calculateTrailingStop(
    entryPrice: number,
    currentPrice: number,
    volatility: number,
    profitPercent: number
  ): number {
    // Tighter base stops for better risk management
    let baseStopPercent = 0.015; // Reduced from 0.02
    
    // Less volatility adjustment
    const volatilityAdjustment = Math.min(volatility / 120, 0.03); // Reduced
    
    // Tighter stops as profit increases
    const profitAdjustment = profitPercent > 8 ? -0.015 : 0; // More aggressive tightening
    
    const stopDistance = baseStopPercent + volatilityAdjustment + profitAdjustment;
    
    const calculatedStop = currentPrice * (1 - stopDistance);
    const minStop = entryPrice * 0.97; // Tighter minimum stop
    
    return Math.max(calculatedStop, minStop);
  }

  /**
   * Higher take profit levels
   */
  calculateTakeProfit(
    entryPrice: number,
    volatility: number,
    strategy: StrategyType
  ): number {
    const baseTarget = {
      safe: 0.04,     // Increased from 0.03
      balanced: 0.08,  // Increased from 0.06  
      aggressive: 0.15 // Increased from 0.10
    }[strategy];

    // Higher volatility adjustment for bigger profits
    const volatilityAdjustment = Math.min(volatility / 80, 0.08); // Increased
    const adjustedTarget = baseTarget + volatilityAdjustment;

    return entryPrice * (1 + adjustedTarget);
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

    if (this.tradeHistory.length > 50) {
      this.tradeHistory.shift();
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
   * Calculate portfolio allocation recommendations
   */
  calculatePortfolioAllocation(
    symbols: string[],
    correlations: CorrelationMatrix,
    portfolioBalance: number
  ): Map<string, number> {
    const allocation = new Map<string, number>();
    const baseAllocation = portfolioBalance / symbols.length;

    // More aggressive allocation
    symbols.forEach(symbol => {
      allocation.set(symbol, baseAllocation * 0.9); // Increased from 0.8
    });

    return allocation;
  }

  resetCircuitBreaker(): void {
    this.circuitBreakerActive = false;
    this.lastCircuitBreakerCheck = Date.now();
    console.log('✅ Circuit Breaker Reset');
  }

  isCircuitBreakerActive(): boolean {
    return this.circuitBreakerActive;
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