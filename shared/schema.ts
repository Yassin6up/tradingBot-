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
