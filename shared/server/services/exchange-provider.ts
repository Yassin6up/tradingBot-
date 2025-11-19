import { BinanceService, BinanceConfig } from './binance';
import ccxt from 'ccxt';

export interface ExchangeProvider {
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): void;
  fetchPrice(symbol: string): Promise<number>;
  fetchPrices(symbols: string[]): Promise<Map<string, number>>;
  fetchOHLCV(symbol: string, timeframe: string, limit: number): Promise<any[]>;
  getTotalBalanceUSDT(): Promise<number>;
  getAssetBalance(asset: string): Promise<number>;
  getSimplifiedBalance(): Promise<{ total: number; assets: Record<string, number> }>;
  placeBuyOrder(symbol: string, amountUSDT: number): Promise<{
    id: string;
    symbol: string;
    side: 'buy';
    filled: number;
    average: number;
    cost: number;
  }>;
  placeSellOrder(symbol: string, quantity: number): Promise<{
    id: string;
    symbol: string;
    side: 'sell';
    filled: number;
    average: number;
    cost: number;
  }>;
}

/**
 * Binance Exchange Adapter
 * Wraps the actual Binance service with the common interface
 */
export class BinanceExchangeAdapter implements ExchangeProvider {
  constructor(private binanceService: BinanceService) {}

  isConnected(): boolean {
    return this.binanceService.isApiConnected();
  }

  async connect(): Promise<void> {
    await this.binanceService.connect();
  }

  disconnect(): void {
    this.binanceService.disconnect();
  }

  async fetchPrice(symbol: string): Promise<number> {
    return await this.binanceService.fetchPrice(symbol);
  }

  async fetchPrices(symbols: string[]): Promise<Map<string, number>> {
    return await this.binanceService.fetchPrices(symbols);
  }

  async fetchOHLCV(symbol: string, timeframe: string, limit: number): Promise<any[]> {
    return await this.binanceService.fetchOHLCV(symbol, timeframe, limit);
  }

  async getTotalBalanceUSDT(): Promise<number> {
    return await this.binanceService.getTotalBalanceUSDT();
  }

  async getAssetBalance(asset: string): Promise<number> {
    return await this.binanceService.getAssetBalance(asset);
  }

  async getSimplifiedBalance(): Promise<{ total: number; assets: Record<string, number> }> {
    return await this.binanceService.getSimplifiedBalance();
  }

  async placeBuyOrder(symbol: string, amountUSDT: number): Promise<any> {
    return await this.binanceService.placeBuyOrder(symbol, amountUSDT);
  }

  async placeSellOrder(symbol: string, quantity: number): Promise<any> {
    return await this.binanceService.placeSellOrder(symbol, quantity);
  }
}

/**
 * Binance Testnet Provider (SPOT Testnet via testnet.binance.vision)
 * Uses real Binance API with testnet funds for realistic paper trading
 */
export class BinanceTestnetProvider implements ExchangeProvider {
  private exchange: any | null = null;
  private connected: boolean = false;
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheExpiry: number = 5000; // 5 seconds

  constructor(private apiKey?: string, private secret?: string) {}

