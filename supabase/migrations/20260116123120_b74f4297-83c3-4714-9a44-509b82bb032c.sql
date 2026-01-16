-- =============================================
-- SIGNALFORGE DATABASE SCHEMA
-- =============================================

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.event_status AS ENUM ('pending', 'processed', 'failed', 'synced');
CREATE TYPE public.destination_type AS ENUM ('klaviyo', 'webhook', 'ga4');
CREATE TYPE public.sync_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE public.identity_type AS ENUM ('email', 'phone', 'customer_id', 'anonymous_id', 'external_id');

-- =============================================
-- 1. ACCOUNTS (Multi-tenant root)
-- =============================================
CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. PROFILES (User profiles linked to auth.users)
-- =============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. USER_ROLES (Separate table for roles - security best practice)
-- =============================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, account_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. WORKSPACES (Shops/stores per account)
-- =============================================
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    domain TEXT,
    platform TEXT, -- 'shopify', 'woocommerce', 'custom'
    platform_store_id TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_workspaces_account ON public.workspaces(account_id);

-- =============================================
-- 5. API_KEYS (Per workspace, hashed)
-- =============================================
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL, -- SHA256 hash of the actual key
    key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "sf_pk_abc...")
    scopes TEXT[] NOT NULL DEFAULT ARRAY['collect', 'identify'],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_workspace ON public.api_keys(workspace_id);

-- =============================================
-- 6. EVENTS_RAW (Ingestion buffer)
-- =============================================
CREATE TABLE public.events_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    source TEXT NOT NULL, -- 'js', 'server', 'shopify', 'webhook'
    ip_address INET,
    user_agent TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    error TEXT
);

ALTER TABLE public.events_raw ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_events_raw_workspace ON public.events_raw(workspace_id);
CREATE INDEX idx_events_raw_unprocessed ON public.events_raw(workspace_id) WHERE processed_at IS NULL;

-- =============================================
-- 7. USERS_UNIFIED (Resolved identity profiles)
-- =============================================
CREATE TABLE public.users_unified (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    primary_email TEXT,
    emails TEXT[] NOT NULL DEFAULT '{}',
    phone TEXT,
    customer_ids TEXT[] NOT NULL DEFAULT '{}',
    anonymous_ids TEXT[] NOT NULL DEFAULT '{}',
    external_ids JSONB NOT NULL DEFAULT '{}',
    traits JSONB NOT NULL DEFAULT '{}', -- name, address, etc.
    computed JSONB NOT NULL DEFAULT '{}', -- intent_score, ltv, etc.
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users_unified ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_users_unified_workspace ON public.users_unified(workspace_id);
CREATE INDEX idx_users_unified_email ON public.users_unified(workspace_id, primary_email);
CREATE INDEX idx_users_unified_emails ON public.users_unified USING GIN(emails);

-- =============================================
-- 8. IDENTITIES (Identity graph edges)
-- =============================================
CREATE TABLE public.identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    unified_user_id UUID NOT NULL REFERENCES public.users_unified(id) ON DELETE CASCADE,
    identity_type identity_type NOT NULL,
    identity_value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0, -- 0.0 to 1.0
    source TEXT NOT NULL, -- 'js', 'shopify', 'manual'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, identity_type, identity_value)
);

ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_identities_workspace ON public.identities(workspace_id);
CREATE INDEX idx_identities_lookup ON public.identities(workspace_id, identity_type, identity_value);
CREATE INDEX idx_identities_user ON public.identities(unified_user_id);

-- =============================================
-- 9. EVENTS (Processed & enriched events)
-- =============================================
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    unified_user_id UUID REFERENCES public.users_unified(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'page_view', 'view_item', 'add_to_cart', 'purchase'
    event_name TEXT NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    context JSONB NOT NULL DEFAULT '{}', -- device, geo, utm, etc.
    anonymous_id TEXT,
    session_id TEXT,
    source TEXT NOT NULL,
    status event_status NOT NULL DEFAULT 'pending',
    dedupe_key TEXT, -- For deduplication
    consent_state JSONB, -- {analytics: true, marketing: false}
    event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_events_workspace_time ON public.events(workspace_id, event_time DESC);
CREATE INDEX idx_events_user ON public.events(unified_user_id);
CREATE INDEX idx_events_type ON public.events(workspace_id, event_type);
CREATE INDEX idx_events_status ON public.events(workspace_id, status);
CREATE INDEX idx_events_dedupe ON public.events(workspace_id, dedupe_key);

-- =============================================
-- 10. DESTINATIONS (Klaviyo, webhooks, etc.)
-- =============================================
CREATE TABLE public.destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type destination_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}', -- api_key, list_id, etc. (encrypted at rest)
    event_mapping JSONB NOT NULL DEFAULT '{}', -- which events to sync
    property_mapping JSONB NOT NULL DEFAULT '{}', -- field mappings
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_destinations_workspace ON public.destinations(workspace_id);

-- =============================================
-- 11. SYNC_JOBS (Queue for syncing to destinations)
-- =============================================
CREATE TABLE public.sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
    unified_user_id UUID REFERENCES public.users_unified(id) ON DELETE SET NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    job_type TEXT NOT NULL, -- 'profile_upsert', 'event_track'
    payload JSONB NOT NULL DEFAULT '{}',
    status sync_status NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_error TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sync_jobs_pending ON public.sync_jobs(workspace_id, status, scheduled_at) 
    WHERE status = 'pending';
