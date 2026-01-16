import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface IntentDistribution {
  low: number;    // 0-30
  medium: number; // 31-60
  high: number;   // 61-100
}

interface FunnelDropOff {
  visitor: number;
  browse_abandoned: number;
  cart_abandoned: number;
  checkout_abandoned: number;
  completed: number;
}

interface TopCategory {
  category: string;
  count: number;
}

interface BehavioralStats {
  intentDistribution: IntentDistribution;
  funnelDropOff: FunnelDropOff;
  topCategories: TopCategory[];
  avgFrequencyScore: number;
  avgDepthScore: number;
  avgSessionCount: number;
  totalProfilesWithEmail: number;
  totalProfilesAnonymous: number;
}

export function useBehavioralStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['behavioral-stats', currentWorkspace?.id],
    queryFn: async (): Promise<BehavioralStats> => {
      if (!currentWorkspace?.id) {
        return getEmptyStats();
      }

      // Fetch all unified users with computed traits
      const { data: users, error } = await supabase
        .from('users_unified')
        .select('computed, primary_email')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      if (!users || users.length === 0) {
        return getEmptyStats();
      }

      // Calculate intent distribution
      const intentDistribution: IntentDistribution = { low: 0, medium: 0, high: 0 };
      const funnelDropOff: FunnelDropOff = {
        visitor: 0,
        browse_abandoned: 0,
        cart_abandoned: 0,
        checkout_abandoned: 0,
        completed: 0,
      };
      const categoryCount: Record<string, number> = {};
      
      let totalFrequency = 0;
      let totalDepth = 0;
      let totalSessions = 0;
      let totalProfilesWithEmail = 0;
      let totalProfilesAnonymous = 0;
      let usersWithScores = 0;

      for (const user of users) {
        const computed = (user.computed || {}) as Record<string, unknown>;
        
        // Count email vs anonymous
        if (user.primary_email) {
          totalProfilesWithEmail++;
        } else {
          totalProfilesAnonymous++;
        }

        // Intent score distribution
        const intentScore = (computed.intent_score as number) || 0;
        if (intentScore <= 30) {
          intentDistribution.low++;
        } else if (intentScore <= 60) {
          intentDistribution.medium++;
        } else {
          intentDistribution.high++;
        }

        // Funnel drop-off
        const dropOffStage = (computed.drop_off_stage as string) || 'visitor';
        if (dropOffStage in funnelDropOff) {
          funnelDropOff[dropOffStage as keyof FunnelDropOff]++;
        } else {
          funnelDropOff.visitor++;
        }

        // Top categories
        const topCategory = computed.top_category_30d as string;
        if (topCategory) {
          categoryCount[topCategory] = (categoryCount[topCategory] || 0) + 1;
        }

        // Aggregate scores
        const frequencyScore = (computed.frequency_score as number) || 0;
        const depthScore = (computed.depth_score as number) || 0;
        const sessionCount = (computed.session_count_30d as number) || 0;

        if (frequencyScore > 0 || depthScore > 0 || sessionCount > 0) {
          totalFrequency += frequencyScore;
          totalDepth += depthScore;
          totalSessions += sessionCount;
          usersWithScores++;
        }
      }

      // Sort categories by count
      const topCategories = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        intentDistribution,
        funnelDropOff,
        topCategories,
        avgFrequencyScore: usersWithScores > 0 ? Math.round(totalFrequency / usersWithScores) : 0,
        avgDepthScore: usersWithScores > 0 ? Math.round(totalDepth / usersWithScores) : 0,
        avgSessionCount: usersWithScores > 0 ? Math.round((totalSessions / usersWithScores) * 10) / 10 : 0,
        totalProfilesWithEmail,
        totalProfilesAnonymous,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000, // Refresh every minute
  });
}

function getEmptyStats(): BehavioralStats {
  return {
    intentDistribution: { low: 0, medium: 0, high: 0 },
    funnelDropOff: {
      visitor: 0,
      browse_abandoned: 0,
      cart_abandoned: 0,
      checkout_abandoned: 0,
      completed: 0,
    },
    topCategories: [],
    avgFrequencyScore: 0,
    avgDepthScore: 0,
    avgSessionCount: 0,
    totalProfilesWithEmail: 0,
    totalProfilesAnonymous: 0,
  };
}
