import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingUp, TrendingDown, DollarSign, Clock, Target, AlertTriangle, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface Position {
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
  currentPrice?: number;
  profitLoss?: number;
  profitLossPercent?: number;
}

export function OpenPositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // Fetch open positions
    const fetchPositions = async () => {
      try {
        const response = await fetch('/api/positions/open');
        if (response.ok) {
          const data = await response.json();
          setPositions(data);
        }
      } catch (error) {
        console.error('Failed to fetch positions:', error);
      }
    };

    fetchPositions();

    // WebSocket for real-time price updates
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('✅ Connected to Positions WebSocket');
      ws.send(JSON.stringify({ type: 'subscribe_prices' }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.event === 'price_update') {
          const priceData = message.data;
          const newPrices = new Map(prices);
          
          priceData.forEach((item: any) => {
            newPrices.set(item.symbol, item.price);
          });
          
          setPrices(newPrices);
        } else if (message.event === 'trade_executed') {
          // Refresh positions when a trade is executed
          fetchPositions();
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('🔌 Disconnected from Positions WebSocket');
    };

    // Poll for updates
    const interval = setInterval(() => {
      fetchPositions();
    }, 5000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  // Calculate current P&L for each position
  const calculatePnL = (position: Position) => {
    const currentPrice = prices.get(position.symbol) || position.entryPrice;
    const profitLoss = (currentPrice - position.entryPrice) * position.quantity;
    const profitLossPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    const costBasis = position.entryPrice * position.quantity;
    
    return {
      currentPrice,
      profitLoss,
      profitLossPercent,
      costBasis,
      currentValue: currentPrice * position.quantity
    };
  };

  const totalPnL = positions.reduce((sum, pos) => {
    const pnl = calculatePnL(pos);
    return sum + pnl.profitLoss;
  }, 0);

  const totalCostBasis = positions.reduce((sum, pos) => {
    return sum + (pos.entryPrice * pos.quantity);
  }, 0);

  const totalPnLPercent = totalCostBasis !== 0 ? (totalPnL / totalCostBasis) * 100 : 0;

  const getProfitColor = (profitPercent: number) => {
    if (profitPercent > 5) return 'text-green-500 font-bold';
    if (profitPercent > 0) return 'text-green-600';
    if (profitPercent > -5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDistanceToStopLoss = (position: Position, currentPrice: number) => {
    const distance = ((currentPrice - position.stopLoss) / currentPrice) * 100;
    return distance;
  };

  const getDistanceToTakeProfit = (position: Position, currentPrice: number) => {
    const distance = ((position.takeProfit - currentPrice) / currentPrice) * 100;
    return distance;
  };

  const getHoldingTime = (openedAt: number) => {
    const now = Date.now();
    const diff = now - openedAt;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Open Positions
            </CardTitle>
            <CardDescription>
              Currently active trades - {positions.length} / 10 positions
            </CardDescription>
          </div>
          
          {positions.length > 0 && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total P&L</p>
              <p className={`text-2xl font-bold ${getProfitColor(totalPnLPercent)}`}>
                {totalPnL > 0 ? '+' : ''}{totalPnL.toFixed(2)} USDT
              </p>
              <p className={`text-sm ${getProfitColor(totalPnLPercent)}`}>
                {totalPnLPercent > 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No open positions</p>
            <p className="text-sm mt-1">Start the bot to begin trading</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] w-full pr-4">
            <div className="space-y-4">
              {positions.map((position) => {
                const pnl = calculatePnL(position);
                const distanceToSL = getDistanceToStopLoss(position, pnl.currentPrice);
                const distanceToTP = getDistanceToTakeProfit(position, pnl.currentPrice);
                
                return (
                  <div 
                    key={position.id} 
                    className="border rounded-lg p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">{position.symbol}</h3>
                        <Badge variant="outline" className="uppercase text-xs">
                          {position.strategy}
                        </Badge>
                        <Badge className={position.mode === 'real' ? 'bg-green-500' : 'bg-blue-500'}>
                          {position.mode === 'real' ? 'REAL' : 'PAPER'}
                        </Badge>
                      </div>
                      
                      <div className="text-right">
                        <p className={`text-xl font-bold ${getProfitColor(pnl.profitLossPercent)}`}>
                          {pnl.profitLoss > 0 ? '+' : ''}{pnl.profitLoss.toFixed(2)} USDT
                        </p>
                        <p className={`text-sm ${getProfitColor(pnl.profitLossPercent)}`}>
                          {pnl.profitLossPercent > 0 ? '+' : ''}{pnl.profitLossPercent.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {/* Position Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Entry Price
                        </p>
                        <p className="font-semibold">${position.entryPrice.toFixed(2)}</p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Current Price
                        </p>
                        <p className="font-semibold">${pnl.currentPrice.toFixed(2)}</p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground">Quantity</p>
                        <p className="font-semibold">{position.quantity.toFixed(6)}</p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Holding Time
                        </p>
                        <p className="font-semibold">{getHoldingTime(position.openedAt)}</p>
                      </div>
                    </div>

                    {/* Cost Basis & Current Value */}
                    <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                      <div>
                        <p className="text-muted-foreground">Cost Basis</p>
                        <p className="font-semibold">${pnl.costBasis.toFixed(2)} USDT</p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground">Current Value</p>
                        <p className="font-semibold">${pnl.currentValue.toFixed(2)} USDT</p>
                      </div>
                    </div>

                    {/* Stop Loss & Take Profit */}
                    <div className="grid grid-cols-2 gap-3 text-sm mt-3 pt-3 border-t">
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          Stop Loss
                        </p>
                        <p className="font-semibold text-red-600">
                          ${position.stopLoss.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {distanceToSL.toFixed(1)}% away
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Target className="w-3 h-3 text-green-500" />
                          Take Profit
                        </p>
                        <p className="font-semibold text-green-600">
                          ${position.takeProfit.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {distanceToTP.toFixed(1)}% to target
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>SL</span>
                        <span>Entry</span>
                        <span>TP</span>
                      </div>
                      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`absolute h-full transition-all ${
                            pnl.profitLossPercent > 0 ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{
                            left: '50%',
                            width: `${Math.abs(pnl.profitLossPercent) * 2}%`,
                            transform: pnl.profitLossPercent < 0 ? 'translateX(-100%)' : 'none'
                          }}
                        />
                        <div 
                          className="absolute w-0.5 h-full bg-white/50"
                          style={{ left: '50%' }}
                        />
                      </div>
                    </div>

                    {/* Opened At */}
                    <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                      Opened: {format(new Date(position.openedAt), 'PPp')}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
