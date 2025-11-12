import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createChart, ColorType } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { AlertCircle, TrendingUp } from "lucide-react";

interface ChartData {
  candles?: any[];
  sma20?: number[];
  sma50?: number[];
  ema12?: number[];
  ema26?: number[];
  rsi?: number[];
  macd?: any[];
  bollingerBands?: {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
  };
}

interface AdvancedChartProps {
  symbol?: string;
  defaultTimeframe?: string;
}

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
];

const INDICATORS = [
  { id: 'sma20', label: 'SMA 20', color: '#2962FF' },
  { id: 'sma50', label: 'SMA 50', color: '#FF6D00' },
  { id: 'ema12', label: 'EMA 12', color: '#00C853' },
  { id: 'ema26', label: 'EMA 26', color: '#D500F9' },
  { id: 'bb', label: 'Bollinger Bands', color: '#6B7280' },
  { id: 'rsi', label: 'RSI', color: '#F59E0B' },
];

export function AdvancedChart({ symbol = 'BTC/USDT', defaultTimeframe = '5m' }: AdvancedChartProps) {
  const { t } = useTranslation();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const indicatorSeriesRef = useRef<Map<string, any>>(new Map());
  
  const [timeframe, setTimeframe] = useState<Timeframe>(defaultTimeframe as Timeframe);
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);

  // Fetch chart data with indicators
  const { data, isLoading, isError, error } = useQuery<ChartData | any[]>({
    queryKey: ['/api/chart', symbol, { timeframe, indicators: activeIndicators.join(',') }],
    enabled: true,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart: any = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!data || !candlestickSeriesRef.current) return;

    const candles = Array.isArray(data) ? data : data.candles;
    if (!candles || candles.length === 0) return;

    // Format candlestick data
    const formattedData = candles.map((c: any) => ({
      time: Math.floor(c.timestamp / 1000) as any, // Convert to seconds
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candlestickSeriesRef.current.setData(formattedData);

    // Update indicators
    if (!Array.isArray(data) && chartRef.current) {
      // Clear existing indicator series
      indicatorSeriesRef.current.forEach((series) => {
        chartRef.current?.removeSeries(series);
      });
      indicatorSeriesRef.current.clear();

      // Add new indicator series
      const chartData = data as ChartData;
      INDICATORS.forEach((indicator) => {
        const indicatorValues = (chartData as any)[indicator.id];
        if (indicatorValues && activeIndicators.includes(indicator.id)) {
          const lineSeries = chartRef.current!.addLineSeries({
            color: indicator.color,
            lineWidth: 2,
            title: indicator.label,
          });

          const indicatorData = indicatorValues.map((value: number | null, index: number) => ({
            time: Math.floor(candles[index + (candles.length - indicatorValues.length)].timestamp / 1000) as any,
            value: value ?? undefined,
          })).filter((d: any) => d.value !== undefined);

          lineSeries.setData(indicatorData);
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        }
      });

      // Handle Bollinger Bands separately
      const chartData2 = data as ChartData;
      if (chartData2.bollingerBands && activeIndicators.includes('bb')) {
        const { upper, middle, lower } = chartData2.bollingerBands;
        
        if (upper) {
          const upperSeries = chartRef.current!.addLineSeries({
            color: '#6B7280',
            lineWidth: 1,
            title: 'BB Upper',
          });
          const upperData = upper.map((value: number | null, index: number) => ({
            time: Math.floor(candles[index + (candles.length - upper.length)].timestamp / 1000) as any,
            value: value ?? undefined,
          })).filter((d: any) => d.value !== undefined);
          upperSeries.setData(upperData);
          indicatorSeriesRef.current.set('bb-upper', upperSeries);
        }

        if (middle) {
          const middleSeries = chartRef.current!.addLineSeries({
            color: '#9CA3AF',
            lineWidth: 1,
            title: 'BB Middle',
          });
          const middleData = middle.map((value: number | null, index: number) => ({
            time: Math.floor(candles[index + (candles.length - middle.length)].timestamp / 1000) as any,
            value: value ?? undefined,
          })).filter((d: any) => d.value !== undefined);
          middleSeries.setData(middleData);
          indicatorSeriesRef.current.set('bb-middle', middleSeries);
        }

        if (lower) {
          const lowerSeries = chartRef.current!.addLineSeries({
            color: '#6B7280',
            lineWidth: 1,
            title: 'BB Lower',
          });
          const lowerData = lower.map((value: number | null, index: number) => ({
            time: Math.floor(candles[index + (candles.length - lower.length)].timestamp / 1000) as any,
            value: value ?? undefined,
          })).filter((d: any) => d.value !== undefined);
          lowerSeries.setData(lowerData);
          indicatorSeriesRef.current.set('bb-lower', lowerSeries);
        }
      }
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, activeIndicators]);

  const toggleIndicator = (indicatorId: string) => {
    setActiveIndicators((prev) =>
      prev.includes(indicatorId)
        ? prev.filter((id) => id !== indicatorId)
        : [...prev, indicatorId]
    );
  };

  if (isError) {
    return (
      <Card className="p-6" data-testid="card-advanced-chart">
        <div className="flex flex-col items-center justify-center h-[500px] text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('dashboard.binanceRequired')}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {t('dashboard.configureBinance')}
          </p>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6" data-testid="card-advanced-chart">
        <div className="mb-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-[500px] w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6" data-testid="card-advanced-chart">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold" data-testid="text-chart-symbol">{symbol}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('dashboard.advancedChart') || 'Advanced Trading Chart'}</p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf.value}
              size="sm"
              variant={timeframe === tf.value ? 'default' : 'outline'}
              onClick={() => setTimeframe(tf.value)}
              data-testid={`button-timeframe-${tf.value}`}
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Indicator Toggles */}
      <div className="mb-4 flex flex-wrap gap-2">
        {INDICATORS.map((indicator) => (
          <Badge
            key={indicator.id}
            variant={activeIndicators.includes(indicator.id) ? 'default' : 'outline'}
            className="cursor-pointer hover-elevate active-elevate-2"
            onClick={() => toggleIndicator(indicator.id)}
            data-testid={`badge-indicator-${indicator.id}`}
          >
            <div className="flex items-center gap-1">
              {activeIndicators.includes(indicator.id) && (
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: indicator.color }} />
              )}
              {indicator.label}
            </div>
          </Badge>
        ))}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="relative" data-testid="chart-container" />
    </Card>
  );
}
