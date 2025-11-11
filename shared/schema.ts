import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (keeping existing)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Trades table
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey(),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(), // 'BUY' or 'SELL'
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  profit: decimal("profit", { precision: 20, scale: 8 }).notNull(),
  profitPercent: decimal("profit_percent", { precision: 10, scale: 4 }).notNull(),
  strategy: text("strategy").notNull(), // 'safe', 'balanced', 'aggressive'
  mode: text("mode").notNull(), // 'sandbox' or 'real'
});

export const insertTradeSchema = createInsertSchema(trades);
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type TradeRow = typeof trades.$inferSelect;

// Portfolio settings table (single row)
export const portfolioSettings = pgTable("portfolio_settings", {
  id: integer("id").primaryKey().default(1),
  initialBalance: decimal("initial_balance", { precision: 20, scale: 2 }).notNull().default('10000'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPortfolioSettingsSchema = createInsertSchema(portfolioSettings).omit({ id: true, createdAt: true });
export type InsertPortfolioSettings = z.infer<typeof insertPortfolioSettingsSchema>;
export type PortfolioSettingsRow = typeof portfolioSettings.$inferSelect;

// Trading Types (in-memory, not database tables)

export type TradingMode = 'sandbox' | 'real';
export type TradeType = 'BUY' | 'SELL';
export type BotStatus = 'stopped' | 'running' | 'paused';
export type StrategyType = 'safe' | 'balanced' | 'aggressive';

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  riskPerTrade: number;
  profitTarget: number;
  description: string;
}

export interface Trade {
  id: string;
  symbol: string;
  type: TradeType;
  price: number;
  quantity: number;
  timestamp: number;
  profit: number;
  profitPercent: number;
  strategy: StrategyType;
  mode: TradingMode;
}

export interface Portfolio {
  balance: number;
  initialBalance: number;
  totalProfit: number;
  totalProfitPercent: number;
  dailyProfit: number;
  dailyProfitPercent: number;
  openPositions: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  bestPerformingCoin: string;
}

export interface BotState {
  status: BotStatus;
  strategy: StrategyType;
  mode: TradingMode;
  startTime: number | null;
  uptime: number;
}

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface ChartDataPoint {
  timestamp: number;
  price: number;
  volume?: number;
}

// Zod schemas for validation
export const startBotSchema = z.object({
  strategy: z.enum(['safe', 'balanced', 'aggressive']),
  mode: z.enum(['sandbox', 'real']).default('sandbox'),
});

export const changeStrategySchema = z.object({
  strategy: z.enum(['safe', 'balanced', 'aggressive']),
});

export type StartBotRequest = z.infer<typeof startBotSchema>;
export type ChangeStrategyRequest = z.infer<typeof changeStrategySchema>;
