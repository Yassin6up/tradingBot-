import type { StrategyType, PriceData, MarketConditions, StrategyScore, AIDecision } from "@shared/schema";
import { randomUUID } from "crypto";

/**
 * AI Strategy Service
 * Analyzes market conditions and intelligently selects optimal trading strategies
 */
export class StrategyAI {
  private priceHistory: Map<string, PriceData[]> = new Map();
  private readonly HISTORY_SIZE = 50; // Keep last 50 price points per symbol
  private aiDecisionHistory: AIDecision[] = [];

  /**
   * Update price history for market analysis
   */
  public updatePriceData(priceData: PriceData[]) {
    priceData.forEach(data => {
      if (!this.priceHistory.has(data.symbol)) {
        this.priceHistory.set(data.symbol, []);
      }
      
      const history = this.priceHistory.get(data.symbol)!;
      history.push(data);
      
      // Keep only recent history
      if (history.length > this.HISTORY_SIZE) {
        history.shift();
      }
    });
  }

  /**
   * Analyze current market conditions
   */
  public analyzeMarketConditions(): MarketConditions {
    // Aggregate metrics across all symbols
    let totalVolatility = 0;
    let totalTrendStrength = 0;
    let totalMomentum = 0;
    let totalVolumeTrend = 0;
    let symbolCount = 0;

    this.priceHistory.forEach((history, symbol) => {
      if (history.length < 20) return; // Need enough data
      
      const metrics = this.calculateSymbolMetrics(history);
      totalVolatility += metrics.volatility;
      totalTrendStrength += metrics.trendStrength;
      totalMomentum += metrics.momentum;
      totalVolumeTrend += metrics.volumeTrend;
      symbolCount++;
    });

    if (symbolCount === 0) {
      // Default conditions if no data
      return {
        volatility: 50,
        trendStrength: 0,
        momentum: 0,
        volumeTrend: 0,
        riskLevel: 'medium',
      };
    }

    const avgVolatility = totalVolatility / symbolCount;
    const avgTrendStrength = totalTrendStrength / symbolCount;
    const avgMomentum = totalMomentum / symbolCount;
    const avgVolumeTrend = totalVolumeTrend / symbolCount;

    // Determine risk level based on volatility
    let riskLevel: 'low' | 'medium' | 'high';
    if (avgVolatility < 30) riskLevel = 'low';
    else if (avgVolatility < 60) riskLevel = 'medium';
    else riskLevel = 'high';

    return {
      volatility: avgVolatility,
      trendStrength: avgTrendStrength,
      momentum: avgMomentum,
      volumeTrend: avgVolumeTrend,
      riskLevel,
    };
  }

  /**
   * Calculate metrics for a single symbol
   */
  private calculateSymbolMetrics(history: PriceData[]) {
    const prices = history.map(d => d.price);
    const volumes = history.map(d => d.volume24h);
    
    // Volatility: Standard deviation of price changes as % of mean price
    const priceChanges = [];
    for (let i = 1; i < prices.length; i++) {
      priceChanges.push(((prices[i] - prices[i-1]) / prices[i-1]) * 100);
    }
    const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    const variance = priceChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / priceChanges.length;
    const volatility = Math.min(Math.sqrt(variance) * 10, 100); // Scale to 0-100

    // Trend Strength: EMA20 slope and position relative to price
    const ema20 = this.calculateEMA(prices, 20);
    const emaSlope = ((ema20[ema20.length - 1] - ema20[ema20.length - 10]) / ema20[ema20.length - 10]) * 1000;
    const trendStrength = Math.max(-100, Math.min(100, emaSlope));

    // Momentum: Rate of change over last 10 periods
    const momentum10 = prices.length >= 10
      ? ((prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10]) * 100
      : 0;
    const momentum = Math.max(-100, Math.min(100, momentum10 * 2));

    // Volume Trend: Compare recent volume to historical average
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const historicalVolume = volumes.slice(0, -5).reduce((a, b) => a + b, 0) / (volumes.length - 5);
    const volumeChange = ((recentVolume - historicalVolume) / historicalVolume) * 100;
    const volumeTrend = Math.max(-100, Math.min(100, volumeChange));

    return { volatility, trendStrength, momentum, volumeTrend };
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Start with SMA
    let sum = 0;
    for (let i = 0; i < Math.min(period, prices.length); i++) {
      sum += prices[i];
    }
    ema.push(sum / Math.min(period, prices.length));
    
    // Calculate EMA for remaining values
    for (let i = period; i < prices.length; i++) {
      const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(value);
    }
    
    return ema;
  }

