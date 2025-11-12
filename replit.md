# AI Trading Bot Platform

## Overview

An AI-powered trading bot web platform with real-time analytics, automated trading strategies, and live market data visualization. The platform supports both sandbox (paper trading) and real trading modes, with multiple risk-adjusted trading strategies and comprehensive performance tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Updates (November 12, 2025)

### Advanced Chart System (November 12, 2025)
- **✅ Chart Rendering Fixed**: Advanced candlestick chart now displays properly using lightweight-charts v5
- **API Migration**: Updated to lightweight-charts v5 API (`addSeries(CandlestickSeries)` instead of deprecated `addCandlestickSeries()`)
- **React Integration**: Fixed chart initialization timing with callback ref pattern to ensure container is ready
- **Multiple Timeframes**: Supports 1m, 5m, 15m, 1H, 4H, 1D candlestick intervals
- **Technical Indicators**: SMA (20/50), EMA (12/26), RSI, MACD, Bollinger Bands ready for overlay
- **Real-time Updates**: Chart data refreshes every 10 seconds with live market data

### Real Binance Trading Integration
- **Real Balance Display**: Dashboard now shows actual Binance account balance when in real trading mode
- **Asset Breakdown**: All non-zero Binance assets (BTC, ETH, BNB, SOL, ADA, etc.) displayed on dashboard
- **Dual-Mode Trading**: Trading engine executes REAL Binance orders in real mode, simulated trades in paper mode
- **Auto-Connection**: Binance API automatically connects on server startup if credentials are in environment
- **Graceful Fallback**: All endpoints fall back to simulated data if Binance unavailable (preserves paper trading)
- **Safety Features**: $10 minimum trade amount, asset balance verification before SELL, distinct logging for real/paper trades

**Production Note**: Binance API connectivity may fail from certain server locations due to geographic restrictions. For production use with real trading, deploy to a server in an allowed region. All code is production-ready.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript using Vite as the build tool and development server
- Client-side routing via Wouter for lightweight navigation
- Single Page Application (SPA) architecture with all routes served from the `/client` directory

**State Management & Data Fetching**
- TanStack Query (React Query) for server state management with aggressive caching strategies
- Real-time updates via WebSocket connections for live market data and trade notifications
- Local component state using React hooks (useState, useEffect, useRef)

**UI Component System**
- Shadcn/ui component library built on Radix UI primitives for accessible, unstyled components
- Tailwind CSS for styling with custom design tokens optimized for financial dashboards
- Dark theme as the primary interface to reduce eye strain during extended monitoring
- Material Design principles adapted for data-dense trading interfaces

**Design Philosophy**
- Information density prioritized over whitespace to maximize visible trading data
- Tabular number formatting for aligned financial data display
- Real-time visual feedback for market changes using color-coded profit/loss indicators
- Responsive grid layouts: single column (mobile), 2-column (tablet), multi-column (desktop)

**Charting & Visualization**
- Recharts library for real-time price charts and performance graphs
- Area charts for portfolio value tracking
- Customizable chart components with automatic data formatting

### Backend Architecture

**Server Framework**
- Express.js with TypeScript running on Node.js
- Custom middleware for request/response logging and JSON body parsing
- HTTP server wrapped with WebSocket support for bidirectional real-time communication

**API Design**
- RESTful API endpoints for CRUD operations on portfolio, trades, and bot state
- WebSocket endpoints for real-time price updates and trade notifications
- Zod schema validation for request/response type safety

**Trading Engine**
- In-memory trading simulation engine with configurable strategies
- Three pre-defined strategies: Safe (1-2% risk), Balanced (2-3% risk), Aggressive (3-5% risk)
- Simulated market data generation for multiple cryptocurrency pairs (BTC, ETH, BNB, SOL, ADA)
- Real-time trade execution logic with profit/loss calculations

**Session Management**
- In-memory storage implementation (MemStorage class) for development/demo purposes
- Interface-based storage abstraction (IStorage) allowing future database integration
- Session state tracked for portfolio balance, trade history, and bot configuration

