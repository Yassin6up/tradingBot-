import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Initialize Binance service on startup if API keys are available
async function initializeBinanceIfConfigured() {
  let apiKey: string | undefined;
  let secret: string | undefined;
  let source: string = '';
  
  // Priority 1: Check database for saved credentials
  try {
    const { storage } = await import("./storage");
    const savedKeys = await storage.getApiKeys('binance');
    if (savedKeys) {
      apiKey = savedKeys.apiKey;
      secret = savedKeys.secretKey;
      source = 'database (encrypted)';
    }
  } catch (error) {
    console.warn('⚠️  Could not load API keys from database:', error instanceof Error ? error.message : error);
  }
  
  // Priority 2: Fallback to environment variables if no database credentials
  if (!apiKey && process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
    apiKey = process.env.BINANCE_API_KEY;
    secret = process.env.BINANCE_SECRET;
    source = 'environment variables';
  }
  
  // Connect if we have credentials from any source
  if (apiKey && secret) {
    try {
      const { getBinanceService } = await import("./services/binance");
      const binanceService = getBinanceService({
        apiKey,
        secret,
      });
      await binanceService.connect();
      log(`✅ Binance API connected automatically from ${source}`);
    } catch (error) {
      console.error('❌ Failed to auto-connect Binance API:', error instanceof Error ? error.message : error);
    }
  }
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Binance connection first
  await initializeBinanceIfConfigured();
  
  // Auto-restart bot if it was running before server shutdown
  try {
    const { storage } = await import("./storage");
    const { tradingEngine } = await import("./trading-engine");
    
    const botState = await storage.getBotState();
    if (botState.status === 'running') {
      log(`🔄 Auto-restarting trading bot (${botState.strategy} strategy, ${botState.mode} mode)`);
      await tradingEngine.start(botState.strategy, botState.mode);
    }
  } catch (error) {
    console.error('Failed to auto-restart bot:', error);
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
