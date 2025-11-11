import { type User, type InsertUser, type Trade, type Portfolio, type BotState, type StrategyType, type TradingMode, trades, portfolioSettings, users } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Trading methods
  getTrades(): Promise<Trade[]>;
  addTrade(trade: Trade): Promise<Trade>;
  getPortfolio(): Promise<Portfolio>;
  updatePortfolio(portfolio: Partial<Portfolio>): Promise<Portfolio>;
  getBotState(): Promise<BotState>;
  updateBotState(state: Partial<BotState>): Promise<BotState>;
  clearTrades(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private botState: BotState;

  constructor() {
    // Bot state stays in memory as it's temporary runtime state
    this.botState = {
      status: 'stopped',
      strategy: 'balanced',
      mode: 'sandbox',
      startTime: null,
      uptime: 0,
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
  async getTrades(): Promise<Trade[]> {
    const rows = await db.select().from(trades).orderBy(desc(trades.timestamp));
    
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
}

export const storage = new DatabaseStorage();
