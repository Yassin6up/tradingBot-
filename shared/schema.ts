import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (keeping existing)
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// API Keys table (for storing encrypted exchange credentials)
export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exchange: text("exchange").notNull().default('binance'), // 'binance', etc.
  apiKey: text("api_key").notNull(), // Encrypted
  secretKey: text("secret_key").notNull(), // Encrypted
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKeyRow = typeof apiKeys.$inferSelect;

// Trades table
export const trades = sqliteTable("trades", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(), // 'BUY' or 'SELL'
  price: text("price").notNull(), // Store as string to maintain precision
  quantity: text("quantity").notNull(), // Store as string to maintain precision
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull(),
  profit: text("profit").notNull(), // Store as string to maintain precision
  profitPercent: text("profit_percent").notNull(), // Store as string to maintain precision
  strategy: text("strategy").notNull(), // 'safe', 'balanced', 'aggressive'
  mode: text("mode").notNull(), // 'sandbox' or 'real'
});

export const insertTradeSchema = createInsertSchema(trades);
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type TradeRow = typeof trades.$inferSelect;

// Positions table (for tracking open positions with stop-loss/take-profit)
export const positions = sqliteTable("positions", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'LONG' or 'SHORT'
  entryPrice: text("entry_price").notNull(), // Store as string to maintain precision
  quantity: text("quantity").notNull(), // Store as string to maintain precision
  stopLoss: text("stop_loss").notNull(), // Stop-loss price
  takeProfit: text("take_profit").notNull(), // Take-profit price
  trailingStop: text("trailing_stop"), // Optional trailing stop price
  mode: text("mode").notNull(), // 'paper' or 'real'
  strategy: text("strategy").notNull(), // 'safe', 'balanced', 'aggressive'
  openedAt: integer("opened_at", { mode: 'timestamp' }).notNull(),
  closedAt: integer("closed_at", { mode: 'timestamp' }), // null if still open
});

export const insertPositionSchema = createInsertSchema(positions).omit({ closedAt: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type PositionRow = typeof positions.$inferSelect;

// Portfolio settings table (single row)
export const portfolioSettings = sqliteTable("portfolio_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  initialBalance: text("initial_balance").notNull().default('10000'), // Store as string
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  // Trading mode settings
  tradingMode: text("trading_mode").notNull().default('paper'), // 'paper' or 'real'
  realBalance: text("real_balance").default('0'), // Fetched from Binance, stored as string
  realBalanceUpdatedAt: integer("real_balance_updated_at", { mode: 'timestamp' }),
  // Safety confirmations
  realModeConfirmedAt: integer("real_mode_confirmed_at", { mode: 'timestamp' }),
  realModeEnabledBy: text("real_mode_enabled_by"), // User identifier who enabled real mode
  // Position limits for real trading
  maxPositionSize: text("max_position_size").default('1000'), // Maximum position size in USD
  dailyLossLimit: text("daily_loss_limit").default('500'), // Maximum daily loss in USD
});

export const insertPortfolioSettingsSchema = createInsertSchema(portfolioSettings).omit({ id: true, createdAt: true });
export type InsertPortfolioSettings = z.infer<typeof insertPortfolioSettingsSchema>;
export type PortfolioSettingsRow = typeof portfolioSettings.$inferSelect;

// Trading Types (in-memory, not database tables)

export type TradingMode = 'paper' | 'real';
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

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  trailingStop?: number;
  mode: TradingMode;
  strategy: StrategyType;
  openedAt: number;
  closedAt?: number;
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
  realMode?: boolean;
  assets?: Record<string, number>; // Real Binance assets breakdown (BTC, ETH, etc.)
}

export interface BotState {
  status: BotStatus;
  strategy: StrategyType;
  mode: TradingMode;
  startTime: number | null;
  uptime: number;
  aiEnabled?: boolean;  // AI-driven strategy selection
}

// AI Decision and Market Analysis Types

export interface MarketConditions {
  volatility: number;          // 0-100 scale
  trendStrength: number;        // -100 to 100 (negative = downtrend, positive = uptrend)
  momentum: number;             // -100 to 100
  volumeTrend: number;          // -100 to 100
  riskLevel: 'low' | 'medium' | 'high';
}

export interface StrategyScore {
  strategy: StrategyType;
  score: number;                // 0-100
  reasons: string[];            // Why this strategy was scored this way
  confidence: number;           // 0-100
}

export interface AIDecision {
  id: string;
  timestamp: number;
  marketConditions: MarketConditions;
  strategyScores: StrategyScore[];
  selectedStrategy: StrategyType;
  previousStrategy: StrategyType;
  reasoning: string;            // Main explanation for the decision
  confidence: number;           // 0-100
  expectedWinRate: number;      // 0-100
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
  mode: z.enum(['paper', 'real']).default('paper'),
});

export const changeTradingModeSchema = z.object({
  mode: z.enum(['paper', 'real']),
  confirmation: z.boolean().default(false), // Must be true for real mode
  maxPositionSize: z.string().optional(),
  dailyLossLimit: z.string().optional(),
});

export const changeStrategySchema = z.object({
  strategy: z.enum(['safe', 'balanced', 'aggressive']),
});

export const saveApiKeysSchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters'),
  secret: z.string().min(10, 'Secret key must be at least 10 characters'),
  exchange: z.string().default('binance'),
});

export type StartBotRequest = z.infer<typeof startBotSchema>;
export type ChangeStrategyRequest = z.infer<typeof changeStrategySchema>;
export type SaveApiKeysRequest = z.infer<typeof saveApiKeysSchema>;
