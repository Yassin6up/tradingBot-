/**
 * Exchange-related error hierarchy for tri-mode trading system
 */

export enum ExchangeErrorCode {
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',
  PROVIDER_CONNECTION_FAILED = 'PROVIDER_CONNECTION_FAILED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  TRADING_MODE_TRANSITION_FAILED = 'TRADING_MODE_TRANSITION_FAILED',
  UNKNOWN = 'UNKNOWN',
}

export class BaseExchangeError extends Error {
  constructor(
    message: string,
    public readonly code: ExchangeErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BaseExchangeError';
    Object.setPrototypeOf(this, BaseExchangeError.prototype);
  }
}

export class MissingCredentialsError extends BaseExchangeError {
  constructor(
    public readonly mode: 'testnet' | 'real',
    message?: string,
    cause?: Error
  ) {
    const defaultMessage = mode === 'testnet'
      ? 'Binance Testnet API credentials (BINANCE_TESTNET_API_KEY/SECRET) required for testnet mode'
      : 'Binance API credentials (BINANCE_API_KEY/SECRET) required for real trading mode';
    
    super(message || defaultMessage, ExchangeErrorCode.MISSING_CREDENTIALS, cause);
    this.name = 'MissingCredentialsError';
    Object.setPrototypeOf(this, MissingCredentialsError.prototype);
  }
}

export class ProviderConnectionError extends BaseExchangeError {
  constructor(
    public readonly mode: string,
    message: string,
    cause?: Error
  ) {
    super(message, ExchangeErrorCode.PROVIDER_CONNECTION_FAILED, cause);
    this.name = 'ProviderConnectionError';
    Object.setPrototypeOf(this, ProviderConnectionError.prototype);
  }
}

export class ProviderUnavailableError extends BaseExchangeError {
  constructor(
    public readonly mode: string,
    message?: string,
    cause?: Error
  ) {
    super(
      message || `No provider available for ${mode} mode`,
      ExchangeErrorCode.PROVIDER_UNAVAILABLE,
      cause
    );
    this.name = 'ProviderUnavailableError';
    Object.setPrototypeOf(this, ProviderUnavailableError.prototype);
  }
}

export class TradingModeTransitionError extends BaseExchangeError {
  constructor(
    public readonly fromMode: string,
    public readonly toMode: string,
    message: string,
    cause?: Error
  ) {
    super(message, ExchangeErrorCode.TRADING_MODE_TRANSITION_FAILED, cause);
    this.name = 'TradingModeTransitionError';
    Object.setPrototypeOf(this, TradingModeTransitionError.prototype);
  }
}
