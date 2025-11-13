import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COINS = [
  // Major coins
  { symbol: 'BTC/USDT', nameKey: 'coins.btc', icon: '₿', category: 'major' },
  { symbol: 'ETH/USDT', nameKey: 'coins.eth', icon: 'Ξ', category: 'major' },
  { symbol: 'BNB/USDT', nameKey: 'coins.bnb', icon: 'BNB', category: 'major' },
  { symbol: 'SOL/USDT', nameKey: 'coins.sol', icon: 'SOL', category: 'major' },
  { symbol: 'XRP/USDT', nameKey: 'coins.xrp', icon: 'XRP', category: 'major' },
  
  // Mid-cap coins with good movement
  { symbol: 'ADA/USDT', nameKey: 'coins.ada', icon: 'ADA', category: 'midcap' },
  { symbol: 'AVAX/USDT', nameKey: 'coins.avax', icon: 'AVAX', category: 'midcap' },
  { symbol: 'DOT/USDT', nameKey: 'coins.dot', icon: 'DOT', category: 'midcap' },
  { symbol: 'LINK/USDT', nameKey: 'coins.link', icon: 'LINK', category: 'midcap' },
  { symbol: 'LTC/USDT', nameKey: 'coins.ltc', icon: 'Ł', category: 'midcap' },
  
  // Affordable coins for small budgets
  { symbol: 'MATIC/USDT', nameKey: 'coins.matic', icon: 'MATIC', category: 'affordable' },
  { symbol: 'ATOM/USDT', nameKey: 'coins.atom', icon: 'ATOM', category: 'affordable' },
  { symbol: 'UNI/USDT', nameKey: 'coins.uni', icon: 'UNI', category: 'affordable' },
  { symbol: 'ALGO/USDT', nameKey: 'coins.algo', icon: 'ALGO', category: 'affordable' },
  { symbol: 'XLM/USDT', nameKey: 'coins.xlm', icon: 'XLM', category: 'affordable' },
  
  // More affordable options
  { symbol: 'VET/USDT', nameKey: 'coins.vet', icon: 'VET', category: 'budget' },
  { symbol: 'THETA/USDT', nameKey: 'coins.theta', icon: 'THETA', category: 'budget' },
  { symbol: 'FIL/USDT', nameKey: 'coins.fil', icon: 'FIL', category: 'budget' },
  { symbol: 'ETC/USDT', nameKey: 'coins.etc', icon: 'ETC', category: 'budget' },
  { symbol: 'EOS/USDT', nameKey: 'coins.eos', icon: 'EOS', category: 'budget' },
  
  // DeFi coins
  { symbol: 'AAVE/USDT', nameKey: 'coins.aave', icon: 'AAVE', category: 'defi' },
  { symbol: 'MKR/USDT', nameKey: 'coins.mkr', icon: 'MKR', category: 'defi' },
  { symbol: 'COMP/USDT', nameKey: 'coins.comp', icon: 'COMP', category: 'defi' },
  { symbol: 'SNX/USDT', nameKey: 'coins.snx', icon: 'SNX', category: 'defi' },
  { symbol: 'YFI/USDT', nameKey: 'coins.yfi', icon: 'YFI', category: 'defi' },
  
  // Meme coins (high volatility)
  { symbol: 'DOGE/USDT', nameKey: 'coins.doge', icon: 'Ð', category: 'meme' },
  { symbol: 'SHIB/USDT', nameKey: 'coins.shib', icon: 'SHIB', category: 'meme' }
];

const CATEGORIES = {
  all: { labelKey: 'coinCategories.all', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  major: { labelKey: 'coinCategories.major', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  midcap: { labelKey: 'coinCategories.midcap', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  affordable: { labelKey: 'coinCategories.affordable', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  budget: { labelKey: 'coinCategories.budget', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  defi: { labelKey: 'coinCategories.defi', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  meme: { labelKey: 'coinCategories.meme', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' }
};

interface CoinSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function CoinSelector({ value, onValueChange }: CoinSelectorProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  
  const filteredCoins = useMemo(() => {
    let filtered = COINS;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(coin => 
        t(coin.nameKey).toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query) ||
        coin.icon.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (activeCategory !== "all") {
      filtered = filtered.filter(coin => coin.category === activeCategory);
    }
    
    return filtered;
  }, [searchQuery, activeCategory, t]);

  const clearSearch = () => {
    setSearchQuery("");
  };

  const getSelectedCoin = () => {
    return COINS.find(coin => coin.symbol === value);
  };

  const selectedCoin = getSelectedCoin();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger 
        className="w-[180px]" 
        data-testid="select-coin"
      >
        <SelectValue>
          {selectedCoin ? (
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base">{selectedCoin.icon}</span>
              <span className="truncate font-medium">{selectedCoin.symbol.replace('/USDT', '')}</span>
            </div>
          ) : (
            t('chart.selectCoin') || 'Select coin'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[320px] p-0" align="end">
        {/* Search Bar */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('coinSelector.search') || "Search coins..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-9"
              data-testid="coin-search-input"
            />
            {searchQuery && (
              <X 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={clearSearch}
                data-testid="clear-search"
              />
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-3 pb-2 border-b">
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-8 gap-1">
              <TabsTrigger value="all" className="text-xs px-2">
                All
              </TabsTrigger>
              <TabsTrigger value="major" className="text-xs px-2">
                Major
              </TabsTrigger>
              <TabsTrigger value="midcap" className="text-xs px-2">
                Mid-Cap
              </TabsTrigger>
              <TabsTrigger value="affordable" className="text-xs px-2">
                Affordable
              </TabsTrigger>
              <TabsTrigger value="budget" className="text-xs px-2">
                Budget
              </TabsTrigger>
              <TabsTrigger value="defi" className="text-xs px-2">
                DeFi
              </TabsTrigger>
              <TabsTrigger value="meme" className="text-xs px-2">
                Meme
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Coins List */}
        <div className="max-h-[300px] overflow-y-auto">
          {filteredCoins.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              {t('coinSelector.noResults') || "No coins found"}
            </div>
          ) : (
            <div className="p-2">
              <div className="grid grid-cols-2 gap-1">
                {filteredCoins.map((coin) => (
                  <SelectItem 
                    key={coin.symbol} 
                    value={coin.symbol}
                    className="p-2 m-0 h-auto"
                    data-testid={`coin-option-${coin.symbol.replace('/', '-')}`}
                  >
                    <div className="flex items-center gap-2 p-1 rounded-md hover:bg-accent transition-colors">
                      <span className="font-mono font-bold text-lg flex-shrink-0">
                        {coin.icon}
                      </span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">
                          {coin.symbol.replace('/USDT', '')}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {t(coin.nameKey)}
                        </span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${CATEGORIES[coin.category].color} flex-shrink-0`}
                      >
                        {coin.category === 'major' ? '💎' : 
                         coin.category === 'midcap' ? '🚀' :
                         coin.category === 'affordable' ? '💰' :
                         coin.category === 'budget' ? '⭐' :
                         coin.category === 'defi' ? '🔄' : '😂'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with coin count */}
        <div className="p-3 border-t bg-muted/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredCoins.length} {t('coinSelector.coinsFound') || "coins"}
            </span>
            {searchQuery && (
              <button 
                onClick={clearSearch}
                className="text-xs hover:text-foreground transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        </div>
      </SelectContent>
    </Select>
  );
}