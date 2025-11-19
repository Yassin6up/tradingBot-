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
  // FUTURES SPECIFIC METHODS
  placeFuturesOrder(symbol: string, side: 'buy' | 'sell', quantity: number, leverage?: number): Promise<{
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    filled: number;
    average: number;
    cost: number;
    leverage?: number;
  }>;
  setLeverage(symbol: string, leverage: number): Promise<void>;
  getFuturesBalance(): Promise<number>;
  getFuturesPositions(): Promise<any[]>;
  closeFuturesPosition(symbol: string, side: 'buy' | 'sell', quantity: number): Promise<any>;
}

/**
 * Binance Futures Exchange Adapter
 * Wraps the actual Binance service with the common interface for FUTURES
 */
export class BinanceFuturesExchangeAdapter implements ExchangeProvider {
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

  // FUTURES METHODS
  async placeFuturesOrder(symbol: string, side: 'buy' | 'sell', quantity: number, leverage: number = 3): Promise<any> {
    if (!this.binanceService.isApiConnected()) {
      throw new Error('Binance not connected');
    }

    try {
      // Set leverage first
      await this.setLeverage(symbol, leverage);
      
      console.log(`🎯 FUTURES ${side.toUpperCase()}: ${quantity} ${symbol} with ${leverage}x leverage`);
      
      // Place futures market order
      const order = await this.binanceService.placeFuturesOrder(symbol, side, quantity, leverage);
      
      return {
        id: order.id,
        symbol: order.symbol,
        side: side,
        filled: order.filled || quantity,
        average: order.average || 0,
        cost: order.cost || 0,
        leverage: leverage
      };
    } catch (error) {
      console.error(`Futures order failed for ${symbol}:`, error);
      throw error;
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    // This would be implemented in your BinanceService
    console.log(`⚡ Setting leverage for ${symbol} to ${leverage}x`);
    // Implementation depends on your BinanceService futures methods
  }

  async getFuturesBalance(): Promise<number> {
    // Get futures account balance
    return await this.binanceService.getFuturesBalance();
  }

  async getFuturesPositions(): Promise<any[]> {
    // Get open futures positions
    return await this.binanceService.getFuturesPositions();
  }

  async closeFuturesPosition(symbol: string, side: 'buy' | 'sell', quantity: number): Promise<any> {
    // Close futures position with opposite side
    const closeSide = side === 'buy' ? 'sell' : 'buy';
    return await this.placeFuturesOrder(symbol, closeSide, quantity);
  }
}

/**
 * Binance Futures Testnet Provider (FUTURES Testnet)
 * Uses Binance Futures Testnet for realistic futures paper trading
 */
export class BinanceFuturesTestnetProvider implements ExchangeProvider {
  private exchange: any | null = null;
  private connected: boolean = false;
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheExpiry: number = 5000; // 5 seconds
  private positions: Map<string, any> = new Map();

  constructor(private apiKey?: string, private secret?: string) {}

  isConnected(): boolean {
    return this.connected && this.exchange !== null;
  }

