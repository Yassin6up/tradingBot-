import { Card } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import type { ChartDataPoint } from "@shared/schema";

interface PriceChartProps {
  data: ChartDataPoint[];
  symbol?: string;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
}

export function PriceChart({ data, symbol = "BTC/USDT", isLoading, isError, error }: PriceChartProps) {
  const { t } = useTranslation();

  if (isError) {
    return (
      <Card className="p-6" data-testid="card-price-chart">
        <div className="flex flex-col items-center justify-center h-[400px] text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('dashboard.binanceRequired')}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {t('dashboard.configureBinance')}
          </p>
        </div>
      </Card>
    );
  }

  if (isLoading || data.length === 0) {
    return (
      <Card className="p-6" data-testid="card-price-chart">
        <div className="mb-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </Card>
    );
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const currentPrice = data[data.length - 1]?.price || 0;
  const previousPrice = data[0]?.price || 0;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice ? (priceChange / previousPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  return (
    <Card className="p-6" data-testid="card-price-chart">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold" data-testid="text-chart-symbol">{symbol}</h3>
          <div className={`text-sm font-medium ${isPositive ? 'text-profit' : 'text-loss'}`} data-testid="text-chart-change">
            {isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%
          </div>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums" data-testid="text-chart-price">
            {formatPrice(currentPrice)}
          </span>
          <span className={`text-sm font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {isPositive ? '+' : ''}{formatPrice(priceChange)}
          </span>
        </div>
      </div>
      
      <div className="h-[400px]" data-testid="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTime}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis 
              tickFormatter={(value) => `$${value.toLocaleString()}`}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
              tickLine={false}
              width={80}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as ChartDataPoint;
                  return (
                    <div className="bg-popover border border-popover-border rounded-md p-3 shadow-lg">
                      <p className="text-xs text-muted-foreground mb-1">
                        {new Date(data.timestamp).toLocaleString()}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatPrice(data.price)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="hsl(217, 91%, 60%)" 
              strokeWidth={2}
              fill="url(#colorPrice)"
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
