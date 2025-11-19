# AI Trading Bot Platform

## Overview

An AI-powered web platform offering real-time cryptocurrency trading simulation, testnet, and live trading capabilities. It features real-time analytics, automated AI-driven strategies, live market data visualization, and comprehensive performance tracking across 55 cryptocurrencies. The platform aims to provide a robust environment for both novice and experienced traders to develop and deploy trading strategies.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

*   **Framework**: React 18 with TypeScript, using Vite for building.
*   **State Management**: TanStack Query for server state caching and React Hooks for local state.
*   **UI Component System**: Shadcn/ui (built on Radix UI) and Tailwind CSS for styling, optimized for dark theme financial dashboards.
*   **Charting**: Recharts for real-time price charts and performance graphs, supporting multiple timeframes (1m, 5m, 15m, 1H, 4H, 1D) and technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands).

### Backend Architecture

*   **Server Framework**: Express.js with TypeScript on Node.js.
*   **API Design**: RESTful endpoints and WebSocket for real-time data and notifications. Zod for schema validation.
*   **Trading Engine**: Supports three distinct modes (simulation, testnet, real) with 10+ AI-driven strategies. Includes an in-memory simulation engine and integration with Binance Spot for testnet and real trading.
*   **Error Handling**: Structured error hierarchy for consistent API responses (e.g., MissingCredentialsError, ProviderConnectionError).

### Data Storage Solutions

*   **Database**: SQLite (`data/app.db`) for persistent local storage, utilizing Drizzle ORM with `better-sqlite3` driver.
*   **Schema**: Tables for Users, Portfolio Settings, Trades, and Positions. Decimal values are stored as TEXT for precision, and timestamps as INTEGER.

### Real-Time Communication

*   **WebSocket**: Custom WebSocket server integrated with Express for live price updates, trade notifications, and portfolio changes.

### Build & Deployment

*   **Development**: Vite dev server and `tsx` for server-side execution.
*   **Production**: Vite builds client assets, and `esbuild` bundles server code into a single deployable unit.

## External Dependencies

*   **Third-Party APIs**: CCXT Library for cryptocurrency exchange integration (Binance API).
*   **Database Driver**: `better-sqlite3` for SQLite interaction.
*   **UI Libraries**: Radix UI (headless components), Recharts (charting), Lucide React (icons).
*   **Development Tools**: Drizzle ORM (type-safe SQL), Zod (runtime validation), TanStack Query (data fetching), Tailwind CSS (styling), TypeScript (static typing).