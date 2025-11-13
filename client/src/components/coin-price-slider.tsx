import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

interface CoinData {
  symbol: string;
  price: number;
  name: string;
}

const COINS = [
  { symbol: 'BTC/USDT', key: 'btc' },
  { symbol: 'ETH/USDT', key: 'eth' },
  { symbol: 'BNB/USDT', key: 'bnb' },
  { symbol: 'SOL/USDT', key: 'sol' },
  { symbol: 'ADA/USDT', key: 'ada' },
];

export function CoinPriceSlider() {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({});

  // Fetch real-time prices from Binance
  const { data: prices, isError, error } = useQuery<Record<string, number>>({
    queryKey: ['/api/prices'],
    queryFn: async () => {
      const response = await fetch('/api/prices');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch prices');
      }
      return response.json();
    },
    refetchInterval: 3000, // Refresh every 3 seconds
    retry: false, // Don't retry on Binance API requirement error
  });

  // Auto-rotate through coins every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % COINS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Track price changes
  useEffect(() => {
    if (prices) {
      setPreviousPrices(prices);
    }
  }, [prices]);

  if (isError) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
        <p className="text-sm text-destructive font-medium">
          {error instanceof Error && error.message.includes('Binance API')
            ? t('dashboard.binanceRequired')
            : t('common.error')}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {t('dashboard.configureBinance')}
        </p>
      </div>
    );
  }

  if (!prices) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-8 bg-muted rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const currentCoin = COINS[currentIndex];
  const currentPrice = prices[currentCoin.symbol];
  const previousPrice = previousPrices[currentCoin.symbol];
  const priceChange = previousPrice ? currentPrice - previousPrice : 0;
  const isUp = priceChange > 0;
  const isDown = priceChange < 0;

  return (
    <div className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border border-primary/20 rounded-lg p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-2"
          >
            {/* Coin name */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t(`coins.${currentCoin.key}`)}
              </span>
              <span className="text-xs text-muted-foreground/60">
                {currentCoin.symbol}
              </span>
            </div>

            {/* Price */}
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold tracking-tight">
                ${currentPrice?.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              
              {/* Price change indicator */}
              {(isUp || isDown) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`flex items-center gap-1 mb-1 ${
                    isUp ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {isUp ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">
                    {Math.abs(priceChange)}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5 pt-2">
              {COINS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'w-8 bg-primary'
                      : 'w-1 bg-muted-foreground/30'
                  }`}
                  data-testid={`slider-dot-${index}`}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
