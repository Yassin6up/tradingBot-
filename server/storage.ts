import { type User, type InsertUser, type Trade, type Portfolio, type BotState, type StrategyType, type TradingMode, type AIDecision, trades, portfolioSettings, users, apiKeys } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { encryptor } from "./utils/encryption";

export type TimeRange = '24h' | '7d' | '30d' | 'all';

export interface TradeFilters {
  symbol?: string;
  strategy?: StrategyType;
  timeRange?: TimeRange;
  startDate?: number; // timestamp (alternative to timeRange)
  endDate?: number;   // timestamp (alternative to timeRange)
}

export interface TradingModeSettings {
  mode: TradingMode;
  confirmedAt?: Date;
  maxPositionSize: number;
  dailyLossLimit: number;
}

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Trading methods
  getTrades(filters?: TradeFilters): Promise<Trade[]>;
  addTrade(trade: Trade): Promise<Trade>;
  getPortfolio(): Promise<Portfolio>;
  updatePortfolio(portfolio: Partial<Portfolio>): Promise<Portfolio>;
  getBotState(): Promise<BotState>;
  updateBotState(state: Partial<BotState>): Promise<BotState>;
  clearTrades(): Promise<void>;
  
  // Trading mode methods
  getTradingMode(): Promise<TradingModeSettings>;
  setTradingMode(settings: TradingModeSettings): Promise<void>;
  getRealBalance(): Promise<number>;
  updateRealBalance(balance: number): Promise<void>;
  
  // AI Decision methods
  addAIDecision(decision: AIDecision): Promise<void>;
  getAIDecisions(limit?: number): Promise<AIDecision[]>;
  getLatestAIDecision(): Promise<AIDecision | undefined>;
  
  // API Key methods
  saveApiKeys(exchange: string, apiKey: string, secretKey: string): Promise<void>;
  getApiKeys(exchange: string): Promise<{ apiKey: string; secretKey: string } | null>;
  deleteApiKeys(exchange: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private botState: BotState;
  private aiDecisions: AIDecision[] = [];

  constructor() {
    // Bot state stays in memory as it's temporary runtime state
    this.botState = {
      status: 'stopped',
      strategy: 'balanced',
      mode: 'paper',
      startTime: null,
      uptime: 0,
      aiEnabled: false,
    };
    this.initializePortfolio();
  }

  private async initializePortfolio() {
    // Ensure portfolio settings row exists
    const existing = await db.select().from(portfolioSettings).limit(1);
    if (existing.length === 0) {
      await db.insert(portfolioSettings).values({
        initialBalance: '10000',
      });
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Trading methods
  async getTrades(filters?: TradeFilters): Promise<Trade[]> {
    // Build where conditions based on filters
    const conditions = [];
    
    if (filters?.symbol) {
      conditions.push(eq(trades.symbol, filters.symbol));
    }
    
    if (filters?.strategy) {
      conditions.push(eq(trades.strategy, filters.strategy));
    }
    
    // Handle timeRange parameter
    if (filters?.timeRange && filters.timeRange !== 'all') {
      const now = Date.now();
      const timeRanges: Record<TimeRange, number> = {
        'all': 0,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const range = timeRanges[filters.timeRange];
      const startDate = now - range;
      conditions.push(gte(trades.timestamp, new Date(startDate)));
    }
    
    // Handle explicit date range (overrides timeRange if both provided)
    if (filters?.startDate) {
      conditions.push(gte(trades.timestamp, new Date(filters.startDate)));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(trades.timestamp, new Date(filters.endDate)));
    }
    
    // Execute query with filters
    const rows = conditions.length > 0
      ? await db.select().from(trades).where(and(...conditions)).orderBy(desc(trades.timestamp))
      : await db.select().from(trades).orderBy(desc(trades.timestamp));
    
    // Convert database rows to application Trade type
    return rows.map(row => ({
      id: row.id,
      symbol: row.symbol,
      type: row.type as 'BUY' | 'SELL',
      price: parseFloat(row.price),
      quantity: parseFloat(row.quantity),
      timestamp: row.timestamp.getTime(),
      profit: parseFloat(row.profit),
      profitPercent: parseFloat(row.profitPercent),
      strategy: row.strategy as StrategyType,
      mode: row.mode as TradingMode,
    }));
  }

  async addTrade(trade: Trade): Promise<Trade> {
    // Convert application Trade to database row
    await db.insert(trades).values({
      id: trade.id,
      symbol: trade.symbol,
      type: trade.type,
      price: trade.price.toString(),
      quantity: trade.quantity.toString(),
      timestamp: new Date(trade.timestamp),
      profit: trade.profit.toString(),
      profitPercent: trade.profitPercent.toString(),
      strategy: trade.strategy,
      mode: trade.mode,
    });
    
    return trade;
  }

  async getPortfolio(): Promise<Portfolio> {
    // Get all trades to calculate portfolio stats
    const allTrades = await this.getTrades();
    
    // Get initial balance from settings
    const [settings] = await db.select().from(portfolioSettings).limit(1);
    const initialBalance = settings ? parseFloat(settings.initialBalance) : 10000;
    
    // Calculate portfolio metrics
    const totalProfit = allTrades.reduce((sum, t) => sum + t.profit, 0);
    const balance = initialBalance + totalProfit;
    const winningTrades = allTrades.filter(t => t.profit > 0).length;
    const losingTrades = allTrades.filter(t => t.profit < 0).length;
    const winRate = allTrades.length > 0 ? (winningTrades / allTrades.length) * 100 : 0;
    
    // Calculate daily profit (trades from last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const dailyTrades = allTrades.filter(t => t.timestamp >= oneDayAgo);
    const dailyProfit = dailyTrades.reduce((sum, t) => sum + t.profit, 0);
    
    // Find best performing coin
    const coinProfits = new Map<string, number>();
    allTrades.forEach(t => {
      const current = coinProfits.get(t.symbol) || 0;
      coinProfits.set(t.symbol, current + t.profit);
    });
    
    let bestPerformingCoin = 'BTC/USDT';
    let maxProfit = -Infinity;
    coinProfits.forEach((profit, symbol) => {
      if (profit > maxProfit) {
        maxProfit = profit;
        bestPerformingCoin = symbol;
      }
    });
    
    return {
      balance,
      initialBalance,
      totalProfit,
      totalProfitPercent: (totalProfit / initialBalance) * 100,
      dailyProfit,
      dailyProfitPercent: (dailyProfit / initialBalance) * 100,
      openPositions: 0, // Not tracking open positions in this implementation
      winRate,
      totalTrades: allTrades.length,
      winningTrades,
      losingTrades,
      bestPerformingCoin,
    };
  }

  async updatePortfolio(updates: Partial<Portfolio>): Promise<Portfolio> {
    // Only initialBalance can be updated; other values are calculated from trades
    if (updates.initialBalance !== undefined) {
      await db.update(portfolioSettings)
        .set({ initialBalance: updates.initialBalance.toString() })
        .where(eq(portfolioSettings.id, 1));
    }
    
    // Return recalculated portfolio with new initial balance
    return this.getPortfolio();
  }

  async getBotState(): Promise<BotState> {
    return { ...this.botState };
  }

  async updateBotState(updates: Partial<BotState>): Promise<BotState> {
    this.botState = { ...this.botState, ...updates };
    return { ...this.botState };
  }

  async clearTrades(): Promise<void> {
    await db.delete(trades);
  }

  // AI Decision methods
  async addAIDecision(decision: AIDecision): Promise<void> {
    this.aiDecisions.push(decision);
    // Keep only last 100 decisions
    if (this.aiDecisions.length > 100) {
      this.aiDecisions.shift();
    }
  }

  async getAIDecisions(limit: number = 20): Promise<AIDecision[]> {
    return this.aiDecisions.slice(-limit).reverse();
  }

  async getLatestAIDecision(): Promise<AIDecision | undefined> {
    return this.aiDecisions[this.aiDecisions.length - 1];
  }

  // Trading mode methods
  async getTradingMode(): Promise<TradingModeSettings> {
    const [settings] = await db.select().from(portfolioSettings).limit(1);
    
    if (!settings) {
      // Return default paper trading mode if no settings exist
      return {
        mode: 'paper',
        maxPositionSize: 1000,
        dailyLossLimit: 500,
      };
    }
    
    return {
      mode: settings.tradingMode as TradingMode,
      confirmedAt: settings.realModeConfirmedAt || undefined,
      maxPositionSize: parseFloat(settings.maxPositionSize || '1000'),
      dailyLossLimit: parseFloat(settings.dailyLossLimit || '500'),
    };
  }

  async setTradingMode(modeSettings: TradingModeSettings): Promise<void> {
    // CRITICAL SAFETY CHECK: Switching to real mode requires explicit confirmation
    if (modeSettings.mode === 'real' && !modeSettings.confirmedAt) {
      throw new Error('Real trading mode requires explicit confirmation timestamp. This is a safety feature to prevent accidental real money trading.');
    }
    
    // Ensure portfolio settings row exists
    const [existingSettings] = await db.select().from(portfolioSettings).limit(1);
    if (!existingSettings) {
      throw new Error('Portfolio settings not initialized. Cannot change trading mode.');
    }
    
    // Update trading mode in portfolio settings
    const updateData: any = {
      tradingMode: modeSettings.mode,
      maxPositionSize: modeSettings.maxPositionSize.toString(),
      dailyLossLimit: modeSettings.dailyLossLimit.toString(),
    };
    
    // If switching to real mode, record confirmation timestamp
    if (modeSettings.mode === 'real') {
      updateData.realModeConfirmedAt = modeSettings.confirmedAt;
      updateData.realModeEnabledBy = 'system'; // TODO: Use actual user ID when auth is implemented
    }
    
    const result = await db.update(portfolioSettings)
      .set(updateData)
      .where(eq(portfolioSettings.id, existingSettings.id));
    
    // Verify update succeeded
    if (!result.changes || result.changes === 0) {
      throw new Error('Failed to update trading mode in database');
    }
    
    // Also update bot state to match
    this.botState.mode = modeSettings.mode;
  }

  async getRealBalance(): Promise<number> {
    const [settings] = await db.select().from(portfolioSettings).limit(1);
    
    if (!settings || !settings.realBalance) {
      return 0;
    }
    
    return parseFloat(settings.realBalance);
  }

  async updateRealBalance(balance: number): Promise<void> {
    await db.update(portfolioSettings)
      .set({
        realBalance: balance.toString(),
        realBalanceUpdatedAt: new Date(),
      })
      .where(eq(portfolioSettings.id, 1));
  }
  
  // API Key methods
  async saveApiKeys(exchange: string, apiKey: string, secretKey: string): Promise<void> {
    try {
      // Encrypt the keys before storing
      const encryptedApiKey = encryptor.encrypt(apiKey);
      const encryptedSecretKey = encryptor.encrypt(secretKey);
      
      // Check if keys already exist for this exchange
      const [existing] = await db.select()
        .from(apiKeys)
        .where(and(
          eq(apiKeys.exchange, exchange),
          eq(apiKeys.isActive, true)
        ))
        .limit(1);
      
      const now = new Date();
      
      if (existing) {
        // Update existing keys
        await db.update(apiKeys)
          .set({
            apiKey: encryptedApiKey,
            secretKey: encryptedSecretKey,
            updatedAt: now,
          })
          .where(eq(apiKeys.id, existing.id));
      } else {
        // Insert new keys
        await db.insert(apiKeys).values({
          exchange,
          apiKey: encryptedApiKey,
          secretKey: encryptedSecretKey,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error('Failed to save API keys:', error);
      throw new Error('Failed to save API credentials');
    }
  }
  
  async getApiKeys(exchange: string): Promise<{ apiKey: string; secretKey: string } | null> {
    try {
      const [record] = await db.select()
        .from(apiKeys)
        .where(and(
          eq(apiKeys.exchange, exchange),
          eq(apiKeys.isActive, true)
        ))
        .limit(1);
      
      if (!record) {
        return null;
      }
      
      // Decrypt the keys before returning
      const apiKey = encryptor.decrypt(record.apiKey);
      const secretKey = encryptor.decrypt(record.secretKey);
      
      return { apiKey, secretKey };
    } catch (error) {
      console.error('Failed to retrieve API keys:', error);
      return null;
    }
  }
  
  async deleteApiKeys(exchange: string): Promise<void> {
    try {
      await db.update(apiKeys)
        .set({ isActive: false })
        .where(eq(apiKeys.exchange, exchange));
    } catch (error) {
      console.error('Failed to delete API keys:', error);
      throw new Error('Failed to delete API credentials');
    }
  }
}

export const storage = new DatabaseStorage();
