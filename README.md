# IdentitySync

**Behavior Intelligence Layer for E-commerce**

IdentitySync captures pre-purchase behavior, resolves identity across touchpoints, and sends only high-value signals to Klaviyo — so your automations make better decisions.

## What IdentitySync Does

| Problem | Solution |
|---------|----------|
| Klaviyo receives too much noise | Only high-value behavioral signals are synced |
| Anonymous visitors are invisible | Identity stitching links all touchpoints |
| Flows trigger on wrong signals | Computed intent scores replace raw events |
| Ghost profiles pollute lists | Only identified users (with email) sync |

## Core Principles

1. **Behavior-first** — Pre-purchase behavior matters more than the sale
2. **Signals > Raw events** — Klaviyo receives computed insights, not noise
3. **Identity stitching** — Every event links to a unified user profile
4. **Transparency** — Clear rules, no magic. You control what syncs
5. **Complementary** — We don't replace Klaviyo tracking, we enhance it

## What Gets Synced to Klaviyo

### Profile Properties (sf_*)
```
sf_intent_score        → Purchase intent (0-100)
sf_frequency_score     → Visit frequency (0-100)  
sf_depth_score         → Browsing depth (0-100)
sf_top_category        → Preferred product category
sf_drop_off_stage      → Funnel position (visitor → cart → checkout → completed)
sf_cart_abandoned_at   → Last cart abandonment timestamp
sf_checkout_abandoned_at → Last checkout abandonment timestamp
sf_lifetime_value      → Total revenue from customer
sf_orders_count        → Number of purchases
```

### Trigger Events (High-Value Only)
```
✅ SF Added to Cart       → Cart intent signal
✅ SF Started Checkout    → High intent signal
✅ SF Placed Order        → Conversion signal
```

### Blocked Events (Noise)
```
❌ Page View              → Aggregated into depth score
❌ Product Viewed         → Aggregated into depth score
❌ Session Start          → Aggregated into frequency score
❌ Scroll Depth           → Not actionable for flows
```

## Architecture

```
src/
├── behavior/           # Behavior engine
│   ├── events/         # Raw event types
│   ├── signals/        # Computed signals
│   └── engine.ts       # Signal computation
│
├── identity/           # Identity resolution
│   ├── resolveUnifiedUser.ts
│   └── mergeIdentities.ts
│
└── integrations/
    └── klaviyo/        # Klaviyo-specific logic
        ├── mapSignalsToProfile.ts
        ├── mapSignalsToEvents.ts
        └── syncJob.ts
```

## Segments (Internal)

IdentitySync computes segments based on behavioral signals:

| Segment | Condition |
|---------|-----------|
| High Intent - No Purchase | intent_score > 60 AND orders_count = 0 |
| Cart Abandoned (24h) | drop_off_stage = cart_abandoned AND cart_abandoned_at within 24h |
| Checkout Abandoned | drop_off_stage = checkout_abandoned |
| Category Lover | top_category exists AND viewed_products >= 5 |
| Returning Visitor | session_count_30d >= 3 |
| At Risk | orders_count > 0 AND recency_days >= 14 |

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (Postgres + Edge Functions)
- **Database**: 
  - `events_raw` — Unprocessed event stream
  - `events` — Processed events
  - `users_unified` — Identity-resolved profiles
  - `identities` — Identity graph
  - `sync_jobs` — Klaviyo sync queue
  - `destinations` — Integration configs

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Result

After implementing IdentitySync:

- **Klaviyo receives less data** — But it's the right data
- **Flows become more reliable** — Triggered by real intent, not page views
- **Segments are accurate** — Based on behavior, not form submissions
- **Email value increases** — Because you're sending to the right people at the right time

---

**Built with [Lovable](https://lovable.dev)**
