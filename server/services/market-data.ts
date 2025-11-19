import type { ExchangeProvider } from './exchange-provider';
import type { OHLCVData } from './technical-indicators';

/**
 * Market Data Service
 * Provides OHLCV data for technical analysis
 */
export class MarketDataService {
  private dataCache: Map<string, { data: OHLCVData[]; timestamp: number }> = new Map();
  private cacheExpiry: number = 60000; // 1 minute cache

  constructor(private exchangeProvider: ExchangeProvider) {}

  /**
   * Fetch 30-minute OHLCV candles for technical analysis
   */
  async get30MinuteCandles(symbol: string, limit: number = 100): Promise<OHLCVData[]> {
    const cacheKey = `${symbol}_30m_${limit}`;
    const cached = this.dataCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const rawData = await this.exchangeProvider.fetchOHLCV(symbol, '30m', limit);
      
      const candles: OHLCVData[] = rawData.map(candle => ({
        timestamp: candle.timestamp || candle[0],
        open: candle.open || candle[1],
        high: candle.high || candle[2],
        low: candle.low || candle[3],
        close: candle.close || candle[4],
        volume: candle.volume || candle[5],
      }));

      this.dataCache.set(cacheKey, {
        data: candles,
        timestamp: Date.now(),
      });

      return candles;
    } catch (error) {
      console.error(`Failed to fetch 30-minute candles for ${symbol}:`, error);
      
      // Return cached data if available, even if expired
      if (cached) {
        console.log(`Using expired cache for ${symbol}`);
        return cached.data;
      }

      throw error;
    }
  }

  /**
   * Fetch multiple timeframe candles
   */
  async getMultiTimeframeCandles(
    symbol: string,
    timeframes: string[] = ['5m', '15m', '30m', '1h']
  ): Promise<Record<string, OHLCVData[]>> {
    const result: Record<string, OHLCVData[]> = {};

    const promises = timeframes.map(async (timeframe) => {
      try {
        const rawData = await this.exchangeProvider.fetchOHLCV(symbol, timeframe, 100);
        const candles: OHLCVData[] = rawData.map(candle => ({
          timestamp: candle.timestamp || candle[0],
          open: candle.open || candle[1],
          high: candle.high || candle[2],
          low: candle.low || candle[3],
          close: candle.close || candle[4],
          volume: candle.volume || candle[5],
        }));
        return { timeframe, candles };
      } catch (error) {
        console.error(`Failed to fetch ${timeframe} candles:`, error);
        return { timeframe, candles: [] };
      }
    });

    const results = await Promise.all(promises);
    results.forEach(({ timeframe, candles }) => {
      result[timeframe] = candles;
    });

    return result;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.dataCache.clear();
  }
}