CREATE INDEX idx_sync_jobs_destination ON public.sync_jobs(destination_id);

-- =============================================
-- 12. BILLING_USAGE (Metering for billing)
-- =============================================
CREATE TABLE public.billing_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    events_count BIGINT NOT NULL DEFAULT 0,
    profiles_count BIGINT NOT NULL DEFAULT 0,
    syncs_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, workspace_id, period_start)
);

ALTER TABLE public.billing_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_account ON public.billing_usage(account_id, period_start);

-- =============================================
-- 13. AUDIT_LOGS (Activity tracking)
-- =============================================
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'api_key.created', 'destination.updated', etc.
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_account ON public.audit_logs(account_id, created_at DESC);

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Check if user has role in account
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _account_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id
          AND account_id = _account_id
          AND role = _role
    )
$$;

-- Get user's account_id
CREATE OR REPLACE FUNCTION public.get_user_account_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT account_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Check if user belongs to workspace
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles p
        JOIN public.workspaces w ON w.account_id = p.account_id
        WHERE p.user_id = _user_id AND w.id = _workspace_id
    )
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- ACCOUNTS
CREATE POLICY "Users can view their own account"
    ON public.accounts FOR SELECT
    USING (id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Owners can update their account"
    ON public.accounts FOR UPDATE
    USING (public.has_role(auth.uid(), id, 'owner'));

-- PROFILES
CREATE POLICY "Users can view profiles in their account"
    ON public.profiles FOR SELECT
    USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- USER_ROLES
CREATE POLICY "Users can view roles in their account"
    ON public.user_roles FOR SELECT
    USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Owners can manage roles"
    ON public.user_roles FOR ALL
    USING (public.has_role(auth.uid(), account_id, 'owner'));

-- WORKSPACES
CREATE POLICY "Users can view workspaces in their account"
    ON public.workspaces FOR SELECT
    USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Admins can manage workspaces"
    ON public.workspaces FOR ALL
    USING (
        public.has_role(auth.uid(), account_id, 'owner') OR 
        public.has_role(auth.uid(), account_id, 'admin')
    );

-- API_KEYS
CREATE POLICY "Users can view API keys for their workspaces"
    ON public.api_keys FOR SELECT
    USING (public.user_has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage API keys"
    ON public.api_keys FOR ALL
    USING (public.user_has_workspace_access(auth.uid(), workspace_id));

-- EVENTS_RAW (ingested by edge functions, read by users)
CREATE POLICY "Users can view raw events for their workspaces"
    ON public.events_raw FOR SELECT
    USING (public.user_has_workspace_access(auth.uid(), workspace_id));

-- USERS_UNIFIED
CREATE POLICY "Users can view unified profiles for their workspaces"
    ON public.users_unified FOR SELECT
    USING (public.user_has_workspace_access(auth.uid(), workspace_id));

-- IDENTITIES
CREATE POLICY "Users can view identities for their workspaces"
    ON public.identities FOR SELECT
    USING (public.user_has_workspace_access(auth.uid(), workspace_id));

-- EVENTS
CREATE POLICY "Users can view events for their workspaces"
    ON public.events FOR SELECT
    USING (public.user_has_workspace_access(auth.uid(), workspace_id));

-- DESTINATIONS
CREATE POLICY "Users can view destinations for their workspaces"
    ON public.destinations FOR SELECT
    USING (public.user_has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage destinations"
    ON public.destinations FOR ALL
    USING (public.user_has_workspace_access(auth.uid(), workspace_id));

-- SYNC_JOBS
CREATE POLICY "Users can view sync jobs for their workspaces"
    ON public.sync_jobs FOR SELECT
    USING (public.user_has_workspace_access(auth.uid(), workspace_id));

-- BILLING_USAGE
CREATE POLICY "Users can view billing for their account"
    ON public.billing_usage FOR SELECT
    USING (account_id = public.get_user_account_id(auth.uid()));

-- AUDIT_LOGS
CREATE POLICY "Users can view audit logs for their account"
    ON public.audit_logs FOR SELECT
    USING (account_id = public.get_user_account_id(auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_users_unified_updated_at
    BEFORE UPDATE ON public.users_unified
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_destinations_updated_at
    BEFORE UPDATE ON public.destinations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_usage_updated_at
    BEFORE UPDATE ON public.billing_usage
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE ACCOUNT + PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_account_id UUID;
BEGIN
    -- Create new account for the user
    INSERT INTO public.accounts (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
    RETURNING id INTO new_account_id;
    
    -- Create profile linked to account
    INSERT INTO public.profiles (user_id, account_id, email, full_name)
    VALUES (
        NEW.id, 
        new_account_id, 
        NEW.email,
        NEW.raw_user_meta_data->>'full_name'
    );
    
    -- Assign owner role
    INSERT INTO public.user_roles (user_id, account_id, role)
    VALUES (NEW.id, new_account_id, 'owner');
    
    -- Create default workspace
    INSERT INTO public.workspaces (account_id, name, domain)
    VALUES (new_account_id, 'My Store', NULL);
    
    RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();