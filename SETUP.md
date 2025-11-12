# AI Trading Bot - Local Setup Guide

This guide explains how to run the AI Trading Bot on your local machine after downloading the project files.

## Prerequisites

You only need **Node.js** installed (version 18 or higher):
- Download from [nodejs.org](https://nodejs.org/)

**That's it!** No database server required - the project uses SQLite for easy local development.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Application

```bash
npm run dev
```

The application will start on `http://localhost:5000`

## What Happens on First Run

- ✅ SQLite database is automatically created at `data/app.db`
- ✅ Database tables are automatically initialized
- ✅ Server starts on port 5000
- ✅ Frontend is served with hot-reload during development

## Configuration

### Database Location

By default, the SQLite database is stored at `data/app.db`.  
To use a custom location, set the `APP_DB_FILE` environment variable:

```bash
APP_DB_FILE=/path/to/your/database.db npm run dev
```

### Binance API Configuration

The trading bot requires Binance API credentials to function:

1. Start the application
2. Navigate to **Settings** in the web interface
3. Enter your Binance API Key and Secret
4. Click "Save Configuration"

**Getting Binance API Credentials:**
1. Create a Binance account at [binance.com](https://www.binance.com)
2. Go to Account → API Management
3. Create a new API key
4. Save the API Key and Secret (keep them secure!)

**Sandbox Mode:**
- For testing without real money, check "Use Testnet" in Settings
- This uses Binance Testnet for paper trading

## Project Structure

```
├── client/              # Frontend React application
│   └── src/
│       ├── pages/      # Dashboard, Settings, AI Analytics pages
│       └── components/ # Reusable UI components
├── server/             # Backend Express server
│   ├── routes.ts       # API endpoints
│   ├── db.ts          # SQLite database connection
│   └── storage.ts     # Data storage layer
├── shared/            # Shared types and schemas
│   └── schema.ts      # Database schema and TypeScript types
└── data/              # SQLite database files (auto-created)
    └── app.db         # Your local database
```

## Development Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm start` - Run production build

## Features

### Dashboard
- Real-time portfolio balance and profit tracking
- Animated coin price slider (BTC, ETH, BNB, SOL, ADA)
- Live price charts with historical data
- Trade history and performance metrics

### AI Analytics
- Transparent AI decision-making display
- Market conditions analysis (volatility, trend, momentum)
- Strategy scoring with confidence levels
- Real-time strategy recommendations

### Settings
- Binance API configuration
- Multi-language support (English / Arabic with RTL)
- Trading parameters customization

## Troubleshooting

### Port 5000 Already in Use

If another application is using port 5000:

```bash
# Option 1: Stop the other application using port 5000

# Option 2: Use a different port
PORT=3000 npm run dev
```

### Database Issues

If you encounter database errors:

```bash
# Remove the database file and restart (data will be lost)
rm -rf data/
npm run dev
```

The database will be automatically recreated with fresh tables.

### Binance API Connection Fails

Common issues:
- **API key restrictions**: Ensure your Binance API key has spot trading permissions
- **IP restrictions**: If you set IP restrictions on Binance, add your current IP
- **Geo-restrictions**: Some regions can't access Binance - the test connection may fail with a 451 error
- **Testnet mode**: Use testnet for paper trading to avoid real money transactions

## Multi-Language Support

The application supports:
- **English** (default)
- **Arabic** (with full RTL layout)

Toggle between languages using the language selector in the header.

## Data Persistence

All data is stored in the SQLite database file (`data/app.db`):
- User accounts
- Trade history
- Portfolio settings
- Bot configuration

**Backup your data:** Simply copy the `data/` folder to backup your trading history and settings.

## Security Notes

- **Never commit API keys** to version control
- **Keep your Binance API secret secure**
- **Use testnet mode** for learning and testing
- **Set appropriate permissions** on your Binance API key (disable withdrawals)

## Support

For issues or questions:
1. Check the console for error messages
2. Review the logs in the terminal
3. Ensure Binance API credentials are correctly configured
4. Try removing the `data/` folder and restarting

---

**Ready to start trading? Run `npm run dev` and navigate to http://localhost:5000!**
