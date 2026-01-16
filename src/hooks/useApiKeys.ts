import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

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
      
      // Return the raw key (only shown once) along with the created record
      return { ...data, raw_key: rawKey };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', currentWorkspace?.id] });
    },
  });

  const revokeApiKey = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', currentWorkspace?.id] });
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
