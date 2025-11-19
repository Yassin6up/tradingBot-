import type { StrategyType, PriceData, MarketConditions, StrategyScore, AIDecision } from "../types";
import { randomUUID } from "crypto";

/**
 * ADVANCED AI with 10 Trading Strategies + Real News Integration + Futures Enhancement
 */
export class StrategyAI {
  private priceHistory: Map<string, PriceData[]> = new Map();
  private readonly HISTORY_SIZE = 100;
  private aiDecisionHistory: AIDecision[] = [];
  private strategyPerformance = new Map<string, { wins: number; losses: number; totalProfit: number }>();
  private newsCache: Map<string, { sentiment: number; relevance: number; timestamp: number }> = new Map();
  private lastNewsUpdate: number = 0;
  private readonly NEWS_UPDATE_INTERVAL = 300000; // 5 minutes
  private lastStrategyRotation: number = 0;
  private readonly STRATEGY_ROTATION_INTERVAL = 900000; // 15 minutes
  private leverage: number = 3;
  private readonly MAX_LEVERAGE: number = 10;
  private fundingRateHistory: Map<string, number[]> = new Map();

  // Futures-specific enhancements
  public updatePriceData(priceData: PriceData[]) {
    priceData.forEach(data => {
      if (!this.priceHistory.has(data.symbol)) {
        this.priceHistory.set(data.symbol, []);
      }
      
      const history = this.priceHistory.get(data.symbol)!;
      history.push(data);
      
      if (history.length > this.HISTORY_SIZE) {
        history.shift();
      }
    });

    // Update news periodically
    this.updateNewsData();
  }

  /**
   * Real News Integration with multiple sources
   */
  private async updateNewsData() {
    const now = Date.now();
    if (now - this.lastNewsUpdate < this.NEWS_UPDATE_INTERVAL) {
      return;
    }

    try {
      console.log('📰 Fetching latest crypto news...');
      
      // Source 1: Reddit crypto communities
      await this.fetchRedditCryptoNews();

      // Source 2: Alternative news source (simulated)
      await this.fetchAlternativeNews();
      
      this.lastNewsUpdate = now;
      console.log('✅ News data updated successfully');
    } catch (error) {
      console.error('❌ Failed to fetch news:', error);
      // Fallback to simulated news
      this.generateSimulatedNews();
    }
  }

