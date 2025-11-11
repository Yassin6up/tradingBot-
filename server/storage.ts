import { type User, type InsertUser, type Trade, type Portfolio, type BotState, type StrategyType, type TradingMode } from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private trades: Trade[];
  private portfolio: Portfolio;
  private botState: BotState;

  constructor() {
    this.users = new Map();
    this.trades = [];
    this.portfolio = {
      balance: 10000,
      initialBalance: 10000,
      totalProfit: 0,
      totalProfitPercent: 0,
      dailyProfit: 0,
      dailyProfitPercent: 0,
      openPositions: 0,
      winRate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      bestPerformingCoin: 'BTC/USDT',
    };
    this.botState = {
      status: 'stopped',
      strategy: 'balanced',
      mode: 'sandbox',
      startTime: null,
      uptime: 0,
    };
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Trading methods
  async getTrades(): Promise<Trade[]> {
    // Return trades sorted by timestamp descending (newest first)
    return [...this.trades].sort((a, b) => b.timestamp - a.timestamp);
  }

  async addTrade(trade: Trade): Promise<Trade> {
    this.trades.push(trade);
    
    // Update portfolio stats
    const totalProfit = this.trades.reduce((sum, t) => sum + t.profit, 0);
    const winningTrades = this.trades.filter(t => t.profit > 0).length;
    const losingTrades = this.trades.filter(t => t.profit < 0).length;
    const winRate = this.trades.length > 0 ? (winningTrades / this.trades.length) * 100 : 0;
    
    // Calculate daily profit (trades from last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const dailyTrades = this.trades.filter(t => t.timestamp >= oneDayAgo);
    const dailyProfit = dailyTrades.reduce((sum, t) => sum + t.profit, 0);
    
    this.portfolio.balance += trade.profit;
    this.portfolio.totalProfit = totalProfit;
    this.portfolio.totalProfitPercent = (totalProfit / this.portfolio.initialBalance) * 100;
    this.portfolio.dailyProfit = dailyProfit;
    this.portfolio.dailyProfitPercent = (dailyProfit / this.portfolio.initialBalance) * 100;
    this.portfolio.totalTrades = this.trades.length;
    this.portfolio.winningTrades = winningTrades;
    this.portfolio.losingTrades = losingTrades;
    this.portfolio.winRate = winRate;
    
    return trade;
  }

  async getPortfolio(): Promise<Portfolio> {
    return { ...this.portfolio };
  }

  async updatePortfolio(updates: Partial<Portfolio>): Promise<Portfolio> {
    this.portfolio = { ...this.portfolio, ...updates };
    return { ...this.portfolio };
  }

  async getBotState(): Promise<BotState> {
    return { ...this.botState };
  }

  async updateBotState(updates: Partial<BotState>): Promise<BotState> {
    this.botState = { ...this.botState, ...updates };
    return { ...this.botState };
  }

  async clearTrades(): Promise<void> {
    this.trades = [];
    this.portfolio = {
      balance: 10000,
      initialBalance: 10000,
      totalProfit: 0,
      totalProfitPercent: 0,
      dailyProfit: 0,
      dailyProfitPercent: 0,
      openPositions: 0,
      winRate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      bestPerformingCoin: 'BTC/USDT',
    };
  }
}

export const storage = new MemStorage();
