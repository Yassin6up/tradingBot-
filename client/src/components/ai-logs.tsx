import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AIDecision } from "@/types";

export function AILogs() {
  const { data: decisions, isLoading } = useQuery<AIDecision[]>({
    queryKey: ['/api/ai/decisions'],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <Card className="p-6" data-testid="card-ai-logs">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStrategyColor = (strategy: string) => {
    const colors: Record<string, string> = {
      safe: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      balanced: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      aggressive: 'bg-red-500/10 text-red-500 border-red-500/20',
      scalping: 'bg-green-500/10 text-green-500 border-green-500/20',
      trend: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      breakout: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      momentum: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    };
    return colors[strategy] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-profit/10 text-profit border-profit/20';
    if (confidence >= 60) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    return 'bg-loss/10 text-loss border-loss/20';
  };

  return (
    <Card className="p-6" data-testid="card-ai-logs">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold" data-testid="text-ai-logs-title">
          AI Decision Log
        </h3>
        <Badge variant="secondary" className="ml-auto" data-testid="badge-decision-count">
          {decisions?.length || 0} decisions
        </Badge>
      </div>

      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-3">
          {!decisions || decisions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-ai-decisions">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No AI decisions yet. Start the bot to see AI analysis.</p>
            </div>
          ) : (
            decisions.map((decision) => (
              <Card 
                key={decision.id} 
                className="p-4 hover-elevate" 
                data-testid={`card-ai-decision-${decision.id}`}
              >
                {/* Header with timestamp and confidence */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground" data-testid={`text-decision-time-${decision.id}`}>
                    {formatTime(decision.timestamp)}
                  </span>
                  <Badge 
                    className={getConfidenceBadgeColor(decision.confidence)}
                    data-testid={`badge-confidence-${decision.id}`}
                  >
                    {decision.confidence}% confidence
                  </Badge>
                </div>

                {/* Strategy Selection */}
                <div className="flex items-center gap-2 mb-3">
                  <Badge 
                    className={getStrategyColor(decision.selectedStrategy)}
                    data-testid={`badge-selected-strategy-${decision.id}`}
                  >
                    {decision.selectedStrategy}
                  </Badge>
                  {decision.previousStrategy !== decision.selectedStrategy && (
                    <>
                      <span className="text-xs text-muted-foreground">from</span>
                      <Badge 
                        variant="outline" 
                        className="opacity-50"
                        data-testid={`badge-previous-strategy-${decision.id}`}
                      >
                        {decision.previousStrategy}
                      </Badge>
                    </>
                  )}
                </div>

                {/* Market Conditions */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Volatility:</span>
                    <span className="font-medium">{decision.marketConditions.volatility.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {decision.marketConditions.trendStrength > 0 ? (
                      <TrendingUp className="h-3 w-3 text-profit" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-loss" />
                    )}
                    <span className="text-muted-foreground">Trend:</span>
                    <span className={decision.marketConditions.trendStrength > 0 ? 'text-profit font-medium' : 'text-loss font-medium'}>
                      {decision.marketConditions.trendStrength.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Risk:</span>
                    <Badge variant="outline" className="text-xs">
                      {decision.marketConditions.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Regime:</span>
                    <span className="font-medium text-xs">{decision.marketConditions.marketRegime}</span>
                  </div>
                </div>

                {/* Technical Indicators (if available) */}
                {decision.marketConditions.technicalIndicators && (
                  <div className="p-3 bg-muted/20 rounded-md mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Technical Analysis:</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">RSI:</span>
                        <span className={`ml-1 font-medium ${
                          decision.marketConditions.technicalIndicators.rsi > 70 ? 'text-loss' :
                          decision.marketConditions.technicalIndicators.rsi < 30 ? 'text-profit' :
                          'text-foreground'
                        }`}>
                          {decision.marketConditions.technicalIndicators.rsi.toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">MACD:</span>
                        <span className={`ml-1 font-medium ${
                          decision.marketConditions.technicalIndicators.macd.histogram > 0 ? 'text-profit' : 'text-loss'
                        }`}>
                          {decision.marketConditions.technicalIndicators.macd.histogram.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Trend:</span>
                        <span className="ml-1 font-medium">
                          {decision.marketConditions.technicalIndicators.sma20 > decision.marketConditions.technicalIndicators.sma50 ? '📈' : '📉'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Reasoning */}
                <div className="p-3 bg-muted/30 rounded-md">
                  <p className="text-sm leading-relaxed" data-testid={`text-reasoning-${decision.id}`}>
                    {decision.reasoning}
                  </p>
                </div>

                {/* Top Strategy Scores */}
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Strategy Scores:</p>
                  <div className="flex flex-wrap gap-2">
                    {decision.strategyScores.slice(0, 5).map((score) => (
                      <div 
                        key={score.strategy}
                        className="flex items-center gap-1 text-xs"
                        data-testid={`badge-strategy-score-${decision.id}-${score.strategy}`}
                      >
                        <span className="text-muted-foreground">{score.strategy}:</span>
                        <span className="font-medium">{score.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