  async connect(): Promise<void> {
    try {
      // Configure CCXT for Binance FUTURES Testnet
      this.exchange = new ccxt.binance({
        apiKey: this.apiKey || process.env.BINANCE_TESTNET_API_KEY,
        secret: this.secret || process.env.BINANCE_TESTNET_SECRET,
        enableRateLimit: true,
        options: {
          defaultType: 'future',
          adjustForTimeDifference: true,
        },
        urls: {
          api: {
            public: 'https://testnet.binancefuture.com/fapi/v1',
            private: 'https://testnet.binancefuture.com/fapi/v1',
          },
        },
      });

      // Load markets to test connection
      await this.exchange.loadMarkets();
      this.connected = true;
      console.log('✅ Binance FUTURES Testnet connected successfully (testnet.binancefuture.com)');
    } catch (error) {
      this.connected = false;
      console.error('❌ Failed to connect to Binance Futures Testnet:', error instanceof Error ? error.message : error);
      throw new Error(`Binance Futures Testnet connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  disconnect(): void {
    this.exchange = null;
    this.connected = false;
    this.priceCache.clear();
    this.positions.clear();
    console.log('Binance Futures Testnet disconnected');
  }

  async fetchPrice(symbol: string): Promise<number> {
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.price;
    }

    if (!this.exchange) {
      throw new Error('Binance Futures Testnet not connected');
    }

    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      const price = ticker.last || ticker.close || 0;
      
      this.priceCache.set(symbol, { price, timestamp: Date.now() });
      return price;
    } catch (error) {
      console.error(`Futures Testnet: Failed to fetch ${symbol}:`, error instanceof Error ? error.message : error);
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
      throw new Error('Binance Futures Testnet not connected');
    }
    return await this.exchange.fetchOHLCV(symbol, timeframe, limit);
  }

  async getTotalBalanceUSDT(): Promise<number> {
    return await this.getFuturesBalance();
  }

  async getAssetBalance(asset: string): Promise<number> {
    // For futures, we don't have asset balances in the same way
    return 0;
  }

  async getSimplifiedBalance(): Promise<{ total: number; assets: Record<string, number> }> {
    const total = await this.getFuturesBalance();
    return { total, assets: {} };
  }

  async placeBuyOrder(symbol: string, amountUSDT: number): Promise<any> {
    // For futures, use placeFuturesOrder instead
    const price = await this.fetchPrice(symbol);
    const quantity = amountUSDT / price;
    return await this.placeFuturesOrder(symbol, 'buy', quantity);
  }

  async placeSellOrder(symbol: string, quantity: number): Promise<any> {
    return await this.placeFuturesOrder(symbol, 'sell', quantity);
  }

  // FUTURES METHODS
  async placeFuturesOrder(symbol: string, side: 'buy' | 'sell', quantity: number, leverage: number = 3): Promise<any> {
    if (!this.exchange) {
      throw new Error('Binance Futures Testnet not connected');
    }

    try {
      // Set leverage first
      await this.setLeverage(symbol, leverage);
      
      const price = await this.fetchPrice(symbol);
      const cost = quantity * price * leverage;

      console.log(`🎯 FUTURES TESTNET ${side.toUpperCase()}: ${quantity} ${symbol} at $${price} with ${leverage}x leverage (notional: $${cost.toFixed(2)})`);
      
      // Place futures market order
      const order = await this.exchange.createOrder(symbol, 'market', side, quantity, undefined, {
        'leverage': leverage
      });
      
      // Store position for tracking
      this.positions.set(symbol, {
        side,
        quantity,
        entryPrice: price,
        leverage,
        timestamp: Date.now()
      });

      return {
        id: order.id,
        symbol: order.symbol,
        side: side,
        filled: order.filled || quantity,
        average: order.average || price,
        cost: order.cost || cost,
        leverage: leverage
      };
    } catch (error) {
      console.error(`Futures Testnet: Order failed for ${symbol}:`, error);
      throw error;
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    if (!this.exchange) {
      throw new Error('Binance Futures Testnet not connected');
    }

    try {
      await this.exchange.setLeverage(leverage, symbol);
      console.log(`⚡ Futures Testnet: Leverage set to ${leverage}x for ${symbol}`);
    } catch (error) {
      console.error(`Futures Testnet: Failed to set leverage for ${symbol}:`, error);
      throw error;
    }
  }

  async getFuturesBalance(): Promise<number> {
    if (!this.exchange) {
      throw new Error('Binance Futures Testnet not connected');
    }

    try {
      const balance = await this.exchange.fetchBalance();
      return balance.total?.USDT || 0;
    } catch (error) {
      console.error('Futures Testnet: Failed to fetch balance:', error);
      return 1000; // Default testnet balance
    }
  }

  async getFuturesPositions(): Promise<any[]> {
    if (!this.exchange) {
      throw new Error('Binance Futures Testnet not connected');
    }

    try {
      const positions = await this.exchange.fetchPositions();
      return positions.filter((pos: any) => Math.abs(pos.contracts) > 0);
    } catch (error) {
      console.error('Futures Testnet: Failed to fetch positions:', error);
      return Array.from(this.positions.values());
    }
  }

  async closeFuturesPosition(symbol: string, side: 'buy' | 'sell', quantity: number): Promise<any> {
    const closeSide = side === 'buy' ? 'sell' : 'buy';
    return await this.placeFuturesOrder(symbol, closeSide, quantity);
  }
}

/**
 * Simulation Futures Exchange Provider
 * Provides realistic simulated FUTURES trading
 */
export class SimulationFuturesExchangeProvider implements ExchangeProvider {
  private connected: boolean = false;
  private balance: number = 1000; // Start with $1000 USDT for futures
  private positions: Map<string, any> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private lastPriceUpdate: number = Date.now();
  private leverage: number = 3; // Default leverage

  constructor(initialBalance: number = 1000) {
    this.balance = initialBalance;
    this.initializePriceHistory();
  }

  private initializePriceHistory(): void {
    const symbols = [
      'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
      'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT', 'LTC/USDT',
      'MATIC/USDT', 'ATOM/USDT', 'UNI/USDT', 'DOGE/USDT'
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
      'DOGE/USDT': 0.08,
    };

    symbols.forEach(symbol => {
      const basePrice = basePrices[symbol];
      const history: number[] = [];
      
      // Generate historical price points
      for (let i = 0; i < 200; i++) {
        const volatility = basePrice * 0.02;
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
    console.log('📊 Connecting to Simulation Futures Exchange...');
    this.connected = true;
    console.log('✅ Simulation Futures Exchange connected successfully');
  }

  disconnect(): void {
    this.connected = false;
    console.log('Simulation Futures Exchange disconnected');
  }

  async fetchPrice(symbol: string): Promise<number> {
    if (!this.connected) {
      throw new Error('Simulation Futures Exchange not connected');
    }

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
      throw new Error('Simulation Futures Exchange not connected');
    }

    const history = this.priceHistory.get(symbol);
    if (!history) {
      return [];
    }

    const timeframeMs = this.getTimeframeMs(timeframe);
    const now = Date.now();
    const candles: any[] = [];

    const dataPoints = Math.min(limit, history.length);
    for (let i = 0; i < dataPoints; i++) {
      const index = history.length - dataPoints + i;
      const open = history[index];
      const volatility = open * 0.01;
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
    return this.balance;
  }

  async getAssetBalance(asset: string): Promise<number> {
    // For futures, we don't hold actual assets
    return 0;
  }

  async getSimplifiedBalance(): Promise<{ total: number; assets: Record<string, number> }> {
    return { total: this.balance, assets: { USDT: this.balance } };
  }

  async placeBuyOrder(symbol: string, amountUSDT: number): Promise<any> {
    const price = await this.fetchPrice(symbol);
    const quantity = amountUSDT / price;
    return await this.placeFuturesOrder(symbol, 'buy', quantity);
  }

  async placeSellOrder(symbol: string, quantity: number): Promise<any> {
    return await this.placeFuturesOrder(symbol, 'sell', quantity);
  }

  // FUTURES METHODS
  async placeFuturesOrder(symbol: string, side: 'buy' | 'sell', quantity: number, leverage: number = 3): Promise<any> {
    if (!this.connected) {
      throw new Error('Simulation Futures Exchange not connected');
    }

    const price = await this.fetchPrice(symbol);
    const notional = quantity * price * leverage;
    
    // Check if we have enough margin
    const requiredMargin = notional / leverage;
    if (requiredMargin > this.balance) {
      throw new Error(`Insufficient margin. Required: $${requiredMargin.toFixed(2)}, Available: $${this.balance.toFixed(2)}`);
    }

    // Calculate fees (0.04% for futures)
    const fee = notional * 0.0004;
    
    // Update balance (reserve margin)
    this.balance -= requiredMargin;

    // Store position
    this.positions.set(symbol, {
      side,
      quantity,
      entryPrice: price,
      leverage,
      margin: requiredMargin,
      timestamp: Date.now()
    });

    console.log(`🎯 SIM FUTURES ${side.toUpperCase()}: ${quantity} ${symbol} at $${price} with ${leverage}x leverage (notional: $${notional.toFixed(2)})`);

    return {
      id: `futures_sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      side: side,
      filled: quantity,
      average: price,
      cost: notional,
      leverage: leverage
    };
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    this.leverage = leverage;
    console.log(`⚡ Simulation: Leverage set to ${leverage}x for ${symbol}`);
  }

  async getFuturesBalance(): Promise<number> {
    return this.balance;
  }

  async getFuturesPositions(): Promise<any[]> {
    return Array.from(this.positions.entries()).map(([symbol, position]) => ({
      symbol,
      ...position
    }));
  }

  async closeFuturesPosition(symbol: string, side: 'buy' | 'sell', quantity: number): Promise<any> {
    const position = this.positions.get(symbol);
    if (!position) {
      throw new Error(`No position found for ${symbol}`);
    }

    const closeSide = side === 'buy' ? 'sell' : 'buy';
    const currentPrice = await this.fetchPrice(symbol);
    const entryPrice = position.entryPrice;
    
    // Calculate PnL
    let pnl = 0;
    if (position.side === 'buy') {
      pnl = (currentPrice - entryPrice) * position.quantity * position.leverage;
    } else {
      pnl = (entryPrice - currentPrice) * position.quantity * position.leverage;
    }

    // Return margin and add PnL
    this.balance += position.margin + pnl;

    // Remove position
    this.positions.delete(symbol);

    console.log(`✅ SIM FUTURES CLOSE: ${position.quantity} ${symbol} at $${currentPrice} | PnL: $${pnl.toFixed(2)}`);

    return {
      id: `futures_close_${Date.now()}`,
      symbol,
      side: closeSide,
      filled: quantity,
      average: currentPrice,
      cost: position.quantity * currentPrice,
      pnl: pnl
    };
  }

  private updatePrices(): void {
    const now = Date.now();
    
    if (now - this.lastPriceUpdate < 3000) {
      return;
    }

    this.lastPriceUpdate = now;

    const historyArray = Array.from(this.priceHistory.entries());
    for (const [symbol, history] of historyArray) {
      const currentPrice = history[history.length - 1];
      const volatility = currentPrice * 0.005;
      const priceChange = (Math.random() - 0.5) * volatility;
      const newPrice = currentPrice + priceChange;
      
      history.push(newPrice);
      if (history.length > 200) {
        history.shift();
      }
    }
  }
}

/**
 * Factory function to create the appropriate FUTURES exchange provider
 */
export async function createExchangeProvider(
  mode: 'simulation' | 'testnet' | 'real',
  config?: { apiKey?: string; secret?: string }
): Promise<ExchangeProvider> {
  try {
    if (mode === 'simulation') {
      // Local futures simulation
      console.log('📊 Creating FUTURES simulation provider (local)');
      const simProvider = new SimulationFuturesExchangeProvider();
      await simProvider.connect();
      return simProvider;
    } else if (mode === 'testnet') {
      // Binance FUTURES Testnet
      console.log('🧪 Creating FUTURES testnet provider (testnet.binancefuture.com)');
      const testnetProvider = new BinanceFuturesTestnetProvider(config?.apiKey, config?.secret);
      await testnetProvider.connect();
      return testnetProvider;
    } else if (mode === 'real') {
      // Live Binance FUTURES trading
      console.log('💰 Creating FUTURES real provider (Binance Futures Live)');
      const binanceService = new BinanceService({
        apiKey: config?.apiKey,
        secret: config?.secret,
        testnet: false,
      });
      await binanceService.connect();
      return new BinanceFuturesExchangeAdapter(binanceService);
    }
    
    throw new Error(`Unknown trading mode: ${mode}`);
  } catch (error) {
    console.error(`❌ Failed to create ${mode} FUTURES provider:`, error instanceof Error ? error.message : error);
    throw error;
  }
}