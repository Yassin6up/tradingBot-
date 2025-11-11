import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Trade } from "@shared/schema";

interface TradeHistoryProps {
  trades: Trade[];
  isLoading?: boolean;
}

export function TradeHistory({ trades, isLoading }: TradeHistoryProps) {
  if (isLoading) {
    return (
      <Card className="p-6" data-testid="card-trade-history">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <Card className="p-6" data-testid="card-trade-history">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold" data-testid="text-trade-history-title">Recent Trades</h3>
        <Badge variant="secondary" data-testid="badge-trade-count">{trades.length} trades</Badge>
      </div>
      
      {trades.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-state-trades">
          <p className="text-muted-foreground text-sm">No trades yet</p>
          <p className="text-muted-foreground text-xs mt-1">Start the bot to begin trading</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]" data-testid="scroll-area-trades">
          <div className="space-y-2">
            {trades.map((trade, index) => {
              const isBuy = trade.type === 'BUY';
              const isProfit = trade.profit >= 0;
              
              return (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-3 rounded-md hover-elevate border border-card-border"
                  data-testid={`trade-item-${index}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-md ${isBuy ? 'bg-profit/10' : 'bg-loss/10'}`}>
                      {isBuy ? (
                        <ArrowUpRight className={`h-4 w-4 ${isBuy ? 'text-profit' : 'text-loss'}`} />
                      ) : (
                        <ArrowDownRight className={`h-4 w-4 text-loss`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm" data-testid={`text-trade-symbol-${index}`}>
                          {trade.symbol}
                        </span>
                        <Badge 
                          variant={isBuy ? "default" : "destructive"} 
                          className="text-xs"
                          data-testid={`badge-trade-type-${index}`}
                        >
                          {trade.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums" data-testid={`text-trade-price-${index}`}>
                          {formatPrice(trade.price)}
                        </span>
                        <span>•</span>
                        <span data-testid={`text-trade-time-${index}`}>{formatTime(trade.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold text-sm tabular-nums ${
                      isProfit ? 'text-profit' : 'text-loss'
                    }`} data-testid={`text-trade-profit-${index}`}>
                      {isProfit ? '+' : ''}{formatPrice(trade.profit)}
                    </div>
                    <div className={`text-xs ${isProfit ? 'text-profit' : 'text-loss'}`}>
                      {isProfit ? '+' : ''}{trade.profitPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
