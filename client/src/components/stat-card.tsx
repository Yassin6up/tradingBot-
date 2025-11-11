import { Card } from "@/components/ui/card";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  changePercent?: number;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function StatCard({ title, value, change, changePercent, icon, isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-24" />
          {icon && <Skeleton className="h-4 w-4 rounded-full" />}
        </div>
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </Card>
    );
  }

  const isPositive = change !== undefined && change >= 0;
  const hasChange = change !== undefined;

  return (
    <Card className="p-6" data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-muted-foreground" data-testid={`text-stat-label-${title.toLowerCase().replace(/\s+/g, '-')}`}>{title}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="space-y-1">
        <h3 
          className="text-3xl font-bold tabular-nums tracking-tight" 
          data-testid={`text-stat-value-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {value}
        </h3>
        {hasChange && (
          <div className={`flex items-center text-sm font-medium gap-1 ${
            isPositive ? 'text-profit' : 'text-loss'
          }`} data-testid={`text-stat-change-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            <span className="tabular-nums">
              {isPositive ? '+' : ''}{change?.toFixed(2)}
              {changePercent !== undefined && ` (${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
