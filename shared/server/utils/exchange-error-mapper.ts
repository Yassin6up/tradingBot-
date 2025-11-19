/**
 * Maps exchange errors to HTTP responses with actionable user messages
 */

import { 
  BaseExchangeError, 
  MissingCredentialsError, 
  ProviderConnectionError,
  ProviderUnavailableError,
  ExchangeErrorCode 
} from '../errors/exchange-errors';

export interface ErrorResponse {
  status: number;
  error: string;
  message: string;
  details?: string;
}

export function mapExchangeErrorToResponse(error: unknown): ErrorResponse {
  // Handle our custom exchange errors
  if (error instanceof MissingCredentialsError) {
    let message = '';
    if (error.mode === 'testnet') {
      message = 'Binance Testnet API credentials required for testnet mode. Please add BINANCE_TESTNET_API_KEY and BINANCE_TESTNET_SECRET to your environment variables in Settings, or switch to simulation mode.';
    } else if (error.mode === 'real') {
      message = 'Binance API credentials required for real trading. Please configure your BINANCE_API_KEY and BINANCE_SECRET in Settings. Warning: Real mode uses real money. You can use simulation or testnet mode for risk-free trading.';
    } else {
      message = error.message;
    }
    
    return {
      status: 400,
      error: 'Missing credentials',
      message,
      details: error.message
    };
  }
  
  if (error instanceof ProviderConnectionError) {
    return {
      status: 503,
      error: 'Provider unavailable',
      message: `Unable to connect to exchange provider. ${error.message}. Please check your network connection and API credentials.`,
      details: error.cause?.message || error.message
    };
  }
  
  if (error instanceof ProviderUnavailableError) {
    return {
      status: 503,
      error: 'Provider unavailable',
      message: `The ${error.mode} trading provider is not available. ${error.message}`,
      details: error.message
    };
  }
  
  if (error instanceof BaseExchangeError) {
    // Generic exchange error handler
    switch (error.code) {
      case ExchangeErrorCode.MISSING_CREDENTIALS:
        return {
          status: 400,
          error: 'Missing credentials',
          message: error.message,
          details: error.cause?.message
        };
      case ExchangeErrorCode.PROVIDER_CONNECTION_FAILED:
      case ExchangeErrorCode.PROVIDER_UNAVAILABLE:
        return {
          status: 503,
          error: 'Service unavailable',
          message: error.message,
          details: error.cause?.message
        };
      case ExchangeErrorCode.TRADING_MODE_TRANSITION_FAILED:
        return {
          status: 400,
          error: 'Mode transition failed',
          message: error.message,
          details: error.cause?.message
        };
      default:
        return {
          status: 500,
          error: 'Exchange error',
          message: error.message,
          details: error.cause?.message
        };
    }
  }
  
  // Not one of our exchange errors - return generic 500
  return {
    status: 500,
    error: 'Internal server error',
    message: error instanceof Error ? error.message : 'Unknown error',
    details: error instanceof Error ? error.stack : undefined
  };
}
