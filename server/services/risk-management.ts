import type { ChartDataPoint, StrategyType } from "@shared/schema";

export interface RiskMetrics {
  volatility: number; // ATR-based volatility percentage
  recommendedPositionSize: number; // As percentage of portfolio
  maxDrawdown: number; // Maximum acceptable loss
  currentRiskLevel: 'low' | 'medium' | 'high' | 'extreme';
  dailyLossLimit: number; // Daily loss limit in currency
  circuitBreakerActive: boolean;
}

export interface CorrelationMatrix {
  symbols: string[];
  correlations: number[][]; // Correlation coefficients between symbols
}

export class RiskManagementService {
  private readonly ATR_PERIOD = 14; // Standard ATR period
  private readonly MAX_POSITION_PERCENT = 0.25; // Max 25% of portfolio per position
  private readonly BASE_RISK_PERCENT = 0.02; // Base 2% risk per trade
  private readonly VOLATILITY_THRESHOLD_HIGH = 5.0; // 5% ATR is high volatility
  private readonly VOLATILITY_THRESHOLD_EXTREME = 10.0; // 10% ATR is extreme
  private readonly DAILY_LOSS_LIMIT_PERCENT = 0.05; // 5% daily loss limit

  private dailyLosses = new Map<string, number>(); // Track daily losses by date
  private circuitBreakerActive = false;
  private lastCircuitBreakerCheck = Date.now();

  /**
   * Calculate Average True Range (ATR) for volatility measurement
   */
  calculateATR(priceHistory: ChartDataPoint[]): number {
    if (priceHistory.length < this.ATR_PERIOD + 1) {
      return 0;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < priceHistory.length; i++) {
      const high = priceHistory[i].price;
      const low = priceHistory[i].price * 0.98; // Simulated low (2% below high)
      const prevClose = priceHistory[i - 1].price;

      // True Range = max(high - low, |high - prevClose|, |low - prevClose|)
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    // Take last N periods for ATR
    const recentTRs = trueRanges.slice(-this.ATR_PERIOD);
    const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
    
    // Return as percentage of current price
    const currentPrice = priceHistory[priceHistory.length - 1].price;
    return (atr / currentPrice) * 100;
  }

  /**
   * Calculate position size based on volatility and risk tolerance
   */
  calculatePositionSize(
    portfolioBalance: number,
    volatility: number,
    strategy: StrategyType
  ): number {
    // Base risk percentage varies by strategy
    const strategyRiskMultiplier = {
      safe: 0.5,
      balanced: 1.0,
      aggressive: 1.5,
    };

    let baseRisk = this.BASE_RISK_PERCENT * strategyRiskMultiplier[strategy];

    // Reduce position size as volatility increases (inverse relationship)
    const volatilityAdjustment = Math.max(0.3, 1 - (volatility / 20));
    const adjustedRisk = baseRisk * volatilityAdjustment;

    // Calculate position size as percentage of portfolio
    let positionPercent = adjustedRisk * 2; // Convert risk to position size

    // Apply maximum position limit
    positionPercent = Math.min(positionPercent, this.MAX_POSITION_PERCENT);

    return positionPercent * portfolioBalance;
  }

  /**
   * Determine current risk level based on volatility
   */
  assessRiskLevel(volatility: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (volatility < 2.0) return 'low';
    if (volatility < this.VOLATILITY_THRESHOLD_HIGH) return 'medium';
    if (volatility < this.VOLATILITY_THRESHOLD_EXTREME) return 'high';
    return 'extreme';
  }

  /**
   * Calculate correlation between two price series
   */
  calculateCorrelation(series1: number[], series2: number[]): number {
    const n = Math.min(series1.length, series2.length);
    if (n < 2) return 0;

    // Use only the most recent N data points
    const x = series1.slice(-n);
    const y = series2.slice(-n);

    // Calculate means
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;

    // Calculate correlation coefficient
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const devX = x[i] - meanX;
      const devY = y[i] - meanY;
      numerator += devX * devY;
      denomX += devX * devX;
      denomY += devY * devY;
    }

    if (denomX === 0 || denomY === 0) return 0;

    return numerator / Math.sqrt(denomX * denomY);
  }

