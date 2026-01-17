import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";

export interface EcommerceEventStatus {
  count: number;
  lastAt: string | null;
  hasRecent: boolean;
}

export interface EcommerceHealth {
  productViews: EcommerceEventStatus;
  addToCart: EcommerceEventStatus;
  checkout: EcommerceEventStatus;
  orders: EcommerceEventStatus;
  overall: 'healthy' | 'warning' | 'critical';
  issues: string[];
}

// Event name patterns for each type
const EVENT_PATTERNS = {
  productViews: ['Product Viewed', 'product_viewed', 'view_item'],
  addToCart: ['Add to Cart', 'add_to_cart', 'Added to Cart'],
  checkout: ['Begin Checkout', 'begin_checkout', 'Checkout Started', 'checkout_started'],
  orders: ['Order Placed', 'order_placed', 'purchase', 'Order Created', 'order_created']
};

async function fetchEventStatus(
  workspaceId: string,
  eventNames: string[],
  daysCutoff: number
): Promise<EcommerceEventStatus> {
  const cutoffDate = new Date(Date.now() - daysCutoff * 24 * 60 * 60 * 1000).toISOString();
  
  // Build OR filter for event names
  const orFilter = eventNames.map(name => `event_name.ilike.%${name}%`).join(',');
  
  const { data, error } = await supabase
    .from('events')
    .select('id, event_time')
    .eq('workspace_id', workspaceId)
    .or(orFilter)
    .gte('event_time', cutoffDate)
    .order('event_time', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching event status:', error);
    return { count: 0, lastAt: null, hasRecent: false };
  }

  const count = data?.length || 0;
  const lastAt = data?.[0]?.event_time || null;
  const hasRecent = count > 0;

  return { count, lastAt, hasRecent };
}

export function useEcommerceHealth() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['ecommerce-health', currentWorkspace?.id],
    queryFn: async (): Promise<EcommerceHealth> => {
      if (!currentWorkspace?.id) {
        return getEmptyHealth();
      }

      // Fetch all event statuses in parallel
      const [productViews, addToCart, checkout, orders] = await Promise.all([
        fetchEventStatus(currentWorkspace.id, EVENT_PATTERNS.productViews, 7),
        fetchEventStatus(currentWorkspace.id, EVENT_PATTERNS.addToCart, 7),
        fetchEventStatus(currentWorkspace.id, EVENT_PATTERNS.checkout, 7),
        fetchEventStatus(currentWorkspace.id, EVENT_PATTERNS.orders, 30)
      ]);

      // Determine overall health and issues
      const issues: string[] = [];
      
      if (!productViews.hasRecent) {
        issues.push('Nessun evento Product Viewed negli ultimi 7 giorni');
      }
      if (!addToCart.hasRecent) {
        issues.push('Nessun evento Add to Cart negli ultimi 7 giorni');
      }
      if (!checkout.hasRecent) {
        issues.push('Nessun evento Checkout negli ultimi 7 giorni');
      }
      if (!orders.hasRecent) {
        issues.push('Nessun ordine negli ultimi 30 giorni');
      }

      let overall: EcommerceHealth['overall'] = 'healthy';
      if (issues.length >= 3) {
        overall = 'critical';
      } else if (issues.length >= 1) {
        overall = 'warning';
      }

      return {
        productViews,
        addToCart,
        checkout,
        orders,
        overall,
        issues
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000
  });
}

function getEmptyHealth(): EcommerceHealth {
  return {
    productViews: { count: 0, lastAt: null, hasRecent: false },
    addToCart: { count: 0, lastAt: null, hasRecent: false },
    checkout: { count: 0, lastAt: null, hasRecent: false },
    orders: { count: 0, lastAt: null, hasRecent: false },
    overall: 'critical',
    issues: ['Nessun dato disponibile']
  };
}

// Hook for workspace health record from database
export function useWorkspaceHealth() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['workspace-health', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('workspace_health')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching workspace health:', error);
        return null;
      }

      return data;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000
  });
}
