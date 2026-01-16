/**
 * Behavior Engine - Transforms raw events into behavioral signals
 * 
 * This engine is the core of IdentitySync's intelligence layer.
 * It processes events and computes derived signals that make Klaviyo smarter.
 */

import { RawEvent, INTENT_WEIGHTS, EVENT_NAME_MAP, RawEventName } from './events/types';
import { BehaviorSignal, DropOffStage, getSegmentIds, SegmentId } from './signals/types';

const INTENT_MAX = 100;
const DECAY_RATE_PER_DAY = 0.95; // 5% decay per day

/**
 * Calculate intent score from events
 */
export function calculateIntentScore(events: RawEvent[], currentScore: number = 0): number {
  let score = currentScore;
  
  for (const event of events) {
    const normalizedName = EVENT_NAME_MAP[event.eventName] || event.eventName as RawEventName;
    const weight = INTENT_WEIGHTS[normalizedName] ?? 1;
    
    // Purchase resets and boosts the base
    if (normalizedName === 'purchase') {
      score = INTENT_MAX;
    } else {
      score = Math.min(score + weight, INTENT_MAX);
      score = Math.max(score, 0);
    }
  }
  
  return Math.round(score);
}

/**
 * Apply time-based decay to intent score
 */
export function applyDecay(score: number, daysSinceLastSeen: number): number {
  const decayFactor = Math.pow(DECAY_RATE_PER_DAY, daysSinceLastSeen);
  return Math.round(score * decayFactor);
}

/**
 * Calculate frequency score based on session count
 */
export function calculateFrequencyScore(sessionCount30d: number): number {
  if (sessionCount30d >= 10) return 100;
  if (sessionCount30d >= 5) return 70;
  if (sessionCount30d >= 3) return 40;
  if (sessionCount30d >= 2) return 25;
  return 10;
}

/**
 * Calculate depth score based on products/categories viewed
 */
export function calculateDepthScore(productsViewed: number, categoriesViewed: number): number {
  const score = (productsViewed * 5) + (categoriesViewed * 10);
  return Math.min(score, 100);
}

/**
 * Determine funnel drop-off stage
 */
export function determineDropOffStage(
  hasProductView: boolean,
  hasCart: boolean,
  hasCheckout: boolean,
  hasOrder: boolean
): DropOffStage {
  if (hasOrder) return 'completed';
  if (hasCheckout) return 'checkout_abandoned';
  if (hasCart) return 'cart_abandoned';
  if (hasProductView) return 'browse_abandoned';
  return 'visitor';
}

/**
 * Find top category from events
 */
