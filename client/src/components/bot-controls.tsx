import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, Square, Zap, Brain, TrendingUp, AlertCircle } from "lucide-react";
import type { BotState, StrategyType, TradingMode, AIDecision } from "@shared/schema";

interface BotControlsProps {
  botState: BotState;
  onStart: (strategy: StrategyType, mode: TradingMode) => void;
  onStop: () => void;
  onStrategyChange: (strategy: StrategyType) => void;
  onAIToggle: (enabled: boolean) => void;
  latestAIDecision: AIDecision | null;
  isLoading?: boolean;
}

const strategies: { type: StrategyType; name: string; risk: string; profit: string }[] = [
  { type: 'safe', name: 'Safe', risk: '1-2%', profit: '3-4%' },
  { type: 'balanced', name: 'Balanced', risk: '2-3%', profit: '5-6%' },
  { type: 'aggressive', name: 'Aggressive', risk: '3-5%', profit: '7-10%' },
];

export function BotControls({ botState, onStart, onStop, onStrategyChange, onAIToggle, latestAIDecision, isLoading }: BotControlsProps) {
  const isRunning = botState.status === 'running';
  const mode = botState.mode;
  const aiEnabled = botState.aiEnabled || false;

  const handleStrategyClick = (strategyType: StrategyType) => {
    if (isRunning) {
      onStrategyChange(strategyType);
    }
  };

  const handleStartStop = () => {
    if (isRunning) {
      onStop();
    } else {
      onStart(botState.strategy, mode);
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-6" data-testid="card-bot-controls">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-1" data-testid="text-bot-title">Trading Bot</h3>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${
                isRunning ? 'bg-profit animate-pulse' : 'bg-muted-foreground'
              }`} data-testid="indicator-bot-status"></div>
              <span className="text-sm text-muted-foreground" data-testid="text-bot-status">
                {isRunning ? 'Running' : 'Stopped'}
              </span>
              {isRunning && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-bot-uptime">
                    {formatUptime(botState.uptime)}
                  </span>
                </>
              )}
            </div>
          </div>
          <Button
            size="lg"
            variant={isRunning ? "destructive" : "default"}
            onClick={handleStartStop}
            disabled={isLoading}
            data-testid="button-start-stop"
          >
            {isRunning ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop Bot
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Bot
              </>
            )}
          </Button>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Trading Strategy</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {strategies.map((strategy) => {
              const isSelected = botState.strategy === strategy.type;
              return (
                <button
                  key={strategy.type}
                  onClick={() => handleStrategyClick(strategy.type)}
                  disabled={!isRunning && isLoading}
                  className={`p-4 rounded-md border-2 text-left transition-all hover-elevate ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-card-border'
                  }`}
                  data-testid={`button-strategy-${strategy.type}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{strategy.name}</span>
                    {isSelected && (
                      <Badge variant="default" className="text-xs" data-testid={`badge-strategy-selected-${strategy.type}`}>
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Risk:</span>
                      <span className="font-medium">{strategy.risk}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Target:</span>
                      <span className="font-medium text-profit">{strategy.profit}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-md">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-warning" />
            <div>
              <Label htmlFor="mode-switch" className="text-sm font-medium cursor-pointer">
                Trading Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                {mode === 'sandbox' ? 'Virtual money (safe)' : 'Real money (live)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={mode === 'sandbox' ? 'secondary' : 'destructive'} data-testid="badge-trading-mode">
              {mode === 'sandbox' ? 'Sandbox' : 'Real'}
            </Badge>
            <Switch
              id="mode-switch"
              checked={mode === 'real'}
              disabled={isRunning || isLoading}
              data-testid="switch-trading-mode"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-md">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="ai-switch" className="text-sm font-medium cursor-pointer">
                AI Strategy Selection
              </Label>
              <p className="text-xs text-muted-foreground">
                {aiEnabled ? 'AI analyzing markets every 60s' : 'Manual strategy control'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={aiEnabled ? 'default' : 'secondary'} data-testid="badge-ai-status">
              {aiEnabled ? 'Active' : 'Off'}
            </Badge>
            <Switch
              id="ai-switch"
              checked={aiEnabled}
              onCheckedChange={onAIToggle}
              disabled={isLoading}
              data-testid="switch-ai-toggle"
            />
          </div>
        </div>

        {aiEnabled && latestAIDecision && (
          <div className="p-4 bg-primary/5 rounded-md border border-primary/20">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Latest AI Analysis</Label>
                  <Badge 
                    variant={latestAIDecision.confidence >= 70 ? 'default' : 'secondary'}
                    data-testid="badge-ai-confidence"
                  >
                    {latestAIDecision.confidence}% Confidence
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Recommended Strategy:</span>
                    <Badge variant="outline" className="text-xs" data-testid="text-ai-recommendation">
                      {latestAIDecision.selectedStrategy.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-ai-reasoning">
                    {latestAIDecision.reasoning}
                  </p>
                  {latestAIDecision.marketConditions && (
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-primary/10">
                      <div>
                        <p className="text-xs text-muted-foreground">Volatility</p>
                        <p className="text-xs font-medium tabular-nums">{latestAIDecision.marketConditions.volatility.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Trend Strength</p>
                        <p className="text-xs font-medium tabular-nums">{latestAIDecision.marketConditions.trendStrength.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Momentum</p>
                        <p className="text-xs font-medium tabular-nums">{latestAIDecision.marketConditions.momentum.toFixed(1)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {aiEnabled && !latestAIDecision && isRunning && (
          <div className="p-4 bg-muted/30 rounded-md border border-border">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                AI is analyzing market conditions... First analysis in 60 seconds
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
