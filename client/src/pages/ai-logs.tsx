import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Brain, TrendingUp, TrendingDown, Activity, Clock, Target, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface AILog {
  timestamp: number;
  type: 'decision' | 'analysis' | 'trade' | 'error';
  strategy: string;
  confidence: number;
  reasons: string[];
  action?: 'BUY' | 'SELL' | 'HOLD';
  symbol?: string;
  marketConditions?: {
    regime: string;
    volatility: number;
    trendStrength: number;
    momentum: number;
  };
}

export default function AILogsPage() {
  const [logs, setLogs] = useState<AILog[]>([]);
  const [aiDecisions, setAIDecisions] = useState<any[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Fetch AI decisions
    const fetchAIDecisions = async () => {
      try {
        const response = await fetch('/api/ai/decisions?limit=50');
        if (response.ok) {
          const data = await response.json();
          setAIDecisions(data);
        }
      } catch (error) {
        console.error('Failed to fetch AI decisions:', error);
      }
    };

    fetchAIDecisions();

    // WebSocket for real-time updates
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('✅ Connected to AI Logs WebSocket');
      ws.send(JSON.stringify({ type: 'subscribe_ai_logs' }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.event === 'ai_decision') {
          const decision = message.data;
          const newLog: AILog = {
            timestamp: decision.timestamp || Date.now(),
            type: 'decision',
            strategy: decision.selectedStrategy,
            confidence: decision.confidence,
            reasons: decision.reasoning || [],
            marketConditions: decision.marketConditions
          };
          
          setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
          setAIDecisions(prev => [decision, ...prev].slice(0, 50));
        } else if (message.event === 'trade_executed') {
          const trade = message.data;
          const newLog: AILog = {
            timestamp: trade.timestamp,
            type: 'trade',
            strategy: trade.strategy,
            confidence: 100,
            reasons: [`Trade executed: ${trade.type} ${trade.quantity.toFixed(6)} ${trade.symbol} at $${trade.price.toFixed(2)}`],
            action: trade.type,
            symbol: trade.symbol
          };
          
          setLogs(prev => [newLog, ...prev].slice(0, 100));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('🔌 Disconnected from AI Logs WebSocket');
    };

    // Poll for updates
    const interval = setInterval(() => {
      fetchAIDecisions();
    }, 10000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'decision':
        return <Brain className="w-5 h-5 text-purple-500" />;
      case 'analysis':
        return <Activity className="w-5 h-5 text-blue-500" />;
      case 'trade':
        return <Target className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return <Badge className="bg-green-500">High {confidence}%</Badge>;
    if (confidence >= 60) return <Badge className="bg-yellow-500">Medium {confidence}%</Badge>;
    return <Badge className="bg-red-500">Low {confidence}%</Badge>;
  };

  const getMarketRegimeBadge = (regime: string) => {
    const colors: Record<string, string> = {
      'bull': 'bg-green-500',
      'bear': 'bg-red-500',
      'neutral': 'bg-gray-500',
      'volatile': 'bg-orange-500',
      'extreme': 'bg-purple-500'
    };
    
    return <Badge className={colors[regime] || 'bg-gray-500'}>{regime.toUpperCase()}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8 text-purple-500" />
            AI Decision Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time AI reasoning and decision-making process
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={autoScroll ? "default" : "outline"} 
                 className="cursor-pointer"
                 onClick={() => setAutoScroll(!autoScroll)}>
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {logs.length} logs
          </Badge>
        </div>
      </div>

      {/* Latest AI Decision Summary */}
      {aiDecisions.length > 0 && (
        <Card className="border-purple-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              Latest AI Decision
            </CardTitle>
            <CardDescription>
              {format(new Date(aiDecisions[0].timestamp), 'PPpp')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Selected Strategy</p>
                  <p className="text-2xl font-bold text-purple-500 uppercase">
                    {aiDecisions[0].selectedStrategy}
                  </p>
                </div>
                {getConfidenceBadge(aiDecisions[0].confidence)}
              </div>
              
              {aiDecisions[0].marketConditions && (
                <div className="flex gap-4">
                  {getMarketRegimeBadge(aiDecisions[0].marketConditions.marketRegime)}
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Volatility</p>
                    <p className="text-lg font-semibold">
                      {aiDecisions[0].marketConditions.volatility.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Trend</p>
                    <p className="text-lg font-semibold flex items-center gap-1">
                      {aiDecisions[0].marketConditions.trendStrength > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      {Math.abs(aiDecisions[0].marketConditions.trendStrength).toFixed(1)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {aiDecisions[0].reasoning && aiDecisions[0].reasoning.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">AI Reasoning:</p>
                <ul className="space-y-1">
                  {aiDecisions[0].reasoning.map((reason: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiDecisions[0].strategyScores && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Top 5 Strategy Scores:</p>
                <div className="grid grid-cols-5 gap-2">
                  {aiDecisions[0].strategyScores.slice(0, 5).map((score: any, i: number) => (
                    <div key={i} className="text-center p-2 bg-secondary rounded-md">
                      <p className="text-xs text-muted-foreground uppercase">{score.strategy}</p>
                      <p className="text-lg font-bold">{score.score}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Real-time Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Real-time AI Activity Stream
          </CardTitle>
          <CardDescription>
            Live feed of AI decisions, analyses, and trade executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full pr-4">
            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No AI activity yet. Start the trading bot to see logs.</p>
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
                      <div className="mt-1">{getLogIcon(log.type)}</div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="uppercase">
                              {log.strategy}
                            </Badge>
                            {log.action && (
                              <Badge className={
                                log.action === 'BUY' ? 'bg-green-500' : 
                                log.action === 'SELL' ? 'bg-red-500' : 
                                'bg-gray-500'
                              }>
                                {log.action}
                              </Badge>
                            )}
                            {log.symbol && (
                              <span className="text-sm font-semibold">{log.symbol}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(new Date(log.timestamp), 'HH:mm:ss')}
                          </div>
                        </div>

                        {log.confidence !== undefined && (
                          <div className="flex items-center gap-2">
                            {getConfidenceBadge(log.confidence)}
                          </div>
                        )}

                        {log.marketConditions && (
                          <div className="flex gap-4 text-sm">
                            {getMarketRegimeBadge(log.marketConditions.regime)}
                            <span className="text-muted-foreground">
                              Vol: {log.marketConditions.volatility.toFixed(1)}%
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              Trend: 
                              {log.marketConditions.trendStrength > 0 ? (
                                <TrendingUp className="w-3 h-3 text-green-500" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-red-500" />
                              )}
                              {Math.abs(log.marketConditions.trendStrength).toFixed(1)}
                            </span>
                          </div>
                        )}

                        {log.reasons && log.reasons.length > 0 && (
                          <ul className="space-y-1 ml-4">
                            {log.reasons.map((reason, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-purple-500">→</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    
                    {index < logs.length - 1 && <Separator />}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Historical AI Decisions */}
      <Card>
        <CardHeader>
          <CardTitle>Historical AI Decisions</CardTitle>
          <CardDescription>
            Recent strategy selections and confidence levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {aiDecisions.slice(0, 20).map((decision, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold uppercase text-sm text-purple-500">
                      {decision.selectedStrategy}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(decision.timestamp), 'PPp')}
                    </p>
                  </div>
                  {getConfidenceBadge(decision.confidence)}
                </div>
                
                {decision.marketConditions && (
                  <div className="flex items-center gap-4">
                    {getMarketRegimeBadge(decision.marketConditions.marketRegime)}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Volatility</p>
                      <p className="text-sm font-semibold">
                        {decision.marketConditions.volatility.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
