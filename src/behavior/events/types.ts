/**
 * Raw Event Types - Events captured from ecommerce platforms
 * These are NOT sent directly to Klaviyo
 */

export type RawEventName =
  | 'page_view'
  | 'product_view'
  | 'collection_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_started'
  | 'checkout_completed'
  | 'purchase';

export interface RawEvent {
  id: string;
  workspaceId: string;
  eventName: RawEventName | string;
  timestamp: string;
  anonymousId?: string;
  email?: string;
  customerId?: string;
  sessionId?: string;
  properties: Record<string, unknown>;
  context?: {
    page?: {
      url?: string;
      path?: string;
      title?: string;
      referrer?: string;
    };
    userAgent?: string;
    ip?: string;
  };
}

/**
 * Maps external event names to internal standardized names
 */
export const EVENT_NAME_MAP: Record<string, RawEventName> = {
  // Page events
  'Page View': 'page_view',
  'Session Start': 'page_view',
  
  // Product events
  'Product Viewed': 'product_view',
  'View Item': 'product_view',
  
  // Collection events
  'View Category': 'collection_view',
  'Collection Viewed': 'collection_view',
  
  // Cart events
  'Add to Cart': 'add_to_cart',
  'Product Added': 'add_to_cart',
  'Remove from Cart': 'remove_from_cart',
  'Product Removed': 'remove_from_cart',
  
  // Checkout events
  'Begin Checkout': 'checkout_started',
  'Checkout Started': 'checkout_started',
  
  // Order events
  'Purchase': 'purchase',
  'Order Completed': 'purchase',
};

/**
 * Intent score weights for each event type
 */
export const INTENT_WEIGHTS: Record<RawEventName, number> = {
  page_view: 1,
  product_view: 5,
  collection_view: 3,
  add_to_cart: 15,
  remove_from_cart: -5,
  checkout_started: 25,
  checkout_completed: 35,
  purchase: 0, // Reset on purchase
};
