import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
    const { profileId, workspaceId } = await req.json();
    
    if (!profileId || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'profileId and workspaceId are required' }),
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

    // Get workspace to check account_id for role verification
    const { data: workspaceForRole } = await supabase
      .from('workspaces')
      .select('account_id')
      .eq('id', workspaceId)
      .single();

    if (!workspaceForRole?.account_id) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check for admin or owner role - GDPR deletion requires elevated permissions
    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: userId,
      _account_id: workspaceForRole.account_id,
      _role: 'admin'
    });

    const { data: hasOwnerRole } = await supabase.rpc('has_role', {
      _user_id: userId,
      _account_id: workspaceForRole.account_id,
      _role: 'owner'
    });

    if (!hasAdminRole && !hasOwnerRole) {
      return new Response(
        JSON.stringify({ error: 'GDPR deletion requires admin or owner role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get profile details before deletion for audit log
    const { data: profile } = await supabase
      .from('users_unified')
      .select('primary_email, id')
      .eq('id', profileId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get account_id for audit log
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('account_id')
      .eq('id', workspaceId)
      .single();

    // Start deletion process
    // 1. Delete identities linked to this profile
    const { error: identitiesError } = await supabase
      .from('identities')
      .delete()
      .eq('unified_user_id', profileId)
      .eq('workspace_id', workspaceId);

    if (identitiesError) {
      console.error('Error deleting identities:', identitiesError);
      throw identitiesError;
    }

    // 2. Anonymize events (remove user link but keep for analytics)
    const { error: eventsError } = await supabase
      .from('events')
      .update({ unified_user_id: null, anonymous_id: null })
      .eq('unified_user_id', profileId)
      .eq('workspace_id', workspaceId);

    if (eventsError) {
      console.error('Error anonymizing events:', eventsError);
      throw eventsError;
    }

    // 3. Delete sync jobs for this user
    const { error: syncJobsError } = await supabase
      .from('sync_jobs')
      .delete()
      .eq('unified_user_id', profileId)
      .eq('workspace_id', workspaceId);

    if (syncJobsError) {
      console.error('Error deleting sync jobs:', syncJobsError);
      // Non-fatal, continue
    }

    // 4. Delete unified user profile
    const { error: userError } = await supabase
      .from('users_unified')
      .delete()
      .eq('id', profileId)
      .eq('workspace_id', workspaceId);

    if (userError) {
      console.error('Error deleting profile:', userError);
      throw userError;
    }

    // 5. Create audit log entry
    if (workspace?.account_id) {
      await supabase
        .from('audit_logs')
        .insert({
          account_id: workspace.account_id,
          workspace_id: workspaceId,
          user_id: userId,
          action: 'delete',
          resource_type: 'identity',
          resource_id: profileId,
          details: {
            email: profile.primary_email || 'anonymous',
            reason: 'GDPR deletion request',
            deleted_at: new Date().toISOString()
          }
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Profile deleted successfully (GDPR compliance)',
        deletedProfileId: profileId 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('GDPR delete error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete profile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
