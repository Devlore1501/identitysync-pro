import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useSegmentStats } from '@/hooks/useSegmentStats';
import { 
  Target, 
  ShoppingCart, 
  CreditCard, 
  Tag, 
  Users, 
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

const segmentIcons: Record<string, React.ReactNode> = {
  'high_intent_no_purchase': <Target className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'atc_no_checkout_24h': <ShoppingCart className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'checkout_abandoned': <CreditCard className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'category_lover': <Tag className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'returning_visitor': <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'at_risk': <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4" />,
};

const segmentColors: Record<string, string> = {
  'high_intent_no_purchase': 'bg-green-500/20 text-green-700 border-green-500/30',
  'atc_no_checkout_24h': 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  'checkout_abandoned': 'bg-red-500/20 text-red-700 border-red-500/30',
  'category_lover': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  'returning_visitor': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'at_risk': 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
};

export function SegmentsWidget() {
  const { data: stats, isLoading } = useSegmentStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="p-3 md:p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
          <div className="space-y-2 md:space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-10 md:h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const activeSegments = stats.segments.filter(s => s.count > 0);

  return (
    <Card>
      <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <CardTitle className="text-sm md:text-base">Behavioral Segments</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs self-start sm:self-auto">
            {stats.usersInSegments} in segment
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Segmenti calcolati automaticamente dai segnali
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        {activeSegments.length === 0 ? (
          <div className="text-center py-4 md:py-6 text-muted-foreground">
            <Target className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs md:text-sm">Nessun utente nei segmenti</p>
            <p className="text-xs mt-1">I segmenti si popoleranno con più dati</p>
          </div>
        ) : (
          <div className="space-y-1.5 md:space-y-2">
            {stats.segments.map((segment) => (
              <div
                key={segment.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 md:p-3 rounded-lg border ${
                  segment.count > 0 ? segmentColors[segment.id] : 'bg-muted/30 border-border text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <div className="opacity-70 flex-shrink-0">
                    {segmentIcons[segment.id]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm font-medium truncate">{segment.name}</p>
                    <p className="text-xs opacity-70 truncate hidden sm:block">{segment.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:text-right flex-shrink-0">
                  <p className="text-base md:text-lg font-bold">{segment.count}</p>
                  <p className="text-xs opacity-70">{segment.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}