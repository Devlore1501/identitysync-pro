/**
 * Identity Module - Public API
 * 
 * Identity Resolution & Stitching for IdentitySync
 * 
 * This module handles resolving anonymous users to known customers
 * and merging profiles when new identifying information is received.
 */

export type { UnifiedUser, IdentityInput } from './resolveUnifiedUser';
export {
  calculateConfidence,
  getDisplayName,
  isIdentified,
  getIdentitySummary,
} from './resolveUnifiedUser';

export type { MergeResult } from './mergeIdentities';
export {
  determinePrimaryUser,
  mergeComputedTraits,
  mergeArrays,
} from './mergeIdentities';
