import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Link2, 
  Users, 
  Mail, 
  UserX,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface StitchingStats {
  totalUsers: number;
  identifiedUsers: number;
  anonymousUsers: number;
  mergedUsers: number;
  stitchingRate: number;
}

export function IdentityStitchingStatus() {
  const { currentWorkspace } = useWorkspace();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['identity-stitching-stats', currentWorkspace?.id],
    queryFn: async (): Promise<StitchingStats> => {
      if (!currentWorkspace?.id) {
        return { totalUsers: 0, identifiedUsers: 0, anonymousUsers: 0, mergedUsers: 0, stitchingRate: 0 };
      }

      // Get total users
      const { count: totalUsers } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);

      // Get identified users (with email)
      const { count: identifiedUsers } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .not('primary_email', 'is', null);

      // Get anonymous users (without email)
      const { count: anonymousUsers } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .is('primary_email', null);

      // Get merged users (check for merged_from in computed)
      const { data: mergedData } = await supabase
        .from('users_unified')
        .select('computed')
        .eq('workspace_id', currentWorkspace.id)
        .not('computed->merged_from', 'is', null);

      const mergedUsers = mergedData?.length || 0;

      // Calculate stitching rate
      const total = totalUsers || 0;
      const identified = identifiedUsers || 0;
      const stitchingRate = total > 0 ? Math.round((identified / total) * 100) : 0;

      return {
        totalUsers: total,
        identifiedUsers: identified,
        anonymousUsers: anonymousUsers || 0,
        mergedUsers,
        stitchingRate,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  const isHealthy = (stats?.stitchingRate || 0) >= 50;

  return (
    <Card>
      <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <CardTitle className="text-sm md:text-base font-semibold">Identity Stitching</CardTitle>
          </div>
          <Badge variant={isHealthy ? 'default' : 'secondary'} className="text-xs">
            {isHealthy ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Attivo
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 mr-1" />
                Da migliorare
              </>
            )}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Collegamento sessioni anonime → profili identificati
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        {/* Visual Flow */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-1">
              <UserX className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
            </div>
            <div className="text-lg md:text-xl font-bold">{stats?.anonymousUsers || 0}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">Anonimi</div>
          </div>
          
          <div className="flex flex-col items-center px-2">
            <ArrowRight className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium text-primary mt-1">{stats?.mergedUsers || 0} merged</span>
          </div>
          
          <div className="text-center flex-1">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-500/20 mx-auto flex items-center justify-center mb-1">
              <Mail className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
            </div>
            <div className="text-lg md:text-xl font-bold text-green-600">{stats?.identifiedUsers || 0}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">Identificati</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tasso di identificazione</span>
            <span className={`font-medium ${isHealthy ? 'text-green-600' : 'text-amber-600'}`}>
              {stats?.stitchingRate || 0}%
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${stats?.stitchingRate || 0}%` }}
            />
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-center gap-1 mt-3 pt-2 border-t border-border">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {stats?.totalUsers || 0} profili totali
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
