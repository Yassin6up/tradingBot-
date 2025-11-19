import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface OpenPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  mode: 'paper' | 'real';
  strategy: string;
  openedAt: number;
  currentPrice: number;
  currentProfit: number;
  currentProfitPercent: number;
  isNearStopLoss: boolean;
  isNearTakeProfit: boolean;
}

export function OpenTrades() {
  const { data: positions, isLoading } = useQuery<OpenPosition[]>({
    queryKey: ['/api/positions/open'],
    refetchInterval: 3000,
  });

  if (isLoading) {
    return (
      <Card className="p-6" data-testid="card-open-trades">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(price);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    return `${minutes}m ago`;
  };

  const totalProfit = positions?.reduce((sum, p) => sum + p.currentProfit, 0) || 0;
  const profitableCount = positions?.filter(p => p.currentProfit > 0).length || 0;

  return (
    <Card className="p-6" data-testid="card-open-trades">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold" data-testid="text-open-trades-title">
          Open Positions
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="badge-position-count">
            {positions?.length || 0} / 10
          </Badge>
          <Badge 
            className={totalProfit >= 0 ? 'bg-profit/10 text-profit border-profit/20' : 'bg-loss/10 text-loss border-loss/20'}
            data-testid="badge-total-profit"
          >
            {totalProfit >= 0 ? '+' : ''}{formatPrice(totalProfit)}
          </Badge>
        </div>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-3">
          {!positions || positions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-open-trades">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No open positions</p>
              <p className="text-sm">Trades will appear here when the bot opens positions</p>
            </div>
          ) : (
            positions.map((position) => (
              <Card 
                key={position.id} 
                className="p-4 hover-elevate" 
                data-testid={`card-position-${position.id}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg" data-testid={`text-position-symbol-${position.id}`}>
                      {position.symbol}
                    </span>
                    <Badge variant="outline" data-testid={`badge-strategy-${position.id}`}>
                      {position.strategy}
                    </Badge>
                    {position.mode === 'real' && (
                      <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                        REAL
                      </Badge>
                    )}
                  </div>
                  <Badge 
                    className={position.currentProfitPercent >= 0 ? 
                      'bg-profit/10 text-profit border-profit/20' : 
                      'bg-loss/10 text-loss border-loss/20'
                    }
                    data-testid={`badge-profit-percent-${position.id}`}
                  >
                    {position.currentProfitPercent >= 0 ? '+' : ''}
                    {position.currentProfitPercent.toFixed(2)}%
                  </Badge>
                </div>

                {/* Prices */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Entry Price</p>
                    <p className="font-medium" data-testid={`text-entry-price-${position.id}`}>
                      {formatPrice(position.entryPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Price</p>
                    <p className="font-medium flex items-center gap-1" data-testid={`text-current-price-${position.id}`}>
                      {formatPrice(position.currentPrice)}
                      {position.currentPrice > position.entryPrice ? (
                        <TrendingUp className="h-3 w-3 text-profit" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-loss" />
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <p className="font-medium" data-testid={`text-quantity-${position.id}`}>
                      {position.quantity.toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current P&L</p>
                    <p 
                      className={`font-medium ${position.currentProfit >= 0 ? 'text-profit' : 'text-loss'}`}
                      data-testid={`text-profit-${position.id}`}
                    >
                      {position.currentProfit >= 0 ? '+' : ''}{formatPrice(position.currentProfit)}
                    </p>
                  </div>
                </div>

                {/* Profit Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-loss">
                      <Shield className="h-3 w-3" />
                      <span>SL: {formatPrice(position.stopLoss)}</span>
                      {position.isNearStopLoss && <Badge variant="destructive" className="text-xs ml-1">Near!</Badge>}
                    </div>
                    <span className="text-muted-foreground">Progress</span>
                    <div className="flex items-center gap-1 text-profit">
                      <Target className="h-3 w-3" />
                      <span>TP: {formatPrice(position.takeProfit)}</span>
                      {position.isNearTakeProfit && <Badge className="bg-profit/10 text-profit text-xs ml-1">Near!</Badge>}
                    </div>
                  </div>
                  
                  {/* Progress visualization */}
                  <div className="relative">
                    <Progress 
                      value={(() => {
                        const range = position.takeProfit - position.stopLoss;
                        const progress = position.currentPrice - position.stopLoss;
                        return Math.max(0, Math.min(100, (progress / range) * 100));
                      })()}
                      className="h-2"
                      data-testid={`progress-profit-${position.id}`}
                    />
                    {/* Entry price marker */}
                    <div 
                      className="absolute top-0 h-2 w-0.5 bg-foreground/50"
                      style={{
                        left: `${(() => {
                          const range = position.takeProfit - position.stopLoss;
                          const entryOffset = position.entryPrice - position.stopLoss;
                          return Math.max(0, Math.min(100, (entryOffset / range) * 100));
                        })()}%`
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-center text-xs text-muted-foreground">
                    <span>
                      {position.currentPrice > position.entryPrice ? 'Profit' : 'Loss'} zone •
                      {' '}{Math.abs(((position.currentPrice - position.takeProfit) / (position.takeProfit - position.stopLoss)) * 100).toFixed(0)}% to target
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  Opened {formatTime(position.openedAt)}
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
