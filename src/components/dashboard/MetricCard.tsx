import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  className?: string;
}

export const MetricCard = ({ 
  title, 
  value, 
  change, 
  changeLabel = "vs last period",
  icon,
  className 
}: MetricCardProps) => {
  const getTrendIcon = () => {
    if (change === undefined || change === 0) return <Minus className="w-3 h-3" />;
    return change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (change === undefined || change === 0) return "text-muted-foreground";
    return change > 0 ? "text-success" : "text-destructive";
  };

  return (
    <div className={cn("metric-card", className)}>
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      
      <div className="text-3xl font-bold mb-2 animate-number">{value}</div>
      
      {change !== undefined && (
        <div className={cn("flex items-center gap-1 text-sm", getTrendColor())}>
          {getTrendIcon()}
          <span>{Math.abs(change)}%</span>
          <span className="text-muted-foreground ml-1">{changeLabel}</span>
        </div>
      )}
    </div>
  );
};