  isConnected(): boolean {
    return this.connected && this.exchange !== null;
  }

async connect(): Promise<void> {
  try {
    // Validate that we have API credentials
    const apiKey = this.apiKey || process.env.BINANCE_TESTNET_API_KEY;
    const secret = this.secret || process.env.BINANCE_TESTNET_SECRET;
    
    if (!apiKey || !secret) {
      throw new Error('Binance Testnet API key and secret are required');
    }

    // Configure CCXT for Binance SPOT Testnet
    this.exchange = new ccxt.binance({
      apiKey,
      secret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot',
        adjustForTimeDifference: true,
      },
      urls: {
        api: {
          public: 'https://testnet.binance.vision/api',
          private: 'https://testnet.binance.vision/api', 
          v3: 'https://testnet.binance.vision/api/v3',
          sapi: 'https://testnet.binance.vision/sapi',
          sapiV2: 'https://testnet.binance.vision/sapi/v2',
          wapi: 'https://testnet.binance.vision/wapi',
        },
        www: 'https://testnet.binance.vision',
      },
    });

    // Test connection by loading markets
    await this.exchange.loadMarkets();
    
    // Verify we can fetch account balance (optional but good for validation)
    try {
      const balance = await this.exchange.fetchBalance();
      console.log(" balance ",balance);
      console.log(`✅ Binance SPOT Testnet connected successfully`);
      console.log(`   Available pairs: ${Object.keys(this.exchange.markets).length}`);
      console.log(`   Account type: ${this.exchange.options.defaultType}`);
    } catch (balanceError) {
      console.warn('⚠️  Connected to Testnet but balance fetch failed - check API permissions');
    }
    
    this.connected = true;
    
  } catch (error) {
    this.connected = false;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to connect to Binance Testnet:', errorMessage);
    
    // More specific error handling
    if (errorMessage.includes('API-key format invalid')) {
      throw new Error('Invalid Binance Testnet API credentials');
    } else if (errorMessage.includes('Network error')) {
      throw new Error('Network connection to Binance Testnet failed');
    } else {
      throw new Error(`Binance Testnet connection failed: ${errorMessage}`);
    }
  }
}
  disconnect(): void {
    this.exchange = null;
    this.connected = false;
    this.priceCache.clear();
    console.log('Binance Testnet disconnected');
  }

  async fetchPrice(symbol: string): Promise<number> {
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.price;
    }

    if (!this.exchange) {
      throw new Error('Binance Testnet not connected');
    }

    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      const price = ticker.last || ticker.close || 0;
      
      this.priceCache.set(symbol, { price, timestamp: Date.now() });
      return price;
    } catch (error) {
      console.error(`Testnet: Failed to fetch ${symbol}:`, error instanceof Error ? error.message : error);
      if (cached) return cached.price;
      throw error;
    }
  }

  async fetchPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const results = await Promise.allSettled(
      symbols.map(symbol => this.fetchPrice(symbol))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        prices.set(symbols[index], result.value);
      }
    });

    return prices;
  }

  async fetchOHLCV(symbol: string, timeframe: string, limit: number): Promise<any[]> {
    if (!this.exchange) {
      throw new Error('Binance Testnet not connected');
    }
    return await this.exchange.fetchOHLCV(symbol, timeframe, limit);
  }

  async getTotalBalanceUSDT(): Promise<number> {
    if (!this.exchange) {
      throw new Error('Binance Testnet not connected');
    }

    try {
      const balance = await this.exchange.fetchBalance();
      let totalUSDT = 0;
      const stablecoins = new Set(['USDT', 'BUSD', 'USDC']);

      if (balance.total) {
        for (const [asset, amount] of Object.entries(balance.total)) {
          if (typeof amount !== 'number' || amount <= 0.00001) continue;
          
          if (stablecoins.has(asset)) {
            totalUSDT += amount;
          } else {
            try {
              const price = await this.fetchPrice(`${asset}/USDT`);
              totalUSDT += amount * price;
            } catch (error) {
              console.warn(`Testnet: Failed to convert ${asset} to USDT`);
            }
          }
        }
      }

      return totalUSDT;
    } catch (error) {
      console.error('Testnet: Failed to fetch balance:', error);
      throw error;
    }
  }

  async getAssetBalance(asset: string): Promise<number> {
    if (!this.exchange) {
      throw new Error('Binance Testnet not connected');
    }

    try {
      const balance = await this.exchange.fetchBalance();
      return balance.free?.[asset] || 0;
    } catch (error) {
      console.error(`Testnet: Failed to get ${asset} balance:`, error);
      return 0;
    }
  }

  async getSimplifiedBalance(): Promise<{ total: number; assets: Record<string, number> }> {
    if (!this.exchange) {
      throw new Error('Binance Testnet not connected');
    }

    try {
      const balance = await this.exchange.fetchBalance();
      const assets: Record<string, number> = {};
      
      if (balance.total) {
        for (const [asset, amount] of Object.entries(balance.total)) {
          if (typeof amount === 'number' && amount > 0.00001) {
            assets[asset] = amount;
          }
        }
      }

      const total = await this.getTotalBalanceUSDT();
      return { total, assets };
    } catch (error) {
      console.error('Testnet: Failed to get simplified balance:', error);
      return { total: 0, assets: {} };
    }
  }

  async placeBuyOrder(symbol: string, amountUSDT: number): Promise<any> {
    if (!this.exchange) {
      throw new Error('Binance Testnet not connected');
    }

    try {
      const price = await this.fetchPrice(symbol);
      const quantity = amountUSDT / price;

      console.log(`🧪 TESTNET BUY: ${quantity} ${symbol} at $${price} (total: $${amountUSDT})`);
      
      const order = await this.exchange.createMarketBuyOrder(symbol, quantity);
      
      return {
        id: order.id,
        symbol: order.symbol,
        side: 'buy',
        filled: order.filled || quantity,
        average: order.average || price,
        cost: order.cost || amountUSDT,
      };
    } catch (error) {
      console.error(`Testnet: Buy order failed for ${symbol}:`, error);
      throw error;
    }
  }

  async placeSellOrder(symbol: string, quantity: number): Promise<any> {
    if (!this.exchange) {
      throw new Error('Binance Testnet not connected');
    }

    try {
      const price = await this.fetchPrice(symbol);
      const cost = quantity * price;

      console.log(`🧪 TESTNET SELL: ${quantity} ${symbol} at $${price} (total: $${cost})`);
      
      const order = await this.exchange.createMarketSellOrder(symbol, quantity);
      
      return {
        id: order.id,
        symbol: order.symbol,
        side: 'sell',
        filled: order.filled || quantity,
        average: order.average || price,
        cost: order.cost || cost,
      };
    } catch (error) {
      console.error(`Testnet: Sell order failed for ${symbol}:`, error);
      throw error;
    }
  }
}