export function findTopCategory(events: RawEvent[]): string | undefined {
  const categoryCount: Record<string, number> = {};
  
  for (const event of events) {
    const category = event.properties.collection_handle as string
      || event.properties.category as string
      || event.properties.product_type as string;
    
    if (category) {
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    }
  }
  
  const entries = Object.entries(categoryCount);
  if (entries.length === 0) return undefined;
  
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Transform database user data into BehaviorSignal
 */
export function transformToSignal(user: {
  id: string;
  computed: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
}): BehaviorSignal {
  const computed = user.computed || {};
  
  return {
    unifiedUserId: user.id,
    
    // Core scores
    intentScore: (computed.intent_score as number) ?? 0,
    frequencyScore: (computed.frequency_score as number) ?? 10,
    depthScore: (computed.depth_score as number) ?? 0,
    recencyDays: (computed.recency_days as number) ?? 0,
    
    // Behavioral insights
    topCategory: computed.top_category_30d as string | undefined,
    dropOffStage: (computed.drop_off_stage as DropOffStage) ?? 'visitor',
    
    // Engagement counts
    viewedProducts7d: (computed.unique_products_viewed as number) ?? 0,
    viewedCategories7d: (computed.unique_categories_viewed as number) ?? 0,
    atc7d: (computed.atc_7d as number) ?? 0,
    sessionCount30d: (computed.session_count_30d as number) ?? 1,
    
    // Abandonment signals
    cartAbandonedAt: computed.cart_abandoned_at as string | undefined,
    checkoutAbandonedAt: computed.checkout_abandoned_at as string | undefined,
    
    // Revenue metrics
    lifetimeValue: (computed.lifetime_value as number) ?? 0,
    ordersCount: (computed.orders_count as number) ?? 0,
    
    // Metadata
    firstSeenAt: user.first_seen_at,
    lastSeenAt: user.last_seen_at,
    computedAt: (computed.last_computed_at as string) ?? new Date().toISOString(),
  };
}

/**
 * Get Klaviyo-ready profile properties from signal
 * These are the only properties that should be synced
 */
export function getKlaviyoProfileProperties(signal: BehaviorSignal): Record<string, unknown> {
  return {
    // Core behavioral scores
    sf_intent_score: signal.intentScore,
    sf_frequency_score: signal.frequencyScore,
    sf_depth_score: signal.depthScore,
    sf_recency_days: signal.recencyDays,
    
    // Behavioral signals
    sf_top_category: signal.topCategory ?? null,
    sf_drop_off_stage: signal.dropOffStage,
    
    // Engagement counts
    sf_viewed_products_7d: signal.viewedProducts7d,
    sf_atc_7d: signal.atc7d,
    sf_session_count_30d: signal.sessionCount30d,
    
    // Timestamps for flow triggers
    sf_cart_abandoned_at: signal.cartAbandonedAt ?? null,
    sf_checkout_abandoned_at: signal.checkoutAbandonedAt ?? null,
    
    // Revenue
    sf_lifetime_value: signal.lifetimeValue,
    sf_orders_count: signal.ordersCount,
    
    // Metadata
    sf_last_seen_at: signal.lastSeenAt,
    sf_computed_at: signal.computedAt,
    
    // Segments (computed client-side for Klaviyo segmentation)
    sf_segments: getSegmentIds(signal).join(','),
  };
}

/**
 * High-value Klaviyo events that should be tracked
 * NOT raw events - only significant behavioral changes
 */
export type HighValueEvent = 
  | 'SF High Intent Detected'
  | 'SF Dropped From Checkout'
  | 'SF Category Interest Updated'
  | 'SF Returning Visitor'
  | 'SF At Risk Customer';

/**
 * Check if a signal change warrants a Klaviyo event
 */
export function getTriggeredEvents(
  previousSignal: BehaviorSignal | null,
  currentSignal: BehaviorSignal
): HighValueEvent[] {
  const events: HighValueEvent[] = [];
  
  // High intent threshold crossed (from below 60 to 60+)
  if (
    currentSignal.intentScore >= 60 &&
    (!previousSignal || previousSignal.intentScore < 60)
  ) {
    events.push('SF High Intent Detected');
  }
  
  // Checkout abandonment detected
  if (
    currentSignal.dropOffStage === 'checkout_abandoned' &&
    currentSignal.checkoutAbandonedAt &&
    (!previousSignal || previousSignal.dropOffStage !== 'checkout_abandoned')
  ) {
    events.push('SF Dropped From Checkout');
  }
  
  // New top category detected
  if (
    currentSignal.topCategory &&
    (!previousSignal || previousSignal.topCategory !== currentSignal.topCategory)
  ) {
    events.push('SF Category Interest Updated');
  }
  
  // Returning visitor (3+ sessions)
  if (
    currentSignal.sessionCount30d >= 3 &&
    (!previousSignal || previousSignal.sessionCount30d < 3)
  ) {
    events.push('SF Returning Visitor');
  }
  
  // At risk customer (previous purchaser not seen in 14+ days)
  if (
    currentSignal.ordersCount > 0 &&
    currentSignal.recencyDays >= 14 &&
    (!previousSignal || previousSignal.recencyDays < 14)
  ) {
    events.push('SF At Risk Customer');
  }
  
  return events;
}
