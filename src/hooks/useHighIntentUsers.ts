import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface HighIntentUser {
  id: string;
  email: string | null;
  intentScore: number;
  dropOffStage: string;
  lastSeenAt: string;
  eventsCount: number;
}

export function useHighIntentUsers() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['high-intent-users', currentWorkspace?.id],
    queryFn: async (): Promise<HighIntentUser[]> => {
      if (!currentWorkspace?.id) {
        return [];
      }

      // Get users with high intent score who haven't purchased
      const { data: users, error } = await supabase
        .from('users_unified')
        .select('id, primary_email, computed, last_seen_at')
        .eq('workspace_id', currentWorkspace.id)
        .order('last_seen_at', { ascending: false })
        .limit(100);

      if (error || !users) {
        console.error('Error fetching high intent users:', error);
        return [];
      }

      // Filter and map users with intent score > 30 who haven't purchased
      const highIntentUsers = users
        .map((user) => {
          const computed = (user.computed as Record<string, unknown>) || {};
          const intentScore = (computed.intent_score as number) || 0;
          const ordersCount = (computed.orders_count as number) || 0;
          const lastEventType = (computed.last_event_type as string) || '';
          
          // Determine drop-off stage
          let dropOffStage = 'browsing';
          if (lastEventType === 'begin_checkout' || computed.drop_off_stage === 'checkout') {
            dropOffStage = 'checkout';
          } else if (lastEventType === 'add_to_cart' || computed.drop_off_stage === 'cart') {
            dropOffStage = 'cart';
          } else if (intentScore > 20) {
            dropOffStage = 'engaged';
          }

          return {
            id: user.id,
            email: user.primary_email,
            intentScore,
            ordersCount,
            dropOffStage,
            lastSeenAt: user.last_seen_at,
          };
        })
        .filter((user) => user.intentScore > 30 && user.ordersCount === 0)
        .sort((a, b) => b.intentScore - a.intentScore)
        .slice(0, 10);

      // Get event counts for high intent users
      const usersWithEvents = await Promise.all(
        highIntentUsers.map(async (user) => {
          const { count } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('unified_user_id', user.id);

          return {
            id: user.id,
            email: user.email,
            intentScore: user.intentScore,
            dropOffStage: user.dropOffStage,
            lastSeenAt: formatTimeAgo(user.lastSeenAt),
            eventsCount: count || 0,
          };
        })
      );

      return usersWithEvents;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffMins / 1440);
    return `${days}d ago`;
  }
}
