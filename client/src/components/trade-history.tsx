import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight, Filter, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Trade, StrategyType } from "@shared/schema";
import { useState, useMemo } from "react";

interface TradeHistoryProps {
  trades: Trade[];
  isLoading?: boolean;
}

type TimeFilter = 'all' | '24h' | '7d' | '30d';

export function TradeHistory({ trades, isLoading }: TradeHistoryProps) {
  const { t } = useTranslation();
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Extract unique symbols from trades
  const uniqueSymbols = useMemo(() => {
    const symbols = new Set(trades.map(t => t.symbol));
    return Array.from(symbols).sort();
  }, [trades]);

  // Filter trades based on selected filters
  const filteredTrades = useMemo(() => {
    let filtered = [...trades];

    // Filter by symbol
    if (symbolFilter !== 'all') {
      filtered = filtered.filter(t => t.symbol === symbolFilter);
    }

    // Filter by strategy
    if (strategyFilter !== 'all') {
      filtered = filtered.filter(t => t.strategy === strategyFilter);
    }

    // Filter by time
    if (timeFilter !== 'all') {
      const now = Date.now();
      const timeRanges: Record<TimeFilter, number> = {
        'all': 0,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      
      const range = timeRanges[timeFilter];
      if (range > 0) {
        filtered = filtered.filter(t => now - t.timestamp <= range);
      }
    }

    return filtered;
  }, [trades, symbolFilter, strategyFilter, timeFilter]);

  const hasActiveFilters = symbolFilter !== 'all' || strategyFilter !== 'all' || timeFilter !== 'all';

  const clearFilters = () => {
    setSymbolFilter('all');
    setStrategyFilter('all');
    setTimeFilter('all');
  };

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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
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
        <h3 className="text-xl font-semibold" data-testid="text-trade-history-title">{t('trades.title')}</h3>
        <Badge variant="secondary" data-testid="badge-trade-count">
          {filteredTrades.length} {filteredTrades.length === 1 ? t('trades.trade') : t('trades.trades')}
        </Badge>
      </div>

      {/* Filter Controls */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          {/* Symbol Filter */}
          <Select value={symbolFilter} onValueChange={setSymbolFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-symbol-filter">
              <SelectValue placeholder={t('trades.filters.allSymbols')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('trades.filters.allSymbols')}</SelectItem>
              {uniqueSymbols.map(symbol => (
                <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Strategy Filter */}
          <Select value={strategyFilter} onValueChange={setStrategyFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-strategy-filter">
              <SelectValue placeholder={t('trades.filters.allStrategies')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('trades.filters.allStrategies')}</SelectItem>
              <SelectItem value="safe">{t('bot.strategies.safe')}</SelectItem>
              <SelectItem value="balanced">{t('bot.strategies.balanced')}</SelectItem>
              <SelectItem value="aggressive">{t('bot.strategies.aggressive')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Time Filter */}
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="w-[140px]" data-testid="select-time-filter">
              <SelectValue placeholder={t('trades.filters.allTime')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('trades.filters.allTime')}</SelectItem>
              <SelectItem value="24h">{t('trades.filters.24h')}</SelectItem>
              <SelectItem value="7d">{t('trades.filters.7d')}</SelectItem>
              <SelectItem value="30d">{t('trades.filters.30d')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-1" />
              {t('trades.filters.clear')}
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Active filters:</span>
            {symbolFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">{symbolFilter}</Badge>
            )}
            {strategyFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs capitalize">{strategyFilter}</Badge>
            )}
            {timeFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {timeFilter === '24h' ? 'Last 24h' : timeFilter === '7d' ? 'Last 7 days' : 'Last 30 days'}
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {filteredTrades.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-state-trades">
          <p className="text-muted-foreground text-sm">
            {hasActiveFilters ? t('trades.noMatches') : t('trades.noTrades')}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            {hasActiveFilters ? t('trades.tryAdjusting') : t('trades.startBot')}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]" data-testid="scroll-area-trades">
          <div className="space-y-2">
            {filteredTrades.map((trade, index) => {
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
                        <Badge variant="outline" className="text-xs capitalize">
                          {trade.strategy}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums" data-testid={`text-trade-price-${index}`}>
                          {formatPrice(trade.price)}
                        </span>
                        <span>•</span>
                        <span data-testid={`text-trade-time-${index}`}>
                          {formatDate(trade.timestamp)} {formatTime(trade.timestamp)}
                        </span>
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
