import type { ExchangeProvider } from './exchange-provider';
import { createExchangeProvider } from './exchange-provider';
import type { TradingMode } from '@shared/schema';
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

  /**
   * Normalize legacy 'paper' mode to 'testnet'
   */
  private normalizeTradingMode(mode: TradingMode | 'paper'): TradingMode {
    if (mode === 'paper') {
      console.log('⚠️  Legacy "paper" mode detected, mapping to "testnet"');
      return 'testnet';
    }
    return mode as TradingMode;
  }

  async initialize(mode: TradingMode | 'paper' = 'simulation') {
    const normalizedMode = this.normalizeTradingMode(mode);
    
    // Allow reinitialization with different mode
    if (this.isInitialized && this.currentMode === normalizedMode) {
      return; // Already initialized with same mode
    }

    const previousMode = this.currentMode;
    this.currentMode = normalizedMode;

    // Always ensure simulation provider is available first
    try {
      await this.ensureProvider('simulation');
      this.isInitialized = true; // Mark as initialized - simulation is always available
    } catch (error) {
      console.error('❌ Failed to initialize simulation provider:', error);
      this.isInitialized = false;
      this.currentMode = previousMode; // Roll back
      throw error; // Only throw if simulation fails (should never happen)
    }

    // Now initialize the requested mode (fail-fast if credentials missing)
    if (normalizedMode !== 'simulation') {
      try {
        await this.ensureProvider(normalizedMode);
      } catch (error) {
        // Roll back to simulation since requested mode failed
        this.currentMode = 'simulation';
        console.warn(`⚠️  Failed to initialize ${normalizedMode}, falling back to simulation`);
        throw error; // Re-throw so caller knows
      }
    }
    
    console.log(`✅ ExchangeProviderManager initialized in ${normalizedMode} mode`);
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
        // Simulation doesn't need credentials
        console.log('📊 Creating simulation provider...');
        provider = await createExchangeProvider('simulation', {});
      } else if (mode === 'testnet') {
        // Testnet uses separate testnet credentials
        const apiKey = process.env.BINANCE_API_KEY || keys?.apiKey;
        const secret = process.env.BINANCE_SECRET || keys?.secretKey;
        
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
  async switchMode(newMode: TradingMode | 'paper'): Promise<void> {
    const normalizedMode = this.normalizeTradingMode(newMode);
    
    if (normalizedMode === this.currentMode) {
      return;
    }

    console.log(`🔄 Switching from ${this.currentMode} to ${normalizedMode} mode`);
    
    // Ensure the new provider is initialized and connected (throws if credentials missing)
    await this.ensureProvider(normalizedMode);
    
    // Verify provider is available
    const newProvider = this.providers[normalizedMode];
    if (!newProvider) {
      throw new Error(`Failed to initialize ${normalizedMode} provider`);
    }
    
    // Ensure connection
    if (!newProvider.isConnected()) {
      await newProvider.connect();
    }
    
    // Only update current mode after successful initialization
    this.currentMode = normalizedMode;
    console.log(`✅ Successfully switched to ${normalizedMode} mode`);
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
