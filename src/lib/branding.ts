// White-label branding configuration
export interface BrandingConfig {
  name: string;
  logo?: string;
  logoLight?: string;
  logoDark?: string;
  favicon?: string;
  primaryColor?: string;
  accentColor?: string;
  supportEmail?: string;
  supportUrl?: string;
  docsUrl?: string;
  termsUrl?: string;
  privacyUrl?: string;
  copyrightText?: string;
  showPoweredBy?: boolean;
}

// Default branding
export const DEFAULT_BRANDING: BrandingConfig = {
  name: "IdentitySync",
  supportEmail: "support@identitysync.dev",
  docsUrl: "/docs",
  termsUrl: "/terms",
  privacyUrl: "/privacy",
  copyrightText: "© 2024 IdentitySync. Tutti i diritti riservati.",
  showPoweredBy: false,
};

// This can be overridden per-account for white-label
let currentBranding: BrandingConfig = DEFAULT_BRANDING;

export function setBranding(config: Partial<BrandingConfig>) {
  currentBranding = { ...DEFAULT_BRANDING, ...config };
}

export function getBranding(): BrandingConfig {
  return currentBranding;
}

export function resetBranding() {
  currentBranding = DEFAULT_BRANDING;
}