  /**
   * Calculate correlation matrix for multiple symbols
   */
  calculateCorrelationMatrix(
    priceHistories: Map<string, ChartDataPoint[]>
  ): CorrelationMatrix {
    const symbols = Array.from(priceHistories.keys());
    const n = symbols.length;
    const correlations: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    // Extract price series for each symbol
    const priceSeries = new Map<string, number[]>();
    priceHistories.forEach((history, symbol) => {
      priceSeries.set(symbol, history.map(point => point.price));
    });

    // Calculate pairwise correlations
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          correlations[i][j] = 1.0; // Perfect correlation with self
        } else {
          const series1 = priceSeries.get(symbols[i]) || [];
          const series2 = priceSeries.get(symbols[j]) || [];
          correlations[i][j] = this.calculateCorrelation(series1, series2);
        }
      }
    }

    return { symbols, correlations };
  }

  /**
   * Check if circuit breaker should be activated
   */
  checkCircuitBreaker(
    currentBalance: number,
    initialBalance: number,
    dailyStartBalance: number
  ): boolean {
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate daily loss
    const dailyLoss = dailyStartBalance - currentBalance;
    const dailyLossPercent = (dailyLoss / dailyStartBalance) * 100;

    // Update daily loss tracking
    this.dailyLosses.set(today, dailyLoss);

    // Calculate daily loss limit
    const dailyLossLimit = dailyStartBalance * this.DAILY_LOSS_LIMIT_PERCENT;

    // Activate circuit breaker if daily loss limit exceeded
    if (dailyLoss >= dailyLossLimit) {
      this.circuitBreakerActive = true;
      console.warn(`🛑 Circuit Breaker Activated: Daily loss ${dailyLossPercent.toFixed(2)}% exceeds ${(this.DAILY_LOSS_LIMIT_PERCENT * 100).toFixed(0)}% limit`);
      return true;
    }

    // Auto-reset circuit breaker at start of new day
    const timeSinceLastCheck = Date.now() - this.lastCircuitBreakerCheck;
    if (timeSinceLastCheck > 24 * 60 * 60 * 1000) { // 24 hours
      this.circuitBreakerActive = false;
      this.lastCircuitBreakerCheck = Date.now();
    }

    return this.circuitBreakerActive;
  }

  /**
   * Calculate comprehensive risk metrics
   */
  calculateRiskMetrics(
    priceHistory: ChartDataPoint[],
    portfolioBalance: number,
    initialBalance: number,
    strategy: StrategyType,
    dailyStartBalance?: number
  ): RiskMetrics {
    // Calculate volatility using ATR
    const volatility = this.calculateATR(priceHistory);

    // Determine risk level
    const currentRiskLevel = this.assessRiskLevel(volatility);

    // Calculate recommended position size
    const recommendedPositionSize = this.calculatePositionSize(
      portfolioBalance,
      volatility,
      strategy
    );

    // Calculate maximum drawdown tolerance
    const maxDrawdown = portfolioBalance * this.BASE_RISK_PERCENT * 3; // 6% for balanced

    // Calculate daily loss limit
    const dailyLossLimit = (dailyStartBalance || portfolioBalance) * this.DAILY_LOSS_LIMIT_PERCENT;

    // Check circuit breaker
    const circuitBreakerActive = this.checkCircuitBreaker(
      portfolioBalance,
      initialBalance,
      dailyStartBalance || portfolioBalance
    );

    return {
      volatility,
      recommendedPositionSize,
      maxDrawdown,
      currentRiskLevel,
      dailyLossLimit,
      circuitBreakerActive,
    };
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerActive = false;
    this.lastCircuitBreakerCheck = Date.now();
    console.log('✅ Circuit Breaker Reset');
  }

  /**
   * Get circuit breaker status
   */
  isCircuitBreakerActive(): boolean {
    return this.circuitBreakerActive;
  }

  /**
   * Calculate trailing stop price
   */
  calculateTrailingStop(
    entryPrice: number,
    currentPrice: number,
    volatility: number
  ): number {
    // Trailing stop distance adjusts based on volatility
    // Higher volatility = wider stop to avoid premature exits
    const baseStopPercent = 0.03; // 3% base
    const volatilityAdjustment = Math.min(volatility / 100, 0.05); // Add up to 5% for volatility
    const stopDistance = baseStopPercent + volatilityAdjustment;

    // Calculate stop price
    const stopPrice = currentPrice * (1 - stopDistance);

    // Never set stop below entry price for long positions
    return Math.max(stopPrice, entryPrice * 0.95); // At least 5% below entry
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
