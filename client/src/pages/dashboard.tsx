import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/stat-card";
import { AdvancedChart } from "@/components/advanced-chart";
import { TradeHistory } from "@/components/trade-history";
import { BotControls } from "@/components/bot-controls";
import { Navigation } from "@/components/navigation";
import { LanguageSelector } from "@/components/language-selector";
import { CoinSelector } from "@/components/coin-selector";
import { CoinPriceSlider } from "@/components/coin-price-slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWebSocket } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { 
  Wallet, 
  TrendingUp, 
  Activity, 
  Target, 
  BarChart3, 
  Trophy,
  Calendar,
  PieChart
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Portfolio, BotState, Trade, StrategyType, TradingMode, AIDecision } from "@shared/schema";

export default function Dashboard() {
  const { t } = useTranslation();
  const [uptime, setUptime] = useState(0);
  const [latestAIDecision, setLatestAIDecision] = useState<AIDecision | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<string>('BTC/USDT');
  const { toast } = useToast();
  const { subscribe } = useWebSocket();

  // Fetch portfolio data
  const { data: portfolio, isLoading: portfolioLoading } = useQuery<Portfolio>({
    queryKey: ['/api/portfolio'],
    refetchInterval: 2000,
  });

  console.log('Portfolio Data:', portfolio);
  // Fetch bot state
  const { data: botState, isLoading: botLoading } = useQuery<BotState>({
    queryKey: ['/api/bot/status'],
    refetchInterval: 1000,
  });
  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ['/api/trades'],
    refetchInterval: 2000,
  });

  // Start bot mutation
  const startBotMutation = useMutation({
    mutationFn: async ({ strategy, mode }: { strategy: StrategyType; mode: TradingMode }) => {
      const response = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, mode }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to start bot');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
      toast({
        title: t('common.success'),
        description: t('bot.messages.started'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('bot.messages.startFailed'),
        variant: "destructive",
      });
    },
  });

  // Stop bot mutation
  const stopBotMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/bot/stop', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
      toast({
        title: t('common.success'),
        description: t('bot.messages.stopped'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('bot.messages.stopFailed'),
        variant: "destructive",
      });
    },
  });

  // Change strategy mutation
  const changeStrategyMutation = useMutation({
    mutationFn: async (strategy: StrategyType) => {
      return await apiRequest('POST', '/api/bot/strategy', { strategy });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
      toast({
        title: "Strategy Updated",
        description: "Trading strategy has been changed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change strategy",
        variant: "destructive",
      });
    },
  });

  // Toggle AI mutation
  const toggleAIMutation = useMutation<BotState, Error, boolean, { previousBotState?: BotState }>({
    mutationFn: async (enabled: boolean): Promise<BotState> => {
      const response = await apiRequest('POST', '/api/ai/toggle', { enabled });
      return await response.json();
    },
    onMutate: async (enabled) => {
      // Cancel outgoing refetches to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/bot/status'] });
      
      // Snapshot previous value
      const previousBotState = queryClient.getQueryData<BotState>(['/api/bot/status']);
      
      // Optimistically update to new value
      queryClient.setQueryData<BotState>(['/api/bot/status'], (old) => 
        old ? { ...old, aiEnabled: enabled } : old
      );
      
      return { previousBotState };
    },
    onSuccess: (data) => {
      // Update with server response
      queryClient.setQueryData<BotState>(['/api/bot/status'], data);
      toast({
        title: data.aiEnabled ? "AI Enabled" : "AI Disabled",
        description: data.aiEnabled 
          ? "AI will now analyze market conditions and recommend strategies" 
          : "Manual strategy selection active",
      });
    },
    onError: (error, _enabled, context) => {
      // Rollback on error
      if (context?.previousBotState) {
        queryClient.setQueryData(['/api/bot/status'], context.previousBotState);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to toggle AI",
        variant: "destructive",
      });
    },
  });

  // Change trading mode mutation
  const changeTradingModeMutation = useMutation({
    mutationFn: async (mode: TradingMode) => {
      const response = await apiRequest('POST', '/api/trading-mode', { 
        mode,
        confirmation: mode === 'real' ? true : undefined
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trading-mode'] });
      toast({
        title: t('common.success'),
        description: t('bot.messages.modeChanged'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('bot.messages.modeChangeFailed'),
        variant: "destructive",
      });
    },
  });

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubscribePrices = subscribe('price_update', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chart'] });
    });

    const unsubscribeTrades = subscribe('trade_executed', (trade: Trade) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });

      // Show toast notification for new trade
      const isProfit = trade.profit >= 0;
      toast({
        title: `${trade.type} ${trade.symbol}`,
        description: `${isProfit ? 'Profit' : 'Loss'}: ${isProfit ? '+' : ''}$${trade.profit?.toFixed(2)} (${isProfit ? '+' : ''}${trade.profitPercent?.toFixed(2)}%)`,
        variant: isProfit ? "default" : "destructive",
      });
    });

    const unsubscribeAI = subscribe('ai_decision', (decision: AIDecision) => {
      // Only update if AI is enabled
      const currentBotState = queryClient.getQueryData<BotState>(['/api/bot/status']);
      if (currentBotState?.aiEnabled) {
        setLatestAIDecision(decision);
        
        // Show toast notification if strategy changed
        if (botState?.strategy !== decision.selectedStrategy) {
          toast({
            title: "AI Strategy Recommendation",
            description: `AI suggests switching to ${decision.selectedStrategy.toUpperCase()} strategy (${decision.confidence}% confidence)`,
          });
        }
      }
    });

    return () => {
      unsubscribePrices();
      unsubscribeTrades();
      unsubscribeAI();
    };
  }, [subscribe, toast, botState?.strategy]);

  // Update uptime counter
  useEffect(() => {
    if (!botState || botState.status !== 'running' || !botState.startTime) {
      setUptime(0);
      return;
    }

    const updateUptime = () => {
      const elapsed = Math.floor((Date.now() - botState.startTime!) / 1000);
      setUptime(elapsed);
    };

    updateUptime();
    const interval = setInterval(updateUptime, 1000);

    return () => clearInterval(interval);
  }, [botState?.status, botState?.startTime]);

  const handleStart = (strategy: StrategyType, mode: TradingMode) => {
    startBotMutation.mutate({ strategy, mode });
  };

  const handleStop = () => {
    stopBotMutation.mutate();
  };

  const handleStrategyChange = (strategy: StrategyType) => {
    changeStrategyMutation.mutate(strategy);
  };

  const handleAIToggle = (enabled: boolean) => {
    toggleAIMutation.mutate(enabled);
    // Clear AI decision display when disabling AI
    if (!enabled) {
      setLatestAIDecision(null);
    }
  };

  const handleModeChange = (mode: TradingMode) => {
    changeTradingModeMutation.mutate(mode);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 5 : 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value?.toFixed(2)}%`;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-app-title">{t('dashboard.title')}</h1>
              <p className="text-sm text-muted-foreground" data-testid="text-app-subtitle">
                {t('dashboard.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSelector />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t('dashboard.currentBalance')}</p>
                <p className="text-xl font-bold tabular-nums" data-testid="text-header-balance">
                  {portfolio ? formatCurrency(portfolio.balance) : '$0.00'}
                </p>
              </div>
              <div className={`h-3 w-3 rounded-full ${
                botState?.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
              }`} data-testid="indicator-header-bot-status"></div>
            </div>
          </div>
          <Navigation />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title={portfolio?.realMode ? t('dashboard.realBalance') || 'Real Balance' : t('dashboard.balance')}
            value={portfolio ? formatCurrency(portfolio.balance) : '$0.00'}
            change={portfolio?.totalProfit}
            changePercent={portfolio?.totalProfitPercent}
            icon={<Wallet className="h-4 w-4" />}
            isLoading={portfolioLoading}
            data-testid="stat-balance"
          />
          <StatCard
            title={t('dashboard.profit') || "Daily Profit"}
            value={portfolio ? formatCurrency(portfolio.dailyProfit) : '$0.00'}
            change={portfolio?.dailyProfit}
            changePercent={portfolio?.dailyProfitPercent}
            icon={<TrendingUp className="h-4 w-4" />}
            isLoading={portfolioLoading}
          />
          <StatCard
            title={t('dashboard.trades') || "Open Positions"}
            value={portfolio?.openPositions?.toString() || '0'}
            subtitle={`Total: ${portfolio?.totalTrades || 0}`}
            icon={<Activity className="h-4 w-4" />}
            isLoading={portfolioLoading}
          />
          <StatCard
            title={t('dashboard.winRate') || "Win Rate"}
            value={portfolio ? formatPercent(portfolio.winRate) : '0.0%'}
            subtitle={`${portfolio?.winningTrades || 0}W / ${portfolio?.losingTrades || 0}L`}
            icon={<Target className="h-4 w-4" />}
            isLoading={portfolioLoading}
          />
        </div>

        {/* Detailed Portfolio Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Total Profit Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Profit/Loss</p>
                  <p className={`text-2xl font-bold ${(portfolio?.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {portfolio ? formatCurrency(portfolio.totalProfit) : '$0.00'}
                  </p>
                  <p className={`text-sm ${(portfolio?.totalProfitPercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {portfolio ? formatPercent(portfolio.totalProfitPercent) : '0.00%'}
                  </p>
                </div>
                <TrendingUp className={`h-8 w-8 ${(portfolio?.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </CardContent>
          </Card>

          {/* Initial Balance Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Initial Balance</p>
                  <p className="text-2xl font-bold text-foreground">
                    {portfolio ? formatCurrency(portfolio.initialBalance) : '$0.00'}
                  </p>
                  <p className="text-sm text-muted-foreground">Starting Capital</p>
                </div>
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Trade Performance Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Trade Performance</p>
                  <p className="text-2xl font-bold text-foreground">
                    {portfolio?.totalTrades || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {portfolio?.winningTrades || 0} Wins • {portfolio?.losingTrades || 0} Losses
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Summary Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Best Performing Coin */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Best Performing Coin
              </CardTitle>
            </CardHeader>
            <CardContent>
              {portfolio?.bestPerformingCoin ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Coin</span>
                    <span className="text-lg font-bold text-foreground bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                      {portfolio.bestPerformingCoin}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Performance</span>
                    <span className="text-lg font-bold text-green-600">
                      Top Performer
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No performance data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trading Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-blue-500" />
                Trading Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Trading Mode</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    portfolio?.realMode 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' 
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                  }`}>
                    {portfolio?.realMode ? 'REAL' : 'PAPER'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Win Rate</span>
                  <span className={`text-sm font-bold ${(portfolio?.winRate || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {portfolio ? formatPercent(portfolio.winRate) : '0.00%'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Trades</span>
                  <span className="text-sm font-bold">{portfolio?.totalTrades || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Profit/Loss Ratio</span>
                  <span className="text-sm font-bold">
                    {portfolio?.winningTrades || 0}:{portfolio?.losingTrades || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Performance Breakdown */}
        {/* <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Performance Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-2xl font-bold text-foreground">{portfolio?.totalTrades || 0}</p>
                <p className="text-xs text-muted-foreground">Total Trades</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-2xl font-bold text-green-600">{portfolio?.winningTrades || 0}</p>
                <p className="text-xs text-muted-foreground">Winning Trades</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <p className="text-2xl font-bold text-red-600">{portfolio?.losingTrades || 0}</p>
                <p className="text-xs text-muted-foreground">Losing Trades</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <p className="text-2xl font-bold text-blue-600">
                  {portfolio ? formatPercent(portfolio.winRate) : '0.00%'}
                </p>
                <p className="text-xs text-muted-foreground">Win Rate</p>
              </div>
            </div>
            
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Performance Progress</span>
                <span className="font-medium">{portfolio ? portfolio.winRate.toFixed(1) : '0'}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(portfolio?.winRate || 0, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card> */}

        {/* Bot Uptime & Status */}
        {botState?.status === 'running' && (
          <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-300">Bot is Running</p>
                    <p className="text-sm text-muted-foreground">
                      Strategy: <span className="font-medium">{botState.strategy}</span> • 
                      Mode: <span className="font-medium">{botState.mode}</span> • 
                      Uptime: <span className="font-medium">{formatUptime(uptime)}</span>
                    </p>
                  </div>
                </div>
                {botState.aiEnabled && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900 rounded-full">
                    <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse"></div>
                    <span className="text-xs font-medium text-purple-800 dark:text-purple-300">AI Enabled</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Animated Coin Price Slider */}
        <div className="mb-6">
          <CoinPriceSlider />
        </div>

        {/* Bot Controls */}
        <div className="mb-6">
          {botState && (
            <BotControls
              botState={{ ...botState, uptime }}
              onStart={handleStart}
              onStop={handleStop}
              onModeChange={handleModeChange}
              onStrategyChange={handleStrategyChange}
              onAIToggle={handleAIToggle}
              latestAIDecision={latestAIDecision}
              isLoading={startBotMutation.isPending || stopBotMutation.isPending || changeStrategyMutation.isPending || toggleAIMutation.isPending || changeTradingModeMutation.isPending}
            />
          )}
        </div>

        {/* Real Binance Balance Breakdown - Only show in real mode */}
        {portfolio?.realMode && portfolio?.assets && Object.keys(portfolio.assets).length > 0 && (
          <Card className="p-6 mb-6" data-testid="card-real-assets">
            <h3 className="text-lg font-semibold mb-4">Real Binance Assets</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(portfolio.assets)
                .sort(([, a], [, b]) => b - a)
                .map(([asset, amount]) => (
                  <div key={asset} className="p-3 rounded-md bg-muted/30 border border-border" data-testid={`asset-${asset}`}>
                    <div className="text-xs text-muted-foreground font-medium mb-1">{asset}</div>
                    <div className="text-sm font-bold tabular-nums">{amount}</div>
                  </div>
                ))}
            </div>
          </Card>
        )}

        {/* Charts and Trade History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">{t('chart.title') || 'Price Chart'}</h2>
              <CoinSelector value={selectedCoin} onValueChange={setSelectedCoin} />
            </div>
            <AdvancedChart 
              symbol={selectedCoin}
              defaultTimeframe="5m"
            />
          </div>
          <div>
            <TradeHistory trades={trades} isLoading={tradesLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}