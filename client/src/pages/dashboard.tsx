import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { PriceChart } from "@/components/price-chart";
import { TradeHistory } from "@/components/trade-history";
import { BotControls } from "@/components/bot-controls";
import { useWebSocket } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { Wallet, TrendingUp, Activity, Target } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Portfolio, BotState, Trade, ChartDataPoint, StrategyType, TradingMode, AIDecision } from "@shared/schema";

export default function Dashboard() {
  const [uptime, setUptime] = useState(0);
  const [latestAIDecision, setLatestAIDecision] = useState<AIDecision | null>(null);
  const { toast } = useToast();
  const { subscribe } = useWebSocket();

  // Fetch portfolio data
  const { data: portfolio, isLoading: portfolioLoading } = useQuery<Portfolio>({
    queryKey: ['/api/portfolio'],
    refetchInterval: 2000,
  });

  // Fetch bot state
  const { data: botState, isLoading: botLoading } = useQuery<BotState>({
    queryKey: ['/api/bot/status'],
    refetchInterval: 1000,
  });

  // Fetch trades
  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ['/api/trades'],
    refetchInterval: 2000,
  });

  // Fetch chart data
  const { data: chartData = [], isLoading: chartLoading } = useQuery<ChartDataPoint[]>({
    queryKey: ['/api/chart'],
    refetchInterval: 5000,
  });

  // Start bot mutation
  const startBotMutation = useMutation({
    mutationFn: async ({ strategy, mode }: { strategy: StrategyType; mode: TradingMode }) => {
      return await apiRequest('POST', '/api/bot/start', { strategy, mode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
      toast({
        title: "Bot Started",
        description: "Trading bot is now running",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start bot",
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
        title: "Bot Stopped",
        description: "Trading bot has been stopped",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to stop bot",
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
        description: `${isProfit ? 'Profit' : 'Loss'}: ${isProfit ? '+' : ''}$${trade.profit.toFixed(2)} (${isProfit ? '+' : ''}${trade.profitPercent.toFixed(2)}%)`,
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-app-title">AI Trading Bot</h1>
              <p className="text-sm text-muted-foreground" data-testid="text-app-subtitle">
                Real-time Analytics & Automated Trading
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Current Balance</p>
                <p className="text-xl font-bold tabular-nums" data-testid="text-header-balance">
                  {portfolio ? formatCurrency(portfolio.balance) : '$0.00'}
                </p>
              </div>
              <div className={`h-3 w-3 rounded-full ${
                botState?.status === 'running' ? 'bg-profit animate-pulse' : 'bg-muted-foreground'
              }`} data-testid="indicator-header-bot-status"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Balance"
            value={portfolio ? formatCurrency(portfolio.balance) : '$0.00'}
            change={portfolio?.totalProfit}
            changePercent={portfolio?.totalProfitPercent}
            icon={<Wallet className="h-4 w-4" />}
            isLoading={portfolioLoading}
          />
          <StatCard
            title="Daily Profit"
            value={portfolio ? formatCurrency(portfolio.dailyProfit) : '$0.00'}
            change={portfolio?.dailyProfit}
            changePercent={portfolio?.dailyProfitPercent}
            icon={<TrendingUp className="h-4 w-4" />}
            isLoading={portfolioLoading}
          />
          <StatCard
            title="Open Positions"
            value={portfolio?.openPositions.toString() || '0'}
            icon={<Activity className="h-4 w-4" />}
            isLoading={portfolioLoading}
          />
          <StatCard
            title="Win Rate"
            value={portfolio ? formatPercent(portfolio.winRate) : '0.0%'}
            change={portfolio?.winningTrades}
            icon={<Target className="h-4 w-4" />}
            isLoading={portfolioLoading}
          />
        </div>

        {/* Bot Controls */}
        <div className="mb-6">
          {botState && (
            <BotControls
              botState={{ ...botState, uptime }}
              onStart={handleStart}
              onStop={handleStop}
              onStrategyChange={handleStrategyChange}
              onAIToggle={handleAIToggle}
              latestAIDecision={latestAIDecision}
              isLoading={startBotMutation.isPending || stopBotMutation.isPending || changeStrategyMutation.isPending || toggleAIMutation.isPending}
            />
          )}
        </div>

        {/* Charts and Trade History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PriceChart data={chartData} isLoading={chartLoading} />
          </div>
          <div>
            <TradeHistory trades={trades} isLoading={tradesLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}
