import ccxt
import pandas as pd
import time
import json
import logging
from datetime import datetime
import os
import numpy as np

# Setup safe logging without emojis
def setup_logging():
    """Setup safe logging for English messages"""
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Remove all existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # File handler (supports Unicode)
    file_handler = logging.FileHandler('trading_bot.log', encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    
    # Console handler (no emojis)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # Simple format without emojis
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

# Call logging setup
setup_logging()

class AdvancedTradingBot:
    def __init__(self, initial_balance=1000, risk_per_trade=0.02, max_drawdown=0.1):
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.risk_per_trade = risk_per_trade
        self.max_drawdown = max_drawdown
        self.position = None
        self.trades = []
        self.total_trades = 0
        self.winning_trades = 0
        self.equity_curve = []
        self.active_symbols = []
        
        # Setup files
        self.setup_files()
        
        # Connect to exchange
        self.setup_exchange()
        
        # Best coins for trading
        self.setup_best_coins()
    
    def setup_files(self):
        """Create necessary files"""
        if not os.path.exists('results'):
            os.makedirs('results')
        
        self.results_file = 'results/trading_results.json'
        self.trades_file = 'results/trades_history.csv'
        self.coins_performance_file = 'results/coins_performance.json'
    
    def setup_exchange(self):
        """Setup exchange connection"""
        try:
            self.exchange = ccxt.binance({
                'apiKey': 'wmijOPy8kSWfWGzTzTxCcSeWxvxhnj6zCSaYXMq9KQ29arpUs81PD4u5O3Tlu5N8',
                'secret': 'FrpxtVOmDCSDRtlqNdVeKi3rmEfZ8SJGh8Iu3l5CfV6WF7Ax5uDLvNXVtpJTlPT2',
                'sandbox': True,
                'enableRateLimit': True,
            })
            logging.info("Successfully connected to exchange")
        except Exception as e:
            logging.error("Connection error: %s", e)
            self.exchange = None
    
    def setup_best_coins(self):
        """Select best available coins on Binance"""
        # Actually available coins on Binance
        self.high_profit_coins = [
            'BTC/USDT',    # Bitcoin
            'ETH/USDT',    # Ethereum
            'BNB/USDT',    # Binance Coin
            'ADA/USDT',    # Cardano
            'DOT/USDT',    # Polkadot
            'SOL/USDT',    # Solana
            'AVAX/USDT',   # Avalanche
            'LINK/USDT',   # Chainlink
            'ATOM/USDT',   # Cosmos
            'XRP/USDT',    # Ripple
            'DOGE/USDT',   # Dogecoin
            # 'MATIC/USDT',  # Polygon
            'SHIB/USDT',   # Shiba Inu
            'NEAR/USDT',   # Near Protocol
            'ALGO/USDT'    # Algorand
        ]
        
        self.active_symbols = self.high_profit_coins
        logging.info("Selected %d coins for trading", len(self.active_symbols))
    
    def analyze_coin_potential(self, symbol):
        """Analyze profit potential for coin"""
        try:
            df = self.get_ohlcv_data(symbol, '1h', 100)
            if df is None or len(df) < 50:
                return 0
            
            # Calculate profit potential with safe defaults
            volatility = (df['high'] - df['low']).mean() / df['close'].mean()
            volume_trend = df['volume'].pct_change(5).mean() if not df['volume'].pct_change(5).isna().all() else 0
            price_trend = abs(df['close'].pct_change(10).mean()) if not df['close'].pct_change(10).isna().all() else 0
            
            # Safe RSI calculation
            rsi_values = self.calculate_rsi(df['close'])
            if rsi_values is not None and len(rsi_values) > 0 and not pd.isna(rsi_values.iloc[-1]):
                rsi = rsi_values.iloc[-1]
            else:
                rsi = 50  # Default value
            
            # Evaluate profit potential (0-100)
            profit_potential = (
                (volatility if not pd.isna(volatility) else 0.02) * 1000 +          # Volatility
                (volume_trend if not pd.isna(volume_trend) else 0) * 500 +          # Volume trend
                (price_trend if not pd.isna(price_trend) else 0) * 1000 +           # Price trend
                (50 - abs(50 - rsi)) * 0.5   # RSI in middle zone
            )
            
            return max(0, min(100, profit_potential))
            
        except Exception as e:
            logging.error("Error analyzing profit potential for %s: %s", symbol, e)
            return 0
    
    def get_best_coins_for_trading(self, top_n=5):
        """Get best coins for trading currently"""
        try:
            coin_scores = []
            
            for symbol in self.active_symbols:
                profit_potential = self.analyze_coin_potential(symbol)
                current_price = self.get_current_price(symbol)
                
                if current_price and profit_potential > 20:  # Ignore low potential coins
                    coin_scores.append({
                        'symbol': symbol,
                        'profit_potential': profit_potential,
                        'price': current_price
                    })
            
            # Sort by profit potential
            coin_scores.sort(key=lambda x: x['profit_potential'], reverse=True)
            return coin_scores[:top_n]
            
        except Exception as e:
            logging.error("Error selecting best coins: %s", e)
            return []
    
    def get_current_price(self, symbol='BTC/USDT'):
        """Get current price"""
        try:
            ticker = self.exchange.fetch_ticker(symbol)
            return ticker['last']
        except Exception as e:
            logging.error("Error getting price for %s: %s", symbol, e)
            return None
    
    def get_ohlcv_data(self, symbol='BTC/USDT', timeframe='1h', limit=100):
        """Get historical data"""
        try:
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            return df
        except Exception as e:
            logging.error("Error getting data for %s: %s", symbol, e)
            return None
    
    def calculate_indicators(self, df):
        """Calculate advanced technical indicators"""
        try:
            if df is None or len(df) == 0:
                return df
            
            # Moving averages
            df['MA_10'] = df['close'].rolling(10).mean()
            df['MA_20'] = df['close'].rolling(20).mean()
            df['MA_50'] = df['close'].rolling(50).mean()
            df['MA_100'] = df['close'].rolling(100).mean()
            
            # RSI multiple periods
            df['RSI_14'] = self.calculate_rsi(df['close'], 14)
            df['RSI_7'] = self.calculate_rsi(df['close'], 7)  # For short momentum
            
            # MACD
            df['MACD'], df['MACD_Signal'] = self.calculate_macd(df['close'])
            
            # Bollinger Bands
            df['BB_Upper'], df['BB_Lower'] = self.calculate_bollinger_bands(df['close'])
            df['BB_Middle'] = df['close'].rolling(20).mean()
            
            # Stochastic
            df['Stoch_K'], df['Stoch_D'] = self.calculate_stochastic(df)
            
            # Volume indicators
            df['Volume_MA'] = df['volume'].rolling(20).mean()
            df['Volume_Ratio'] = df['volume'] / df['Volume_MA']
            
            # Momentum indicators
            df['Momentum'] = df['close'] - df['close'].shift(5)
            df['Price_Change'] = df['close'].pct_change(5)
            
            # Fill NaN values with defaults
            numeric_columns = ['MA_10', 'MA_20', 'MA_50', 'MA_100', 'RSI_14', 'RSI_7', 
                             'MACD', 'MACD_Signal', 'BB_Upper', 'BB_Lower', 'BB_Middle',
                             'Stoch_K', 'Stoch_D', 'Volume_MA', 'Volume_Ratio', 
                             'Momentum', 'Price_Change']
            
            for col in numeric_columns:
                if col in df.columns:
                    if col in ['RSI_14', 'RSI_7', 'Stoch_K', 'Stoch_D']:
                        df[col] = df[col].fillna(50)  # Default for oscillators
                    elif col in ['MACD', 'MACD_Signal', 'Momentum']:
                        df[col] = df[col].fillna(0)   # Default for momentum
                    elif col == 'Volume_Ratio':
                        df[col] = df[col].fillna(1)   # Default volume ratio
                    elif col == 'Price_Change':
                        df[col] = df[col].fillna(0)   # Default price change
                    else:
                        df[col] = df[col].fillna(df['close'])  # Default to close price
            
            return df
        except Exception as e:
            logging.error("Error calculating indicators: %s", e)
            return df
    
    def calculate_rsi(self, prices, period=14):
        """Calculate RSI indicator safely"""
        try:
            if prices is None or len(prices) < period:
                return pd.Series([50] * len(prices))  # Default values
            
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).fillna(0)
            loss = (-delta.where(delta < 0, 0)).fillna(0)
            
            avg_gain = gain.rolling(window=period).mean()
            avg_loss = loss.rolling(window=period).mean()
            
            # Avoid division by zero
            rs = avg_gain / avg_loss.replace(0, float('nan')).fillna(1)
            rsi = 100 - (100 / (1 + rs))
            
            return rsi.fillna(50)  # Default value if error
        except Exception as e:
            logging.error("RSI calculation error: %s", e)
            return pd.Series([50] * len(prices))
    
    def calculate_macd(self, prices, fast=12, slow=26, signal=9):
        """Calculate MACD indicator"""
        try:
            if prices is None or len(prices) < slow:
                return pd.Series([0] * len(prices)), pd.Series([0] * len(prices))
            
            ema_fast = prices.ewm(span=fast).mean()
            ema_slow = prices.ewm(span=slow).mean()
            macd = ema_fast - ema_slow
            macd_signal = macd.ewm(span=signal).mean()
            return macd.fillna(0), macd_signal.fillna(0)
        except Exception as e:
            logging.error("MACD calculation error: %s", e)
            return pd.Series([0] * len(prices)), pd.Series([0] * len(prices))
    
    def calculate_bollinger_bands(self, prices, period=20, std=2):
        """Calculate Bollinger Bands"""
        try:
            if prices is None or len(prices) < period:
                return pd.Series([0] * len(prices)), pd.Series([0] * len(prices))
            
            sma = prices.rolling(period).mean()
            rolling_std = prices.rolling(period).std()
            upper_band = sma + (rolling_std * std)
            lower_band = sma - (rolling_std * std)
            return upper_band.fillna(prices), lower_band.fillna(prices)
        except Exception as e:
            logging.error("Bollinger Bands calculation error: %s", e)
            return pd.Series([0] * len(prices)), pd.Series([0] * len(prices))
    
    def calculate_stochastic(self, df, period=14):
        """Calculate Stochastic"""
        try:
            if df is None or len(df) < period:
                return pd.Series([50] * len(df)), pd.Series([50] * len(df))
            
            low_14 = df['low'].rolling(period).min()
            high_14 = df['high'].rolling(period).max()
            stoch_k = 100 * ((df['close'] - low_14) / (high_14 - low_14))
            stoch_d = stoch_k.rolling(3).mean()
            return stoch_k.fillna(50), stoch_d.fillna(50)
        except Exception as e:
            logging.error("Stochastic calculation error: %s", e)
            return pd.Series([50] * len(df)), pd.Series([50] * len(df))
    
    def aggressive_profit_strategy(self, df, symbol):
        """Aggressive strategy for quick profits - COMPLETELY FIXED"""
        try:
            if df is None or len(df) < 50:
                return 'HOLD', 0
            
            current = df.iloc[-1]
            
            # SAFE VALUE EXTRACTION - COMPLETELY FIXED
            def safe_value(key, default):
                """Safely extract value from current row"""
                try:
                    value = current.get(key)
                    if value is None or pd.isna(value):
                        return default
                    return float(value)
                except (TypeError, ValueError):
                    return default
            
            # Extract all values safely
            ma_10 = safe_value('MA_10', 0)
            ma_20 = safe_value('MA_20', 0)
            ma_50 = safe_value('MA_50', 0)
            rsi_7 = safe_value('RSI_7', 50)
            rsi_14 = safe_value('RSI_14', 50)
            macd = safe_value('MACD', 0)
            macd_signal = safe_value('MACD_Signal', 0)
            volume_ratio = safe_value('Volume_Ratio', 1)
            bb_upper = safe_value('BB_Upper', current['close'] * 1.1)
            bb_middle = safe_value('BB_Middle', current['close'])
            stoch_k = safe_value('Stoch_K', 50)
            stoch_d = safe_value('Stoch_D', 50)
            momentum = safe_value('Momentum', 0)
            price_change = safe_value('Price_Change', 0)
            current_close = safe_value('close', 0)
            
            # STRONG BUY CONDITIONS - ALL VALUES ARE SAFE NOW
            strong_buy_conditions = []
            
            # Condition 1: Strong uptrend
            if ma_10 > ma_20 and ma_20 > ma_50:
                strong_buy_conditions.append(True)
            else:
                strong_buy_conditions.append(False)
            
            # Condition 2: RSI in good range
            if 30 < rsi_7 < 80:
                strong_buy_conditions.append(True)
            else:
                strong_buy_conditions.append(False)
            
            # Condition 3: MACD positive
            if macd > macd_signal:
                strong_buy_conditions.append(True)
            else:
                strong_buy_conditions.append(False)
            
            # Condition 4: High volume
            if volume_ratio > 1.2:
                strong_buy_conditions.append(True)
            else:
                strong_buy_conditions.append(False)
            
            # Condition 5: Near resistance
            if current_close > bb_upper * 0.98:
                strong_buy_conditions.append(True)
            else:
                strong_buy_conditions.append(False)
            
            # Condition 6: Stochastic rising
            if stoch_k > stoch_d and stoch_k < 80:
                strong_buy_conditions.append(True)
            else:
                strong_buy_conditions.append(False)
            
            # Condition 7: Positive momentum
            if momentum > 0:
                strong_buy_conditions.append(True)
            else:
                strong_buy_conditions.append(False)
            
            # Condition 8: Not in sharp decline
            if price_change > -0.02:
                strong_buy_conditions.append(True)
            else:
                strong_buy_conditions.append(False)
            
            # SELL CONDITIONS
            strong_sell_conditions = []
            
            # Condition 1: Trend reversal
            if ma_10 < ma_20:
                strong_sell_conditions.append(True)
            else:
                strong_sell_conditions.append(False)
            
            # Condition 2: Overbought
            if rsi_14 > 75:
                strong_sell_conditions.append(True)
            else:
                strong_sell_conditions.append(False)
            
            # Condition 3: MACD negative
            if macd < macd_signal:
                strong_sell_conditions.append(True)
            else:
                strong_sell_conditions.append(False)
            
            # Condition 4: Low volume
            if volume_ratio < 0.8:
                strong_sell_conditions.append(True)
            else:
                strong_sell_conditions.append(False)
            
            # Condition 5: Below average
            if current_close < bb_middle:
                strong_sell_conditions.append(True)
            else:
                strong_sell_conditions.append(False)
            
            # Condition 6: Stochastic falling
            if stoch_k < stoch_d:
                strong_sell_conditions.append(True)
            else:
                strong_sell_conditions.append(False)
            
            # Condition 7: Negative momentum
            if momentum < 0:
                strong_sell_conditions.append(True)
            else:
                strong_sell_conditions.append(False)
            
            # Condition 8: 8%+ profit (only if we have position)
            if self.position and current_close >= self.position['entry_price'] * 1.08:
                strong_sell_conditions.append(True)
            else:
                strong_sell_conditions.append(False)
            
            # Calculate signal strength - ALL VALUES ARE SAFE NOW
            buy_score = sum(strong_buy_conditions) * 2
            
            # Additional conditions for high volatility coins
            if any(high_vol_coin in symbol for high_vol_coin in ['SOL', 'AVAX', 'ADA', 'DOT']):
                if volume_ratio > 1.5:
                    buy_score += 2
                if abs(price_change) > 0.05:  # Strong price movement
                    buy_score += 1
            
            sell_score = sum(strong_sell_conditions)
            
            # Trading decision
            if buy_score >= 8:
                return 'BUY', buy_score
            elif sell_score >= 4 or (self.position and current_close <= self.position['stop_loss']):
                return 'SELL', sell_score
            else:
                return 'HOLD', 0
                
        except Exception as e:
            logging.error("Strategy error for %s: %s", symbol, e)
            return 'HOLD', 0
    
    def calculate_position_size(self, current_price, stop_loss_price, symbol):
        """Calculate position size with profit adjustments"""
        try:
            base_risk = self.balance * self.risk_per_trade
            
            # Increase risk for high-profit coins
            profit_potential = self.analyze_coin_potential(symbol)
            if profit_potential > 70:
                base_risk *= 1.5  # 50% increase for high potential
            elif profit_potential > 50:
                base_risk *= 1.2  # 20% increase for medium potential
            
            price_diff = abs(current_price - stop_loss_price)
            
            if price_diff == 0:
                return 0
                
            position_size = base_risk / price_diff
            
            # Flexible maximum based on profit potential
            max_position_value = self.balance * min(0.15, 0.08 * (profit_potential / 50))
            
            if position_size * current_price > max_position_value:
                position_size = max_position_value / current_price
            
            return position_size
        except Exception as e:
            logging.error("Position size calculation error: %s", e)
            return 0
    
    def execute_trade(self, signal, signal_strength, current_price, symbol):
        """Execute trade with profit improvements"""
        try:
            if signal == 'BUY' and self.position is None:
                # Dynamic stop loss and take profit
                stop_loss_pct = 0.015  # 1.5% base
                take_profit_pct = 0.06  # 6% base
                
                # Adjust based on signal strength
                if signal_strength >= 10:
                    take_profit_pct = 0.08  # 8% for strong signals
                elif signal_strength >= 8:
                    take_profit_pct = 0.06  # 6% for medium signals
                
                stop_loss_price = current_price * (1 - stop_loss_pct)
                take_profit_price = current_price * (1 + take_profit_pct)
                
                # Calculate position size
                position_size = self.calculate_position_size(current_price, stop_loss_price, symbol)
                
                if position_size > 0:
                    self.position = {
                        'entry_price': current_price,
                        'size': position_size,
                        'stop_loss': stop_loss_price,
                        'take_profit': take_profit_price,
                        'entry_time': datetime.now(),
                        'type': 'BUY',
                        'signal_strength': signal_strength,
                        'symbol': symbol
                    }
                    self.balance -= position_size * current_price
                    
                    trade_info = {
                        'type': 'BUY',
                        'symbol': symbol,
                        'price': current_price,
                        'size': position_size,
                        'time': datetime.now(),
                        'signal_strength': signal_strength,
                        'take_profit_pct': take_profit_pct,
                        'stop_loss_pct': stop_loss_pct
                    }
                    self.trades.append(trade_info)
                    self.save_trade_to_file(trade_info)
                    
                    logging.info("BUY %s: %.6f at $%.2f | TP: %.1f%%", symbol, position_size, current_price, take_profit_pct*100)
                    
            elif signal == 'SELL' and self.position and self.position['symbol'] == symbol:
                # Close buy position
                profit_loss = (current_price - self.position['entry_price']) * self.position['size']
                self.balance += self.position['size'] * current_price
                
                # Update statistics
                self.total_trades += 1
                if profit_loss > 0:
                    self.winning_trades += 1
                
                trade_info = {
                    'type': 'SELL',
                    'symbol': symbol,
                    'price': current_price,
                    'size': self.position['size'],
                    'profit_loss': profit_loss,
                    'time': datetime.now(),
                    'entry_price': self.position['entry_price'],
                    'hold_duration': (datetime.now() - self.position['entry_time']).total_seconds() / 3600
                }
                self.trades.append(trade_info)
                self.save_trade_to_file(trade_info)
                
                profit_pct = (profit_loss / (self.position['entry_price'] * self.position['size'])) * 100
                logging.info("SELL %s: %.6f at $%.2f | Profit: $%.2f (%.1f%%)", symbol, self.position['size'], current_price, profit_loss, profit_pct)
                self.position = None
                
            # Manage open position
            elif self.position and self.position['symbol'] == symbol:
                self.manage_open_position(current_price, symbol)
                
        except Exception as e:
            logging.error("Trade execution error for %s: %s", symbol, e)
    
    def manage_open_position(self, current_price, symbol):
        """Intelligent open position management"""
        try:
            if self.position['type'] == 'BUY':
                # Trailing stop loss after profit
                if current_price >= self.position['entry_price'] * 1.03:  # After 3% profit
                    new_stop_loss = self.position['entry_price'] * 1.01   # Stop at 1% profit
                    if new_stop_loss > self.position['stop_loss']:
                        self.position['stop_loss'] = new_stop_loss
                
                # Stop loss
                if current_price <= self.position['stop_loss']:
                    self.force_close_position(current_price, "Stop Loss", symbol)
                # Take profit
                elif current_price >= self.position['take_profit']:
                    self.force_close_position(current_price, "Take Profit", symbol)
                    
        except Exception as e:
            logging.error("Position management error: %s", e)
    
    def force_close_position(self, current_price, reason, symbol):
        """Force close position"""
        try:
            if self.position['type'] == 'BUY':
                profit_loss = (current_price - self.position['entry_price']) * self.position['size']
                self.balance += self.position['size'] * current_price
                
                self.total_trades += 1
                if profit_loss > 0:
                    self.winning_trades += 1
                
                trade_info = {
                    'type': 'SELL',
                    'symbol': symbol,
                    'price': current_price,
                    'size': self.position['size'],
                    'profit_loss': profit_loss,
                    'time': datetime.now(),
                    'entry_price': self.position['entry_price'],
                    'reason': reason
                }
                self.trades.append(trade_info)
                self.save_trade_to_file(trade_info)
                
                logging.info("CLOSE %s: %s | Price: $%.2f | Profit: $%.2f", symbol, reason, current_price, profit_loss)
                self.position = None
                
        except Exception as e:
            logging.error("Force close error: %s", e)
    
    def save_trade_to_file(self, trade_info):
        """Save trade to file"""
        try:
            # Save to JSON
            with open(self.results_file, 'w', encoding='utf-8') as f:
                results = {
                    'current_balance': self.balance,
                    'total_profit': self.balance - self.initial_balance,
                    'total_trades': self.total_trades,
                    'winning_trades': self.winning_trades,
                    'win_rate': (self.winning_trades / self.total_trades * 100) if self.total_trades > 0 else 0,
                    'last_update': datetime.now().isoformat(),
                    'best_performing_coins': self.get_best_performing_coins()
                }
                json.dump(results, f, indent=4, ensure_ascii=False)
            
            # Save to CSV
            df_trade = pd.DataFrame([trade_info])
            if not os.path.exists(self.trades_file):
                df_trade.to_csv(self.trades_file, index=False, encoding='utf-8')
            else:
                df_trade.to_csv(self.trades_file, mode='a', header=False, index=False, encoding='utf-8')
                
        except Exception as e:
            logging.error("Save trade error: %s", e)
    
    def get_best_performing_coins(self):
        """Get best performing coins"""
        try:
            coin_performance = {}
            for trade in self.trades[-50:]:  # Last 50 trades
                symbol = trade.get('symbol', 'Unknown')
                profit = trade.get('profit_loss', 0)
                if symbol not in coin_performance:
                    coin_performance[symbol] = {'total_profit': 0, 'trades': 0}
                coin_performance[symbol]['total_profit'] += profit
                coin_performance[symbol]['trades'] += 1
            
            # Sort by profitability
            sorted_coins = sorted(coin_performance.items(), 
                                key=lambda x: x[1]['total_profit'], reverse=True)
            return {coin: data for coin, data in sorted_coins[:5]}
        except:
            return {}
    
    def print_stats(self):
        """Display statistics"""
        try:
            total_profit = self.balance - self.initial_balance
            win_rate = (self.winning_trades / self.total_trades * 100) if self.total_trades > 0 else 0
            
            print("\n" + "="*60)
            print("ADVANCED BOT STATISTICS:")
            print("="*60)
            print(f"Current Balance: ${self.balance:.2f}")
            print(f"Total Profit: ${total_profit:.2f}")
            print(f"Profit Percentage: {(total_profit/self.initial_balance)*100:.1f}%")
            print(f"Total Trades: {self.total_trades}")
            print(f"Winning Trades: {self.winning_trades}")
            print(f"Success Rate: {win_rate:.1f}%")
            print(f"Max Drawdown Allowed: {self.max_drawdown * 100}%")
            print(f"Risk Per Trade: {self.risk_per_trade * 100}%")
            
            # Best coins
            best_coins = self.get_best_performing_coins()
            if best_coins:
                print("\nTOP PERFORMING COINS:")
                for coin, data in list(best_coins.items())[:3]:
                    avg_profit = data['total_profit'] / data['trades']
                    print(f"   {coin}: ${data['total_profit']:.2f} ({data['trades']} trades) | Avg: ${avg_profit:.2f}")
            
            if total_profit > 0:
                print("Bot is generating excellent profits!")
            else:
                print("Bot in testing phase - continue monitoring")
            print("="*60)
            
        except Exception as e:
            logging.error("Statistics display error: %s", e)
    
    def check_drawdown(self):
        """Check if reached maximum allowed loss"""
        try:
            current_drawdown = (self.initial_balance - self.balance) / self.initial_balance
            if current_drawdown >= self.max_drawdown:
                logging.error("Bot stopped - reached maximum allowed loss: %.1f%%", current_drawdown*100)
                return True
            return False
        except Exception as e:
            logging.error("Drawdown check error: %s", e)
            return False
    
    def run(self):
        """Run bot on best coins"""
        logging.info("Starting Advanced Trading Bot...")
        
        try:
            while True:
                # Check if reached maximum loss
                if self.check_drawdown():
                    break
                
                # Get best 3 coins for trading currently
                best_coins = self.get_best_coins_for_trading(3)
                
                if not best_coins:
                    logging.warning("No suitable coins found for trading")
                    time.sleep(300)
                    continue
                
                for coin_data in best_coins:
                    symbol = coin_data['symbol']
                    profit_potential = coin_data['profit_potential']
                    
                    # If we have open position, focus on managing it
                    if self.position and self.position['symbol'] == symbol:
                        current_price = self.get_current_price(symbol)
                        if current_price:
                            self.manage_open_position(current_price, symbol)
                        continue
                    
                    # If no open position, look for new opportunities
                    if self.position is None:
                        current_price = self.get_current_price(symbol)
                        if current_price is None:
                            continue
                        
                        df = self.get_ohlcv_data(symbol, '1h')
                        if df is None:
                            continue
                        
                        df = self.calculate_indicators(df)
                        signal, signal_strength = self.aggressive_profit_strategy(df, symbol)
                        
                        if signal in ['BUY', 'SELL']:
                            logging.info("SIGNAL %s for %s | Strength: %s | Profit Potential: %.1f%%", signal, symbol, signal_strength, profit_potential)
                            self.execute_trade(signal, signal_strength, current_price, symbol)
                
                # Save data and display statistics
                self.equity_curve.append({
                    'timestamp': datetime.now(),
                    'equity': self.balance
                })
                
                # Display statistics every 5 trades
                if self.total_trades % 5 == 0 and self.total_trades > 0:
                    self.print_stats()
                
                # Wait before next iteration
                logging.info("Waiting 3 minutes for next analysis... | Best coins: %s", [c['symbol'] for c in best_coins])
                time.sleep(180)  # 3 minutes
                
        except KeyboardInterrupt:
            logging.info("Bot stopped by user")
        except Exception as e:
            logging.error("Unexpected error: %s", e)
        finally:
            self.print_stats()
            logging.info("Results saved in 'results/' folder")

# Run bot
if __name__ == "__main__":
    print("ADVANCED TRADING BOT - PROFIT VERSION")
    print("Specialized in high-profit coins: SOL, MATIC, AVAX, ADA, DOT")
    print("WARNING: For testing only - do not use real money!")
    
    # Setup bot
    bot = AdvancedTradingBot(
        initial_balance=1000,      # $1000 starting balance
        risk_per_trade=0.025,      # 2.5% risk per trade
        max_drawdown=0.12          # 12% maximum loss
    )
    
    # Run bot
    bot.run()