  /**
   * Score each strategy based on market conditions
   */
  public scoreStrategies(conditions: MarketConditions): StrategyScore[] {
    const scores: StrategyScore[] = [];

    // Score SAFE strategy
    const safeReasons: string[] = [];
    let safeScore = 50; // Base score
    
    if (conditions.volatility < 40) {
      safeScore += 30;
      safeReasons.push('Low volatility favors conservative approach');
    }
    if (conditions.riskLevel === 'low') {
      safeScore += 20;
      safeReasons.push('Low risk environment suits safe trading');
    }
    if (Math.abs(conditions.trendStrength) < 30) {
      safeScore += 15;
      safeReasons.push('Weak trends reduce profit opportunities');
    }
    if (conditions.volatility > 70) {
      safeScore -= 30;
      safeReasons.push('High volatility increases risk');
    }
    
    scores.push({
      strategy: 'safe',
      score: Math.max(0, Math.min(100, safeScore)),
      reasons: safeReasons.length > 0 ? safeReasons : ['Standard safe strategy conditions'],
      confidence: this.calculateConfidence(conditions, safeScore),
    });

    // Score BALANCED strategy
    const balancedReasons: string[] = [];
    let balancedScore = 50;
    
    if (conditions.volatility >= 30 && conditions.volatility <= 60) {
      balancedScore += 35;
      balancedReasons.push('Moderate volatility optimal for balanced approach');
    }
    if (conditions.riskLevel === 'medium') {
      balancedScore += 25;
      balancedReasons.push('Medium risk environment ideal');
    }
    if (Math.abs(conditions.momentum) < 50) {
      balancedScore += 15;
      balancedReasons.push('Moderate momentum supports balanced trading');
    }
    if (conditions.volumeTrend > 10) {
      balancedScore += 10;
      balancedReasons.push('Increasing volume provides liquidity');
    }
    
    scores.push({
      strategy: 'balanced',
      score: Math.max(0, Math.min(100, balancedScore)),
      reasons: balancedReasons.length > 0 ? balancedReasons : ['Standard balanced strategy conditions'],
      confidence: this.calculateConfidence(conditions, balancedScore),
    });

    // Score AGGRESSIVE strategy
    const aggressiveReasons: string[] = [];
    let aggressiveScore = 50;
    
    if (conditions.volatility > 60) {
      aggressiveScore += 35;
      aggressiveReasons.push('High volatility creates profit opportunities');
    }
    if (Math.abs(conditions.trendStrength) > 50) {
      aggressiveScore += 30;
      aggressiveReasons.push('Strong trend enables aggressive positioning');
    }
    if (Math.abs(conditions.momentum) > 60) {
      aggressiveScore += 20;
      aggressiveReasons.push('Strong momentum supports aggressive trades');
    }
    if (conditions.volumeTrend > 30) {
      aggressiveScore += 10;
      aggressiveReasons.push('High volume surge indicates major movement');
    }
    if (conditions.volatility < 30) {
      aggressiveScore -= 30;
      aggressiveReasons.push('Low volatility limits profit potential');
    }
    
    scores.push({
      strategy: 'aggressive',
      score: Math.max(0, Math.min(100, aggressiveScore)),
      reasons: aggressiveReasons.length > 0 ? aggressiveReasons : ['Standard aggressive strategy conditions'],
      confidence: this.calculateConfidence(conditions, aggressiveScore),
    });

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate confidence level for a strategy score
   */
  private calculateConfidence(conditions: MarketConditions, score: number): number {
    // Base confidence on data quality and market stability
    let confidence = 70; // Base confidence
    
    // More data = more confidence
    const avgDataPoints = Array.from(this.priceHistory.values())
      .reduce((sum, history) => sum + history.length, 0) / this.priceHistory.size;
    
    if (avgDataPoints > 40) confidence += 15;
    else if (avgDataPoints < 20) confidence -= 20;
    
    // Clear market conditions = higher confidence
    if (conditions.volatility < 30 || conditions.volatility > 70) confidence += 10;
    if (Math.abs(conditions.trendStrength) > 50) confidence += 10;
    
    // Extreme score deviations = lower confidence
    const scoreDiff = Math.abs(score - 50);
    if (scoreDiff > 40) confidence += 5; // Very clear signal
    else if (scoreDiff < 10) confidence -= 15; // Uncertain
    
    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Select best strategy based on AI analysis
   */
  public selectBestStrategy(currentStrategy: StrategyType): AIDecision {
    const conditions = this.analyzeMarketConditions();
    const strategyScores = this.scoreStrategies(conditions);
    const bestStrategy = strategyScores[0];
    
    // Build reasoning
    const reasoning = this.buildReasoning(conditions, strategyScores, bestStrategy);
    
    // Calculate expected win rate based on strategy and conditions
    const expectedWinRate = this.calculateExpectedWinRate(bestStrategy.strategy, conditions);
    
    const decision: AIDecision = {
      id: randomUUID(),
      timestamp: Date.now(),
      marketConditions: conditions,
      strategyScores,
      selectedStrategy: bestStrategy.strategy,
      previousStrategy: currentStrategy,
      reasoning,
      confidence: bestStrategy.confidence,
      expectedWinRate,
    };
    
    // Store decision history
    this.aiDecisionHistory.push(decision);
    if (this.aiDecisionHistory.length > 100) {
      this.aiDecisionHistory.shift();
    }
    
    return decision;
  }

  /**
   * Build human-readable reasoning for strategy selection
   */
  private buildReasoning(
    conditions: MarketConditions,
    scores: StrategyScore[],
    selectedScore: StrategyScore
  ): string {
    const parts: string[] = [];
    
    // Market overview
    parts.push(`Market analysis shows ${conditions.volatility.toFixed(0)}% volatility with ${conditions.riskLevel} risk level.`);
    
    if (Math.abs(conditions.trendStrength) > 50) {
      parts.push(`Strong ${conditions.trendStrength > 0 ? 'upward' : 'downward'} trend detected.`);
    } else {
      parts.push(`Market showing weak trending behavior.`);
    }
    
    // Strategy rationale
    parts.push(`${selectedScore.strategy.toUpperCase()} strategy scored highest (${selectedScore.score.toFixed(0)}/100) because:`);
    parts.push(selectedScore.reasons.join('; '));
    
    // Comparison
    const otherScores = scores.filter(s => s.strategy !== selectedScore.strategy);
    if (otherScores.length > 0) {
      parts.push(`Alternative strategies: ${otherScores.map(s => `${s.strategy} (${s.score.toFixed(0)})`).join(', ')}.`);
    }
    
    return parts.join(' ');
  }

  /**
   * Calculate expected win rate for strategy under current conditions
   */
  private calculateExpectedWinRate(strategy: StrategyType, conditions: MarketConditions): number {
    // Base win rates
    const baseRates = {
      safe: 70,
      balanced: 60,
      aggressive: 50,
    };
    
    let winRate = baseRates[strategy];
    
    // Adjust based on conditions matching strategy
    if (strategy === 'safe') {
      if (conditions.volatility < 40) winRate += 10;
      if (conditions.riskLevel === 'low') winRate += 5;
      if (conditions.volatility > 70) winRate -= 15;
    } else if (strategy === 'balanced') {
      if (conditions.volatility >= 30 && conditions.volatility <= 60) winRate += 12;
      if (conditions.riskLevel === 'medium') winRate += 8;
    } else if (strategy === 'aggressive') {
      if (conditions.volatility > 60) winRate += 10;
      if (Math.abs(conditions.trendStrength) > 50) winRate += 8;
      if (conditions.volatility < 30) winRate -= 15;
    }
    
    return Math.max(30, Math.min(85, winRate));
  }

  /**
   * Get recent AI decision history
   */
  public getDecisionHistory(limit: number = 20): AIDecision[] {
    return this.aiDecisionHistory.slice(-limit);
  }

  /**
   * Clear decision history (for testing/reset)
   */
  public clearHistory() {
    this.aiDecisionHistory = [];
    this.priceHistory.clear();
  }
}

// Singleton instance
export const strategyAI = new StrategyAI();
