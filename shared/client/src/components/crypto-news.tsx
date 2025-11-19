import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface NewsResponse {
  marketSentiment: number;
  newsActivity: number;
  marketRegime: string;
  summary: string;
  timestamp: number;
  articles: Array<{
    id: string;
    title: string;
    source: string;
    sentiment: number;
    relevance: number;
    timestamp: number;
  }>;
}

export function CryptoNews() {
  const { data: news, isLoading } = useQuery<NewsResponse>({
    queryKey: ['/api/news'],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className="p-6" data-testid="card-crypto-news">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 10) return 'text-profit';
    if (sentiment < -10) return 'text-loss';
    return 'text-muted-foreground';
  };

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 10) return <TrendingUp className="h-4 w-4 text-profit" />;
    if (sentiment < -10) return <TrendingDown className="h-4 w-4 text-loss" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 20) return 'Very Bullish';
    if (sentiment > 10) return 'Bullish';
    if (sentiment > -10) return 'Neutral';
    if (sentiment > -20) return 'Bearish';
    return 'Very Bearish';
  };

  return (
    <Card className="p-6" data-testid="card-crypto-news">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold" data-testid="text-crypto-news-title">
          Market News & Sentiment
        </h3>
      </div>

      {news && (
        <>
          {/* Market Summary */}
          <Card className="p-4 mb-4 bg-muted/30" data-testid="card-market-summary">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getSentimentIcon(news.marketSentiment)}
                  <span className={`font-semibold ${getSentimentColor(news.marketSentiment)}`}>
                    {getSentimentLabel(news.marketSentiment)}
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    {news.marketRegime}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-market-summary">
                  {news.summary}
                </p>
              </div>
            </div>

            {/* Market Metrics */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Sentiment:</span>
                <span className={`font-medium ${getSentimentColor(news.marketSentiment)}`}>
                  {news.marketSentiment.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">News Activity:</span>
                <span className="font-medium">
                  {(news.newsActivity * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </Card>

          {/* News Articles */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {!news.articles || news.articles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-news">
                  <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No news articles available</p>
                  <p className="text-sm">News updates will appear here</p>
                </div>
              ) : (
                news.articles.map((article) => (
                  <Card 
                    key={article.id} 
                    className="p-4 hover-elevate" 
                    data-testid={`card-news-article-${article.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-medium leading-tight flex-1" data-testid={`text-article-title-${article.id}`}>
                        {article.title}
                      </h4>
                      {getSentimentIcon(article.sentiment)}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span data-testid={`text-article-source-${article.id}`}>{article.source}</span>
                      <span>•</span>
                      <span>Relevance: {article.relevance.toFixed(0)}%</span>
                      <span>•</span>
                      <span className={getSentimentColor(article.sentiment)}>
                        {getSentimentLabel(article.sentiment)}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </Card>
  );
}
