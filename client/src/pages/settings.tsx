import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/navigation";
import { LanguageSelector } from "@/components/language-selector";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Plug, CheckCircle, XCircle, Loader2, DollarSign, AlertTriangle, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [testnet, setTestnet] = useState(false);
  const [showRealModeDialog, setShowRealModeDialog] = useState(false);

  // Query Binance connection status
  const { data: status } = useQuery<{ connected: boolean; message: string }>({
    queryKey: ['/api/binance/status'],
    refetchInterval: 10000,
  });

  // Query trading mode
  const { data: tradingMode } = useQuery<{ mode: string; realBalance?: number }>({
    queryKey: ['/api/trading-mode'],
    enabled: status?.connected ?? false,
  });

  // Query real balance
  const { data: realBalance, refetch: refetchBalance } = useQuery<{ total: number; assets: Record<string, number> }>({
    queryKey: ['/api/binance/balance'],
    enabled: false, // Only fetch when user clicks button
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/binance/test', {
        apiKey: apiKey || undefined,
        secret: secret || undefined,
        testnet,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: t('common.success'),
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/binance/status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/trading-mode'] });
      } else {
        toast({
          title: t('common.error'),
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('common.testConnectionFailed'),
        variant: "destructive",
      });
    },
  });

  // Switch trading mode mutation
  const switchModeMutation = useMutation({
    mutationFn: async (mode: string) => {
      const response = await apiRequest('POST', '/api/trading-mode', {
        mode,
        confirmation: mode === 'real',
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: t('common.success'),
        description: `Switched to ${data.mode} trading mode`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trading-mode'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bot/status'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to switch trading mode',
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-settings-title">{t('settings.title')}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('settings.subtitle')}
                </p>
              </div>
            </div>
            <LanguageSelector />
          </div>
          <Navigation />
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {/* Binance API Configuration */}
        <Card className="p-6 mb-6" data-testid="card-binance-config">
          <div className="flex items-center gap-2 mb-6">
            <Plug className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t('settings.binanceConfig')}</h2>
            {status && (
              <Badge
                variant={status.connected ? "default" : "secondary"}
                className="ml-auto"
                data-testid="badge-connection-status"
              >
                {status.connected ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> {t('settings.connected')}</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> {t('settings.notConnected')}</>
                )}
              </Badge>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div className="p-4 rounded-md bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground">
                <strong>{t('settings.note')}:</strong> {t('settings.binanceNote')}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="api-key">{t('settings.apiKey')}</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder={t('settings.apiKey')}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1"
                  data-testid="input-api-key"
                />
              </div>

              <div>
                <Label htmlFor="api-secret">{t('settings.apiSecret')}</Label>
                <Input
                  id="api-secret"
                  type="password"
                  placeholder={t('settings.apiSecret')}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="mt-1"
                  data-testid="input-api-secret"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="testnet"
                  type="checkbox"
                  checked={testnet}
                  onChange={(e) => setTestnet(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-testnet"
                />
                <Label htmlFor="testnet" className="cursor-pointer">
                  {t('settings.testnet')}
                </Label>
              </div>
            </div>
          </div>

          <Button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="w-full"
            data-testid="button-test-connection"
          >
            {testMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('settings.testing')}
              </>
            ) : (
              <>
                <Plug className="mr-2 h-4 w-4" />
                {t('settings.testConnection')}
              </>
            )}
          </Button>
        </Card>

        {/* Trading Mode Configuration */}
        {status?.connected && (
          <Card className="p-6 mb-6" data-testid="card-trading-mode">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t('settings.tradingMode') || 'Trading Mode'}</h2>
              {tradingMode && (
                <Badge
                  variant={tradingMode.mode === 'real' ? "destructive" : "default"}
                  className="ml-auto"
                  data-testid="badge-current-mode"
                >
                  {tradingMode.mode === 'real' ? '🔴 REAL MONEY' : '📝 Paper Trading'}
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              {/* Current Mode Info */}
              <div className="p-4 rounded-md bg-muted/30 border border-border">
                <p className="text-sm font-medium mb-2">
                  {tradingMode?.mode === 'real' 
                    ? t('settings.realModeActive') || '🔴 Real Trading Mode Active'
                    : t('settings.paperModeActive') || '📝 Paper Trading Mode Active'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {tradingMode?.mode === 'real'
                    ? t('settings.realModeDesc') || 'Your bot is trading with real money from your Binance account. All trades will execute on the live market.'
                    : t('settings.paperModeDesc') || 'Your bot is simulating trades with virtual money. No real funds are used.'}
                </p>
              </div>

              {/* Real Balance Display */}
              {tradingMode?.mode === 'real' && (
                <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Real Binance Balance</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => refetchBalance()}
                      data-testid="button-refresh-balance"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  {realBalance ? (
                    <div>
                      <p className="text-2xl font-bold">${realBalance.total.toFixed(2)} USDT</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Object.keys(realBalance.assets).length} assets
                      </p>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => refetchBalance()}
                      data-testid="button-fetch-balance"
                    >
                      Fetch Balance
                    </Button>
                  )}
                </div>
              )}

              {/* Mode Toggle Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={tradingMode?.mode === 'paper' ? 'default' : 'outline'}
                  onClick={() => switchModeMutation.mutate('paper')}
                  disabled={switchModeMutation.isPending || tradingMode?.mode === 'paper'}
                  data-testid="button-switch-paper"
                  className="w-full"
                >
                  {switchModeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  📝 Paper Trading
                </Button>
                <Button
                  variant={tradingMode?.mode === 'real' ? 'destructive' : 'outline'}
                  onClick={() => setShowRealModeDialog(true)}
                  disabled={switchModeMutation.isPending || tradingMode?.mode === 'real'}
                  data-testid="button-switch-real"
                  className="w-full"
                >
                  {switchModeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  🔴 Real Trading
                </Button>
              </div>

              {/* Safety Warning */}
              <div className="p-4 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
                      {t('settings.tradingWarning') || 'Trading Risk Warning'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('settings.tradingWarningDesc') || 'Real trading mode will execute actual trades on Binance using your account funds. Only use real mode if you understand the risks and have tested your strategy in paper mode first.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Real Mode Confirmation Dialog */}
        <AlertDialog open={showRealModeDialog} onOpenChange={setShowRealModeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {t('settings.confirmRealMode') || 'Confirm Real Trading Mode'}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 text-left">
                <p className="font-medium text-foreground">
                  {t('settings.realModeWarning1') || 'You are about to enable REAL MONEY trading. This means:'}
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{t('settings.realModeWarning2') || 'All trades will execute on the live Binance market'}</li>
                  <li>{t('settings.realModeWarning3') || 'Real funds from your Binance account will be used'}</li>
                  <li>{t('settings.realModeWarning4') || 'You can lose money based on market conditions'}</li>
                  <li>{t('settings.realModeWarning5') || 'Trading fees will apply to all transactions'}</li>
                </ul>
                <p className="font-medium text-destructive">
                  {t('settings.realModeWarning6') || '⚠️ Only proceed if you have tested your strategy thoroughly in paper mode and understand the risks.'}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-real-mode">
                {t('common.cancel') || 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => {
                  switchModeMutation.mutate('real');
                  setShowRealModeDialog(false);
                }}
                data-testid="button-confirm-real-mode"
              >
                {t('settings.confirmRealModeButton') || 'I Understand, Enable Real Mode'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Information Card */}
        <Card className="p-6" data-testid="card-api-info">
          <h3 className="font-semibold mb-3">{t('settings.howTo')}</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>{t('settings.step1')}</li>
            <li>{t('settings.step2')}</li>
            <li>{t('settings.step3')}</li>
            <li>{t('settings.step4')}</li>
            <li>{t('settings.step5')}</li>
            <li>{t('settings.step6')}</li>
            <li>{t('settings.step7')}</li>
          </ol>

          <div className="mt-4 p-4 rounded-md bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
              ⚠️ {t('settings.securityWarning')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('settings.securityNote')}
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