/**
 * Simulation Exchange Provider
 * Provides realistic simulated trading for development and testing
 */
export class SimulationExchangeProvider implements ExchangeProvider {
  private connected: boolean = false;
  private basePrice: number = 50000; // BTC base price
  private balance: number = 10000; // Start with $10,000 USDT
  private holdings: Map<string, number> = new Map(); // Asset holdings
  private priceHistory: Map<string, number[]> = new Map(); // Price history for charts
  private lastPriceUpdate: number = Date.now();

  constructor(initialBalance: number = 10000) {
    this.balance = initialBalance;
    this.initializePriceHistory();
  }

  private initializePriceHistory(): void {
    const symbols = [
      'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
      'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT', 'LTC/USDT',
      'MATIC/USDT', 'ATOM/USDT', 'UNI/USDT', 'ALGO/USDT', 'XLM/USDT',
      'VET/USDT', 'FIL/USDT', 'ETC/USDT', 'EOS/USDT', 'AAVE/USDT',
      'MKR/USDT', 'COMP/USDT', 'SNX/USDT', 'YFI/USDT', 'SAND/USDT',
      'DOGE/USDT', 'SHIB/USDT', 'TRX/USDT', 'APE/USDT', 'GALA/USDT',
      'MANA/USDT', 'ENJ/USDT', 'CHZ/USDT', 'HOT/USDT', 'BAT/USDT',
      'NEAR/USDT', 'FTM/USDT', 'GRT/USDT', 'CRV/USDT', '1INCH/USDT',
      'ZIL/USDT', 'IOTA/USDT', 'WAVES/USDT', 'DASH/USDT', 'ZEC/USDT',
      'AXS/USDT', 'SUSHI/USDT', 'CELO/USDT', 'KAVA/USDT', 'RVN/USDT',
      'IOST/USDT', 'STORJ/USDT', 'ONT/USDT', 'SC/USDT', 'DGB/USDT'
    ];
    
    const basePrices: Record<string, number> = {
      'BTC/USDT': 50000,
      'ETH/USDT': 3000,
      'BNB/USDT': 400,
      'SOL/USDT': 100,
      'XRP/USDT': 0.60,
      'ADA/USDT': 0.50,
      'AVAX/USDT': 25,
      'DOT/USDT': 5,
      'LINK/USDT': 12,
      'LTC/USDT': 80,
      'MATIC/USDT': 0.80,
      'ATOM/USDT': 8,
      'UNI/USDT': 7,
      'ALGO/USDT': 0.20,
      'XLM/USDT': 0.12,
      'VET/USDT': 0.03,
      'FIL/USDT': 4,
      'ETC/USDT': 20,
      'EOS/USDT': 0.70,
      'AAVE/USDT': 90,
      'MKR/USDT': 1500,
      'COMP/USDT': 50,
      'SNX/USDT': 3,
      'YFI/USDT': 8000,
      'SAND/USDT': 0.40,
      'DOGE/USDT': 0.08,
      'SHIB/USDT': 0.000012,
      'TRX/USDT': 0.10,
      'APE/USDT': 1.50,
      'GALA/USDT': 0.025,
      'MANA/USDT': 0.45,
      'ENJ/USDT': 0.30,
      'CHZ/USDT': 0.08,
      'HOT/USDT': 0.002,
      'BAT/USDT': 0.25,
      'NEAR/USDT': 5,
      'FTM/USDT': 0.40,
      'GRT/USDT': 0.15,
      'CRV/USDT': 0.60,
      '1INCH/USDT': 0.40,
      'ZIL/USDT': 0.02,
      'IOTA/USDT': 0.20,
      'WAVES/USDT': 2,
      'DASH/USDT': 30,
      'ZEC/USDT': 35,
      'AXS/USDT': 6,
      'SUSHI/USDT': 1,
      'CELO/USDT': 0.70,
      'KAVA/USDT': 0.50,
      'RVN/USDT': 0.02,
      'IOST/USDT': 0.01,
      'STORJ/USDT': 0.50,
      'ONT/USDT': 0.25,
      'SC/USDT': 0.005,
      'DGB/USDT': 0.01,
    };

    symbols.forEach(symbol => {
      const basePrice = basePrices[symbol];
      const history: number[] = [];
      
      // Generate 200 historical price points (30-minute candles = 100 hours of history)
      for (let i = 0; i < 200; i++) {
        const volatility = basePrice * 0.02; // 2% volatility
        const randomWalk = (Math.random() - 0.5) * volatility;
        const price = basePrice + randomWalk;
        history.push(price);
      }
      
      this.priceHistory.set(symbol, history);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    console.log('📊 Connecting to Simulation Exchange...');
    this.connected = true;
    console.log('✅ Simulation Exchange connected successfully');
  }

  disconnect(): void {
    this.connected = false;
    console.log('Simulation Exchange disconnected');
  }

  async fetchPrice(symbol: string): Promise<number> {
    if (!this.connected) {
      throw new Error('Simulation Exchange not connected');
    }

    // Simulate price movement
    this.updatePrices();

    const history = this.priceHistory.get(symbol);
    if (!history || history.length === 0) {
      throw new Error(`No price data for ${symbol}`);
    }

    return history[history.length - 1];
  }

  async fetchPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    for (const symbol of symbols) {
      try {
        const price = await this.fetchPrice(symbol);
        prices.set(symbol, price);
      } catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error);
      }
    }

