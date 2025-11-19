import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/navigation";
import { LanguageSelector } from "@/components/language-selector";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Brain, TrendingUp, AlertCircle, Activity } from "lucide-react";
import type { AIDecision } from "@shared/schema";

export default function Analytics() {
  const { t } = useTranslation();
  const { data: decisions = [], isLoading } = useQuery<AIDecision[]>({
    queryKey: ['/api/ai/decisions'],
    queryFn: async () => {
      const response = await fetch('/api/ai/decisions?limit=50');
      if (!response.ok) throw new Error('Failed to fetch AI decisions');
      return response.json();
    },
    refetchInterval: 10000,
  });

  // Prepare chart data
  const confidenceChartData = decisions
    .slice()
    .reverse()
    .map((decision, index) => ({
      index: index + 1,
      confidence: decision.confidence,
      timestamp: new Date(decision.timestamp).toLocaleTimeString(),
    }));

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'safe': return 'text-blue-400';
      case 'balanced': return 'text-green-400';
      case 'aggressive': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getConfidenceBadgeVariant = (confidence: number): "default" | "secondary" => {
    return confidence >= 70 ? "default" : "secondary";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-analytics-title">{t('analytics.title')}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('analytics.subtitle')}
                </p>
              </div>
            </div>
            <LanguageSelector />
          </div>
          <Navigation />
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {/* Confidence Trend Chart */}
        <Card className="p-6 mb-6" data-testid="card-confidence-chart">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t('analytics.confidenceTrend')}</h2>
          </div>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('analytics.loading')}
            </div>
          ) : confidenceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={confidenceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="index" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  domain={[0, 100]}
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="confidence"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-2 opacity-50" />
              <p>{t('analytics.noDecisions')}</p>
            </div>
          )}
        </Card>

        {/* Decision History */}
        <Card className="p-6" data-testid="card-decision-history">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t('analytics.decisionHistory')}</h2>
            <Badge variant="outline" className="ml-auto">{decisions.length} {t('analytics.decisions')}</Badge>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading decision history...
            </div>
          ) : decisions.length > 0 ? (
            <div className="space-y-4">
              {decisions.map((decision, index) => (
                <div
                  key={decision.timestamp}
                  className="p-4 rounded-md border border-border hover-elevate"
                  data-testid={`decision-item-${index}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(decision.timestamp).toLocaleString()}
                        </span>
                        <Badge 
                          variant={getConfidenceBadgeVariant(decision.confidence)}
                          data-testid={`badge-confidence-${index}`}
                        >
                          {decision.confidence}% Confidence
                        </Badge>
                        <Badge variant="outline" className={getStrategyColor(decision.selectedStrategy)}>
                          {decision.selectedStrategy.toUpperCase()}
                        </Badge>
                      </div>

                      <p className="text-sm mb-3" data-testid={`text-reasoning-${index}`}>
                        {decision.reasoning}
                      </p>

                      {decision.marketConditions && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border">
                          <div>
                            <p className="text-xs text-muted-foreground">Volatility</p>
                            <p className="text-sm font-medium tabular-nums">
                              {decision.marketConditions.volatility.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Trend Strength</p>
                            <p className="text-sm font-medium tabular-nums">
                              {decision.marketConditions.trendStrength.toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Momentum</p>
                            <p className="text-sm font-medium tabular-nums">
                              {decision.marketConditions.momentum.toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Risk Level</p>
                            <Badge variant="outline" className="capitalize">
                              {decision.marketConditions.riskLevel}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {decision.strategyScores && decision.strategyScores.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">{t('analytics.strategyScores')}:</p>
                          <div className="grid grid-cols-3 gap-2">
                            {decision.strategyScores.map((score) => (
                              <div key={score.strategy} className="text-center p-2 rounded bg-muted/30">
                                <p className="text-xs font-medium capitalize">{score.strategy}</p>
                                <p className="text-sm font-bold tabular-nums">{score.score.toFixed(0)}/100</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-2 opacity-50" />
              <p>No AI decisions recorded yet.</p>
              <p className="text-sm">Enable AI on the dashboard to see decision analytics.</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
