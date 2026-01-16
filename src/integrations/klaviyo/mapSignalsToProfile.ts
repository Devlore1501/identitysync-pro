/**
 * Klaviyo Profile Mapping
 * 
 * Maps behavioral signals to Klaviyo profile properties.
 * Only high-value signals are sent - no raw events.
 */

import { BehaviorSignal, getKlaviyoProfileProperties } from '@/behavior';
import { UnifiedUser, isIdentified } from '@/identity';

export interface KlaviyoProfileData {
  email: string;
  externalId: string;
  phoneNumber?: string;
  properties: Record<string, unknown>;
}

/**
 * Should this user be synced to Klaviyo?
 * Only identified users (with email) should be synced.
 */
export function shouldSyncToKlaviyo(user: UnifiedUser): boolean {
  return isIdentified(user);
}

/**
 * Map a unified user and their signals to Klaviyo profile format
 */
export function mapToKlaviyoProfile(
  user: UnifiedUser,
  signal: BehaviorSignal
): KlaviyoProfileData | null {
  // Never sync users without email
  if (!user.primaryEmail) {
    return null;
  }
  
  return {
    email: user.primaryEmail,
    externalId: user.id,
    phoneNumber: user.phone,
    properties: getKlaviyoProfileProperties(signal),
  };
}

/**
 * Get the Klaviyo API payload for profile upsert
 */
export function getKlaviyoProfilePayload(profile: KlaviyoProfileData) {
  return {
    data: {
      type: 'profile',
      attributes: {
        email: profile.email,
        external_id: profile.externalId,
        phone_number: profile.phoneNumber,
        properties: profile.properties,
      },
    },
  };
}

/**
 * Profile properties that Klaviyo will receive
 * These are the ONLY properties synced - behavior first, not raw events
 */
export const SYNCED_PROPERTIES = [
  // Core behavioral scores
  'sf_intent_score',
  'sf_frequency_score',
  'sf_depth_score',
  'sf_recency_days',
  
  // Behavioral signals
  'sf_top_category',
  'sf_drop_off_stage',
  
  // Engagement counts
  'sf_viewed_products_7d',
  'sf_atc_7d',
  'sf_session_count_30d',
  
  // Timestamps for flow triggers
  'sf_cart_abandoned_at',
  'sf_checkout_abandoned_at',
  
  // Revenue
  'sf_lifetime_value',
  'sf_orders_count',
  
  // Metadata
  'sf_last_seen_at',
  'sf_computed_at',
  'sf_segments',
] as const;
