import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COINS = [
  { symbol: 'BTC/USDT', nameKey: 'coins.btc', icon: '₿' },
  { symbol: 'ETH/USDT', nameKey: 'coins.eth', icon: 'Ξ' },
  { symbol: 'BNB/USDT', nameKey: 'coins.bnb', icon: 'BNB' },
  { symbol: 'SOL/USDT', nameKey: 'coins.sol', icon: 'SOL' },
  { symbol: 'ADA/USDT', nameKey: 'coins.ada', icon: 'ADA' },
];

interface CoinSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function CoinSelector({ value, onValueChange }: CoinSelectorProps) {
  const { t } = useTranslation();
  
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger 
        className="w-[180px]" 
        data-testid="select-coin"
      >
        <SelectValue placeholder={t('chart.selectCoin') || 'Select coin'} />
      </SelectTrigger>
      <SelectContent>
        {COINS.map((coin) => (
          <SelectItem 
            key={coin.symbol} 
            value={coin.symbol}
            data-testid={`coin-option-${coin.symbol.replace('/', '-')}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold">{coin.icon}</span>
              <span>{t(coin.nameKey)}</span>
              <span className="text-muted-foreground text-xs">{coin.symbol}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
