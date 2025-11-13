import type { StrategyType, PriceData, MarketConditions, StrategyScore, AIDecision } from "@shared/schema";
import { randomUUID } from "crypto";

/**
 * ADVANCED AI with 10 Trading Strategies + Real News Integration
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
      
      // Source 1: CryptoPanic API (Free crypto news aggregator)
      // await this.fetchCryptoPanicNews();
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
        console.warn(`⚠️ Failed to fetch from /r/${subreddit}:`, error.message);
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
  private async fetchCryptoPanicNews(): Promise<void> {
    try {
      // CryptoPanic free API (no key required for basic usage)
      const response = await fetch('https://cryptopanic.com/api/v1/posts/?auth_token=44e26097056b763f7f2865973d064c856e9caa5c&public=true');
      
      if (!response.ok) {
        throw new Error(`CryptoPanic API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.results) {
        data.results.forEach((post: any) => {
          if (post.title && post.currencies) {
            const sentiment = this.analyzeNewsSentiment(post.title);
            post.currencies.forEach((currency: any) => {
              if (currency.code) {
                const symbol = `${currency.code}/USDT`;
                this.newsCache.set(symbol, {
                  sentiment,
                  relevance: this.calculateNewsRelevance(post.title, currency.code),
                  timestamp: Date.now()
                });
              }
            });
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ CryptoPanic API unavailable, using fallback');
      throw error;
    }
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

  private calculateNewsRelevance(headline: string, coin: string): number {
    const text = headline.toLowerCase();
    const coinName = coin.toLowerCase();
    
    if (text.includes(coinName)) return 90;
    if (text.includes(coinName.slice(0, 3))) return 70;
    
    const cryptoTerms = ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'digital currency'];
    if (cryptoTerms.some(term => text.includes(term))) return 50;
    
    return 30;
  }

  private getNewsSentiment(symbol: string): { sentiment: number; relevance: number } {
    const news = this.newsCache.get(symbol);
    if (!news || Date.now() - news.timestamp > 3600000) { // 1 hour expiry
      return { sentiment: 0, relevance: 0 };
    }
    return news;
  }

  /**
   * Enhanced market analysis with news integration
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

   public scoreStrategies(conditions: MarketConditions): StrategyScore[] {
    console.log("🤖 AI STRATEGY SELECTION DEBUG:");
    console.log(`📊 Market Conditions: ${conditions.marketRegime}, Trend: ${conditions.trendStrength.toFixed(1)}, Vol: ${conditions.volatility.toFixed(1)}%`);
    
    const scores: StrategyScore[] = [];
    const { marketRegime, volatility, trendStrength, momentum, volumeTrend, newsSentiment, newsActivity, trendingRatio, volatilityRatio } = conditions;

    // 1. TREND FOLLOWING Strategy - BOOSTED in trending markets
    let trendScore = 45; // Increased from 40
    const trendReasons: string[] = [];
    if (Math.abs(trendStrength) > 15) { // Lower threshold
      trendScore += 40; // Increased from 35
      trendReasons.push(`Strong ${trendStrength > 0 ? 'bullish' : 'bearish'} trend (${Math.abs(trendStrength).toFixed(1)})`);
    }
    if (trendingRatio > 0.5) { // Lower threshold
      trendScore += 30; // Increased from 25
      trendReasons.push(`Many coins trending (${(trendingRatio * 100).toFixed(0)}%)`);
    }
    if (marketRegime === 'bull' || marketRegime === 'bear') {
      trendScore += 25; // Increased from 20
      trendReasons.push(`${marketRegime.toUpperCase()} market ideal for trend following`);
    }
    scores.push({
      strategy: 'trend',
      score: Math.max(0, Math.min(100, trendScore)),
      reasons: trendReasons,
      confidence: this.calculateConfidence(conditions, trendScore),
    });

    // 2. BREAKOUT Strategy - BOOSTED
    let breakoutScore = 40; // Increased from 35
    const breakoutReasons: string[] = [];
    if (volatility > 35) { // Lower threshold
      breakoutScore += 35; // Increased from 30
      breakoutReasons.push(`High volatility (${volatility.toFixed(1)}%) enables breakouts`);
    }
    if (volumeTrend > 15) { // Lower threshold
      breakoutScore += 30; // Increased from 25
      breakoutReasons.push(`High volume surge (${volumeTrend.toFixed(1)}%) supports breakouts`);
    }
    if (volatilityRatio > 0.4) { // Lower threshold
      breakoutScore += 25; // Increased from 20
      breakoutReasons.push(`Many volatile coins (${(volatilityRatio * 100).toFixed(0)}%)`);
    }
    scores.push({
      strategy: 'breakout',
      score: Math.max(0, Math.min(100, breakoutScore)),
      reasons: breakoutReasons,
      confidence: this.calculateConfidence(conditions, breakoutScore),
    });

    // 3. MEAN REVERSION Strategy - REDUCED base score and added penalties
    let meanReversionScore = 35; // REDUCED from 45
    const meanReversionReasons: string[] = [];
    if (Math.abs(trendStrength) < 12) { // Tighter range
      meanReversionScore += 25; // Reduced from 30
      meanReversionReasons.push('Weak trends perfect for mean reversion');
    }
    if (volatility >= 25 && volatility <= 50) { // Tighter range
      meanReversionScore += 20; // Reduced from 25
      meanReversionReasons.push(`Ideal volatility range (${volatility.toFixed(1)}%)`);
    }
    if (marketRegime === 'neutral') {
      meanReversionScore += 15; // Reduced from 20
      meanReversionReasons.push('Neutral market optimal for mean reversion');
    }
    // PENALTIES in trending markets
    if (Math.abs(trendStrength) > 25) {
      meanReversionScore -= 20;
      meanReversionReasons.push('Strong trend unfavorable for mean reversion');
    }
    scores.push({
      strategy: 'mean_reversion',
      score: Math.max(0, Math.min(100, meanReversionScore)),
      reasons: meanReversionReasons,
      confidence: this.calculateConfidence(conditions, meanReversionScore),
    });

    // 4. SCALPING Strategy
    let scalpingScore = 45;
    const scalpingReasons: string[] = [];
    if (volatility >= 12 && volatility <= 45) { // Wider range
      scalpingScore += 35;
      scalpingReasons.push(`Good volatility for scalping (${volatility.toFixed(1)}%)`);
    }
    if (volumeTrend > 12) { // Lower threshold
      scalpingScore += 30;
      scalpingReasons.push(`High liquidity (${volumeTrend.toFixed(1)}% volume)`);
    }
    if (Math.abs(momentum) < 25) { // Higher threshold
      scalpingScore += 25;
      scalpingReasons.push('Moderate momentum reduces risk');
    }
    scores.push({
      strategy: 'scalping',
      score: Math.max(0, Math.min(100, scalpingScore)),
      reasons: scalpingReasons,
      confidence: this.calculateConfidence(conditions, scalpingScore),
    });

    // 5. MOMENTUM Strategy - BOOSTED
    let momentumScore = 40; // Increased from 35
    const momentumReasons: string[] = [];
    if (Math.abs(momentum) > 15) { // Lower threshold
      momentumScore += 40; // Increased from 35
      momentumReasons.push(`Strong momentum (${momentum.toFixed(1)})`);
    }
    if (volumeTrend > 20) { // Lower threshold
      momentumScore += 30; // Increased from 25
      momentumReasons.push(`Volume confirms momentum (${volumeTrend.toFixed(1)}%)`);
    }
    if (trendingRatio > 0.45) { // Lower threshold
      momentumScore += 25; // Increased from 20
      momentumReasons.push(`Many momentum coins (${(trendingRatio * 100).toFixed(0)}%)`);
    }
    scores.push({
      strategy: 'momentum',
      score: Math.max(0, Math.min(100, momentumScore)),
      reasons: momentumReasons,
      confidence: this.calculateConfidence(conditions, momentumScore),
    });

    // 6. SWING TRADING Strategy
    let swingScore = 45;
    const swingReasons: string[] = [];
    if (volatility >= 20 && volatility <= 65) { // Wider range
      swingScore += 35;
      swingReasons.push(`Ideal swing volatility (${volatility.toFixed(1)}%)`);
    }
    if (Math.abs(trendStrength) >= 12 && Math.abs(trendStrength) <= 35) { // Adjusted range
      swingScore += 30;
      swingReasons.push(`Good trend strength for swings (${Math.abs(trendStrength).toFixed(1)})`);
    }
    if (marketRegime !== 'extreme') {
      swingScore += 25;
      swingReasons.push('Stable market conditions');
    }
    scores.push({
      strategy: 'swing',
      score: Math.max(0, Math.min(100, swingScore)),
      reasons: swingReasons,
      confidence: this.calculateConfidence(conditions, swingScore),
    });

    // 7. ARBITRAGE Strategy
    let arbitrageScore = 30;
    const arbitrageReasons: string[] = [];
    if (volatility > 45) {
      arbitrageScore += 25;
      arbitrageReasons.push('High volatility creates arbitrage opportunities');
    }
    if (marketRegime === 'volatile') {
      arbitrageScore += 30;
      arbitrageReasons.push('Volatile market ideal for arbitrage');
    }
    if (volumeTrend > 35) {
      arbitrageScore += 20;
      arbitrageReasons.push('High volume improves arbitrage execution');
    }
    scores.push({
      strategy: 'arbitrage',
      score: Math.max(0, Math.min(100, arbitrageScore)),
      reasons: arbitrageReasons,
      confidence: this.calculateConfidence(conditions, arbitrageScore),
    });

    // 8. PAIR TRADING Strategy
    let pairScore = 35;
    const pairReasons: string[] = [];
    if (Math.abs(trendStrength) < 18) {
      pairScore += 35;
      pairReasons.push('Weak overall trends good for pair trading');
    }
    if (volatility < 55) {
      pairScore += 30;
      pairReasons.push('Moderate volatility reduces pair risk');
    }
    if (trendingRatio < 0.35) {
      pairScore += 20;
      pairReasons.push('Low trending ratio favorable for pairs');
    }
    scores.push({
      strategy: 'pair',
      score: Math.max(0, Math.min(100, pairScore)),
      reasons: pairReasons,
      confidence: this.calculateConfidence(conditions, pairScore),
    });

    // 9. SENTIMENT Strategy
    let sentimentScore = 40;
    const sentimentReasons: string[] = [];
    if (volumeTrend > 25) {
      sentimentScore += 25;
      sentimentReasons.push(`High volume indicates strong sentiment (${volumeTrend.toFixed(1)}%)`);
    }
    if (Math.abs(newsSentiment) > 15) { // Lower threshold
      sentimentScore += 30;
      sentimentReasons.push(`Strong news sentiment: ${newsSentiment > 0 ? 'bullish' : 'bearish'} (${newsSentiment.toFixed(1)})`);
    }
    if (newsActivity > 0.35) { // Lower threshold
      sentimentScore += 25;
      sentimentReasons.push(`High news activity (${(newsActivity * 100).toFixed(0)}% of coins)`);
    }
    scores.push({
      strategy: 'sentiment',
      score: Math.max(0, Math.min(100, sentimentScore)),
      reasons: sentimentReasons,
      confidence: this.calculateConfidence(conditions, sentimentScore),
    });

    // 10. NEWS Strategy
    let newsScore = 35;
    const newsReasons: string[] = [];
    if (volatility > 30) { // Lower threshold
      newsScore += 25;
      newsReasons.push(`Volatile market reacts strongly to news (${volatility.toFixed(1)}%)`);
    }
    if (Math.abs(newsSentiment) > 20) { // Lower threshold
      newsScore += 35;
      newsReasons.push(`Strong news catalyst: ${newsSentiment > 0 ? 'positive' : 'negative'} (${Math.abs(newsSentiment).toFixed(1)})`);
    }
    if (newsActivity > 0.45) { // Lower threshold
      newsScore += 25;
      newsReasons.push(`Active news environment (${(newsActivity * 100).toFixed(0)}% of coins)`);
    }
    scores.push({
      strategy: 'news',
      score: Math.max(0, Math.min(100, newsScore)),
      reasons: newsReasons,
      confidence: this.calculateConfidence(conditions, newsScore),
    });

    const sortedScores = scores.sort((a, b) => b.score - a.score);
    
    // DEBUG: Show top 3 strategies
    console.log(`🏆 Top 3 Strategies: ${sortedScores.slice(0, 3).map(s => `${s.strategy}(${s.score})`).join(', ')}`);
    
    return sortedScores;
  }

  /**
   * Smart coin selection for each strategy
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

      // Budget adjustment
      if (budget < 200) {
        const currentPrice = history[history.length - 1].price;
        if (currentPrice < 20) {
          score += 10;
          reasons.push('Affordable for small budget');
        }
      }

      if (score > 30) {
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
      .slice(0, 5)
      .map(coin => coin.symbol);

    console.log(`🎯 ${strategy.toUpperCase()} Strategy selected ${selectedCoins.length} coins`);
    return selectedCoins;
  }


  /**
   * STRATEGY DIVERSITY ENFORCEMENT
   */
  private enforceStrategyDiversity(strategyScores: StrategyScore[], currentStrategy: string): StrategyScore[] {
    const now = Date.now();
    
    // Force strategy rotation every 15 minutes if mean_reversion dominates
    if (now - this.lastStrategyRotation > this.STRATEGY_ROTATION_INTERVAL) {
      const topStrategies = strategyScores.slice(0, 3);
      const meanReversionInTop = topStrategies.filter(s => s.strategy === 'mean_reversion').length;
      
      if (meanReversionInTop >= 2) {
        console.log("🔄 ENFORCING STRATEGY DIVERSITY: Mean reversion dominating top 3");
        
        // Find best alternative strategy with score > 60
        const alternative = strategyScores.find(s => 
          s.strategy !== 'mean_reversion' && 
          s.score >= 60 &&
          !topStrategies.includes(s)
        );
        
        if (alternative) {
          // Boost the alternative strategy to top
          const boostedScores = strategyScores.map(score => {
            if (score.strategy === alternative.strategy) {
              return { ...score, score: Math.min(100, score.score + 15) };
            }
            if (score.strategy === 'mean_reversion') {
              return { ...score, score: Math.max(0, score.score - 10) };
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
   * Strategy-specific scoring methods
   */
private scoreForTrendStrategy(metrics: any, reasons: string[]): number {
  let score = 0;
  if (Math.abs(metrics.trendStrength) > 20) { // Changed from 25 to match scoreStrategies
    score += 45; // Increased to match
    reasons.push(`Strong trend: ${metrics.trendStrength.toFixed(1)}`);
  }
  if (metrics.momentum > 8) { // Changed from 10
    score += 30; // Increased
    reasons.push(`Good momentum: ${metrics.momentum.toFixed(1)}%`);
  }
  if (metrics.volumeStrength > 12) { // Changed from 15
    score += 25; // Increased
    reasons.push(`Volume confirmation: ${metrics.volumeStrength.toFixed(1)}%`);
  }
  return score;
}

  private scoreForBreakoutStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volatility > 35) {
      score += 35;
      reasons.push(`High volatility: ${metrics.volatility.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 25) {
      score += 30;
      reasons.push(`Volume surge: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    if (metrics.consolidation) {
      score += 25;
      reasons.push('Consolidation pattern detected');
    }
    return score;
  }

  private scoreForMeanReversionStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (Math.abs(metrics.trendStrength) < 20) {
      score += 35;
      reasons.push('Weak trend - good for reversion');
    }
    if (metrics.rsi < 30 || metrics.rsi > 70) {
      score += 30;
      reasons.push(`Extreme RSI: ${metrics.rsi.toFixed(1)}`);
    }
    if (metrics.volatility < 50) {
      score += 25;
      reasons.push(`Controlled volatility: ${metrics.volatility.toFixed(1)}%`);
    }
    return score;
  }

  private scoreForScalpingStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volatility >= 10 && metrics.volatility <= 40) {
      score += 35;
      reasons.push(`Ideal scalping volatility: ${metrics.volatility.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 20) {
      score += 30;
      reasons.push(`High liquidity: ${metrics.volumeStrength.toFixed(1)}% volume`);
    }
    if (metrics.spread < 0.1) {
      score += 25;
      reasons.push('Low spread');
    }
    return score;
  }

  private scoreForMomentumStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (Math.abs(metrics.momentum) > 15) {
      score += 40;
      reasons.push(`Strong momentum: ${metrics.momentum.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 20) {
      score += 30;
      reasons.push(`Volume momentum: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    if (metrics.trendStrength * metrics.momentum > 0) {
      score += 20;
      reasons.push('Trend and momentum aligned');
    }
    return score;
  }

  private scoreForSwingStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volatility >= 20 && metrics.volatility <= 60) {
      score += 35;
      reasons.push(`Good swing volatility: ${metrics.volatility.toFixed(1)}%`);
    }
    if (Math.abs(metrics.trendStrength) >= 10 && Math.abs(metrics.trendStrength) <= 35) {
      score += 30;
      reasons.push(`Swing-friendly trend: ${metrics.trendStrength.toFixed(1)}`);
    }
    if (metrics.supportResistanceStrength > 50) {
      score += 25;
      reasons.push('Clear support/resistance levels');
    }
    return score;
  }

  private scoreForArbitrageStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volatility > 45) {
      score += 40;
      reasons.push(`High volatility: ${metrics.volatility.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 30) {
      score += 35;
      reasons.push(`High volume: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    score += 25; // Base score for arbitrage potential
    reasons.push('Arbitrage opportunities possible');
    return score;
  }

  private scoreForPairStrategy(metrics: any, reasons: string[]): number {
    let score = 0;
    if (Math.abs(metrics.trendStrength) < 25) {
      score += 35;
      reasons.push('Weak trend - good for pairs');
    }
    if (metrics.volatility < 55) {
      score += 30;
      reasons.push(`Stable volatility: ${metrics.volatility.toFixed(1)}%`);
    }
    if (metrics.correlationPotential) {
      score += 25;
      reasons.push('Good correlation potential');
    }
    return score;
  }

  private scoreForSentimentStrategy(metrics: any, news: any, reasons: string[]): number {
    let score = 0;
    if (metrics.volumeStrength > 25) {
      score += 25;
      reasons.push(`High volume indicates sentiment: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    if (news.relevance > 50 && Math.abs(news.sentiment) > 20) {
      score += 35;
      reasons.push(`Strong ${news.sentiment > 0 ? 'positive' : 'negative'} news sentiment`);
    }
    if (metrics.momentum > 10 && metrics.momentum * (news.sentiment || 1) > 0) {
      score += 20;
      reasons.push(`Momentum aligns with sentiment: ${metrics.momentum.toFixed(1)}%`);
    }
    return score;
  }

  private scoreForNewsStrategy(metrics: any, news: any, reasons: string[]): number {
    let score = 0;
    if (news.relevance > 60 && Math.abs(news.sentiment) > 25) {
      score += 50;
      reasons.push(`Strong news catalyst: ${news.sentiment > 0 ? 'bullish' : 'bearish'} (${Math.abs(news.sentiment).toFixed(1)})`);
    }
    if (metrics.volatility > 30) {
      score += 25;
      reasons.push(`News-sensitive volatility: ${metrics.volatility.toFixed(1)}%`);
    }
    if (metrics.volumeStrength > 20) {
      score += 15;
      reasons.push(`Volume reacts to news: ${metrics.volumeStrength.toFixed(1)}%`);
    }
    return score;
  }

  /**
   * FIXED: Enhanced trade signals with proper BUY/SELL logic
   */
  public generateTradeSignals(symbol: string, currentPrice: number, strategy: string, entryPrice?: number): { 
    action: 'BUY' | 'SELL' | 'HOLD'; 
    confidence: number; 
    reasons: string[];
    suggestedStopLoss?: number;
    suggestedTakeProfit?: number;
  } {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 15) {
      return { action: 'HOLD', confidence: 0, reasons: ['Insufficient data'] };
    }

    const metrics = this.calculateComprehensiveMetrics(history);
    const news = this.getNewsSentiment(symbol);
    
    // 🚨 CRITICAL FIX: Different logic for positions vs new entries
    if (entryPrice) {
      // EXISTING POSITION LOGIC - Can only HOLD or SELL
      return this.generatePositionSignals(symbol, currentPrice, entryPrice, strategy, metrics, news);
    } else {
      // NEW ENTRY LOGIC - Can only BUY or HOLD
      return this.generateEntrySignals(symbol, currentPrice, strategy, metrics, news);
    }
  }

 private generatePositionSignals(
    symbol: string, 
    currentPrice: number, 
    entryPrice: number, 
    strategy: string, 
    metrics: any,
    news: any
  ): { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number; reasons: string[]; suggestedStopLoss?: number; suggestedTakeProfit?: number; } {
    
    const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    const reasons: string[] = [];
    
    // 🚨 NEVER SELL AT LOSS
    if (profitPercent < 0) {
      const widerStopLoss = entryPrice * 0.90;
      reasons.push(`Holding at ${profitPercent.toFixed(2)}% loss - waiting for profit`);
      
      return { 
        action: 'HOLD', 
        confidence: 85, 
        reasons,
        suggestedStopLoss: widerStopLoss,
        suggestedTakeProfit: entryPrice * 1.15 // Higher target when holding at loss
      };
    }

    // Use ProfitOptimizer logic for consistency
    const profitDecision = {
      scalping: { minProfit: 3.0, maxProfit: 5.0 },
      swing: { minProfit: 12.0, maxProfit: 20.0 },
      momentum: { minProfit: 10.0, maxProfit: 18.0 },
      trend: { minProfit: 8.0, maxProfit: 15.0 },
      breakout: { minProfit: 9.0, maxProfit: 16.0 },
      mean_reversion: { minProfit: 6.0, maxProfit: 12.0 },
      safe: { minProfit: 3.5, maxProfit: 8.0 },
      balanced: { minProfit: 5.5, maxProfit: 12.0 },
      aggressive: { minProfit: 8.0, maxProfit: 20.0 },
      news: { minProfit: 8.5, maxProfit: 18.0 },
      sentiment: { minProfit: 5.0, maxProfit: 10.0 },
      arbitrage: { minProfit: 2.5, maxProfit: 6.0 },
      pair: { minProfit: 3.0, maxProfit: 8.0 }
    }[strategy] || { minProfit: 8.0, maxProfit: 15.0 };

    let shouldSell = false;
    let sellConfidence = 0;
    const sellReasons: string[] = [];

    // Take profit at minimum target
    if (profitPercent >= profitDecision.minProfit) {
      shouldSell = true;
      sellConfidence = 75 + Math.min(25, (profitPercent - profitDecision.minProfit) * 3);
      sellReasons.push(`Profit target reached: ${profitPercent.toFixed(2)}%`);
    }

    // Emergency profit taking at very high profits
    if (profitPercent >= 25) {
      shouldSell = true;
      sellConfidence = 95;
      sellReasons.push(`Emergency profit taking at ${profitPercent.toFixed(2)}% profit`);
    }

    if (shouldSell) {
      return { 
        action: 'SELL', 
        confidence: sellConfidence, 
        reasons: sellReasons,
        suggestedStopLoss: currentPrice * 0.98,
        suggestedTakeProfit: currentPrice * 1.02
      };
    }

    // Hold the position
    reasons.push(`Holding with ${profitPercent.toFixed(2)}% profit - waiting for better exit`);
    
    return { 
      action: 'HOLD', 
      confidence: 65, 
      reasons,
      suggestedStopLoss: entryPrice * 0.94, // Tighter stop loss when in profit
      suggestedTakeProfit: currentPrice * 1.10 // Higher take profit
    };
  }

  private generateEntrySignals(
    symbol: string, 
    currentPrice: number, 
    strategy: string, 
    metrics: any,
    news: any
  ): { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number; reasons: string[]; suggestedStopLoss?: number; suggestedTakeProfit?: number; } {
    
    let shouldBuy = false;
    let buyConfidence = 0;
    const reasons: string[] = [];

    // Strategy-specific entry logic
    switch (strategy) {
      case 'trend':
        if (metrics.trendStrength > 25 && metrics.momentum > 8) {
          shouldBuy = true;
          buyConfidence = 75;
          reasons.push(`Strong bullish trend: ${metrics.trendStrength.toFixed(1)}`);
          reasons.push(`Positive momentum: ${metrics.momentum.toFixed(1)}%`);
        }
        break;

      case 'breakout':
        if (metrics.breakoutSignal && metrics.volumeStrength > 20) {
          shouldBuy = true;
          buyConfidence = 80;
          reasons.push(`Breakout detected with volume confirmation`);
          reasons.push(`Volume strength: ${metrics.volumeStrength.toFixed(1)}%`);
        }
        break;

      case 'mean_reversion':
        if (metrics.rsi < 30 && metrics.trendStrength > -20) {
          shouldBuy = true;
          buyConfidence = 70;
          reasons.push(`Oversold RSI: ${metrics.rsi.toFixed(1)}`);
          reasons.push(`Not in strong downtrend: ${metrics.trendStrength.toFixed(1)}`);
        }
        break;

      case 'scalping':
        if (metrics.volatility >= 15 && metrics.volumeStrength > 25 && metrics.spread < 0.1) {
          shouldBuy = true;
          buyConfidence = 65;
          reasons.push(`Good scalping conditions`);
          reasons.push(`Volatility: ${metrics.volatility.toFixed(1)}%, Volume: ${metrics.volumeStrength.toFixed(1)}%`);
        }
        break;

      case 'momentum':
        if (metrics.momentum > 15 && metrics.volumeStrength > 20) {
          shouldBuy = true;
          buyConfidence = 78;
          reasons.push(`Strong momentum: ${metrics.momentum.toFixed(1)}%`);
          reasons.push(`Volume confirmation: ${metrics.volumeStrength.toFixed(1)}%`);
        }
        break;

      case 'swing':
        if (metrics.swingBuySignal && metrics.supportResistanceStrength > 50) {
          shouldBuy = true;
          buyConfidence = 72;
          reasons.push(`Swing buy signal detected`);
          reasons.push(`Clear support/resistance: ${metrics.supportResistanceStrength.toFixed(1)}%`);
        }
        break;

      case 'arbitrage':
        if (metrics.volatility > 45 && metrics.volumeStrength > 30) {
          shouldBuy = true;
          buyConfidence = 60;
          reasons.push(`High volatility for arbitrage: ${metrics.volatility.toFixed(1)}%`);
          reasons.push(`Good volume: ${metrics.volumeStrength.toFixed(1)}%`);
        }
        break;

      case 'pair':
        if (Math.abs(metrics.trendStrength) < 25 && metrics.volatility < 55) {
          shouldBuy = true;
          buyConfidence = 63;
          reasons.push(`Weak trend good for pairs: ${metrics.trendStrength.toFixed(1)}`);
          reasons.push(`Stable volatility: ${metrics.volatility.toFixed(1)}%`);
        }
        break;

      case 'sentiment':
        if ((news.relevance > 50 && news.sentiment > 20) || metrics.volumeStrength > 30) {
          shouldBuy = true;
          buyConfidence = 68;
          if (news.relevance > 50) reasons.push(`Positive news sentiment: ${news.sentiment.toFixed(1)}`);
          if (metrics.volumeStrength > 30) reasons.push(`High volume indicates sentiment: ${metrics.volumeStrength.toFixed(1)}%`);
        }
        break;

      case 'news':
        if (news.relevance > 60 && news.sentiment > 25) {
          shouldBuy = true;
          buyConfidence = 75;
          reasons.push(`Strong positive news catalyst: ${news.sentiment.toFixed(1)}`);
          reasons.push(`High relevance: ${news.relevance.toFixed(1)}%`);
        }
        break;

      default:
        if (metrics.trendStrength > 20 && metrics.momentum > 5 && metrics.volumeStrength > 15) {
          shouldBuy = true;
          buyConfidence = 70;
          reasons.push(`Favorable market conditions`);
          reasons.push(`Trend: ${metrics.trendStrength.toFixed(1)}, Momentum: ${metrics.momentum.toFixed(1)}%`);
        }
    }

    // Additional safety filters
    if (shouldBuy) {
      // Avoid buying in extreme conditions
      if (metrics.volatility > 80) {
        shouldBuy = false;
        reasons.push(`Volatility too high: ${metrics.volatility.toFixed(1)}% - too risky`);
        buyConfidence = 0;
      }
      
      if (metrics.rsi > 80) {
        shouldBuy = false;
        reasons.push(`RSI overbought: ${metrics.rsi.toFixed(1)} - waiting for pullback`);
        buyConfidence = 0;
      }

      // News-specific safety
      if (strategy === 'news' || strategy === 'sentiment') {
        if (news.relevance < 40) {
          shouldBuy = false;
          reasons.push(`News relevance too low: ${news.relevance.toFixed(1)}%`);
          buyConfidence = 0;
        }
      }
    }

    if (shouldBuy && buyConfidence > 50) {
      const stopLoss = currentPrice * 0.93;
      const takeProfit = currentPrice * 1.08;
      
      reasons.push(`Stop loss: $${stopLoss.toFixed(2)} | Take profit: $${takeProfit.toFixed(2)}`);
      
      return { 
        action: 'BUY', 
        confidence: buyConfidence, 
        reasons,
        suggestedStopLoss: stopLoss,
        suggestedTakeProfit: takeProfit
      };
    }

    // No good entry signal - HOLD
    if (reasons.length === 0) {
      reasons.push('Market conditions not optimal for entry');
      reasons.push(`Current metrics - Trend: ${metrics.trendStrength.toFixed(1)}, RSI: ${metrics.rsi.toFixed(1)}, Vol: ${metrics.volatility.toFixed(1)}%`);
    }
    
    return { 
      action: 'HOLD', 
      confidence: 40, 
      reasons,
      suggestedStopLoss: undefined,
      suggestedTakeProfit: undefined
    };
  }

  // ADD THIS MISSING FUNCTION to strategy-ai.ts
private calculateExpectedWinRate(strategy: string, conditions: MarketConditions): number {
  const baseRates: Record<string, number> = {
    trend: 68, breakout: 65, mean_reversion: 65, scalping: 62, momentum: 66,
    swing: 67, arbitrage: 58, pair: 62, sentiment: 60, news: 59
  };
  let winRate = baseRates[strategy] || 50;
  if (conditions.marketRegime === 'bull') winRate += 12;
  if (conditions.marketRegime === 'bear') winRate -= 4;
  if (conditions.newsSentiment > 20) winRate += 8;
  return Math.max(45, Math.min(85, winRate));
}

  /**
   * Select best strategy and coins
   */
public selectBestStrategy(currentStrategy: StrategyType): AIDecision {
    const conditions = this.analyzeMarketConditions();
    let strategyScores = this.scoreStrategies(conditions);
    
    // Apply diversity enforcement
    strategyScores = this.enforceStrategyDiversity(strategyScores, currentStrategy);
    
    const bestStrategy = strategyScores[0];
    
    const reasoning = this.buildReasoning(conditions, strategyScores, bestStrategy);
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
    
    return decision;
  }



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
      if (trendStrength > 25) return 'bull'; // Lower threshold from ~30
      if (trendStrength < -25) return 'bear'; // Lower threshold
      if (Math.abs(trendStrength) < 12) return 'neutral'; // Tighter range
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

  private buildReasoning(conditions: MarketConditions, scores: StrategyScore[], selectedScore: StrategyScore): string {
    const topStrategies = scores.slice(0, 3).map(s => `${s.strategy} (${s.score})`).join(', ');
    return `Market: ${conditions.marketRegime} | Volatility: ${conditions.volatility.toFixed(1)}% | News: ${conditions.newsSentiment.toFixed(1)} | Top Strategies: ${topStrategies}`;
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
}

export const strategyAI = new StrategyAI();