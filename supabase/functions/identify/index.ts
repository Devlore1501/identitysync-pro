import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { validateApiKey } from '../_shared/auth.ts';

interface IdentifyPayload {
  anonymous_id?: string;
  user_id?: string; // external customer ID
  email?: string;
  phone?: string;
  traits?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authResult = await validateApiKey(apiKey);
    
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authResult.scopes?.includes('identify')) {
      return new Response(
        JSON.stringify({ error: 'API key does not have identify scope' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: IdentifyPayload = await req.json();
    const workspaceId = authResult.workspaceId!;

    // Need at least one identifier
    if (!payload.email && !payload.user_id && !payload.anonymous_id && !payload.phone) {
      return new Response(
        JSON.stringify({ error: 'At least one identifier is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find or create unified user
    let unifiedUserId: string | null = null;

    // Priority: email > user_id > phone > anonymous_id
    const identifiersToCheck = [
      { type: 'email', value: payload.email },
      { type: 'customer_id', value: payload.user_id },
      { type: 'phone', value: payload.phone },
      { type: 'anonymous_id', value: payload.anonymous_id },
    ].filter(i => i.value);

    // Try to find existing identity
    for (const identifier of identifiersToCheck) {
      const { data: existingIdentity } = await supabase
        .from('identities')
        .select('unified_user_id')
        .eq('workspace_id', workspaceId)
        .eq('identity_type', identifier.type)
        .eq('identity_value', identifier.value)
        .single();

      if (existingIdentity) {
        unifiedUserId = existingIdentity.unified_user_id;
        break;
      }
    }

    // Create new unified user if not found
    if (!unifiedUserId) {
      const { data: newUser, error: createError } = await supabase
        .from('users_unified')
        .insert({
          workspace_id: workspaceId,
          primary_email: payload.email || null,
          emails: payload.email ? [payload.email] : [],
          phone: payload.phone || null,
          customer_ids: payload.user_id ? [payload.user_id] : [],
          anonymous_ids: payload.anonymous_id ? [payload.anonymous_id] : [],
          traits: payload.traits || {},
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating unified user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      unifiedUserId = newUser.id;
    } else {
      // Update existing user with new identifiers and traits
      const { data: existingUser } = await supabase
        .from('users_unified')
        .select('*')
        .eq('id', unifiedUserId)
        .single();

      if (existingUser) {
        const updates: Record<string, unknown> = {
          last_seen_at: new Date().toISOString(),
        };

        // Merge emails
        if (payload.email && !existingUser.emails?.includes(payload.email)) {
          updates.emails = [...(existingUser.emails || []), payload.email];
          if (!existingUser.primary_email) {
            updates.primary_email = payload.email;
          }
        }

        // Merge customer_ids
        if (payload.user_id && !existingUser.customer_ids?.includes(payload.user_id)) {
          updates.customer_ids = [...(existingUser.customer_ids || []), payload.user_id];
        }

        // Merge anonymous_ids
        if (payload.anonymous_id && !existingUser.anonymous_ids?.includes(payload.anonymous_id)) {
          updates.anonymous_ids = [...(existingUser.anonymous_ids || []), payload.anonymous_id];
        }

        // Merge traits
        if (payload.traits) {
          updates.traits = { ...existingUser.traits, ...payload.traits };
        }

        // Update phone
        if (payload.phone && !existingUser.phone) {
          updates.phone = payload.phone;
        }

        await supabase
          .from('users_unified')
          .update(updates)
          .eq('id', unifiedUserId);
      }
    }

    // Create identity records for all provided identifiers
    const identityInserts = identifiersToCheck.map(({ type, value }) => ({
      workspace_id: workspaceId,
      unified_user_id: unifiedUserId,
      identity_type: type,
      identity_value: value,
      source: 'api',
    }));

    // Upsert identities (ignore conflicts)
    for (const identity of identityInserts) {
      await supabase
        .from('identities')
        .upsert(identity, { 
          onConflict: 'workspace_id,identity_type,identity_value',
          ignoreDuplicates: true 
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        unified_user_id: unifiedUserId,
        message: 'Identity linked successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Identify error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
