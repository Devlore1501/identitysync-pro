/**
 * Identity Resolution
 * 
 * Resolves user identity with priority:
 * 1. email (highest confidence)
 * 2. customerId (high confidence)
 * 3. anonymousId (base identifier)
 * 
 * Note: The actual resolution logic runs in the database via resolve_identity()
 * This client-side module provides types and utilities for working with resolved users.
 */

export interface UnifiedUser {
  id: string;
  workspaceId: string;
  
  // Identifiers
  anonymousIds: string[];
  emails: string[];
  customerIds: string[];
  primaryEmail?: string;
  phone?: string;
  
  // Timestamps
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  
  // Computed traits (behavioral signals)
  computed: Record<string, unknown>;
  
  // Custom traits
  traits: Record<string, unknown>;
}

export interface IdentityInput {
  anonymousId: string;
  email?: string;
  phone?: string;
  customerId?: string;
  source?: string;
}

/**
 * Calculate identity confidence based on available identifiers
 */
export function calculateConfidence(input: IdentityInput): number {
  let confidence = 0.5; // Base confidence for anonymous ID
  
  if (input.email) {
    confidence = 1.0; // Email is highest confidence
  } else if (input.customerId) {
    confidence = 0.9; // Customer ID is high confidence
  } else if (input.phone) {
    confidence = 0.85; // Phone is good confidence
  }
  
  return confidence;
}

/**
 * Get display name for a unified user
 */
export function getDisplayName(user: UnifiedUser): string {
  if (user.primaryEmail) {
    return user.primaryEmail;
  }
  if (user.customerIds.length > 0) {
    return `Customer ${user.customerIds[0].slice(0, 8)}...`;
  }
  if (user.anonymousIds.length > 0) {
    return `Anonymous ${user.anonymousIds[0].slice(0, 8)}...`;
  }
  return user.id.slice(0, 8);
}

/**
 * Check if user is identified (has email)
 */
export function isIdentified(user: UnifiedUser): boolean {
  return !!user.primaryEmail;
}

/**
 * Get identity summary for display
 */
export function getIdentitySummary(user: UnifiedUser): {
  total: number;
  emails: number;
  customerIds: number;
  anonymousIds: number;
} {
  return {
    total: user.emails.length + user.customerIds.length + user.anonymousIds.length,
    emails: user.emails.length,
    customerIds: user.customerIds.length,
    anonymousIds: user.anonymousIds.length,
  };
}
