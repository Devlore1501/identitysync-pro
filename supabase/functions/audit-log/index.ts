import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface AuditLogEntry {
  action: 'create' | 'update' | 'delete' | 'revoke';
  resource_type: 'api_key' | 'destination' | 'workspace' | 'identity' | 'settings';
  resource_id?: string;
  details?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // User client for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claims.claims.sub;

    // Parse request
    const { workspaceId, entries }: { workspaceId: string; entries: AuditLogEntry[] } = await req.json();
    
    if (!workspaceId || !entries || !Array.isArray(entries)) {
      return new Response(
        JSON.stringify({ error: 'workspaceId and entries array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service client for privileged operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has access to this workspace
    const { data: hasAccess } = await supabase.rpc('user_has_workspace_access', {
      _user_id: userId,
      _workspace_id: workspaceId
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace account_id first for role check
    const { data: workspaceData } = await supabase
      .from('workspaces')
      .select('account_id')
      .eq('id', workspaceId)
      .single();

    if (!workspaceData?.account_id) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check for admin or owner role - audit log creation requires elevated permissions
    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: userId,
      _account_id: workspaceData.account_id,
      _role: 'admin'
    });

    const { data: hasOwnerRole } = await supabase.rpc('has_role', {
      _user_id: userId,
      _account_id: workspaceData.account_id,
      _role: 'owner'
    });

    if (!hasAdminRole && !hasOwnerRole) {
      return new Response(
        JSON.stringify({ error: 'Audit log creation requires admin or owner role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use workspaceData.account_id (already fetched above for role check)

    // Get client IP from headers
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('cf-connecting-ip') || 
                      null;

    // Insert audit log entries
    const logsToInsert = entries.map(entry => ({
      account_id: workspaceData.account_id,
      workspace_id: workspaceId,
      user_id: userId,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id || null,
      details: entry.details || {},
      ip_address: ipAddress
    }));

    const { error: insertError } = await supabase
      .from('audit_logs')
      .insert(logsToInsert);

    if (insertError) {
      console.error('Error inserting audit logs:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, logged: entries.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Audit log error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create audit log' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