    return prices;
  }

  async fetchOHLCV(symbol: string, timeframe: string, limit: number): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Simulation Exchange not connected');
    }

    const history = this.priceHistory.get(symbol);
    if (!history) {
      return [];
    }

    const timeframeMs = this.getTimeframeMs(timeframe);
    const now = Date.now();
    const candles: any[] = [];

    // Generate OHLCV candles from price history
    const dataPoints = Math.min(limit, history.length);
    for (let i = 0; i < dataPoints; i++) {
      const index = history.length - dataPoints + i;
      const open = history[index];
      const volatility = open * 0.01; // 1% intra-candle volatility
      const close = open + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      const volume = Math.random() * 1000;

      candles.push({
        timestamp: now - ((dataPoints - i) * timeframeMs),
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return candles;
  }

  private getTimeframeMs(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };
    return map[timeframe] || 300000;
  }

  async getTotalBalanceUSDT(): Promise<number> {
    let total = this.balance;

    // Add value of holdings
    const holdingsArray = Array.from(this.holdings.entries());
    for (const [symbol, amount] of holdingsArray) {
      const fullSymbol = `${symbol}/USDT`;
      try {
        const price = await this.fetchPrice(fullSymbol);
        total += amount * price;
      } catch (error) {
        console.error(`Failed to get price for ${symbol}:`, error);
      }
    }

    return total;
  }

  async getAssetBalance(asset: string): Promise<number> {
    return this.holdings.get(asset) || 0;
  }

  async getSimplifiedBalance(): Promise<{ total: number; assets: Record<string, number> }> {
    const total = await this.getTotalBalanceUSDT();
    const assets: Record<string, number> = { USDT: this.balance };

    const holdingsArray = Array.from(this.holdings.entries());
    for (const [symbol, amount] of holdingsArray) {
      if (amount > 0) {
        assets[symbol] = amount;
      }
    }

    return { total, assets };
  }

  async placeBuyOrder(symbol: string, amountUSDT: number): Promise<any> {
    if (!this.connected) {
      throw new Error('Simulation Exchange not connected');
    }

    const price = await this.fetchPrice(symbol);
    
    // Simulate 0.1% fee
    const fee = amountUSDT * 0.001;
    const actualAmount = amountUSDT - fee;
    
    if (this.balance < amountUSDT) {
      throw new Error(`Insufficient balance. Have: $${this.balance.toFixed(2)}, Need: $${amountUSDT.toFixed(2)}`);
    }

    const quantity = actualAmount / price;
    this.balance -= amountUSDT;
    
    const asset = symbol.split('/')[0];
    const currentHolding = this.holdings.get(asset) || 0;
    this.holdings.set(asset, currentHolding + quantity);

    console.log(`✅ SIM BUY: ${quantity.toFixed(8)} ${asset} at $${price.toFixed(2)} = $${amountUSDT.toFixed(2)}`);

    return {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      side: 'buy' as const,
      filled: quantity,
      average: price,
      cost: amountUSDT,
    };
  }

  async placeSellOrder(symbol: string, quantity: number): Promise<any> {
    if (!this.connected) {
      throw new Error('Simulation Exchange not connected');
    }

    const asset = symbol.split('/')[0];
    const currentHolding = this.holdings.get(asset) || 0;

    if (currentHolding < quantity) {
      throw new Error(`Insufficient ${asset}. Have: ${currentHolding.toFixed(8)}, Need: ${quantity.toFixed(8)}`);
    }

    const price = await this.fetchPrice(symbol);
    const grossAmount = quantity * price;
    
    // Simulate 0.1% fee
    const fee = grossAmount * 0.001;
    const netAmount = grossAmount - fee;

    this.holdings.set(asset, currentHolding - quantity);
    this.balance += netAmount;

    console.log(`✅ SIM SELL: ${quantity.toFixed(8)} ${asset} at $${price.toFixed(2)} = $${netAmount.toFixed(2)}`);

    return {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      side: 'sell' as const,
      filled: quantity,
      average: price,
      cost: grossAmount,
    };
  }

  private updatePrices(): void {
    const now = Date.now();
    
    // Update prices every 3 seconds to simulate real market movement
    if (now - this.lastPriceUpdate < 3000) {
      return;
    }

    this.lastPriceUpdate = now;

    const historyArray = Array.from(this.priceHistory.entries());
    for (const [symbol, history] of historyArray) {
      const currentPrice = history[history.length - 1];
      const volatility = currentPrice * 0.005; // 0.5% volatility per update
      const priceChange = (Math.random() - 0.5) * volatility;
      const newPrice = currentPrice + priceChange;
      
      // Add new price and keep last 200 points
      history.push(newPrice);
      if (history.length > 200) {
        history.shift();
      }
    }
  }
}

