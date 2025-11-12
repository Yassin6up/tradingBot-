import ccxt from 'ccxt';

export interface BinanceConfig {
  apiKey?: string;
  secret?: string;
  testnet?: boolean;
}

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

export class BinanceService {
  private exchange: any | null = null;
  private isConnected: boolean = false;
  private priceCache: Map<string, PriceData> = new Map();
  private cacheExpiry: number = 5000; // 5 seconds cache

  constructor(private config: BinanceConfig = {}) {}

  /**
   * Initialize connection to Binance
   */
  async connect(): Promise<void> {
    try {
      this.exchange = new ccxt.binance({
        apiKey: this.config.apiKey || process.env.BINANCE_API_KEY,
        secret: this.config.secret || process.env.BINANCE_SECRET,
        enableRateLimit: true,
        options: {
          defaultType: 'spot',
          adjustForTimeDifference: true,
        },
      });

      // Use testnet if configured
      if (this.config.testnet) {
        this.exchange.setSandboxMode(true);
      }

      // Test connection by loading markets
      await this.exchange.loadMarkets();
      this.isConnected = true;
      console.log('✅ Binance API connected successfully');
    } catch (error) {
      this.isConnected = false;
      console.error('❌ Failed to connect to Binance:', error instanceof Error ? error.message : error);
      throw new Error(`Binance connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if connected to Binance
   */
  isApiConnected(): boolean {
    return this.isConnected && this.exchange !== null;
  }

  /**
   * Disconnect from Binance
   */
  disconnect(): void {
    this.exchange = null;
    this.isConnected = false;
    this.priceCache.clear();
    console.log('Binance API disconnected');
  }

  /**
   * Fetch current price for a symbol with caching
   */
  async fetchPrice(symbol: string): Promise<number> {
    // Check cache first
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.price;
    }

    if (!this.exchange) {
      throw new Error('Binance not connected. Call connect() first.');
    }

    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      const price = ticker.last || ticker.close || 0;
      
      // Update cache
      this.priceCache.set(symbol, {
        symbol,
        price,
        timestamp: Date.now(),
      });

      return price;
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error instanceof Error ? error.message : error);
      
      // Return cached value if available, even if expired
      if (cached) {
        console.log(`Using expired cache for ${symbol}`);
        return cached.price;
      }
      
      throw new Error(`Failed to fetch price for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch multiple prices at once
   */
  async fetchPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    // Fetch prices in parallel
    const results = await Promise.allSettled(
      symbols.map(symbol => this.fetchPrice(symbol))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        prices.set(symbols[index], result.value);
      } else {
        console.error(`Failed to fetch ${symbols[index]}:`, result.reason);
      }
    });

    return prices;
  }

