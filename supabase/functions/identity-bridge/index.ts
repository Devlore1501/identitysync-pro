import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Identity Bridge - Public Endpoint (no API key required)
 * 
 * This endpoint is specifically designed for the Identity Bridge script
 * that runs on checkout/thank-you pages. Since navigator.sendBeacon() 
 * cannot send custom headers, this endpoint:
 * 
 * 1. Does NOT require x-api-key header
 * 2. Validates via workspace_id in payload
 * 3. Optionally validates Origin/Referer against workspace domain
 * 4. Performs identity stitching logic
 */

interface IdentityBridgePayload {
  workspace_id: string;
  anonymous_id: string;
  email?: string;
  customer_id?: string;
  phone?: string;
}

Deno.serve(async (req) => {
  console.log('=== IDENTITY BRIDGE CALLED ===');
  console.log('Method:', req.method);
  
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
    const payload: IdentityBridgePayload = await req.json();
    
    console.log('Payload received:', {
      workspace_id: payload.workspace_id,
      anonymous_id: payload.anonymous_id,
      email: payload.email ? '***@***' : 'not provided',
      customer_id: payload.customer_id || 'not provided'
    });

    // Validate required fields
    if (!payload.workspace_id) {
      console.log('ERROR: Missing workspace_id');
      return new Response(
        JSON.stringify({ error: 'workspace_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.anonymous_id) {
      console.log('ERROR: Missing anonymous_id');
      return new Response(
        JSON.stringify({ error: 'anonymous_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.email && !payload.customer_id) {
      console.log('ERROR: Missing email or customer_id');
      return new Response(
        JSON.stringify({ error: 'email or customer_id is required for identity stitching' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate workspace exists
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id, domain')
      .eq('id', payload.workspace_id)
      .single();

    if (wsError || !workspace) {
      console.log('ERROR: Invalid workspace_id:', payload.workspace_id);
      return new Response(
        JSON.stringify({ error: 'Invalid workspace' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional: Validate origin matches workspace domain
    const origin = req.headers.get('origin') || req.headers.get('referer');
    if (workspace.domain && origin) {
      try {
        const originUrl = new URL(origin);
        const expectedDomain = workspace.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const actualDomain = originUrl.hostname;
        
        // Allow if domains match (including subdomains like www)
        const domainMatches = actualDomain === expectedDomain || 
          actualDomain.endsWith('.' + expectedDomain) ||
          expectedDomain.endsWith('.' + actualDomain);
          
        if (!domainMatches) {
          console.log(`Domain mismatch: expected ${expectedDomain}, got ${actualDomain}`);
          // Log but don't block - domain validation is informational
        }
      } catch (e) {
        console.log('Could not parse origin:', origin);
      }
    }

    const workspaceId = payload.workspace_id;
    let unifiedUserId: string | null = null;
    let identityMerged = false;
    let eventsLinked = 0;

    // === STEP 1: Find existing users ===
    let anonymousUser: { id: string; primary_email: string | null } | null = null;
    let emailUser: { id: string } | null = null;

    // Check anonymous_id
    const { data: anonResult } = await supabase
      .from('users_unified')
      .select('id, primary_email')
      .eq('workspace_id', workspaceId)
      .contains('anonymous_ids', [payload.anonymous_id])
      .single();
    
    if (anonResult) {
      anonymousUser = anonResult;
      console.log('Found anonymous user:', anonResult.id, 'has email:', !!anonResult.primary_email);
    }

    // Check email if provided
    if (payload.email) {
      const { data: emailResult } = await supabase
        .from('users_unified')
        .select('id')
        .eq('workspace_id', workspaceId)
        .or(`primary_email.eq.${payload.email},emails.cs.{${payload.email}}`)
        .single();
      
      if (emailResult) {
        emailUser = emailResult;
        console.log('Found email user:', emailResult.id);
      }
    }

    // === STEP 2: Identity Stitching Logic ===
    if (anonymousUser && emailUser && anonymousUser.id !== emailUser.id) {
      // MERGE: Anonymous user and email user are different - merge them
      console.log('MERGE CASE: Merging anonymous into email user');
      
      const { data: mergeData, error: mergeError } = await supabase.rpc('merge_anonymous_to_identified', {
        p_workspace_id: workspaceId,
        p_anonymous_id: payload.anonymous_id,
        p_identified_user_id: emailUser.id
      });
      
      if (mergeError) {
        console.error('Merge error:', mergeError);
      } else if (mergeData?.merged) {
        unifiedUserId = emailUser.id;
        identityMerged = true;
        console.log('Merge successful');
      }
    } else if (anonymousUser && !anonymousUser.primary_email && payload.email) {
      // UPDATE: Anonymous user exists without email - add email to it
      console.log('UPDATE CASE: Adding email to anonymous user');
      unifiedUserId = anonymousUser.id;
      
      const updates: Record<string, unknown> = {
        primary_email: payload.email,
        emails: [payload.email],
        updated_at: new Date().toISOString()
      };
      
      if (payload.customer_id) {
        updates.customer_ids = [payload.customer_id];
      }
      if (payload.phone) {
        updates.phone = payload.phone;
      }
      
      await supabase
        .from('users_unified')
        .update(updates)
        .eq('id', unifiedUserId);
      
      identityMerged = true;
      console.log('Anonymous user updated with email');
    } else if (emailUser) {
      // EXISTING: Email user exists - add anonymous_id to it
      unifiedUserId = emailUser.id;
      
      const { data: existingUser } = await supabase
        .from('users_unified')
        .select('anonymous_ids, customer_ids')
        .eq('id', unifiedUserId)
        .single();
        
      if (existingUser) {
        const updates: Record<string, unknown> = {
          last_seen_at: new Date().toISOString()
        };
        
        if (!existingUser.anonymous_ids?.includes(payload.anonymous_id)) {
          updates.anonymous_ids = [...(existingUser.anonymous_ids || []), payload.anonymous_id];
          identityMerged = true;
        }
        
        if (payload.customer_id && !existingUser.customer_ids?.includes(payload.customer_id)) {
          updates.customer_ids = [...(existingUser.customer_ids || []), payload.customer_id];
        }
        
        await supabase
          .from('users_unified')
          .update(updates)
          .eq('id', unifiedUserId);
      }
    } else if (anonymousUser) {
      // Only anonymous user exists - update with any new info
      unifiedUserId = anonymousUser.id;
    } else {
      // No user found - create new one
      console.log('CREATE CASE: Creating new user');
      
      const { data: newUser, error: createError } = await supabase
        .from('users_unified')
        .insert({
          workspace_id: workspaceId,
          primary_email: payload.email || null,
          emails: payload.email ? [payload.email] : [],
          phone: payload.phone || null,
          customer_ids: payload.customer_id ? [payload.customer_id] : [],
          anonymous_ids: [payload.anonymous_id],
          computed: {
            intent_score: 0,
            frequency_score: 10,
            depth_score: 0,
            drop_off_stage: 'checkout',
            identified_via: 'identity_bridge'
          }
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      unifiedUserId = newUser.id;
      identityMerged = true;
      console.log('Created new user:', unifiedUserId);
    }

    // === STEP 3: Link orphan events ===
    if (unifiedUserId && payload.anonymous_id) {
      const { data: orphanEvents, error: orphanError } = await supabase
        .from('events')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('anonymous_id', payload.anonymous_id)
        .or(`unified_user_id.is.null,unified_user_id.neq.${unifiedUserId}`);

      if (!orphanError && orphanEvents && orphanEvents.length > 0) {
        console.log(`Linking ${orphanEvents.length} orphan events`);
        
        const eventIds = orphanEvents.map(e => e.id);
        const { error: updateError } = await supabase
          .from('events')
          .update({ unified_user_id: unifiedUserId })
          .in('id', eventIds);
        
        if (!updateError) {
          eventsLinked = orphanEvents.length;
        }
      }
    }

    // === STEP 4: Create sync jobs if user now has email ===
    let syncJobsCreated = 0;
    
    if (payload.email && unifiedUserId) {
      const { data: destinations } = await supabase
        .from('destinations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('enabled', true);

      if (destinations && destinations.length > 0) {
        const now = new Date().toISOString();
        
        for (const dest of destinations) {
          // Profile upsert job
          await supabase
            .from('sync_jobs')
            .insert({
              workspace_id: workspaceId,
              destination_id: dest.id,
              unified_user_id: unifiedUserId,
              job_type: 'profile_upsert',
              status: 'pending',
              scheduled_at: now,
              payload: { trigger: 'identity_bridge', has_email: true }
            });
          syncJobsCreated++;
        }
      }
    }

    // Create identity records
    const identityInserts = [];
    if (payload.anonymous_id) {
      identityInserts.push({
        workspace_id: workspaceId,
        unified_user_id: unifiedUserId,
        identity_type: 'anonymous_id',
        identity_value: payload.anonymous_id,
        source: 'identity_bridge'
      });
    }
    if (payload.email) {
      identityInserts.push({
        workspace_id: workspaceId,
        unified_user_id: unifiedUserId,
        identity_type: 'email',
        identity_value: payload.email,
        source: 'identity_bridge'
      });
    }
    if (payload.customer_id) {
      identityInserts.push({
        workspace_id: workspaceId,
        unified_user_id: unifiedUserId,
        identity_type: 'customer_id',
        identity_value: payload.customer_id,
        source: 'identity_bridge'
      });
    }

    for (const identity of identityInserts) {
      await supabase
        .from('identities')
        .upsert(identity, { 
          onConflict: 'workspace_id,identity_type,identity_value',
          ignoreDuplicates: true 
        });
    }

    console.log('=== IDENTITY BRIDGE SUCCESS ===');
    console.log('Unified User ID:', unifiedUserId);
    console.log('Identity Merged:', identityMerged);
    console.log('Events Linked:', eventsLinked);
    console.log('Sync Jobs Created:', syncJobsCreated);

    return new Response(
      JSON.stringify({ 
        success: true,
        unified_user_id: unifiedUserId,
        identity_merged: identityMerged,
        events_linked: eventsLinked,
        sync_jobs_created: syncJobsCreated
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Identity Bridge error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
