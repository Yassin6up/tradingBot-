import { RSI, MACD, SMA, EMA, BollingerBands } from 'technicalindicators';

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Calculate technical indicators from OHLCV data
 */
export function calculateTechnicalIndicators(candles: OHLCVData[]): TechnicalIndicators | null {
  if (candles.length < 50) {
    console.warn('Not enough candles for technical indicators (need at least 50)');
    return null;
  }

  const closePrices = candles.map(c => c.close);
  const highPrices = candles.map(c => c.high);
  const lowPrices = candles.map(c => c.low);

  try {
    // RSI (14 period)
    const rsiValues = RSI.calculate({
      values: closePrices,
      period: 14,
    });
    const rsi = rsiValues[rsiValues.length - 1] || 50;

    // MACD (12, 26, 9)
    const macdValues = MACD.calculate({
      values: closePrices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const macdLast = macdValues[macdValues.length - 1];

    // SMA 20 and 50
    const sma20Values = SMA.calculate({
      values: closePrices,
      period: 20,
    });
    const sma50Values = SMA.calculate({
      values: closePrices,
      period: 50,
    });
    const sma20 = sma20Values[sma20Values.length - 1] || closePrices[closePrices.length - 1];
    const sma50 = sma50Values[sma50Values.length - 1] || closePrices[closePrices.length - 1];

    // EMA 12 and 26
    const ema12Values = EMA.calculate({
      values: closePrices,
      period: 12,
    });
    const ema26Values = EMA.calculate({
      values: closePrices,
      period: 26,
    });
    const ema12 = ema12Values[ema12Values.length - 1] || closePrices[closePrices.length - 1];
    const ema26 = ema26Values[ema26Values.length - 1] || closePrices[closePrices.length - 1];

    // Bollinger Bands (20 period, 2 std dev)
    const bbValues = BollingerBands.calculate({
      values: closePrices,
      period: 20,
      stdDev: 2,
    });
    const bbLast = bbValues[bbValues.length - 1] || {
      upper: closePrices[closePrices.length - 1] * 1.02,
      middle: closePrices[closePrices.length - 1],
      lower: closePrices[closePrices.length - 1] * 0.98,
    };

    return {
      rsi,
      macd: {
        macd: macdLast?.MACD ?? 0,
        signal: macdLast?.signal ?? 0,
        histogram: macdLast?.histogram ?? 0,
      },
      sma20,
      sma50,
      ema12,
      ema26,
      bollingerBands: {
        upper: bbLast.upper,
        middle: bbLast.middle,
        lower: bbLast.lower,
      },
    };
  } catch (error) {
    console.error('Error calculating technical indicators:', error);
    return null;
  }
}

/**
 * Analyze market trend based on technical indicators
 */
export function analyzeTrend(indicators: TechnicalIndicators, currentPrice: number): {
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  signals: string[];
} {
  const signals: string[] = [];
  let bullishScore = 0;
  let bearishScore = 0;

  // RSI Analysis
  if (indicators.rsi > 70) {
    bearishScore += 2;
    signals.push('RSI Overbought (>70)');
  } else if (indicators.rsi < 30) {
    bullishScore += 2;
    signals.push('RSI Oversold (<30)');
  } else if (indicators.rsi > 50) {
    bullishScore += 1;
    signals.push('RSI Bullish (>50)');
  } else {
    bearishScore += 1;
    signals.push('RSI Bearish (<50)');
  }

  // MACD Analysis
  if (indicators.macd.histogram > 0) {
    bullishScore += 2;
    signals.push('MACD Bullish Crossover');
  } else {
    bearishScore += 2;
    signals.push('MACD Bearish Crossover');
  }

  // Moving Average Analysis
  if (currentPrice > indicators.sma20 && currentPrice > indicators.sma50) {
    bullishScore += 2;
    signals.push('Price Above MA20 & MA50');
  } else if (currentPrice < indicators.sma20 && currentPrice < indicators.sma50) {
    bearishScore += 2;
    signals.push('Price Below MA20 & MA50');
  }

  if (indicators.sma20 > indicators.sma50) {
    bullishScore += 1;
    signals.push('MA20 > MA50 (Golden Cross)');
  } else {
    bearishScore += 1;
    signals.push('MA20 < MA50 (Death Cross)');
  }

  // EMA Analysis
  if (indicators.ema12 > indicators.ema26) {
    bullishScore += 1;
    signals.push('EMA12 > EMA26');
  } else {
    bearishScore += 1;
    signals.push('EMA12 < EMA26');
  }

  // Bollinger Bands Analysis
  if (currentPrice > indicators.bollingerBands.upper) {
    bearishScore += 1;
    signals.push('Price Above Upper BB (Overbought)');
  } else if (currentPrice < indicators.bollingerBands.lower) {
    bullishScore += 1;
    signals.push('Price Below Lower BB (Oversold)');
  }

  // Determine trend and strength
  const totalScore = bullishScore + bearishScore;
  const strength = totalScore > 0 ? Math.abs(bullishScore - bearishScore) / totalScore : 0;

  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (bullishScore > bearishScore + 1) {
    trend = 'bullish';
  } else if (bearishScore > bullishScore + 1) {
    trend = 'bearish';
  }

  return {
    trend,
    strength: strength * 100,
    signals,
  };
}

/**
 * Get trading signals based on technical indicators
 */
export function getTradingSignals(indicators: TechnicalIndicators, currentPrice: number): {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasons: string[];
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
} {
  const trendAnalysis = analyzeTrend(indicators, currentPrice);
  const reasons: string[] = [...trendAnalysis.signals];
  let confidence = trendAnalysis.strength;

  // Strong buy signals
  if (
    indicators.rsi < 30 &&
    indicators.macd.histogram > 0 &&
    currentPrice < indicators.bollingerBands.lower
  ) {
    return {
      action: 'BUY',
      confidence: Math.min(confidence + 20, 95),
      reasons: [...reasons, 'Strong Buy: Oversold + MACD Bullish + BB Lower'],
      suggestedStopLoss: currentPrice * 0.97,
      suggestedTakeProfit: currentPrice * 1.05,
    };
  }

  // Strong sell signals
  if (
    indicators.rsi > 70 &&
    indicators.macd.histogram < 0 &&
    currentPrice > indicators.bollingerBands.upper
  ) {
    return {
      action: 'SELL',
      confidence: Math.min(confidence + 20, 95),
      reasons: [...reasons, 'Strong Sell: Overbought + MACD Bearish + BB Upper'],
    };
  }

  // Regular buy signals
  if (trendAnalysis.trend === 'bullish' && confidence > 60) {
    return {
      action: 'BUY',
      confidence,
      reasons,
      suggestedStopLoss: currentPrice * 0.98,
      suggestedTakeProfit: currentPrice * 1.03,
    };
  }

  // Regular sell signals
  if (trendAnalysis.trend === 'bearish' && confidence > 60) {
    return {
      action: 'SELL',
      confidence,
      reasons,
    };
  }

  // Hold
  return {
    action: 'HOLD',
    confidence: 100 - confidence,
    reasons: [...reasons, 'No strong signals - holding position'],
  };
}