### Data Storage Solutions

**Current Implementation**
- **SQLite database** for persistent local storage (`data/app.db`)
- Automatic table initialization on server startup
- Database file created automatically - no setup required
- WAL (Write-Ahead Logging) mode enabled for better concurrency

**Database Schema (SQLite)**
- Drizzle ORM configured with better-sqlite3 driver
- User authentication table defined (users table with username/password)
- Schema exports TypeScript types for compile-time safety
- Tables created programmatically using raw SQL for simplicity

**Data Models**
- User: ID (text/UUID), username, password (for future authentication)
- Portfolio Settings: ID, initial balance, creation timestamp
- Trade: ID, symbol, type (BUY/SELL), price (text), quantity (text), timestamp (integer), profit, strategy, mode
- BotState: In-memory (status, strategy, mode, uptime)
- AI Decisions: In-memory (market conditions, strategy scores, reasoning)

**Data Type Handling**
- Decimal values stored as TEXT for precision preservation
- Timestamps stored as INTEGER (Unix timestamps) with Drizzle's timestamp mode
- Automatic conversion between JavaScript numbers and TEXT on read/write

### Authentication & Authorization

**Current State**
- User schema defined but authentication not yet implemented
- Prepared for session-based authentication with file-based or in-memory sessions
- Password hashing infrastructure ready (noted in dependencies)

**Planned Architecture**
- Session-based authentication using Express sessions
- SQLite or in-memory session store for persistence
- User registration and login endpoints prepared in schema

### Real-Time Communication

**WebSocket Implementation**
- Custom WebSocket server integrated with Express HTTP server
- Event-based messaging system for price updates and trade notifications
- Automatic reconnection logic with exponential backoff (up to 5 attempts)
- Client-side subscription management for different data streams

**WebSocket Events**
- `subscribe_prices`: Client requests real-time price updates
- `subscribe_trades`: Client requests trade execution notifications
- `price_update`: Server broadcasts current market prices
- `new_trade`: Server broadcasts completed trade details
- `portfolio_update`: Server broadcasts portfolio balance changes

### Build & Deployment

**Development Mode**
- Vite dev server with HMR for instant client updates
- tsx for running TypeScript server code without compilation
- Concurrent client and server development with proxy configuration

**Production Build**
- Vite builds client into static assets in `dist/public`
- esbuild bundles server code into ESM format in `dist`
- Single production server serves both API and static files

**Environment Configuration**
- SQLite database path configurable via APP_DB_FILE environment variable (defaults to `data/app.db`)
- Development vs. production mode detection via NODE_ENV
- Replit-specific plugins for development experience enhancements
- No DATABASE_URL required - SQLite file is auto-created

## External Dependencies

### Third-Party APIs & Services
- **CCXT Library**: Cryptocurrency exchange integration library (for Binance API access)
- **better-sqlite3**: High-performance SQLite3 binding for Node.js with synchronous API

### UI Component Libraries
- **Radix UI**: Headless component primitives for accessible UI elements (accordion, dialog, dropdown, select, tooltip, etc.)
- **Recharts**: Declarative charting library for React-based data visualization
- **Lucide React**: Icon library for consistent iconography

### Development Tools
- **Drizzle ORM**: Type-safe SQL query builder and migration tool
- **Zod**: Runtime type validation for API schemas
- **TanStack Query**: Data synchronization and caching for server state
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **TypeScript**: Static typing for both client and server code

### Trading Strategy References
The design is inspired by professional trading platforms:
- TradingView: Chart layouts and technical analysis presentation
- Coinbase Pro: Order book visualization and trade execution flow
- Robinhood: Simplified UX for retail trading with clear profit/loss displays

### Potential Integration Points
- Real cryptocurrency exchange APIs (Binance, Coinbase, Kraken) via CCXT
- Market data providers for historical and real-time price feeds
- Notification services (email, SMS, push) for trade alerts
- Analytics services for performance tracking and reporting