/**
 * Klaviyo Integration Module
 * 
 * Handles syncing behavioral signals to Klaviyo.
 * Only high-value data is synced - signals, not raw events.
 */

// Profile mapping
export type { KlaviyoProfileData } from './mapSignalsToProfile';
export {
  shouldSyncToKlaviyo,
  mapToKlaviyoProfile,
  getKlaviyoProfilePayload,
  SYNCED_PROPERTIES,
} from './mapSignalsToProfile';

// Event mapping
export type { KlaviyoEventData } from './mapSignalsToEvents';
export {
  ALLOWED_KLAVIYO_EVENTS,
  shouldSendEvent,
  createKlaviyoEvent,
  getKlaviyoEventPayload,
  BLOCKED_EVENT_NAMES,
  isBlockedEvent,
} from './mapSignalsToEvents';

// Sync jobs
export type { SyncJob, SyncJobType, SyncJobStatus, SyncStats } from './syncJob';
export {
  calculateSyncHealth,
  getSyncStatusMessage,
} from './syncJob';
