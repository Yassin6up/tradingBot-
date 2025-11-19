import type { ExchangeProvider } from './exchange-provider';
import { createExchangeProvider } from './exchange-provider';
import type { TradingMode } from '../types';
import { storage } from '../storage';
import { MissingCredentialsError, ProviderConnectionError, ProviderUnavailableError } from '../errors/exchange-errors';

/**
 * Manages exchange providers for simulation, testnet, and real trading modes
 * Uses lazy initialization to avoid unnecessary credential usage
 */
export class ExchangeProviderManager {
  private providers: Record<TradingMode, ExchangeProvider | null> = {
    simulation: null,
    testnet: null,
    real: null,
  };
  private currentMode: TradingMode = 'simulation';
  private isInitialized: boolean = false;

  async initialize(mode: TradingMode = 'simulation') {
    
    // Allow reinitialization with different mode
    if (this.isInitialized && this.currentMode === mode) {
      return; // Already initialized with same mode
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;

    // Initialize the requested mode (fail-fast if credentials missing)
    try {
      await this.ensureProvider(mode);
      this.isInitialized = true;
    } catch (error) {
      console.error(`❌ Failed to initialize ${mode} provider:`, error);
      this.isInitialized = false;
      this.currentMode = previousMode; // Roll back
      throw error;
    }
    
    console.log(`✅ ExchangeProviderManager initialized in ${mode} mode`);
  }

  /**
   * Lazy-load and connect a provider for the given mode
   */
  private async ensureProvider(mode: TradingMode): Promise<void> {
    if (this.providers[mode]) {
      return; // Already initialized
    }

    try {
      // Get API keys from storage
      const keys = await storage.getApiKeys("binance");

      let provider: ExchangeProvider;

      if (mode === 'simulation') {
        // Simulation doesn't need credentials - uses real market data but local trades
        console.log('📊 Creating simulation provider (no credentials required)...');
        provider = await createExchangeProvider('simulation', {});
      } else if (mode === 'testnet') {
        // Testnet uses separate testnet credentials
        const apiKey = process.env.BINANCE_TESTNET_API_KEY || keys?.apiKey;
        const secret = process.env.BINANCE_TESTNET_SECRET || keys?.secretKey;
        
        if (!apiKey || !secret) {
          throw new MissingCredentialsError('testnet');
        }
        
        console.log('🧪 Creating testnet provider...');
        provider = await createExchangeProvider('testnet', { apiKey, secret });
      } else if (mode === 'real') {
        // Real mode uses production credentials
        const apiKey = process.env.BINANCE_API_KEY || keys?.apiKey;
        const secret = process.env.BINANCE_SECRET || keys?.secretKey;
        
        if (!apiKey || !secret) {
          throw new MissingCredentialsError('real');
        }
        
        console.log('💰 Creating real provider...');
        provider = await createExchangeProvider('real', { apiKey, secret });
      } else {
        throw new ProviderUnavailableError(mode, `Unknown trading mode: ${mode}`);
      }

      // Ensure provider is connected
      if (!provider.isConnected()) {
        await provider.connect();
      }

      this.providers[mode] = provider;
      console.log(`✅ ${mode} provider initialized and connected`);
    } catch (error) {
      // Wrap unknown errors in ProviderConnectionError
      if (error instanceof MissingCredentialsError || error instanceof ProviderUnavailableError) {
        throw error; // Already wrapped
      }
      
      // Network/CCXT/connection errors
      throw new ProviderConnectionError(
        mode,
        `Failed to connect ${mode} provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get the active provider based on current mode
   */
  async getActiveProvider(): Promise<ExchangeProvider> {
    if (!this.isInitialized) {
      throw new ProviderUnavailableError(
        this.currentMode,
        'ExchangeProviderManager not initialized'
      );
    }

    // Ensure the provider for the current mode is initialized
    await this.ensureProvider(this.currentMode);

    const provider = this.providers[this.currentMode];
    
    if (!provider) {
      throw new ProviderUnavailableError(this.currentMode);
    }

    return provider;
  }

  /**
   * Switch between trading modes
   */
  async switchMode(newMode: TradingMode): Promise<void> {
    if (newMode === this.currentMode) {
      return;
    }

    console.log(`🔄 Switching from ${this.currentMode} to ${newMode} mode`);
    
    // Ensure the new provider is initialized and connected (throws if credentials missing)
    await this.ensureProvider(newMode);
    
    // Verify provider is available
    const newProvider = this.providers[newMode];
    if (!newProvider) {
      throw new Error(`Failed to initialize ${newMode} provider`);
    }
    
    // Ensure connection
    if (!newProvider.isConnected()) {
      await newProvider.connect();
    }
    
    // Only update current mode after successful initialization
    this.currentMode = newMode;
    console.log(`✅ Successfully switched to ${newMode} mode`);
  }

  /**
   * Get current mode
   */
  getCurrentMode(): TradingMode {
    return this.currentMode;
  }

  /**
   * Disconnect all providers
   */
  disconnect() {
    for (const [mode, provider] of Object.entries(this.providers)) {
      if (provider) {
        provider.disconnect();
      }
    }
    this.providers = {
      simulation: null,
      testnet: null,
      real: null,
    };
    this.isInitialized = false;
    console.log('🔌 All exchange providers disconnected');
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
let providerManager: ExchangeProviderManager | null = null;

export function getExchangeProviderManager(): ExchangeProviderManager {
  if (!providerManager) {
    providerManager = new ExchangeProviderManager();
  }
  return providerManager;
}
