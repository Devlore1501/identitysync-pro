/**
 * Klaviyo Event Mapping
 * 
 * Maps behavioral signals to Klaviyo events.
 * Only HIGH-VALUE events are sent - not raw page views or clicks.
 * 
 * ❌ NOT sent to Klaviyo:
 * - page_view
 * - product_view (individual)
 * - session_start
 * - scroll events
 * 
 * ✅ Sent to Klaviyo:
 * - SF High Intent Detected
 * - SF Dropped From Checkout
 * - SF Category Interest Updated
 * - SF Returning Visitor
 * - SF At Risk Customer
 */

import { HighValueEvent, BehaviorSignal, getSegmentIds } from '@/behavior';

export interface KlaviyoEventData {
  email: string;
  externalId: string;
  eventName: HighValueEvent;
  properties: Record<string, unknown>;
  timestamp: string;
  uniqueId: string;
}

/**
 * Allowed events that can be sent to Klaviyo
 * These are behavioral milestones, not raw events
 */
export const ALLOWED_KLAVIYO_EVENTS: readonly HighValueEvent[] = [
  'SF High Intent Detected',
  'SF Dropped From Checkout',
  'SF Category Interest Updated',
  'SF Returning Visitor',
  'SF At Risk Customer',
] as const;

/**
 * Check if an event should be sent to Klaviyo
 */
export function shouldSendEvent(eventName: string): boolean {
  return ALLOWED_KLAVIYO_EVENTS.includes(eventName as HighValueEvent);
}

/**
 * Create a Klaviyo event from a high-value trigger
 */
export function createKlaviyoEvent(
  email: string,
  userId: string,
  eventName: HighValueEvent,
  signal: BehaviorSignal
): KlaviyoEventData {
  return {
    email,
    externalId: userId,
    eventName,
    properties: {
      // Context about the trigger
      intent_score: signal.intentScore,
      drop_off_stage: signal.dropOffStage,
      top_category: signal.topCategory ?? null,
      session_count: signal.sessionCount30d,
      lifetime_value: signal.lifetimeValue,
      orders_count: signal.ordersCount,
      segments: getSegmentIds(signal),
      
      // Timestamps
      cart_abandoned_at: signal.cartAbandonedAt ?? null,
      checkout_abandoned_at: signal.checkoutAbandonedAt ?? null,
    },
    timestamp: new Date().toISOString(),
    uniqueId: `${userId}_${eventName}_${Date.now()}`,
  };
}

/**
 * Get the Klaviyo API payload for event tracking
 */
export function getKlaviyoEventPayload(event: KlaviyoEventData) {
  return {
    data: {
      type: 'event',
      attributes: {
        metric: {
          data: {
            type: 'metric',
            attributes: {
              name: event.eventName,
            },
          },
        },
        profile: {
          data: {
            type: 'profile',
            attributes: {
              email: event.email,
              external_id: event.externalId,
            },
          },
        },
        properties: event.properties,
        time: event.timestamp,
        unique_id: event.uniqueId,
      },
    },
  };
}

/**
 * Events that should NOT be sent to Klaviyo
 * These are handled internally by IdentitySync
 */
export const BLOCKED_EVENT_NAMES = [
  // Page events (noise)
  'page_view',
  'Page View',
  'Session Start',
  'Scroll Depth',
  'Time on Page',
  
  // Individual product events (aggregated instead)
  'product_view',
  'Product Viewed',
  'View Item',
  'View Category',
  
  // Form events (not behavioral)
  'Form Viewed',
  'Form Submitted',
] as const;

/**
 * Check if an event name is blocked from Klaviyo
 */
export function isBlockedEvent(eventName: string): boolean {
  return BLOCKED_EVENT_NAMES.includes(eventName as typeof BLOCKED_EVENT_NAMES[number]);
}
