/**
 * Behavior Signals - Derived insights from raw events
 * These are the high-value signals sent to Klaviyo
 */

export type DropOffStage = 
  | 'visitor' 
  | 'browse_abandoned' 
  | 'cart_abandoned' 
  | 'checkout_abandoned' 
  | 'completed';

export interface BehaviorSignal {
  unifiedUserId: string;
  
  // Core scores (0-100)
  intentScore: number;
  frequencyScore: number;
  depthScore: number;
  recencyDays: number;
  
  // Behavioral insights
  topCategory?: string;
  dropOffStage: DropOffStage;
  
  // Engagement counts
  viewedProducts7d: number;
  viewedCategories7d: number;
  atc7d: number;
  sessionCount30d: number;
  
  // Abandonment signals
  cartAbandonedAt?: string;
  checkoutAbandonedAt?: string;
  
  // Revenue metrics
  lifetimeValue: number;
  ordersCount: number;
  
  // Metadata
  firstSeenAt: string;
  lastSeenAt: string;
  computedAt: string;
}

/**
 * Segment definitions based on behavior signals
 */
export type SegmentId = 
  | 'high_intent_no_purchase'
  | 'atc_no_checkout_24h'
  | 'checkout_abandoned'
  | 'category_lover'
  | 'returning_visitor'
  | 'at_risk';

export interface Segment {
  id: SegmentId;
  name: string;
  description: string;
  condition: (signal: BehaviorSignal) => boolean;
}

/**
 * Predefined segments based on behavioral signals
 */
export const SEGMENTS: Segment[] = [
  {
    id: 'high_intent_no_purchase',
    name: 'High Intent - No Purchase',
    description: 'Users with intent score > 60 who have not purchased',
    condition: (signal) => signal.intentScore > 60 && signal.ordersCount === 0,
  },
  {
    id: 'atc_no_checkout_24h',
    name: 'Added to Cart - No Checkout (24h)',
    description: 'Users who added to cart but did not start checkout in last 24 hours',
    condition: (signal) => {
      if (signal.dropOffStage !== 'cart_abandoned' || !signal.cartAbandonedAt) return false;
      const hoursSinceCart = (Date.now() - new Date(signal.cartAbandonedAt).getTime()) / (1000 * 60 * 60);
      return hoursSinceCart <= 24 && hoursSinceCart >= 0.5; // Between 30 min and 24 hours
    },
  },
  {
    id: 'checkout_abandoned',
    name: 'Checkout Abandoned',
    description: 'Users who started checkout but did not complete',
    condition: (signal) => signal.dropOffStage === 'checkout_abandoned',
  },
  {
    id: 'category_lover',
    name: 'Category Lover',
    description: 'Users with a clear category preference (viewed 5+ products in same category)',
    condition: (signal) => signal.topCategory !== undefined && signal.viewedProducts7d >= 5,
  },
  {
    id: 'returning_visitor',
    name: 'Returning Visitor',
    description: 'Users with 3+ sessions in last 30 days',
    condition: (signal) => signal.sessionCount30d >= 3,
  },
  {
    id: 'at_risk',
    name: 'At Risk',
    description: 'Previous purchasers not seen in 14+ days',
    condition: (signal) => signal.ordersCount > 0 && signal.recencyDays >= 14,
  },
];

/**
 * Get all matching segments for a behavior signal
 */
export function getMatchingSegments(signal: BehaviorSignal): Segment[] {
  return SEGMENTS.filter(segment => segment.condition(signal));
}

/**
 * Get segment IDs for a behavior signal
 */
export function getSegmentIds(signal: BehaviorSignal): SegmentId[] {
  return getMatchingSegments(signal).map(s => s.id);
}
