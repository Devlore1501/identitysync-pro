import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { validateApiKey } from '../_shared/auth.ts';

interface IdentifyPayload {
  anonymous_id?: string;
  user_id?: string; // external customer ID
  email?: string;
  phone?: string;
  traits?: Record<string, unknown> & {
    ad_ids?: {
      gclid?: string;
      gbraid?: string;
      wbraid?: string;
      fbclid?: string;
      fbp?: string;
      fbc?: string;
    };
    capture_source?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
}

Deno.serve(async (req) => {
  console.log('=== IDENTIFY FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
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

    console.log('=== IDENTIFY RECEIVED ===');
    console.log('Anonymous ID:', payload.anonymous_id || 'not provided');
    console.log('Email:', payload.email || 'not provided');
    console.log('User ID:', payload.user_id || 'not provided');
    console.log('Phone:', payload.phone || 'not provided');
    console.log('Workspace:', workspaceId);

    // SECURITY: Validate traits payload size to prevent DoS attacks
    const traitsSize = JSON.stringify(payload.traits || {}).length;
    
    if (traitsSize > 10000) { // 10KB limit for traits
      console.log('ERROR: Traits payload too large:', traitsSize);
      return new Response(
        JSON.stringify({ error: 'Traits payload too large (max 10KB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate nesting depth to prevent stack overflow
    function getJsonDepth(obj: unknown, depth = 0): number {
      if (depth > 10) return depth;
      if (typeof obj !== 'object' || obj === null) return depth;
      let maxChildDepth = depth;
      for (const value of Object.values(obj)) {
        maxChildDepth = Math.max(maxChildDepth, getJsonDepth(value, depth + 1));
      }
      return maxChildDepth;
    }
    
    if (getJsonDepth(payload.traits) > 10) {
      console.log('ERROR: Traits nesting too deep');
      return new Response(
        JSON.stringify({ error: 'Traits nesting too deep (max 10 levels)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Traits size:', traitsSize);

    // Need at least one identifier
    if (!payload.email && !payload.user_id && !payload.anonymous_id && !payload.phone) {
      console.log('ERROR: No identifier provided');
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
    let isNewUser = false;
    let identityMerged = false;
    let mergeResult: Record<string, unknown> | null = null;

    // Priority: email > user_id > phone > anonymous_id
    const identifiersToCheck = [
      { type: 'email', value: payload.email },
      { type: 'customer_id', value: payload.user_id },
      { type: 'phone', value: payload.phone },
      { type: 'anonymous_id', value: payload.anonymous_id },
    ].filter(i => i.value);

    // === STEP 1: Find existing user by any identifier ===
    let foundByAnonymous = false;
    let foundByEmail = false;
    let anonymousUser: { id: string; primary_email: string | null } | null = null;
    let emailUser: { id: string } | null = null;

    // Check anonymous_id first
    if (payload.anonymous_id) {
      const { data: anonResult } = await supabase
        .from('users_unified')
        .select('id, primary_email')
        .eq('workspace_id', workspaceId)
        .contains('anonymous_ids', [payload.anonymous_id])
        .single();
      
      if (anonResult) {
        anonymousUser = anonResult;
        foundByAnonymous = true;
        if (!anonResult.primary_email) {
          console.log('Found anonymous user without email:', anonResult.id);
        }
      }
    }

    // Check email
    if (payload.email) {
      const { data: emailResult } = await supabase
        .from('users_unified')
        .select('id')
        .eq('workspace_id', workspaceId)
        .or(`primary_email.eq.${payload.email},emails.cs.{${payload.email}}`)
        .single();
      
      if (emailResult) {
        emailUser = emailResult;
        foundByEmail = true;
        console.log('Found user by email:', emailResult.id);
      }
    }

    // === STEP 2: Identity Stitching Logic ===
    if (foundByAnonymous && foundByEmail && anonymousUser && emailUser && anonymousUser.id !== emailUser.id) {
      // MERGE CASE: Anonymous user exists, email user exists, they are different
      console.log('IDENTITY STITCHING: Merging anonymous user into email user');
      console.log('Anonymous user:', anonymousUser.id);
      console.log('Email user:', emailUser.id);
      
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
        mergeResult = mergeData;
        console.log('Merge successful:', mergeData);
      }
    } else if (foundByAnonymous && !anonymousUser?.primary_email && payload.email) {
      // UPDATE CASE: Anonymous user exists without email, we have email now
      console.log('IDENTITY STITCHING: Updating anonymous user with email');
      unifiedUserId = anonymousUser!.id;
      
      await supabase
        .from('users_unified')
        .update({
          primary_email: payload.email,
          emails: [payload.email],
          customer_ids: payload.user_id ? [payload.user_id] : [],
          phone: payload.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', unifiedUserId);
      
      identityMerged = true;
      console.log('Anonymous user updated with email');
    } else if (foundByEmail && emailUser) {
      // EXISTING EMAIL USER: Just update with new identifiers
      unifiedUserId = emailUser.id;
    } else if (foundByAnonymous && anonymousUser) {
      // EXISTING ANONYMOUS USER: Just update with new identifiers  
      unifiedUserId = anonymousUser.id;
    }

    // === Extract ad_ids and capture_source from traits ===
    const adIds = (payload.traits?.ad_ids || {}) as Record<string, string>;
    const captureSource = (payload.traits?.capture_source || 'identify_api') as string;
    
    // Clean traits (remove ad_ids which go in separate column)
    const cleanTraits = { ...payload.traits };
    if (cleanTraits) {
      delete cleanTraits.ad_ids;
      delete cleanTraits.capture_source;
    }
    
    console.log('Capture source:', captureSource);
    console.log('Ad IDs:', JSON.stringify(adIds));

    // === STEP 3: Create new user if not found ===
    if (!unifiedUserId) {
      isNewUser = true;
      console.log('Creating new unified user');
      
      const { data: newUser, error: createError } = await supabase
        .from('users_unified')
        .insert({
          workspace_id: workspaceId,
          primary_email: payload.email || null,
          emails: payload.email ? [payload.email] : [],
          phone: payload.phone || null,
          customer_ids: payload.user_id ? [payload.user_id] : [],
          anonymous_ids: payload.anonymous_id ? [payload.anonymous_id] : [],
          traits: cleanTraits || {},
          ad_ids: adIds,
          computed: {
            intent_score: 0,
            frequency_score: 10,
            depth_score: 0,
            drop_off_stage: 'browsing',
            identified_via: captureSource
          }
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
      console.log('Created new user:', unifiedUserId);
    } else if (!isNewUser && !identityMerged) {
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
        if (cleanTraits) {
          updates.traits = { ...(existingUser.traits as Record<string, unknown>), ...cleanTraits };
        }

        // Update phone
        if (payload.phone && !existingUser.phone) {
          updates.phone = payload.phone;
        }
        
        // Merge ad_ids
        if (Object.keys(adIds).some(k => adIds[k])) {
          updates.ad_ids = { ...(existingUser.ad_ids as Record<string, string> || {}), ...adIds };
        }

        await supabase
          .from('users_unified')
          .update(updates)
          .eq('id', unifiedUserId);
      }
    }

    // Create identity records for all provided identifiers with capture_source
    const identityInserts = identifiersToCheck.map(({ type, value }) => ({
      workspace_id: workspaceId,
      unified_user_id: unifiedUserId,
      identity_type: type,
      identity_value: value,
      source: 'api',
      capture_source: captureSource,
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

    // ========================================
    // 🔗 RETROACTIVE IDENTITY LINKING
    // Link past anonymous events to this user
    // ========================================
    
    let eventsLinked = 0;
    let syncJobsCreated = 0;
    
    if (payload.anonymous_id && unifiedUserId) {
      // Find ALL events with this anonymous_id that don't have a unified_user_id yet
      // OR have a different unified_user_id (orphan events)
      const { data: orphanEvents, error: orphanError } = await supabase
        .from('events')
        .select('id, event_name, unified_user_id')
        .eq('workspace_id', workspaceId)
        .eq('anonymous_id', payload.anonymous_id)
        .or(`unified_user_id.is.null,unified_user_id.neq.${unifiedUserId}`);

      if (!orphanError && orphanEvents && orphanEvents.length > 0) {
        console.log(`Found ${orphanEvents.length} orphan events to link for anonymous_id ${payload.anonymous_id}`);
        
        // Update all orphan events to point to the unified user
        const eventIds = orphanEvents.map(e => e.id);
        const { error: updateError } = await supabase
          .from('events')
          .update({ unified_user_id: unifiedUserId })
          .in('id', eventIds);
        
        if (updateError) {
          console.error('Error linking orphan events:', updateError);
        } else {
          eventsLinked = orphanEvents.length;
          console.log(`Successfully linked ${eventsLinked} events to user ${unifiedUserId}`);
        }
      }
    }

    // ========================================
    // 📤 SCHEDULE SYNC JOBS FOR RE-SYNC
    // Now that user has email, sync everything
    // ========================================
    
    if (payload.email && unifiedUserId) {
      // Get all enabled destinations for this workspace
      const { data: destinations } = await supabase
        .from('destinations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('enabled', true);

      if (destinations && destinations.length > 0) {
        const now = new Date().toISOString();
        
        for (const dest of destinations) {
          // 1. Create profile upsert job (priority: sync user profile with email)
          await supabase
            .from('sync_jobs')
            .insert({
              workspace_id: workspaceId,
              destination_id: dest.id,
              unified_user_id: unifiedUserId,
              job_type: 'profile_upsert',
              status: 'pending',
              scheduled_at: now,
              payload: { trigger: 'identify', has_email: true }
            });
          syncJobsCreated++;

          // 2. Get ALL events for this user that haven't been synced to this destination
          // (includes events from before they had email)
          const { data: unsyncedEvents } = await supabase
            .from('events')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('unified_user_id', unifiedUserId)
            .order('event_time', { ascending: true })
            .limit(100); // Limit to prevent overwhelming sync

          if (unsyncedEvents && unsyncedEvents.length > 0) {
            // Check which events already have sync jobs for this destination
            const { data: existingJobs } = await supabase
              .from('sync_jobs')
              .select('event_id')
              .eq('destination_id', dest.id)
              .in('event_id', unsyncedEvents.map(e => e.id))
              .eq('status', 'completed');

            const existingEventIds = new Set((existingJobs || []).map(j => j.event_id));
            const eventsToSync = unsyncedEvents.filter(e => !existingEventIds.has(e.id));

            if (eventsToSync.length > 0) {
              // Create sync jobs for events that haven't been successfully synced
              const eventSyncJobs = eventsToSync.map(event => ({
                workspace_id: workspaceId,
                destination_id: dest.id,
                unified_user_id: unifiedUserId,
                event_id: event.id,
                job_type: 'event_track',
                status: 'pending',
                scheduled_at: now,
                payload: { trigger: 'identify_retroactive' }
              }));

              const { error: insertError } = await supabase
                .from('sync_jobs')
                .insert(eventSyncJobs);

              if (!insertError) {
                syncJobsCreated += eventsToSync.length;
                console.log(`Created ${eventsToSync.length} event sync jobs for destination ${dest.id}`);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        unified_user_id: unifiedUserId,
        is_new_user: isNewUser,
        identity_merged: identityMerged,
        merge_result: mergeResult,
        events_linked: eventsLinked,
        sync_jobs_created: syncJobsCreated,
        message: identityMerged 
          ? `Identity stitched successfully. Anonymous user merged with identified profile.`
          : eventsLinked > 0 
            ? `Identity linked successfully. ${eventsLinked} past events linked to this user.`
            : 'Identity linked successfully'
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
