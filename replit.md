# AI Trading Bot Platform

## Overview

An AI-powered web platform offering real-time cryptocurrency trading simulation, testnet, and live trading capabilities. It features real-time analytics, automated AI-driven strategies, live market data visualization, and comprehensive performance tracking across 55 cryptocurrencies. The platform aims to provide a robust environment for both novice and experienced traders to develop and deploy trading strategies.

## Recent Changes

### November 14, 2025 - Code Refactoring & Price Fixes
- **Removed Shared Folder**: Eliminated shared/ directory, moved types to server/types.ts and client/src/types.ts
- **Import Cleanup**: Updated all imports across frontend and backend to use local type definitions
- **Price Data Fixed**: Added lazy initialization in TradingEngine.getCurrentPrices() to populate prices on first request
- **Price Slider Enhanced**: Fixed infinite loop issue and integrated WebSocket price updates
- **TypeScript Config**: Updated tsconfig.json to remove @shared path mapping

### November 14, 2025 - Trading Mode System Enhancement
- **Restored 3-Mode Architecture**: Simulation (default), Testnet, and Real trading modes
- **Simulation Mode**: Local trades with real Binance chart data, no credentials required
- **Database Migration**: Automatic conversion of legacy 'testnet' defaults to 'simulation' mode
- **Initialization Guards**: Added `ensureInitialized()` to prevent race conditions during startup
- **Mode Sync**: Bot state mode now syncs from database after migration to ensure consistency
- **Frontend Updates**: All components (bot-controls, settings, dashboard) updated with accurate 3-mode displays
- **Portfolio API**: Now includes mode field in all responses for accurate dashboard badge display

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

*   **Framework**: React 18 with TypeScript, using Vite for building.
*   **State Management**: TanStack Query for server state caching and React Hooks for local state.
*   **UI Component System**: Shadcn/ui (built on Radix UI) and Tailwind CSS for styling, optimized for dark theme financial dashboards.
*   **Charting**: Recharts for real-time price charts and performance graphs, supporting multiple timeframes (1m, 5m, 15m, 1H, 4H, 1D) and technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands).
*   **Type System**: Local TypeScript types in client/src/types.ts for all frontend interfaces.

### Backend Architecture

*   **Server Framework**: Express.js with TypeScript on Node.js.
*   **API Design**: RESTful endpoints and WebSocket for real-time data and notifications. Zod for schema validation.
*   **Trading Engine**: Supports three distinct modes:
    *   **Simulation** (default): Local trades with real Binance chart data, no credentials required
    *   **Testnet**: Binance Spot testnet paper trading with test funds
    *   **Real**: Live Binance Spot trading with real funds (requires confirmation)
*   **Trading Strategies**: 10+ AI-driven strategies with dynamic selection
*   **Error Handling**: Structured error hierarchy for consistent API responses (e.g., MissingCredentialsError, ProviderConnectionError)
*   **Initialization System**: Async initialization with `ensureInitialized()` guards to prevent race conditions
*   **Price System**: Lazy loading with automatic fallback to simulated prices when exchange unavailable
*   **Type System**: Centralized TypeScript types in server/types.ts including database schemas and business logic types.

### Data Storage Solutions

*   **Database**: SQLite (`data/app.db`) for persistent local storage, utilizing Drizzle ORM with `better-sqlite3` driver.
*   **Schema**: Tables for Users, Portfolio Settings, Trades, and Positions. Decimal values are stored as TEXT for precision, and timestamps as INTEGER.
*   **Migration Logic**: Automatic conversion of legacy modes to current defaults on startup

### Real-Time Communication

*   **WebSocket**: Custom WebSocket server integrated with Express for live price updates, trade notifications, and portfolio changes.
*   **Price Updates**: Real-time price broadcasts via WebSocket with fallback to polling.

### Build & Deployment

*   **Development**: Vite dev server and `tsx` for server-side execution.
*   **Production**: Vite builds client assets, and `esbuild` bundles server code into a single deployable unit.

## External Dependencies

*   **Third-Party APIs**: CCXT Library for cryptocurrency exchange integration (Binance API).
*   **Database Driver**: `better-sqlite3` for SQLite interaction.
*   **UI Libraries**: Radix UI (headless components), Recharts (charting), Lucide React (icons), Framer Motion (animations).
*   **Development Tools**: Drizzle ORM (type-safe SQL), Zod (runtime validation), TanStack Query (data fetching), Tailwind CSS (styling), TypeScript (static typing).
