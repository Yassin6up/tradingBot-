// Trading Types
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
  mode?: TradingMode;
  realMode?: boolean;
  assets?: Record<string, number>;
}

export interface BotState {
  status: BotStatus;
  strategy: StrategyType;
  mode: TradingMode;
  startTime: number | null;
  uptime: number;
  aiEnabled?: boolean;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerWidth: number;
  volume: number;
  volumeSMA: number;
}

export interface MarketConditions {
  volatility: number;
  trendStrength: number;
  momentum: number;
  volumeTrend: number;
  newsSentiment: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  marketRegime: 'bull' | 'bear' | 'neutral' | 'volatile' | 'extreme';
  trendingRatio: number;
  volatilityRatio: number;
  newsActivity: number;
  avgRSI: number;
  avgMACD: number;
  priceAboveSMA50Ratio: number;
}

export interface StrategyScore {
  strategy: StrategyType;
  score: number;
  reasons: string[];
  confidence: number;
}

export interface CoinAnalysis {
  symbol: string;
  price: number;
  indicators: TechnicalIndicators;
  signalStrength: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  reasoning: string[];
}

export interface AIDecision {
  id: string;
  timestamp: number;
  marketConditions: MarketConditions;
  strategyScores: StrategyScore[];
  selectedStrategy: StrategyType;
  previousStrategy: StrategyType;
  reasoning: string;
  confidence: number;
  expectedWinRate: number;
  topCoins?: CoinAnalysis[];
  redditSentiment?: number;
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
  sentimentScore: number;
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
