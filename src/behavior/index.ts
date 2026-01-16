/**
 * Behavior Module - Public API
 * 
 * IdentitySync's Behavior Intelligence Layer
 * 
 * This module transforms raw ecommerce events into actionable behavioral signals
 * that make Klaviyo automations smarter and more effective.
 */

// Event types
export type { RawEvent, RawEventName } from './events/types';
export { EVENT_NAME_MAP, INTENT_WEIGHTS } from './events/types';

// Signal types
export type { BehaviorSignal, DropOffStage, Segment, SegmentId } from './signals/types';
export { SEGMENTS, getMatchingSegments, getSegmentIds } from './signals/types';

// Engine functions
export {
  calculateIntentScore,
  applyDecay,
  calculateFrequencyScore,
  calculateDepthScore,
  determineDropOffStage,
  findTopCategory,
  transformToSignal,
  getKlaviyoProfileProperties,
  getTriggeredEvents,
} from './engine';
export type { HighValueEvent } from './engine';
