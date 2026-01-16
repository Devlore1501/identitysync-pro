/**
 * Identity Merge Logic
 * 
 * Handles merging of unified user profiles when new identifying information
 * links previously separate profiles.
 * 
 * Example: Anonymous user browses → provides email → matched to existing customer
 */

import { UnifiedUser } from './resolveUnifiedUser';

export interface MergeResult {
  primaryUserId: string;
  mergedUserIds: string[];
  mergedAnonymousIds: string[];
  mergedEvents: number;
  mergedIdentities: number;
}

/**
 * Determine which user should be the primary during a merge
 * Priority: has email > has customer ID > older first_seen_at > older id
 */
export function determinePrimaryUser(users: UnifiedUser[]): UnifiedUser {
  return users.sort((a, b) => {
    // Priority 1: Has email
    const aHasEmail = !!a.primaryEmail;
    const bHasEmail = !!b.primaryEmail;
    if (aHasEmail && !bHasEmail) return -1;
    if (!aHasEmail && bHasEmail) return 1;
    
    // Priority 2: Has customer ID
    const aHasCustomer = a.customerIds.length > 0;
    const bHasCustomer = b.customerIds.length > 0;
    if (aHasCustomer && !bHasCustomer) return -1;
    if (!aHasCustomer && bHasCustomer) return 1;
    
    // Priority 3: Earlier first_seen_at
    const aFirstSeen = new Date(a.firstSeenAt).getTime();
    const bFirstSeen = new Date(b.firstSeenAt).getTime();
    if (aFirstSeen !== bFirstSeen) return aFirstSeen - bFirstSeen;
    
    // Priority 4: Older ID (alphabetically earlier)
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Merge computed traits from multiple users
 * Takes the max of numeric scores, most recent timestamps
 */
export function mergeComputedTraits(
  users: UnifiedUser[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  
  for (const user of users) {
    const computed = user.computed || {};
    
    // Numeric scores: take max
    const numericFields = [
      'intent_score',
      'frequency_score', 
      'depth_score',
      'lifetime_value',
      'orders_count',
      'unique_products_viewed',
      'unique_categories_viewed',
      'session_count_30d',
    ];
    
    for (const field of numericFields) {
      const current = (merged[field] as number) ?? 0;
      const incoming = (computed[field] as number) ?? 0;
      merged[field] = Math.max(current, incoming);
    }
    
    // Timestamps: take most recent
    const timestampFields = [
      'last_computed_at',
      'cart_abandoned_at',
      'checkout_abandoned_at',
    ];
    
    for (const field of timestampFields) {
      const current = merged[field] as string | undefined;
      const incoming = computed[field] as string | undefined;
      if (incoming && (!current || incoming > current)) {
        merged[field] = incoming;
      }
    }
    
    // Strings: take first non-null
    if (!merged['top_category_30d'] && computed['top_category_30d']) {
      merged['top_category_30d'] = computed['top_category_30d'];
    }
    if (!merged['drop_off_stage'] && computed['drop_off_stage']) {
      merged['drop_off_stage'] = computed['drop_off_stage'];
    }
  }
  
  // Recency: use the primary user's last_seen_at
  const primaryUser = determinePrimaryUser(users);
  const daysSinceLastSeen = Math.floor(
    (Date.now() - new Date(primaryUser.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  merged['recency_days'] = daysSinceLastSeen;
  
  return merged;
}

/**
 * Merge array fields from multiple users
 */
export function mergeArrays(...arrays: string[][]): string[] {
  const set = new Set<string>();
  for (const arr of arrays) {
    for (const item of arr) {
      if (item) set.add(item);
    }
  }
  return Array.from(set);
}
