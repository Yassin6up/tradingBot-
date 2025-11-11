import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/navigation";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Plug, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [testnet, setTestnet] = useState(false);

  // Query Binance connection status
  const { data: status } = useQuery<{ connected: boolean; message: string }>({
    queryKey: ['/api/binance/status'],
    refetchInterval: 10000,
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
          title: "Connection Successful",
          description: data.message,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "Failed to test connection",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure Binance API and trading parameters
              </p>
            </div>
          </div>
          <Navigation />
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {/* Binance API Configuration */}
        <Card className="p-6 mb-6" data-testid="card-binance-config">
          <div className="flex items-center gap-2 mb-6">
            <Plug className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Binance API Configuration</h2>
            {status && (
              <Badge
                variant={status.connected ? "default" : "secondary"}
                className="ml-auto"
                data-testid="badge-connection-status"
              >
                {status.connected ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Connected</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> Not Connected</>
                )}
              </Badge>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div className="p-4 rounded-md bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Binance API integration allows you to fetch real-time market data and execute live trades.
                You can test the connection without providing credentials to fetch public price data.
                For trading operations, you'll need to provide your Binance API key and secret.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="api-key">API Key (Optional)</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Binance API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1"
                  data-testid="input-api-key"
                />
              </div>

              <div>
                <Label htmlFor="api-secret">API Secret (Optional)</Label>
                <Input
                  id="api-secret"
                  type="password"
                  placeholder="Enter your Binance API secret"
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
                  Use Testnet (Sandbox Mode)
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
                Testing Connection...
              </>
            ) : (
              <>
                <Plug className="mr-2 h-4 w-4" />
                Test Connection
              </>
            )}
          </Button>
        </Card>

        {/* Information Card */}
        <Card className="p-6" data-testid="card-api-info">
          <h3 className="font-semibold mb-3">How to Get Binance API Credentials</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Log in to your Binance account</li>
            <li>Go to Account → API Management</li>
            <li>Create a new API key with appropriate permissions</li>
            <li>Copy the API Key and Secret Key</li>
            <li>Paste them in the fields above</li>
            <li>For safety, enable "Restrict access to trusted IPs only"</li>
            <li>Enable only "Enable Reading" for monitoring, or "Enable Spot & Margin Trading" for automated trading</li>
          </ol>

          <div className="mt-4 p-4 rounded-md bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
              ⚠️ Security Warning
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Never share your API secret with anyone. Store it securely and only use it in trusted applications.
              Consider using the testnet/sandbox mode first to test the bot without risking real funds.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
