import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Hash API key using SHA-256
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate API key and return workspace info
export async function validateApiKey(apiKey: string): Promise<{
  valid: boolean;
  workspaceId?: string;
  scopes?: string[];
  error?: string;
}> {
  if (!apiKey || !apiKey.startsWith('sf_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const keyHash = await hashApiKey(apiKey);
  
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, workspace_id, scopes, expires_at, revoked_at')
    .eq('key_hash', keyHash)
    .single();
  
  if (error || !data) {
    return { valid: false, error: 'API key not found' };
  }
  
  if (data.revoked_at) {
    return { valid: false, error: 'API key has been revoked' };
  }
  
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }
  
  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);
  
  return { 
    valid: true, 
    workspaceId: data.workspace_id,
    scopes: data.scopes 
  };
}

// Verify HMAC signature for server-to-server calls
export async function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return signature === expectedSignature;
}
