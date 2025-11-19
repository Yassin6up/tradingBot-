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
  strategy: text("strategy").notNull(), // All AI strategies supported
  mode: text("mode").notNull(), // 'simulation', 'testnet', or 'real'
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
  mode: text("mode").notNull(), // 'simulation', 'testnet', or 'real'
  strategy: text("strategy").notNull(), // All AI strategies supported
  openedAt: integer("opened_at", { mode: 'timestamp' }).notNull(),
  closedAt: integer("closed_at", { mode: 'timestamp' }), // null if still open
  currentPrice: text("current_price"), // Track current price for monitoring
  currentProfitPercent: text("current_profit_percent"), // Track current P&L
});

export const insertPositionSchema = createInsertSchema(positions).omit({ closedAt: true, currentPrice: true, currentProfitPercent: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type PositionRow = typeof positions.$inferSelect;

// AI Logs table for persistent decision history
export const aiLogs = sqliteTable("ai_logs", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull(),
  marketConditions: text("market_conditions").notNull(), // JSON string
  strategyScores: text("strategy_scores").notNull(), // JSON string
  selectedStrategy: text("selected_strategy").notNull(),
  previousStrategy: text("previous_strategy").notNull(),
  reasoning: text("reasoning").notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  expectedWinRate: integer("expected_win_rate").notNull(), // 0-100
});

export const insertAILogSchema = createInsertSchema(aiLogs);
export type InsertAILog = z.infer<typeof insertAILogSchema>;
export type AILogRow = typeof aiLogs.$inferSelect;

// Reddit Sentiment table for crypto news analysis
export const redditSentiment = sqliteTable("reddit_sentiment", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  postId: text("post_id").notNull().unique(), // Reddit post ID
  subreddit: text("subreddit").notNull(), // e.g., 'CryptoCurrency'
  title: text("title").notNull(),
  content: text("content"), // Post body/selftext
  author: text("author").notNull(),
  score: integer("score").notNull(), // Reddit upvotes
  numComments: integer("num_comments").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  fetchedAt: integer("fetched_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  sentimentScore: real("sentiment_score").notNull(), // -1.0 to 1.0 (VADER compound score)
  sentimentLabel: text("sentiment_label").notNull(), // 'positive', 'negative', 'neutral'
  mentionedCoins: text("mentioned_coins"), // JSON array of coin symbols mentioned
  relevanceScore: real("relevance_score"), // 0-1 how relevant to crypto trading
});

export const insertRedditSentimentSchema = createInsertSchema(redditSentiment).omit({ 
  id: true, 
  fetchedAt: true 
});

export type InsertRedditSentiment = z.infer<typeof insertRedditSentimentSchema>;
export type RedditSentimentRow = typeof redditSentiment.$inferSelect;

// Portfolio settings table (single row)
export const portfolioSettings = sqliteTable("portfolio_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  initialBalance: text("initial_balance").notNull().default('10000'), // Store as string
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  // Trading mode settings
  tradingMode: text("trading_mode").notNull().default('simulation'), // 'simulation', 'testnet', or 'real'
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

export type TradingMode = 'simulation' | 'testnet' | 'real';
export type TradeType = 'BUY' | 'SELL';
export type BotStatus = 'stopped' | 'running' | 'paused';
export type StrategyType = 
  | 'safe' 
  | 'balanced' 
  | 'aggressive'
  | 'trend'
  | 'breakout'
  | 'mean_reversion'
  | 'scalping'
  | 'momentum'
  | 'swing'
  | 'arbitrage'
  | 'pair'
  | 'sentiment'
  | 'news';

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
  mode?: TradingMode; // Current trading mode
  realMode?: boolean; // Legacy: true for real mode, false otherwise
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

export interface TechnicalIndicators {
  rsi: number;                  // 0-100 (Relative Strength Index)
  macd: number;                 // MACD line value
  macdSignal: number;           // MACD signal line
  macdHistogram: number;        // MACD histogram
  sma20: number;                // 20-period Simple Moving Average
  sma50: number;                // 50-period Simple Moving Average
  ema12: number;                // 12-period Exponential Moving Average
  ema26: number;                // 26-period Exponential Moving Average
  bollingerUpper: number;       // Upper Bollinger Band
  bollingerMiddle: number;      // Middle Bollinger Band (SMA20)
  bollingerLower: number;       // Lower Bollinger Band
  bollingerWidth: number;       // Bollinger Band width (volatility measure)
  volume: number;               // Current volume
  volumeSMA: number;            // Volume moving average
}

export interface MarketConditions {
  volatility: number;          // 0-100 scale
  trendStrength: number;        // -100 to 100 (negative = downtrend, positive = uptrend)
  momentum: number;             // -100 to 100
  volumeTrend: number;          // -100 to 100
  newsSentiment: number;        // -50 to 50 (negative = bearish, positive = bullish)
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  marketRegime: 'bull' | 'bear' | 'neutral' | 'volatile' | 'extreme';
  trendingRatio: number;        // 0-1 (percentage of coins trending)
  volatilityRatio: number;      // 0-1 (percentage of coins with high volatility)
  newsActivity: number;         // 0-1 (how much relevant news is available)
  avgRSI: number;               // Average RSI across all coins
  avgMACD: number;              // Average MACD across all coins
  priceAboveSMA50Ratio: number; // Ratio of coins above SMA50 (trend indicator)
}

export interface StrategyScore {
  strategy: StrategyType;
  score: number;                // 0-100
  reasons: string[];            // Why this strategy was scored this way
  confidence: number;           // 0-100
}

export interface CoinAnalysis {
  symbol: string;
  price: number;
  indicators: TechnicalIndicators;
  signalStrength: number;       // -100 to 100 (negative = sell, positive = buy)
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  reasoning: string[];          // Why this signal was generated
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
  topCoins?: CoinAnalysis[];    // Top coins to trade based on analysis
  redditSentiment?: number;     // Overall sentiment from Reddit (-1 to 1)
}

export interface RedditPost {
  id: string;
  postId: string;
  subreddit: string;
  title: string;
  content: string | null;
  author: string;
  score: number;
  numComments: number;
  createdAt: Date;
  fetchedAt: Date;
  sentimentScore: number;       // -1.0 to 1.0
  sentimentLabel: 'positive' | 'negative' | 'neutral';
  mentionedCoins: string[] | null;
  relevanceScore: number | null;
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
  strategy: z.enum(['safe', 'balanced', 'aggressive', 'trend', 'breakout', 'mean_reversion', 'scalping', 'momentum', 'swing', 'arbitrage', 'pair', 'sentiment', 'news']),
  mode: z.enum(['simulation', 'testnet', 'real']).default('simulation'),
  aiEnabled: z.boolean().default(false), // Enable AI-driven strategy selection
});

export const changeTradingModeSchema = z.object({
  mode: z.enum(['simulation', 'testnet', 'real']),
  confirmation: z.boolean().default(false), // Must be true for real mode (not needed for simulation)
  maxPositionSize: z.string().optional(),
  dailyLossLimit: z.string().optional(),
});

export const changeStrategySchema = z.object({
  strategy: z.enum(['safe', 'balanced', 'aggressive', 'trend', 'breakout', 'mean_reversion', 'scalping', 'momentum', 'swing', 'arbitrage', 'pair', 'sentiment', 'news']),
  aiEnabled: z.boolean().optional(), // Toggle AI mode
});

export const saveApiKeysSchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters'),
  secret: z.string().min(10, 'Secret key must be at least 10 characters'),
  exchange: z.string().default('binance'),
});

export type StartBotRequest = z.infer<typeof startBotSchema>;
export type ChangeStrategyRequest = z.infer<typeof changeStrategySchema>;
export type SaveApiKeysRequest = z.infer<typeof saveApiKeysSchema>;
