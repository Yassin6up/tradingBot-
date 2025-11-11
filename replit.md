# AI Trading Bot Platform

## Overview

An AI-powered trading bot web platform with real-time analytics, automated trading strategies, and live market data visualization. The platform supports both sandbox (paper trading) and real trading modes, with multiple risk-adjusted trading strategies and comprehensive performance tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- In-memory storage using TypeScript Maps and arrays
- No persistence between server restarts (intentional for sandbox mode)
- Portfolio state, trade history, and bot configuration stored in RAM

**Database Schema (Prepared for PostgreSQL)**
- Drizzle ORM configured with PostgreSQL dialect
- User authentication table defined (users table with username/password)
- Schema exports TypeScript types for compile-time safety
- Migration system ready via drizzle-kit for schema versioning

**Data Models**
- User: ID, username, password (for future authentication)
- Portfolio: balance, profit metrics, trade statistics, performance analytics
- Trade: symbol, type (BUY/SELL), price, quantity, timestamp, profit calculations
- BotState: status, strategy, mode, uptime tracking

### Authentication & Authorization

**Current State**
- User schema defined but authentication not yet implemented
- Prepared for session-based authentication with connect-pg-simple for PostgreSQL sessions
- Password hashing infrastructure ready (noted in dependencies)

**Planned Architecture**
- Session-based authentication using Express sessions
- PostgreSQL session store for persistence
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
- Database URL configured via environment variables
- Development vs. production mode detection via NODE_ENV
- Replit-specific plugins for development experience enhancements

## External Dependencies

### Third-Party APIs & Services
- **CCXT Library** (referenced in Python bot): Cryptocurrency exchange integration library (currently simulated in Node.js implementation)
- **Neon Database** (@neondatabase/serverless): Serverless PostgreSQL provider for production data storage

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