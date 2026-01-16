import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { BehaviorSignal, DropOffStage, SEGMENTS, getMatchingSegments } from '@/behavior';

interface SegmentCount {
  id: string;
  name: string;
  description: string;
  count: number;
  percentage: number;
}

interface SegmentStats {
  segments: SegmentCount[];
  totalUsers: number;
  usersInSegments: number;
}

export function useSegmentStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['segment-stats', currentWorkspace?.id],
    queryFn: async (): Promise<SegmentStats> => {
      if (!currentWorkspace?.id) {
        return { segments: [], totalUsers: 0, usersInSegments: 0 };
      }

      // Fetch all unified users with computed traits
      const { data: users, error } = await supabase
        .from('users_unified')
        .select('id, computed, first_seen_at, last_seen_at, primary_email')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      if (!users || users.length === 0) {
        return { segments: [], totalUsers: 0, usersInSegments: 0 };
      }

      // Transform users to BehaviorSignal format and count segments
      const segmentCounts: Record<string, number> = {};
      SEGMENTS.forEach(s => { segmentCounts[s.id] = 0; });
      
      let usersInAnySegment = 0;

      for (const user of users) {
        const computed = (user.computed || {}) as Record<string, unknown>;
        
        const signal: BehaviorSignal = {
          unifiedUserId: user.id,
          intentScore: (computed.intent_score as number) ?? 0,
          frequencyScore: (computed.frequency_score as number) ?? 10,
          depthScore: (computed.depth_score as number) ?? 0,
          recencyDays: (computed.recency_days as number) ?? 0,
          topCategory: computed.top_category_30d as string | undefined,
          dropOffStage: (computed.drop_off_stage as DropOffStage) ?? 'visitor',
          viewedProducts7d: (computed.unique_products_viewed as number) ?? 0,
          viewedCategories7d: (computed.unique_categories_viewed as number) ?? 0,
          atc7d: 0,
          sessionCount30d: (computed.session_count_30d as number) ?? 1,
          cartAbandonedAt: computed.cart_abandoned_at as string | undefined,
          checkoutAbandonedAt: computed.checkout_abandoned_at as string | undefined,
          lifetimeValue: (computed.lifetime_value as number) ?? 0,
          ordersCount: (computed.orders_count as number) ?? 0,
          firstSeenAt: user.first_seen_at,
          lastSeenAt: user.last_seen_at,
          computedAt: (computed.last_computed_at as string) ?? new Date().toISOString(),
        };

        const matchingSegments = getMatchingSegments(signal);
        if (matchingSegments.length > 0) {
          usersInAnySegment++;
          matchingSegments.forEach(s => {
            segmentCounts[s.id]++;
          });
        }
      }

      const totalUsers = users.length;
      const segments: SegmentCount[] = SEGMENTS.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        count: segmentCounts[s.id] || 0,
        percentage: totalUsers > 0 ? Math.round((segmentCounts[s.id] / totalUsers) * 100) : 0,
      }));

      // Sort by count descending
      segments.sort((a, b) => b.count - a.count);

      return {
        segments,
        totalUsers,
        usersInSegments: usersInAnySegment,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000,
  });
}