  private async fetchRedditCryptoNews(): Promise<void> {
    try {
      console.log('📰 Fetching Reddit crypto news...');
      
      const subreddits = [
        'CryptoCurrency',
        'Bitcoin', 
        'ethereum',
        'CryptoMarkets',
        'binance',
        'solana',
        'cardano',
        'polkadot'
      ];

      for (const subreddit of subreddits) {
        try {
          const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=15`);
          
          if (!response.ok) {
            console.warn(`⚠️ Reddit /r/${subreddit} returned status: ${response.status}`);
            continue;
          }
          
          const data = await response.json();
          
          if (data.data?.children) {
            console.log(`📊 Found ${data.data.children.length} posts in /r/${subreddit}`);
            
            data.data.children.forEach((post: any) => {
              const postData = post.data;
              
              // Skip stickied posts (mod posts, announcements) and low-score posts
              if (postData.stickied || postData.score < 5) {
                return;
              }

              // Combine title and selftext for better sentiment analysis
              const content = `${postData.title} ${postData.selftext || ''}`;
              
              if (content.length > 10) { // Ensure we have meaningful content
                const sentiment = this.analyzeNewsSentiment(content);
                const relevance = this.calculateRedditRelevance(postData, subreddit);
                
                // Map this post to relevant crypto symbols
                this.mapRedditPostToCryptos(postData, sentiment, relevance, subreddit);
              }
            });
          }

          // Be respectful to Reddit's servers - add delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`⚠️ Failed to fetch from /r/${subreddit}:`, errorMessage);
          continue;
        }
      }
      
      console.log(`✅ Reddit news processing complete. Cache size: ${this.newsCache.size}`);
      
    } catch (error) {
      console.warn('⚠️ Reddit API completely unavailable');
      throw error;
    }
  }

  private calculateRedditRelevance(postData: any, subreddit: string): number {
    let relevance = 50; // Base relevance
    
    // Score based on upvotes and engagement
    if (postData.score > 100) relevance += 20;
    if (postData.score > 500) relevance += 15;
    if (postData.score > 1000) relevance += 15;
    
    // Comments indicate engagement
    if (postData.num_comments > 10) relevance += 10;
    if (postData.num_comments > 50) relevance += 10;
    
    // Subreddit-specific relevance boosts
    const subredditBoost: Record<string, number> = {
      'Bitcoin': 15,
      'ethereum': 15,
      'CryptoCurrency': 10,
      'CryptoMarkets': 10,
      'binance': 5,
      'solana': 5,
      'cardano': 5,
      'polkadot': 5
    };
    
    relevance += subredditBoost[subreddit] || 0;
    
    // Recent posts are more relevant
    const postAgeHours = (Date.now() / 1000 - postData.created_utc) / 3600;
    if (postAgeHours < 1) relevance += 20;
    else if (postAgeHours < 6) relevance += 15;
    else if (postAgeHours < 24) relevance += 10;
    
    return Math.min(100, relevance);
  }

  private mapRedditPostToCryptos(postData: any, sentiment: number, relevance: number, subreddit: string): void {
    const content = `${postData.title} ${postData.selftext || ''}`.toLowerCase();
    
    // Enhanced crypto keyword mapping
    const cryptoKeywords: Record<string, { keywords: string[]; subredditBonus: boolean }> = {
      'BTC/USDT': { 
        keywords: ['bitcoin', 'btc', 'satoshi', 'lightning network', 'halving', 'store of value', 'digital gold'],
        subredditBonus: subreddit === 'Bitcoin'
      },
      'ETH/USDT': { 
        keywords: ['ethereum', 'eth', 'vitalik', 'smart contract', 'defi', 'dapp', 'ether', 'pos', 'merge'],
        subredditBonus: subreddit === 'ethereum'
      },
      'BNB/USDT': { 
        keywords: ['binance', 'bnb', 'cz', 'cz binance', 'bnb chain', 'binance smart chain'],
        subredditBonus: subreddit === 'binance'
      },
      'SOL/USDT': { 
        keywords: ['solana', 'sol', 'anatoly', 'phantom wallet', 'solana ecosystem'],
        subredditBonus: subreddit === 'solana'
      },
      'ADA/USDT': { 
        keywords: ['cardano', 'ada', 'charles hoskinson', 'iog', 'input output', 'ada coin'],
        subredditBonus: subreddit === 'cardano'
      },
      'XRP/USDT': { 
        keywords: ['ripple', 'xrp', 'xrp lawsuit', 'sec', 'brad garlinghouse', 'ripple labs'],
        subredditBonus: false
      },
      'DOT/USDT': { 
        keywords: ['polkadot', 'dot', 'gavin wood', 'parachain', 'kusama', 'web3 foundation'],
        subredditBonus: subreddit === 'polkadot'
      },
      'DOGE/USDT': { 
        keywords: ['dogecoin', 'doge', 'elon musk', 'meme coin', 'shiba', 'wow', 'much wow'],
        subredditBonus: false
      },
      'MATIC/USDT': { 
        keywords: ['polygon', 'matic', 'layer 2', 'scaling', 'matic network'],
        subredditBonus: false
      },
      'LTC/USDT': { 
        keywords: ['litecoin', 'ltc', 'charlie lee', 'digital silver', 'lite coin'],
        subredditBonus: false
      },
      'AVAX/USDT': { 
        keywords: ['avalanche', 'avax', 'subnet', 'avalanche ecosystem'],
        subredditBonus: false
      },
      'LINK/USDT': { 
        keywords: ['chainlink', 'link', 'oracle', 'smart contract', 'sergey nazarov'],
        subredditBonus: false
      }
    };

    Object.entries(cryptoKeywords).forEach(([symbol, { keywords, subredditBonus }]) => {
      const keywordMatches = keywords.filter(keyword => content.includes(keyword.toLowerCase()));
      
      if (keywordMatches.length > 0) {
        let symbolRelevance = relevance;
        
        // Boost relevance based on keyword matches
        symbolRelevance += keywordMatches.length * 8;
        
        // Additional boost if post is in the coin's dedicated subreddit
        if (subredditBonus) {
          symbolRelevance += 15;
        }
        
        // Title mentions are more important than body mentions
        if (postData.title.toLowerCase().includes(keywordMatches[0])) {
          symbolRelevance += 10;
        }
        
        symbolRelevance = Math.min(100, symbolRelevance);
        
        const currentNews = this.newsCache.get(symbol);
        
        // Only update if this post has higher relevance or we don't have data for this symbol
        if (!currentNews || symbolRelevance > currentNews.relevance) {
          this.newsCache.set(symbol, {
            sentiment,
            relevance: symbolRelevance,
            timestamp: Date.now()
          });
          
          console.log(`🔗 Mapped Reddit post to ${symbol}: ${postData.title.substring(0, 60)}... (relevance: ${symbolRelevance}%)`);
        }
      }
    });
  }

  private async fetchAlternativeNews(): Promise<void> {
    // Simulated alternative news source
    const cryptoKeywords = ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'defi', 'nft'];
    const symbols = Array.from(this.priceHistory.keys());
    
    symbols.forEach(symbol => {
      const coin = symbol.replace('/USDT', '').toLowerCase();
      if (cryptoKeywords.some(keyword => coin.includes(keyword) || keyword.includes(coin))) {
        // Simulate occasional news events
        if (Math.random() < 0.3) {
          const sentiment = Math.random() * 100 - 50; // -50 to +50
          this.newsCache.set(symbol, {
            sentiment,
            relevance: 60 + Math.random() * 40,
            timestamp: Date.now()
          });
        }
      }
    });
  }

  private generateSimulatedNews(): void {
    const symbols = Array.from(this.priceHistory.keys());
    
    symbols.forEach(symbol => {
      // More realistic news simulation based on price movement
      const history = this.priceHistory.get(symbol);
      if (!history || history.length < 10) return;

      const recentPrices = history.slice(-10).map(h => h.price);
      const priceChange = ((recentPrices[9] - recentPrices[0]) / recentPrices[0]) * 100;
      
      // Generate news based on significant price movements
      if (Math.abs(priceChange) > 8) {
        const sentiment = priceChange > 0 ? 30 + Math.random() * 40 : -30 - Math.random() * 40;
        this.newsCache.set(symbol, {
          sentiment,
          relevance: 70 + Math.random() * 30,
          timestamp: Date.now()
        });
      }
    });
  }

  private analyzeNewsSentiment(headline: string): number {
    const positiveWords = ['bullish', 'surge', 'rally', 'gain', 'up', 'positive', 'breakout', 'adoption', 'partnership', 'launch', 'success', 'growth', 'approval'];
    const negativeWords = ['bearish', 'drop', 'crash', 'loss', 'down', 'negative', 'selloff', 'regulation', 'ban', 'hack', 'scam', 'warning', 'fraud'];
    
    const text = headline.toLowerCase();
    let score = 0;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) score += 15;
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) score -= 15;
    });
    
    return Math.max(-50, Math.min(50, score));
  }

  private getNewsSentiment(symbol: string): { sentiment: number; relevance: number } {
    const news = this.newsCache.get(symbol);
    if (!news || Date.now() - news.timestamp > 3600000) { // 1 hour expiry
      return { sentiment: 0, relevance: 0 };
    }
    return news;
  }

  /**
   * Enhanced market analysis with news integration + Futures metrics
   */
  public analyzeMarketConditions(): MarketConditions {
    let totalVolatility = 0;
    let totalTrendStrength = 0;
    let totalMomentum = 0;
    let totalVolume = 0;
    let totalNewsSentiment = 0;
    let symbolCount = 0;
    let trendingCoins = 0;
    let volatileCoins = 0;
    let newsActiveCoins = 0;

    this.priceHistory.forEach((history, symbol) => {
      if (history.length < 20) return;
      
      const metrics = this.calculateComprehensiveMetrics(history);
      const news = this.getNewsSentiment(symbol);
      
      totalVolatility += metrics.volatility;
      totalTrendStrength += metrics.trendStrength;
      totalMomentum += metrics.momentum;
      totalVolume += metrics.volumeStrength;
      totalNewsSentiment += news.sentiment * (news.relevance / 100);
      symbolCount++;

      if (Math.abs(metrics.trendStrength) > 25) trendingCoins++;
      if (metrics.volatility > 40) volatileCoins++;
      if (news.relevance > 50) newsActiveCoins++;
    });

    if (symbolCount === 0) {
      return {
        volatility: 50,
        trendStrength: 0,
        momentum: 0,
        volumeTrend: 0,
        newsSentiment: 0,
        riskLevel: 'medium',
        marketRegime: 'neutral',
        trendingRatio: 0.5,
        volatilityRatio: 0.5,
        newsActivity: 0.3
      };
    }

    const marketRegime = this.determineMarketRegime(totalTrendStrength / symbolCount);
    const trendingRatio = trendingCoins / symbolCount;
    const volatilityRatio = volatileCoins / symbolCount;
    const newsActivity = newsActiveCoins / symbolCount;

    return {
      volatility: totalVolatility / symbolCount,
      trendStrength: totalTrendStrength / symbolCount,
      momentum: totalMomentum / symbolCount,
      volumeTrend: totalVolume / symbolCount,
      newsSentiment: totalNewsSentiment / symbolCount,
      riskLevel: this.calculateRiskLevel(totalVolatility / symbolCount, marketRegime),
      marketRegime,
      trendingRatio,
      volatilityRatio,
      newsActivity
    };
  }

  /**
   * Enhanced strategy scoring for Futures trading
   */
  public scoreStrategies(conditions: MarketConditions): StrategyScore[] {
    console.log("🤖 AI STRATEGY SELECTION DEBUG:");
    console.log(`📊 Market Conditions: ${conditions.marketRegime}, Trend: ${conditions.trendStrength.toFixed(1)}, Vol: ${conditions.volatility.toFixed(1)}%`);
    
    const scores: StrategyScore[] = [];
    const { marketRegime, volatility, trendStrength, momentum, volumeTrend, newsSentiment, newsActivity, trendingRatio, volatilityRatio } = conditions;

    // 1. TREND FOLLOWING Strategy - BOOSTED for futures
    let trendScore = 50; // Increased for futures
    const trendReasons: string[] = [];
    if (Math.abs(trendStrength) > 15) {
      trendScore += 45; // Increased for futures leverage
      trendReasons.push(`Strong ${trendStrength > 0 ? 'bullish' : 'bearish'} trend (${Math.abs(trendStrength).toFixed(1)})`);
    }
    if (trendingRatio > 0.5) {
      trendScore += 35; // Increased
      trendReasons.push(`Many coins trending (${(trendingRatio * 100).toFixed(0)}%)`);
    }
    if (marketRegime === 'bull' || marketRegime === 'bear') {
      trendScore += 30; // Increased
      trendReasons.push(`${marketRegime.toUpperCase()} market ideal for futures trend following`);
    }
    // Futures-specific boost
    trendScore += 10;
    trendReasons.push('Futures leverage amplifies trend profits');
    scores.push({
      strategy: 'trend',
      score: Math.max(0, Math.min(100, trendScore)),
      reasons: trendReasons,
      confidence: this.calculateConfidence(conditions, trendScore),
    });

    // 2. BREAKOUT Strategy - BOOSTED for futures
    let breakoutScore = 45; // Increased
    const breakoutReasons: string[] = [];
    if (volatility > 35) {
      breakoutScore += 40; // Increased
      breakoutReasons.push(`High volatility (${volatility.toFixed(1)}%) enables futures breakouts`);
    }
    if (volumeTrend > 15) {
      breakoutScore += 35; // Increased
      breakoutReasons.push(`High volume surge (${volumeTrend.toFixed(1)}%) supports breakouts`);
    }
    if (volatilityRatio > 0.4) {
      breakoutScore += 30; // Increased
      breakoutReasons.push(`Many volatile coins (${(volatilityRatio * 100).toFixed(0)}%)`);
    }
    scores.push({
      strategy: 'breakout',
      score: Math.max(0, Math.min(100, breakoutScore)),
      reasons: breakoutReasons,
      confidence: this.calculateConfidence(conditions, breakoutScore),
    });

    // 3. MEAN REVERSION Strategy - ADJUSTED for futures risk
    let meanReversionScore = 30; // Reduced for futures risk
    const meanReversionReasons: string[] = [];
    if (Math.abs(trendStrength) < 12) {
      meanReversionScore += 30; // Reduced
      meanReversionReasons.push('Weak trends perfect for mean reversion');
    }
    if (volatility >= 25 && volatility <= 50) {
      meanReversionScore += 25; // Reduced
      meanReversionReasons.push(`Ideal volatility range (${volatility.toFixed(1)}%)`);
    }
    if (marketRegime === 'neutral') {
      meanReversionScore += 20; // Reduced
      meanReversionReasons.push('Neutral market optimal for mean reversion');
    }
    // PENALTIES in trending markets for futures
    if (Math.abs(trendStrength) > 25) {
      meanReversionScore -= 25; // Increased penalty
      meanReversionReasons.push('Strong trend dangerous for futures mean reversion');
    }
    // Futures-specific risk warning
    if (volatility > 60) {
      meanReversionScore -= 15;
      meanReversionReasons.push('High volatility increases liquidation risk');
    }
    scores.push({
      strategy: 'mean_reversion',
      score: Math.max(0, Math.min(100, meanReversionScore)),
      reasons: meanReversionReasons,
      confidence: this.calculateConfidence(conditions, meanReversionScore),
    });

    // 4. SCALPING Strategy - EXCELLENT for futures
    let scalpingScore = 50; // Increased
    const scalpingReasons: string[] = [];
    if (volatility >= 12 && volatility <= 45) {
      scalpingScore += 40; // Increased
      scalpingReasons.push(`Good volatility for futures scalping (${volatility.toFixed(1)}%)`);
    }
    if (volumeTrend > 12) {
      scalpingScore += 35; // Increased
      scalpingReasons.push(`High liquidity (${volumeTrend.toFixed(1)}% volume)`);
    }
    if (Math.abs(momentum) < 25) {
      scalpingScore += 30; // Increased
      scalpingReasons.push('Moderate momentum reduces futures risk');
    }
    // Futures-specific boost
    scalpingScore += 10;
    scalpingReasons.push('Futures ideal for scalping with tight stops');
    scores.push({
      strategy: 'scalping',
      score: Math.max(0, Math.min(100, scalpingScore)),
      reasons: scalpingReasons,
      confidence: this.calculateConfidence(conditions, scalpingScore),
    });

    // 5. MOMENTUM Strategy - BOOSTED for futures
    let momentumScore = 45; // Increased
    const momentumReasons: string[] = [];
    if (Math.abs(momentum) > 15) {
      momentumScore += 45; // Increased
      momentumReasons.push(`Strong momentum (${momentum.toFixed(1)})`);
    }
    if (volumeTrend > 20) {
      momentumScore += 35; // Increased
      momentumReasons.push(`Volume confirms momentum (${volumeTrend.toFixed(1)}%)`);
    }
    if (trendingRatio > 0.45) {
      momentumScore += 30; // Increased
      momentumReasons.push(`Many momentum coins (${(trendingRatio * 100).toFixed(0)}%)`);
    }
    scores.push({
      strategy: 'momentum',
      score: Math.max(0, Math.min(100, momentumScore)),
      reasons: momentumReasons,
      confidence: this.calculateConfidence(conditions, momentumScore),
    });

    // 6. SWING TRADING Strategy
    let swingScore = 50; // Increased
    const swingReasons: string[] = [];
    if (volatility >= 20 && volatility <= 65) {
      swingScore += 40; // Increased
      swingReasons.push(`Ideal swing volatility for futures (${volatility.toFixed(1)}%)`);
    }
    if (Math.abs(trendStrength) >= 12 && Math.abs(trendStrength) <= 35) {
      swingScore += 35; // Increased
      swingReasons.push(`Good trend strength for futures swings (${Math.abs(trendStrength).toFixed(1)})`);
    }
    if (marketRegime !== 'extreme') {
      swingScore += 30; // Increased
      swingReasons.push('Stable market conditions for futures');
    }
    scores.push({
      strategy: 'swing',
      score: Math.max(0, Math.min(100, swingScore)),
      reasons: swingReasons,
      confidence: this.calculateConfidence(conditions, swingScore),
    });

    // 7. ARBITRAGE Strategy
    let arbitrageScore = 35; // Increased
    const arbitrageReasons: string[] = [];
    if (volatility > 45) {
      arbitrageScore += 30; // Increased
      arbitrageReasons.push('High volatility creates futures arbitrage opportunities');
    }
    if (marketRegime === 'volatile') {
      arbitrageScore += 35; // Increased
      arbitrageReasons.push('Volatile market ideal for futures arbitrage');
    }
    if (volumeTrend > 35) {
      arbitrageScore += 25; // Increased
      arbitrageReasons.push('High volume improves futures arbitrage execution');
    }
    scores.push({
      strategy: 'arbitrage',
      score: Math.max(0, Math.min(100, arbitrageScore)),
      reasons: arbitrageReasons,
      confidence: this.calculateConfidence(conditions, arbitrageScore),
    });

    // 8. PAIR TRADING Strategy
    let pairScore = 40; // Increased
    const pairReasons: string[] = [];
    if (Math.abs(trendStrength) < 18) {
      pairScore += 40; // Increased
      pairReasons.push('Weak overall trends good for futures pair trading');
    }
    if (volatility < 55) {
      pairScore += 35; // Increased
      pairReasons.push('Moderate volatility reduces futures pair risk');
    }
    if (trendingRatio < 0.35) {
      pairScore += 25; // Increased
      pairReasons.push('Low trending ratio favorable for futures pairs');
    }
    scores.push({
      strategy: 'pair',
      score: Math.max(0, Math.min(100, pairScore)),
      reasons: pairReasons,
      confidence: this.calculateConfidence(conditions, pairScore),
    });

    // 9. SENTIMENT Strategy
    let sentimentScore = 45; // Increased
    const sentimentReasons: string[] = [];
    if (volumeTrend > 25) {
      sentimentScore += 30; // Increased
      sentimentReasons.push(`High volume indicates strong sentiment (${volumeTrend.toFixed(1)}%)`);
    }
    if (Math.abs(newsSentiment) > 15) {
      sentimentScore += 35; // Increased
      sentimentReasons.push(`Strong news sentiment: ${newsSentiment > 0 ? 'bullish' : 'bearish'} (${newsSentiment.toFixed(1)})`);
    }
    if (newsActivity > 0.35) {
      sentimentScore += 30; // Increased
      sentimentReasons.push(`High news activity (${(newsActivity * 100).toFixed(0)}% of coins)`);
    }
    scores.push({
      strategy: 'sentiment',
      score: Math.max(0, Math.min(100, sentimentScore)),
      reasons: sentimentReasons,
      confidence: this.calculateConfidence(conditions, sentimentScore),
    });

    // 10. NEWS Strategy
    let newsScore = 40; // Increased
    const newsReasons: string[] = [];
    if (volatility > 30) {
      newsScore += 30; // Increased
      newsReasons.push(`Volatile market reacts strongly to news (${volatility.toFixed(1)}%)`);
    }
    if (Math.abs(newsSentiment) > 20) {
      newsScore += 40; // Increased
      newsReasons.push(`Strong news catalyst: ${newsSentiment > 0 ? 'positive' : 'negative'} (${Math.abs(newsSentiment).toFixed(1)})`);
    }
    if (newsActivity > 0.45) {
      newsScore += 30; // Increased
      newsReasons.push(`Active news environment (${(newsActivity * 100).toFixed(0)}% of coins)`);
    }
    scores.push({
      strategy: 'news',
      score: Math.max(0, Math.min(100, newsScore)),
      reasons: newsReasons,
      confidence: this.calculateConfidence(conditions, newsScore),
    });

    // Sort by score descending, with tiebreaker for equal scores
    const sortedScores = scores.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // Primary sort by score
      }
      // Tiebreaker: Add slight randomization + confidence bonus
      const tiebreaker = (b.confidence * 0.1 + Math.random() * 5) - (a.confidence * 0.1 + Math.random() * 5);
      return tiebreaker;
    });
    
    // DEBUG: Show top 3 strategies
    console.log(`🏆 Top 3 Strategies: ${sortedScores.slice(0, 3).map(s => `${s.strategy}(${s.score})`).join(', ')}`);
    
    return sortedScores;
  }

  /**
   * Smart coin selection for each strategy - Enhanced for futures
   */
  public selectOptimalCoins(availableCoins: string[], strategy: string, budget: number = 100): string[] {
    const scoredCoins: { symbol: string; score: number; strategy: string; reasons: string[] }[] = [];

    availableCoins.forEach(symbol => {
      const history = this.priceHistory.get(symbol);
      if (!history || history.length < 15) return;

      const metrics = this.calculateComprehensiveMetrics(history);
      const news = this.getNewsSentiment(symbol);
      let score = 0;
      const reasons: string[] = [];

      // Strategy-specific scoring
      switch (strategy) {
        case 'trend':
          score = this.scoreForTrendStrategy(metrics, reasons);
          break;
        case 'breakout':
          score = this.scoreForBreakoutStrategy(metrics, reasons);
          break;
        case 'mean_reversion':
          score = this.scoreForMeanReversionStrategy(metrics, reasons);
          break;
        case 'scalping':
          score = this.scoreForScalpingStrategy(metrics, reasons);
          break;
        case 'momentum':
          score = this.scoreForMomentumStrategy(metrics, reasons);
          break;
        case 'swing':
          score = this.scoreForSwingStrategy(metrics, reasons);
          break;
        case 'arbitrage':
          score = this.scoreForArbitrageStrategy(metrics, reasons);
          break;
        case 'pair':
          score = this.scoreForPairStrategy(metrics, reasons);
          break;
        case 'sentiment':
          score = this.scoreForSentimentStrategy(metrics, news, reasons);
          break;
        case 'news':
          score = this.scoreForNewsStrategy(metrics, news, reasons);
          break;
        default:
          score = this.scoreForTrendStrategy(metrics, reasons);
      }

      // Futures-specific adjustments
      if (metrics.volatility > 80) {
        score -= 20;
        reasons.push('Extreme volatility dangerous for futures');
      }

      // Budget adjustment for futures
      if (budget < 200) {
        const currentPrice = history[history.length - 1].price;
        if (currentPrice < 50) { // More strict for futures
          score += 15;
          reasons.push('Affordable for futures with small budget');
        }
      }

      if (score > 40) { // Higher threshold for futures
        scoredCoins.push({ 
          symbol, 
          score, 
          strategy,
          reasons 
        });
      }
    });

    const selectedCoins = scoredCoins
      .sort((a, b) => b.score - a.score)
      .slice(0, 4) // Fewer coins for better focus in futures
      .map(coin => coin.symbol);

    console.log(`🎯 ${strategy.toUpperCase()} Futures Strategy selected ${selectedCoins.length} coins`);
    return selectedCoins;
  }

  /**
   * STRATEGY DIVERSITY ENFORCEMENT for futures safety
   */
  private enforceStrategyDiversity(strategyScores: StrategyScore[], currentStrategy: string): StrategyScore[] {
    const now = Date.now();
    
    // Force strategy rotation every 15 minutes if risky strategies dominate
    if (now - this.lastStrategyRotation > this.STRATEGY_ROTATION_INTERVAL) {
      const topStrategies = strategyScores.slice(0, 3);
      const riskyInTop = topStrategies.filter(s => 
        s.strategy === 'mean_reversion' || s.strategy === 'arbitrage'
      ).length;
      
      if (riskyInTop >= 2) {
        console.log("🔄 ENFORCING FUTURES STRATEGY DIVERSITY: Risky strategies dominating");
        
        // Find best alternative strategy with score > 65
        const alternative = strategyScores.find(s => 
          !['mean_reversion', 'arbitrage'].includes(s.strategy) && 
          s.score >= 65 &&
          !topStrategies.includes(s)
        );
        
        if (alternative) {
          // Boost the alternative strategy to top
          const boostedScores = strategyScores.map(score => {
            if (score.strategy === alternative.strategy) {
              return { ...score, score: Math.min(100, score.score + 20) };
            }
            if (score.strategy === 'mean_reversion' || score.strategy === 'arbitrage') {
              return { ...score, score: Math.max(0, score.score - 15) };
            }
            return score;
          });
          
          this.lastStrategyRotation = now;
          return boostedScores.sort((a, b) => b.score - a.score);
        }
      }
    }
    
    return strategyScores;
  }

  /**
   * Strategy-specific scoring methods - Enhanced for futures
   */
  private scoreForTrendStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (Math.abs(metrics.trendStrength) > 20) {
      score += 50; // Increased for futures
      reasons.push(`Strong trend: ${metrics.trendStrength.toFixed(1)}`);
    }
    if (metrics.momentum > 8) {
      score += 35; // Increased
      reasons.push(`Good momentum: ${metrics.momentum.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 12) {
      score += 30; // Increased
      reasons.push(`Volume confirmation: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    // Futures bonus
    score += 10;
    reasons.push('Futures leverage enhances trend profits');
    return score;
  }

  private scoreForBreakoutStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volatility > 35) {
      score += 40; // Increased
      reasons.push(`High volatility: ${metrics.volatility.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 25) {
      score += 35; // Increased
      reasons.push(`Volume surge: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    if (metrics.consolidation) {
      score += 30; // Increased
      reasons.push('Consolidation pattern detected - good for futures breakouts');
    }
    return score;
  }

  private scoreForMeanReversionStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (Math.abs(metrics.trendStrength) < 20) {
      score += 40; // Increased but cautious
      reasons.push('Weak trend - careful with futures mean reversion');
    }
    if (metrics.rsi < 30 || metrics.rsi > 70) {
      score += 35; // Increased but cautious
      reasons.push(`Extreme RSI: ${metrics.rsi.toFixed(1)} - monitor liquidation risk`);
    }
    if (metrics.volatility < 50) {
      score += 30; // Increased but cautious
      reasons.push(`Controlled volatility: ${metrics.volatility.toFixed(1)}% - safer for futures`);
    }
    // Futures risk warning
    if (metrics.volatility > 60) {
      score -= 20;
      reasons.push('High volatility increases futures liquidation risk');
    }
    return score;
  }

  private scoreForScalpingStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volatility >= 10 && metrics.volatility <= 40) {
      score += 40; // Increased
      reasons.push(`Ideal scalping volatility for futures: ${metrics.volatility.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 20) {
      score += 35; // Increased
      reasons.push(`High liquidity: ${metrics.volumeStrength.toFixed(1)}% volume`);
    }
    if (metrics.spread < 0.1) {
      score += 30; // Increased
      reasons.push('Low spread - excellent for futures scalping');
    }
    // Futures bonus
    score += 15;
    reasons.push('Futures ideal for scalping strategy');
    return score;
  }

  private scoreForMomentumStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (Math.abs(metrics.momentum) > 15) {
      score += 45; // Increased
      reasons.push(`Strong momentum: ${metrics.momentum.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 20) {
      score += 35; // Increased
      reasons.push(`Volume momentum: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    if (metrics.trendStrength * metrics.momentum > 0) {
      score += 25; // Increased
      reasons.push('Trend and momentum aligned - good for futures');
    }
    return score;
  }

  private scoreForSwingStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volatility >= 20 && metrics.volatility <= 60) {
      score += 40; // Increased
      reasons.push(`Good swing volatility for futures: ${metrics.volatility.toFixed(1)}%`);
    }
    if (Math.abs(metrics.trendStrength) >= 10 && Math.abs(metrics.trendStrength) <= 35) {
      score += 35; // Increased
      reasons.push(`Swing-friendly trend: ${metrics.trendStrength.toFixed(1)}`);
    }
    if (metrics.supportResistanceStrength > 50) {
      score += 30; // Increased
      reasons.push('Clear support/resistance levels - good for futures swings');
    }
    return score;
  }

  private scoreForArbitrageStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volatility > 45) {
      score += 45; // Increased
      reasons.push(`High volatility: ${metrics.volatility.toFixed(1)}% - futures arbitrage opportunities`);
    }
    if (metrics.volumeStrength > 30) {
      score += 40; // Increased
      reasons.push(`High volume: ${metrics.volumeStrength.toFixed(1)}% - good for execution`);
    }
    score += 30; // Base score for futures arbitrage potential
    reasons.push('Futures arbitrage opportunities possible');
    return score;
  }

  private scoreForPairStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (Math.abs(metrics.trendStrength) < 25) {
      score += 40; // Increased
      reasons.push('Weak trend - good for futures pairs');
    }
    if (metrics.volatility < 55) {
      score += 35; // Increased
      reasons.push(`Stable volatility: ${metrics.volatility.toFixed(1)}% - reduces futures risk`);
    }
    if (metrics.correlationPotential) {
      score += 30; // Increased
      reasons.push('Good correlation potential for futures pairs');
    }
    return score;
  }

  private scoreForSentimentStrategy(metrics: any, news: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volumeStrength > 25) {
      score += 30; // Increased
      reasons.push(`High volume indicates sentiment: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    if (news.relevance > 50 && Math.abs(news.sentiment) > 20) {
      score += 40; // Increased
      reasons.push(`Strong ${news.sentiment > 0 ? 'positive' : 'negative'} news sentiment`);
    }
    if (metrics.momentum > 10 && metrics.momentum * (news.sentiment || 1) > 0) {
      score += 25; // Increased
      reasons.push(`Momentum aligns with sentiment: ${metrics.momentum.toFixed(1)}%`);
    }
    return score;
  }

  private scoreForNewsStrategy(metrics: any, news: any, reasons: string[]): number {
    let score = 0;
    if (news.relevance > 60 && Math.abs(news.sentiment) > 25) {
      score += 55; // Increased
      reasons.push(`Strong news catalyst: ${news.sentiment > 0 ? 'bullish' : 'bearish'} (${Math.abs(news.sentiment).toFixed(1)})`);
    }
    if (metrics.volatility > 30) {
      score += 30; // Increased
      reasons.push(`News-sensitive volatility: ${metrics.volatility.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 20) {
      score += 20; // Increased
      reasons.push(`Volume reacts to news: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    return score;
  }

  /**
   * FUTURES-ENHANCED trade signals with proper LONG/SHORT logic
   */
  public generateTradeSignals(symbol: string, currentPrice: number, strategy: string, entryPrice?: number): { 
    action: 'BUY' | 'SELL' | 'HOLD' | 'LONG' | 'SHORT' | 'CLOSE'; 
    confidence: number; 
    reasons: string[];
    suggestedStopLoss?: number;
    suggestedTakeProfit?: number;
    recommendedLeverage?: number;
    positionSize?: number;
  } {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 15) {
      return { action: 'HOLD', confidence: 0, reasons: ['Insufficient data'] };
    }

    const metrics = this.calculateComprehensiveMetrics(history);
    const news = this.getNewsSentiment(symbol);
    
    // FUTURES ENHANCEMENT: Different logic for futures positions
    if (entryPrice) {
      return this.generateFuturesPositionSignals(symbol, currentPrice, entryPrice, strategy, metrics, news);
    } else {
      return this.generateFuturesEntrySignals(symbol, currentPrice, strategy, metrics, news);
    }
  }

  /**
   * FUTURES-SPECIFIC position management
   */
  private generateFuturesPositionSignals(
    symbol: string, 
    currentPrice: number, 
    entryPrice: number, 
    strategy: string, 
    metrics: any,
    news: any
  ): any {
    const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    const reasons: string[] = [];
    
    // 🚨 FUTURES RISK MANAGEMENT: Emergency stops
    if (profitPercent <= -15) { // Tighter stop for futures
      const emergencyStopLoss = currentPrice * 0.99;
      reasons.push(`🚨 FUTURES EMERGENCY: ${profitPercent.toFixed(2)}% loss - close position`);
      
      return { 
        action: 'CLOSE', 
        confidence: 95, 
        reasons,
        suggestedStopLoss: emergencyStopLoss,
        recommendedLeverage: Math.max(1, this.leverage - 1), // Reduce leverage
        positionSize: this.calculateSafePositionSize(1000, currentPrice, entryPrice, strategy) // Example $1000 account
      };
    }

    // 🚨 NEVER HOLD LARGE LOSSES IN FUTURES
    if (profitPercent < -8) {
      const widerStopLoss = entryPrice * 0.92;
      reasons.push(`Holding at ${profitPercent.toFixed(2)}% loss - monitoring closely for futures`);
      
      return { 
        action: 'HOLD', 
        confidence: 70, 
        reasons,
        suggestedStopLoss: widerStopLoss,
        recommendedLeverage: Math.max(1, this.leverage - 1), // Reduce leverage
        positionSize: this.calculateSafePositionSize(1000, currentPrice, entryPrice, strategy)
      };
    }

    // Use ProfitOptimizer logic for futures
    const profitDecision = {
      scalping: { minProfit: 2.5, maxProfit: 4.0 }, // Tighter for futures
      swing: { minProfit: 8.0, maxProfit: 15.0 },
      momentum: { minProfit: 7.0, maxProfit: 12.0 },
      trend: { minProfit: 6.0, maxProfit: 10.0 },
      breakout: { minProfit: 6.5, maxProfit: 11.0 },
      mean_reversion: { minProfit: 4.0, maxProfit: 8.0 }, // Conservative for futures
      safe: { minProfit: 2.5, maxProfit: 6.0 },
      balanced: { minProfit: 4.0, maxProfit: 9.0 },
      aggressive: { minProfit: 6.0, maxProfit: 15.0 },
      news: { minProfit: 6.0, maxProfit: 12.0 },
      sentiment: { minProfit: 3.5, maxProfit: 7.0 },
      arbitrage: { minProfit: 1.5, maxProfit: 4.0 }, // Small targets for arbitrage
      pair: { minProfit: 2.0, maxProfit: 5.0 }
    }[strategy] || { minProfit: 6.0, maxProfit: 10.0 };

    let shouldClose = false;
    let closeConfidence = 0;
    const closeReasons: string[] = [];

    // Take profit at minimum target
    if (profitPercent >= profitDecision.minProfit) {
      shouldClose = true;
      closeConfidence = 80 + Math.min(20, (profitPercent - profitDecision.minProfit) * 4);
      closeReasons.push(`Futures profit target reached: ${profitPercent.toFixed(2)}%`);
    }

    // Emergency profit taking at high profits for futures
    if (profitPercent >= 20) {
      shouldClose = true;
      closeConfidence = 95;
      closeReasons.push(`🚨 Futures emergency profit taking at ${profitPercent.toFixed(2)}% profit`);
    }

    // Partial profit taking
    if (profitPercent >= 12 && profitPercent < 20) {
      shouldClose = true;
      closeConfidence = 85;
      closeReasons.push(`Futures partial profit taking at ${profitPercent.toFixed(2)}% profit`);
    }

    if (shouldClose) {
      return { 
        action: 'CLOSE', 
        confidence: closeConfidence, 
        reasons: closeReasons,
        suggestedStopLoss: currentPrice * 0.99,
        recommendedLeverage: this.leverage,
        positionSize: this.calculateSafePositionSize(1000, currentPrice, entryPrice, strategy)
      };
    }

    // Hold the futures position
    reasons.push(`Holding futures with ${profitPercent.toFixed(2)}% profit - waiting for better exit`);
    
    return { 
      action: 'HOLD', 
      confidence: 75, 
      reasons,
      suggestedStopLoss: entryPrice * 0.96, // Tighter stop loss when in profit
      recommendedLeverage: this.leverage,
      positionSize: this.calculateSafePositionSize(1000, currentPrice, entryPrice, strategy)
    };
  }

  /**
   * FUTURES-SPECIFIC entry signals
   */
  private generateFuturesEntrySignals(
    symbol: string, 
    currentPrice: number, 
    strategy: string, 
    metrics: any,
    news: any
  ): any {
    
    let shouldEnter = false;
    let enterAction: 'LONG' | 'SHORT' | 'HOLD' = 'HOLD';
    let enterConfidence = 0;
    const reasons: string[] = [];
    const recommendedLeverage = this.calculateSafeLeverage(metrics.volatility);

    // Strategy-specific entry logic for futures
    switch (strategy) {
      case 'trend':
        if (metrics.trendStrength > 25 && metrics.momentum > 8) {
          shouldEnter = true;
          enterAction = 'LONG';
          enterConfidence = 80;
          reasons.push(`Strong bullish trend: ${metrics.trendStrength.toFixed(1)}`);
          reasons.push(`Positive momentum: ${metrics.momentum.toFixed(1)}%`);
        } else if (metrics.trendStrength < -25 && metrics.momentum < -8) {
          shouldEnter = true;
          enterAction = 'SHORT';
          enterConfidence = 75;
          reasons.push(`Strong bearish trend: ${metrics.trendStrength.toFixed(1)}`);
          reasons.push(`Negative momentum: ${metrics.momentum.toFixed(1)}%`);
        }
        break;

      case 'breakout':
        if (metrics.breakoutSignal && metrics.volumeStrength > 20) {
          shouldEnter = true;
          enterAction = metrics.trendStrength > 0 ? 'LONG' : 'SHORT';
          enterConfidence = 85;
          reasons.push(`Futures breakout detected with volume confirmation`);
          reasons.push(`Volume strength: ${metrics.volumeStrength.toFixed(1)}%`);
        }
        break;

      case 'mean_reversion':
        if (metrics.rsi < 30 && metrics.trendStrength > -15) {
          shouldEnter = true;
          enterAction = 'LONG';
          enterConfidence = 70;
          reasons.push(`Oversold RSI: ${metrics.rsi.toFixed(1)}`);
          reasons.push(`Not in strong downtrend: ${metrics.trendStrength.toFixed(1)}`);
        } else if (metrics.rsi > 70 && metrics.trendStrength < 15) {
          shouldEnter = true;
          enterAction = 'SHORT';
          enterConfidence = 65;
          reasons.push(`Overbought RSI: ${metrics.rsi.toFixed(1)}`);
          reasons.push(`Not in strong uptrend: ${metrics.trendStrength.toFixed(1)}`);
        }
        break;

      case 'scalping':
        if (metrics.volatility >= 15 && metrics.volumeStrength > 25 && metrics.spread < 0.1) {
          shouldEnter = true;
          enterAction = Math.random() > 0.5 ? 'LONG' : 'SHORT'; // Scalping can go both ways
          enterConfidence = 75;
          reasons.push(`Good futures scalping conditions`);
          reasons.push(`Volatility: ${metrics.volatility.toFixed(1)}%, Volume: ${metrics.volumeStrength.toFixed(1)}%`);
        }
        break;

      case 'momentum':
        if (metrics.momentum > 15 && metrics.volumeStrength > 20) {
          shouldEnter = true;
          enterAction = 'LONG';
          enterConfidence = 82;
          reasons.push(`Strong momentum: ${metrics.momentum.toFixed(1)}%`);
          reasons.push(`Volume confirmation: ${metrics.volumeStrength.toFixed(1)}%`);
        } else if (metrics.momentum < -15 && metrics.volumeStrength > 20) {
          shouldEnter = true;
          enterAction = 'SHORT';
          enterConfidence = 78;
          reasons.push(`Strong negative momentum: ${metrics.momentum.toFixed(1)}%`);
          reasons.push(`Volume confirmation: ${metrics.volumeStrength.toFixed(1)}%`);
        }
        break;

      case 'swing':
        if (metrics.swingBuySignal && metrics.supportResistanceStrength > 50) {
          shouldEnter = true;
          enterAction = 'LONG';
          enterConfidence = 78;
          reasons.push(`Futures swing buy signal detected`);
          reasons.push(`Clear support/resistance: ${metrics.supportResistanceStrength.toFixed(1)}%`);
        } else if (metrics.swingSellSignal && metrics.supportResistanceStrength > 50) {
          shouldEnter = true;
          enterAction = 'SHORT';
          enterConfidence = 75;
          reasons.push(`Futures swing sell signal detected`);
          reasons.push(`Clear support/resistance: ${metrics.supportResistanceStrength.toFixed(1)}%`);
        }
        break;

      case 'sentiment':
        if ((news.relevance > 50 && news.sentiment > 20) || metrics.volumeStrength > 30) {
          shouldEnter = true;
          enterAction = 'LONG';
          enterConfidence = 72;
          if (news.relevance > 50) reasons.push(`Positive news sentiment: ${news.sentiment.toFixed(1)}`);
          if (metrics.volumeStrength > 30) reasons.push(`High volume indicates sentiment: ${metrics.volumeStrength.toFixed(1)}%`);
        } else if ((news.relevance > 50 && news.sentiment < -20) || metrics.volumeStrength > 30) {
          shouldEnter = true;
          enterAction = 'SHORT';
          enterConfidence = 68;
          if (news.relevance > 50) reasons.push(`Negative news sentiment: ${news.sentiment.toFixed(1)}`);
          if (metrics.volumeStrength > 30) reasons.push(`High volume indicates sentiment: ${metrics.volumeStrength.toFixed(1)}%`);
        }
        break;

      case 'news':
        if (news.relevance > 60 && news.sentiment > 25) {
          shouldEnter = true;
          enterAction = 'LONG';
          enterConfidence = 80;
          reasons.push(`Strong positive news catalyst: ${news.sentiment.toFixed(1)}`);
          reasons.push(`High relevance: ${news.relevance.toFixed(1)}%`);
        } else if (news.relevance > 60 && news.sentiment < -25) {
          shouldEnter = true;
          enterAction = 'SHORT';
          enterConfidence = 78;
          reasons.push(`Strong negative news catalyst: ${news.sentiment.toFixed(1)}`);
          reasons.push(`High relevance: ${news.relevance.toFixed(1)}%`);
        }
        break;

      default:
        if (metrics.trendStrength > 20 && metrics.momentum > 5 && metrics.volumeStrength > 15) {
          shouldEnter = true;
          enterAction = 'LONG';
          enterConfidence = 75;
          reasons.push(`Favorable market conditions for LONG`);
          reasons.push(`Trend: ${metrics.trendStrength.toFixed(1)}, Momentum: ${metrics.momentum.toFixed(1)}%`);
        } else if (metrics.trendStrength < -20 && metrics.momentum < -5 && metrics.volumeStrength > 15) {
          shouldEnter = true;
          enterAction = 'SHORT';
          enterConfidence = 70;
          reasons.push(`Favorable market conditions for SHORT`);
          reasons.push(`Trend: ${metrics.trendStrength.toFixed(1)}, Momentum: ${metrics.momentum.toFixed(1)}%`);
        }
    }

    // FUTURES-SPECIFIC safety filters
    if (shouldEnter) {
      // Avoid entering in extreme volatility
      if (metrics.volatility > 70) {
        shouldEnter = false;
        reasons.push(`🚨 Volatility too high for futures: ${metrics.volatility.toFixed(1)}% - too risky`);
        enterConfidence = 0;
      }
      
      // Avoid overbought/oversold extremes for futures
      if ((enterAction === 'LONG' && metrics.rsi > 75) || (enterAction === 'SHORT' && metrics.rsi < 25)) {
        shouldEnter = false;
        reasons.push(`RSI extreme: ${metrics.rsi.toFixed(1)} - too risky for futures entry`);
        enterConfidence = 0;
      }

      // News-specific safety for futures
      if (strategy === 'news' || strategy === 'sentiment') {
        if (news.relevance < 40) {
          shouldEnter = false;
          reasons.push(`News relevance too low for futures: ${news.relevance.toFixed(1)}%`);
          enterConfidence = 0;
        }
      }

      // Check if we should avoid shorting in strong bull markets
      if (enterAction === 'SHORT' && metrics.trendStrength > 30) {
        shouldEnter = false;
        reasons.push(`Strong bull trend - avoiding SHORT position`);
        enterConfidence = 0;
      }
    }

    if (shouldEnter && enterConfidence > 55) {
      const stopLoss = enterAction === 'LONG' ? currentPrice * 0.96 : currentPrice * 1.04;
      const takeProfit = enterAction === 'LONG' ? currentPrice * 1.06 : currentPrice * 0.94;
      const positionSize = this.calculateSafePositionSize(1000, currentPrice, stopLoss, strategy);
      
      reasons.push(`Futures ${enterAction} with ${recommendedLeverage}x leverage`);
      reasons.push(`Stop loss: $${stopLoss.toFixed(2)} | Take profit: $${takeProfit.toFixed(2)}`);
      reasons.push(`Position size: ${positionSize.toFixed(4)} units`);
      
      return { 
        action: enterAction, 
        confidence: enterConfidence, 
        reasons,
        suggestedStopLoss: stopLoss,
        suggestedTakeProfit: takeProfit,
        recommendedLeverage,
        positionSize
      };
    }

    // No good entry signal - HOLD
    if (reasons.length === 0) {
      reasons.push('Market conditions not optimal for futures entry');
      reasons.push(`Current metrics - Trend: ${metrics.trendStrength.toFixed(1)}, RSI: ${metrics.rsi.toFixed(1)}, Vol: ${metrics.volatility.toFixed(1)}%`);
    }
    
    return { 
      action: 'HOLD', 
      confidence: 35, 
      reasons,
      suggestedStopLoss: undefined,
      suggestedTakeProfit: undefined,
      recommendedLeverage: 1, // Minimal leverage when holding
      positionSize: 0
    };
  }

  /**
   * FUTURES-SPECIFIC position sizing with liquidation protection
   */
  private calculateSafePositionSize(
    accountBalance: number,
    currentPrice: number,
    stopLossPrice: number,
    strategy: string
  ): number {
    const riskPerTrade = 0.02; // 2% risk per trade
    const maxRiskAmount = accountBalance * riskPerTrade;
    
    // Price distance to stop loss
    const priceDifference = Math.abs(currentPrice - stopLossPrice);
    
    // Calculate position size based on risk
    const riskBasedSize = maxRiskAmount / priceDifference;
    
    // Strategy-specific adjustments
    let strategyMultiplier = 1.0;
    switch (strategy) {
      case 'scalping': strategyMultiplier = 0.6; break;
      case 'trend': strategyMultiplier = 0.7; break;
      case 'mean_reversion': strategyMultiplier = 0.4; break; // Very conservative
      case 'breakout': strategyMultiplier = 0.5; break;
      case 'momentum': strategyMultiplier = 0.6; break;
      case 'swing': strategyMultiplier = 0.65; break;
      case 'arbitrage': strategyMultiplier = 0.8; break;
      case 'news': strategyMultiplier = 0.55; break;
      default: strategyMultiplier = 0.6;
    }
    
    return riskBasedSize * strategyMultiplier;
  }

  /**
   * Calculate safe leverage based on volatility
   */
  private calculateSafeLeverage(volatility: number): number {
    if (volatility < 20) return 5;
    if (volatility < 35) return 4;
    if (volatility < 50) return 3;
    if (volatility < 65) return 2;
    return 1; // Minimal leverage for high volatility
  }

  /**
   * Calculate expected win rate for strategies
   */
  private calculateExpectedWinRate(strategy: string, conditions: MarketConditions): number {
    const baseRates: Record<string, number> = {
      trend: 65, breakout: 62, mean_reversion: 58, scalping: 60, momentum: 63,
      swing: 64, arbitrage: 55, pair: 58, sentiment: 57, news: 56
    };
    let winRate = baseRates[strategy] || 50;
    
    // Market condition adjustments
    if (conditions.marketRegime === 'bull') winRate += 10;
    if (conditions.marketRegime === 'bear') winRate -= 8;
    if (conditions.newsSentiment > 20) winRate += 7;
    if (conditions.volatility > 60) winRate -= 5; // Reduced win rate in high volatility
    
    return Math.max(45, Math.min(80, winRate));
  }

  /**
   * Select best strategy and coins - Enhanced for futures
   */
  public selectBestStrategy(currentStrategy: StrategyType): AIDecision {
    const conditions = this.analyzeMarketConditions();
    let strategyScores = this.scoreStrategies(conditions);
    
    // Apply futures diversity enforcement
    strategyScores = this.enforceStrategyDiversity(strategyScores, currentStrategy);
    
    const bestStrategy = strategyScores[0];
    
    const reasoning = this.buildFuturesReasoning(conditions, strategyScores, bestStrategy);
    const expectedWinRate = this.calculateExpectedWinRate(bestStrategy.strategy, conditions);
    
    const decision: AIDecision = {
      id: randomUUID(),
      timestamp: Date.now(),
      marketConditions: conditions,
      strategyScores,
      selectedStrategy: bestStrategy.strategy as StrategyType,
      previousStrategy: currentStrategy,
      reasoning,
      confidence: bestStrategy.confidence,
      expectedWinRate,
    };
    
    this.aiDecisionHistory.push(decision);
    if (this.aiDecisionHistory.length > 100) {
      this.aiDecisionHistory.shift();
    }
    
    console.log(`🎯 FUTURES AI Selected: ${bestStrategy.strategy} with ${bestStrategy.confidence}% confidence`);
    console.log(`📈 Expected Win Rate: ${expectedWinRate}%`);
    console.log(`⚡ Recommended Leverage: ${this.calculateSafeLeverage(conditions.volatility)}x`);
    
    return decision;
  }

  private buildFuturesReasoning(conditions: MarketConditions, scores: StrategyScore[], selectedScore: StrategyScore): string {
    const topStrategies = scores.slice(0, 3).map(s => `${s.strategy} (${s.score})`).join(', ');
    const safeLeverage = this.calculateSafeLeverage(conditions.volatility);
    return `FUTURES Market: ${conditions.marketRegime} | Vol: ${conditions.volatility.toFixed(1)}% | ` +
           `Leverage: ${safeLeverage}x | Risk: ${conditions.riskLevel} | ` +
           `Top Strategies: ${topStrategies}`;
  }

  /**
   * Technical indicator calculations
   */
  private calculateComprehensiveMetrics(history: PriceData[]) {
    const prices = history.map(d => d.price);
    const volumes = history.map(d => d.volume24h);
    const currentPrice = prices[prices.length - 1];

    const volatility = this.calculateVolatility(prices);
    const trendStrength = this.calculateTrendStrength(prices);
    const momentum = this.calculateMomentum(prices);
    const volumeStrength = this.calculateVolumeStrength(volumes);
    const rsi = this.calculateRSI(prices, 14);
    
    const consolidation = this.detectConsolidation(prices);
    const breakoutSignal = this.detectBreakout(prices, volumes);
    const supportResistanceStrength = this.calculateSupportResistanceStrength(prices);
    const swingBuySignal = this.detectSwingBuySignal(prices);
    const swingSellSignal = this.detectSwingSellSignal(prices);

    return {
      volatility,
      trendStrength,
      momentum,
      volumeStrength,
      rsi,
      consolidation,
      breakoutSignal,
      supportResistanceStrength,
      swingBuySignal,
      swingSellSignal,
      spread: 0.05,
      correlationPotential: Math.random() > 0.3,
      socialSentiment: 50 + (Math.random() * 50)
    };
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100 * Math.sqrt(365);
  }

  private calculateTrendStrength(prices: number[]): number {
    if (prices.length < 10) return 0;
    const shortMA = this.calculateSMA(prices, 5);
    const longMA = this.calculateSMA(prices, 20);
    return ((shortMA - longMA) / longMA) * 100;
  }

  private calculateMomentum(prices: number[]): number {
    if (prices.length < 10) return 0;
    return ((prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10]) * 100;
  }

  private calculateVolumeStrength(volumes: number[]): number {
    if (volumes.length < 10) return 0;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const historicalVolume = volumes.slice(0, -5).reduce((a, b) => a + b, 0) / Math.max(1, volumes.length - 5);
    return ((recentVolume - historicalVolume) / historicalVolume) * 100;
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateSMA(prices: number[], period: number): number {
    const recent = prices.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  private detectConsolidation(prices: number[]): boolean {
    if (prices.length < 20) return false;
    const recent = prices.slice(-10);
    const range = (Math.max(...recent) - Math.min(...recent)) / Math.min(...recent);
    return range < 0.05; // Less than 5% range indicates consolidation
  }

  private detectBreakout(prices: number[], volumes: number[]): boolean {
    if (prices.length < 20) return false;
    const currentPrice = prices[prices.length - 1];
    const resistance = Math.max(...prices.slice(-20, -1));
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19;
    return currentPrice > resistance && currentVolume > avgVolume * 1.5;
  }

  private calculateSupportResistanceStrength(prices: number[]): number {
    if (prices.length < 20) return 0;
    const highs = [];
    const lows = [];
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] > prices[i-1] && prices[i] > prices[i+1]) highs.push(prices[i]);
      if (prices[i] < prices[i-1] && prices[i] < prices[i+1]) lows.push(prices[i]);
    }
    return Math.min(100, (highs.length + lows.length) * 10);
  }

  private detectSwingBuySignal(prices: number[]): boolean {
    if (prices.length < 10) return false;
    const rsi = this.calculateRSI(prices, 14);
    const momentum = this.calculateMomentum(prices);
    return rsi < 40 && momentum > -5;
  }

  private detectSwingSellSignal(prices: number[]): boolean {
    if (prices.length < 10) return false;
    const rsi = this.calculateRSI(prices, 14);
    const momentum = this.calculateMomentum(prices);
    return rsi > 60 && momentum < 5;
  }

  private determineMarketRegime(trendStrength: number): 'bull' | 'bear' | 'neutral' | 'volatile' | 'extreme' {
    if (trendStrength > 25) return 'bull';
    if (trendStrength < -25) return 'bear';
    if (Math.abs(trendStrength) < 12) return 'neutral';
    return 'volatile';
  }

  private calculateRiskLevel(volatility: number, regime: string): 'low' | 'medium' | 'high' | 'extreme' {
    if (regime === 'extreme') return 'extreme';
    if (volatility < 20) return 'low';
    if (volatility < 50) return 'medium';
    if (volatility < 80) return 'high';
    return 'extreme';
  }

  private calculateConfidence(conditions: MarketConditions, score: number): number {
    let confidence = 60;
    if (conditions.marketRegime === 'bull' || conditions.marketRegime === 'bear') confidence += 15;
    if (conditions.trendingRatio > 0.7) confidence += 10;
    if (conditions.newsActivity > 0.6) confidence += 10;
    const scoreDiff = Math.abs(score - 50);
    if (scoreDiff > 30) confidence += 10;
    return Math.max(0, Math.min(100, confidence));
  }

  public getDecisionHistory(limit: number = 20): AIDecision[] {
    return this.aiDecisionHistory.slice(-limit);
  }

  public clearHistory() {
    this.aiDecisionHistory = [];
    this.priceHistory.clear();
    this.strategyPerformance.clear();
    this.newsCache.clear();
  }

  /**
   * FUTURES-SPECIFIC methods
   */
  public setLeverage(leverage: number): void {
    this.leverage = Math.min(this.MAX_LEVERAGE, Math.max(1, leverage));
    console.log(`⚡ Leverage set to: ${this.leverage}x`);
  }

  public getCurrentLeverage(): number {
    return this.leverage;
  }

  public analyzeFuturesConditions() {
    const conditions = this.analyzeMarketConditions();
    const safeLeverage = this.calculateSafeLeverage(conditions.volatility);
    
    return {
      ...conditions,
      safeLeverage,
      liquidationRisk: this.assessLiquidationRisk(conditions.volatility),
      recommendedMaxPosition: 0.1, // 10% of portfolio max
      fundingRateImpact: 'low' // Simulated
    };
  }

  private assessLiquidationRisk(volatility: number): 'low' | 'medium' | 'high' {
    if (volatility < 30) return 'low';
    if (volatility < 55) return 'medium';
    return 'high';
  }
}

export const strategyAI = new StrategyAI();