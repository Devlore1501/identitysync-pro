import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface IdentityGraphStats {
  totalProfiles: number;
  resolvedToday: number;
  averageIdentities: number;
  recentResolutions: {
    id: string;
    identities: { type: string; value: string }[];
    events: number;
    lastSeen: string;
  }[];
}

export function useIdentityGraphStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['identity-graph-stats', currentWorkspace?.id],
    queryFn: async (): Promise<IdentityGraphStats> => {
      if (!currentWorkspace?.id) {
        return { totalProfiles: 0, resolvedToday: 0, averageIdentities: 0, recentResolutions: [] };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get stats in parallel
      const [
        totalResult,
        todayResult,
        identitiesResult,
        recentProfilesResult
      ] = await Promise.all([
        // Total profiles
        supabase
          .from('users_unified')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id),
        
        // Profiles created today
        supabase
          .from('users_unified')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .gte('created_at', today.toISOString()),
        
        // Total identities for average calculation
        supabase
          .from('identities')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id),
        
        // Recent profiles with identities
        supabase
          .from('users_unified')
          .select('id, primary_email, phone, emails, customer_ids, anonymous_ids, last_seen_at')
          .eq('workspace_id', currentWorkspace.id)
          .order('last_seen_at', { ascending: false })
          .limit(3)
      ]);

      const totalProfiles = totalResult.count || 0;
      const resolvedToday = todayResult.count || 0;
      const totalIdentities = identitiesResult.count || 0;
      const averageIdentities = totalProfiles > 0 ? Math.round((totalIdentities / totalProfiles) * 10) / 10 : 0;

      // Build recent resolutions with identity details
      const recentResolutions = await Promise.all(
        (recentProfilesResult.data || []).map(async (profile) => {
          // Get event count for this user
          const { count: eventCount } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('unified_user_id', profile.id);

          // Build identities array
          const identities: { type: string; value: string }[] = [];
          
          if (profile.primary_email) {
            identities.push({ 
              type: 'email', 
              value: maskValue(profile.primary_email, 'email') 
            });
          }
          
          if (profile.phone) {
            identities.push({ 
              type: 'phone', 
              value: maskValue(profile.phone, 'phone') 
            });
          }
          
          if (profile.customer_ids?.length > 0) {
            identities.push({ 
              type: 'customer_id', 
              value: profile.customer_ids[0].slice(0, 12) + '...' 
            });
          }
          
          if (profile.anonymous_ids?.length > 0) {
            identities.push({ 
              type: 'anonymous_id', 
              value: profile.anonymous_ids[0].slice(0, 12) + '...' 
            });
          }

          // Calculate time ago
          const lastSeenDate = new Date(profile.last_seen_at);
          const now = new Date();
          const diffMs = now.getTime() - lastSeenDate.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          let lastSeen: string;
          
          if (diffMins < 1) {
            lastSeen = 'Just now';
          } else if (diffMins < 60) {
            lastSeen = `${diffMins} min ago`;
          } else if (diffMins < 1440) {
            lastSeen = `${Math.floor(diffMins / 60)} hour${Math.floor(diffMins / 60) > 1 ? 's' : ''} ago`;
          } else {
            lastSeen = `${Math.floor(diffMins / 1440)} day${Math.floor(diffMins / 1440) > 1 ? 's' : ''} ago`;
          }

          return {
            id: `uid_${profile.id.slice(0, 6)}`,
            identities,
            events: eventCount || 0,
            lastSeen
          };
        })
      );

      return {
        totalProfiles,
        resolvedToday,
        averageIdentities,
        recentResolutions
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}

function maskValue(value: string, type: 'email' | 'phone'): string {
  if (type === 'email') {
    const [local, domain] = value.split('@');
    if (local && domain) {
      return `${local.slice(0, 3)}***@${domain}`;
    }
    return value.slice(0, 5) + '***';
  }
  if (type === 'phone') {
    return value.slice(0, 4) + ' ***-***-' + value.slice(-4);
  }
  return value;
}