/**
 * Factory function to create the appropriate exchange provider
 */
export async function createExchangeProvider(
  mode: 'simulation' | 'testnet' | 'real',
  config?: { apiKey?: string; secret?: string }
): Promise<ExchangeProvider> {
  try {
    if (mode === 'simulation') {
      // Local simulation - no API connection needed
      console.log('📊 Creating simulation provider (local)');
      const simProvider = new SimulationExchangeProvider();
      await simProvider.connect();
      return simProvider;
    } else if (mode === 'testnet') {
      // Binance SPOT Testnet - real API with test funds
      console.log('🧪 Creating testnet provider (testnet.binance.vision)');
      const testnetProvider = new BinanceTestnetProvider(config?.apiKey, config?.secret);
      await testnetProvider.connect();
      return testnetProvider;
    } else if (mode === 'real') {
      // Live Binance trading
      console.log('💰 Creating real provider (Binance Spot Live)');
      const binanceService = new BinanceService({
        apiKey: config?.apiKey,
        secret: config?.secret,
        testnet: false,
      });
      await binanceService.connect();
      return new BinanceExchangeAdapter(binanceService);
    }
    
    throw new Error(`Unknown trading mode: ${mode}`);
  } catch (error) {
    console.error(`❌ Failed to create ${mode} provider:`, error instanceof Error ? error.message : error);
    throw error;
  }
}