  /**
   * Get account balance (requires API credentials)
   */
  async getBalance(): Promise<any | null> {
    if (!this.exchange) {
      throw new Error('Binance not connected');
    }

    if (!this.config.apiKey || !this.config.secret) {
      console.warn('API credentials not configured - cannot fetch balance');
      return null;
    }

    try {
      const balance = await this.exchange.fetchBalance();
      return balance;
    } catch (error) {
      console.error('Failed to fetch balance:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Get total balance in USDT equivalent
   * Calculates total portfolio value by converting all assets to USDT
   */
  async getTotalBalanceUSDT(balanceData?: any): Promise<number> {
    // Reuse balance if provided to avoid duplicate API calls
    const balance = balanceData || await this.getBalance();
    if (!balance) {
      throw new Error('Failed to fetch balance');
    }

    let totalUSDT = 0;
    
    // Stablecoins that are 1:1 with USD (no conversion needed)
    const stablecoins = new Set(['USDT', 'BUSD', 'USDC', 'TUSD', 'USDP', 'DAI']);

    if (!balance.total) {
      return 0;
    }

    // Process all assets
    for (const [asset, amount] of Object.entries(balance.total)) {
      if (typeof amount !== 'number' || amount <= 0.00001) {
        continue; // Skip dust and invalid amounts
      }

      // Add stablecoins directly (they're already ~1 USD each)
      if (stablecoins.has(asset)) {
        totalUSDT += amount;
        continue;
      }

      // Convert other assets to USDT
      try {
        const symbol = `${asset}/USDT`;
        const price = await this.fetchPrice(symbol);
        totalUSDT += amount * price;
      } catch (error) {
        console.warn(`Failed to convert ${asset} to USDT (pair may not exist):`, error instanceof Error ? error.message : error);
        // Try BTC as intermediate if direct USDT pair doesn't exist
        try {
          if (asset !== 'BTC') {
            const btcPair = `${asset}/BTC`;
            const btcPrice = await this.fetchPrice(btcPair);
            const btcUsdtPrice = await this.fetchPrice('BTC/USDT');
            totalUSDT += amount * btcPrice * btcUsdtPrice;
          }
        } catch (fallbackError) {
          console.warn(`Failed to convert ${asset} via BTC fallback, skipping`);
        }
      }
    }

    return totalUSDT;
  }

  /**
   * Get simplified balance structure for frontend display
   */
  async getSimplifiedBalance(): Promise<{ total: number; assets: Record<string, number> }> {
    const balance = await this.getBalance();
    if (!balance) {
      return { total: 0, assets: {} };
    }

    // Extract non-zero balances
    const assets: Record<string, number> = {};
    if (balance.total) {
      for (const [asset, amount] of Object.entries(balance.total)) {
        if (typeof amount === 'number' && amount > 0.00001) { // Filter dust
          assets[asset] = amount;
        }
      }
    }

    // Calculate total in USDT using the same balance object (avoid duplicate API call)
    const total = await this.getTotalBalanceUSDT(balance);

    return { total, assets };
  }

  /**
   * Test connection to Binance API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.exchange) {
        await this.connect();
      }

      // Test by fetching a common pair
      const price = await this.fetchPrice('BTC/USDT');
      
      return {
        success: true,
        message: `Connected successfully. BTC/USDT price: $${price.toFixed(2)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Fetch historical OHLCV data for charting
   */
  async fetchOHLCV(symbol: string, timeframe: string = '5m', limit: number = 100): Promise<any[]> {
    if (!this.exchange) {
      throw new Error('Binance not connected. Call connect() first.');
    }

    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
      
      // Transform OHLCV data to chart format
      // OHLCV format: [timestamp, open, high, low, close, volume]
      return ohlcv.map((candle: number[]) => ({
        timestamp: candle[0],
        price: candle[4], // Use close price
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
    } catch (error) {
      console.error(`Failed to fetch OHLCV for ${symbol}:`, error instanceof Error ? error.message : error);
      throw new Error(`Failed to fetch historical data for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
  }

  /**
   * Get available trading symbols
   */
  async getAvailableSymbols(): Promise<string[]> {
    if (!this.exchange) {
      throw new Error('Binance not connected');
    }

    try {
      const markets = await this.exchange.loadMarkets();
      return Object.keys(markets).filter(symbol => 
        symbol.includes('/USDT') && markets[symbol].active
      );
    } catch (error) {
      console.error('Failed to load markets:', error);
      return [];
    }
  }

  /**
   * Place a market buy order
   */
  async placeBuyOrder(symbol: string, amountInUSDT: number): Promise<any> {
    if (!this.exchange) {
      throw new Error('Binance not connected. Call connect() first.');
    }

    if (!this.config.apiKey || !this.config.secret) {
      throw new Error('API credentials required for trading');
    }

    try {
      // Fetch current price to calculate quantity
      const currentPrice = await this.fetchPrice(symbol);
      const quantity = amountInUSDT / currentPrice;

      // Place market buy order
      const order = await this.exchange.createMarketBuyOrder(symbol, quantity);
      
      console.log(`✅ BUY order placed: ${quantity.toFixed(8)} ${symbol} at ~$${currentPrice.toFixed(2)}`);
      return order;
    } catch (error) {
      console.error(`Failed to place BUY order for ${symbol}:`, error instanceof Error ? error.message : error);
      throw new Error(`Failed to place BUY order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Place a market sell order
   */
  async placeSellOrder(symbol: string, quantity: number): Promise<any> {
    if (!this.exchange) {
      throw new Error('Binance not connected. Call connect() first.');
    }

    if (!this.config.apiKey || !this.config.secret) {
      throw new Error('API credentials required for trading');
    }

    try {
      // Place market sell order
      const order = await this.exchange.createMarketSellOrder(symbol, quantity);
      
      const currentPrice = await this.fetchPrice(symbol);
      console.log(`✅ SELL order placed: ${quantity.toFixed(8)} ${symbol} at ~$${currentPrice.toFixed(2)}`);
      return order;
    } catch (error) {
      console.error(`Failed to place SELL order for ${symbol}:`, error instanceof Error ? error.message : error);
      throw new Error(`Failed to place SELL order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get asset balance for a specific symbol (e.g., 'BTC', 'ETH')
   */
  async getAssetBalance(asset: string): Promise<number> {
    if (!this.exchange) {
      throw new Error('Binance not connected');
    }

    try {
      const balance = await this.getBalance();
      if (!balance || !balance.free) {
        return 0;
      }
      return balance.free[asset] || 0;
    } catch (error) {
      console.error(`Failed to get balance for ${asset}:`, error);
      return 0;
    }
  }
}

// Singleton instance for app-wide use
let binanceInstance: BinanceService | null = null;

export function getBinanceService(config?: BinanceConfig): BinanceService {
  // If config is provided, always create a new instance or reconfigure existing one
  if (config) {
    if (binanceInstance) {
      binanceInstance.disconnect();
    }
    binanceInstance = new BinanceService(config);
    return binanceInstance;
  }
  
  // If no config provided, return existing instance or create a default one
  if (!binanceInstance) {
    binanceInstance = new BinanceService();
  }
  return binanceInstance;
}

export function resetBinanceService(): void {
  if (binanceInstance) {
    binanceInstance.disconnect();
    binanceInstance = null;
  }
}

// Create a temporary instance for testing without affecting the singleton
export function createTemporaryBinanceService(config?: BinanceConfig): BinanceService {
  return new BinanceService(config);
}
