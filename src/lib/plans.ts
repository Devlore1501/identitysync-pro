// Plan configuration with limits
export interface PlanConfig {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  events: number;
  eventsLabel: string;
  workspaces: number;
  workspacesLabel: string;
  features: string[];
  cta: string;
  popular: boolean;
  retentionDays: number;
}

export const PLANS: PlanConfig[] = [
  {
    id: "starter",
    name: "Starter",
    price: 99,
    period: "/mese",
    description: "Per store in crescita che iniziano con il tracking server-side",
    events: 200000,
    eventsLabel: "200K eventi/mese",
    workspaces: 1,
    workspacesLabel: "1 sito",
    features: [
      "Raccolta eventi server-side",
      "Identity stitching base",
      "Sync Klaviyo",
      "Retention eventi 7 giorni",
      "Supporto email",
    ],
    cta: "Inizia Trial Gratuito",
    popular: false,
    retentionDays: 7,
  },
  {
    id: "growth",
    name: "Growth",
    price: 249,
    period: "/mese",
    description: "Per store in scaling che necessitano identity resolution completa",
    events: 1000000,
    eventsLabel: "1M eventi/mese",
    workspaces: 3,
    workspacesLabel: "Fino a 3 siti",
    features: [
      "Tutto di Starter",
      "Identity graph avanzato",
      "Event enrichment custom",
      "Retention eventi 30 giorni",
      "Webhook integrations",
      "Supporto prioritario",
    ],
    cta: "Inizia Trial Gratuito",
    popular: true,
    retentionDays: 30,
  },
  {
    id: "pro",
    name: "Pro",
    price: 499,
    period: "/mese",
    description: "Per store high-volume che richiedono funzionalità enterprise",
    events: 3000000,
    eventsLabel: "3M eventi/mese",
    workspaces: -1, // unlimited
    workspacesLabel: "Siti illimitati",
    features: [
      "Tutto di Growth",
      "Dashboard real-time",
      "Destinations custom",
      "Retention eventi 90 giorni",
      "Backfill & replay",
      "Supporto dedicato",
      "SLA garantito",
    ],
    cta: "Contatta Sales",
    popular: false,
    retentionDays: 90,
  },
];

export const OVERAGE_PRICE = 5; // €5 per 100K eventi

export function getPlanById(planId: string): PlanConfig | undefined {
  return PLANS.find(p => p.id === planId);
}

export function getPlanLimits(planId: string) {
  const plan = getPlanById(planId) || PLANS[0]; // Default to starter
  return {
    events: plan.events,
    workspaces: plan.workspaces,
    retentionDays: plan.retentionDays,
  };
}

export function canAddWorkspace(planId: string, currentCount: number): boolean {
  const limits = getPlanLimits(planId);
  if (limits.workspaces === -1) return true; // unlimited
  return currentCount < limits.workspaces;
}

export function formatEventCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(count % 1000000 === 0 ? 0 : 1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}K`;
  }
  return count.toString();
}
