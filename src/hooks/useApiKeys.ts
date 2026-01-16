import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

// Generate a random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'sf_pk_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Hash API key using Web Crypto API
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to log audit events
async function logAuditEvent(
  workspaceId: string,
  action: 'create' | 'revoke',
  resourceId: string,
  details: Record<string, unknown>
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-log`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspaceId,
          entries: [{
            action,
            resource_type: 'api_key',
            resource_id: resourceId,
            details,
          }],
        }),
      }
    );
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

export function useApiKeys() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: apiKeys, isLoading, error } = useQuery({
    queryKey: ['api-keys', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ApiKey[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const createApiKey = useMutation({
    mutationFn: async ({ name, scopes }: { name: string; scopes: string[] }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');
      
      const rawKey = generateApiKey();
      const keyHash = await hashApiKey(rawKey);
      const keyPrefix = rawKey.substring(0, 12) + '...';
      
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          workspace_id: currentWorkspace.id,
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          scopes,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // SECURITY: Only store the key prefix in localStorage (not the full key)
      // Full keys should only be shown once when created, following industry best practices
      localStorage.setItem(`sf_api_key_prefix_${currentWorkspace.id}`, keyPrefix);
      
      // Log audit event
      await logAuditEvent(currentWorkspace.id, 'create', data.id, {
        name,
        scopes,
        key_prefix: keyPrefix,
      });
      
      // Return the raw key (only shown once) along with the created record
      return { ...data, raw_key: rawKey };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', currentWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success('API key created');
    },
    onError: (error) => {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    },
  });

  const revokeApiKey = useMutation({
    mutationFn: async (keyId: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');
      
      // Get key info before revoking for audit log
      const { data: keyInfo } = await supabase
        .from('api_keys')
        .select('name, key_prefix')
        .eq('id', keyId)
        .single();
      
      const { error } = await supabase
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId);
      
      if (error) throw error;
      
      // Log audit event
      await logAuditEvent(currentWorkspace.id, 'revoke', keyId, {
        name: keyInfo?.name,
        key_prefix: keyInfo?.key_prefix,
        revoked_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', currentWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success('API key revoked');
    },
    onError: (error) => {
      console.error('Error revoking API key:', error);
      toast.error('Failed to revoke API key');
    },
  });

  return {
    apiKeys: apiKeys || [],
    isLoading,
    error,
    createApiKey,
    revokeApiKey,
  };
}
