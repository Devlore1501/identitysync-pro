import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { validateApiKey } from '../_shared/auth.ts';

/**
 * Server-Side Tracking Endpoint
 * 
 * Receives events directly from server (Shopify ScriptTag, webhooks, etc.)
 * Bypasses browser completely - immune to AdBlock and cookie blockers
 * 
 * Features:
 * - Server-side fingerprinting (IP + UA hash)
 * - Identity stitching when email provided
 * - Retroactive event attribution
 */

interface ServerTrackPayload {
  // Event data
  event_type: string;
  event_name: string;
  properties?: Record<string, unknown>;
  
  // Identity data
  anonymous_id?: string;
  email?: string;
  customer_id?: string;
  phone?: string;
  
  // Server fingerprint
  client_ip?: string;
  user_agent?: string;
  
  // Metadata
  source?: string;
  timestamp?: string;
}

function generateFingerprint(ip: string, userAgent: string): string {
  // Create a simple fingerprint from IP and UA
  const data = `${ip}|${userAgent}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

Deno.serve(async (req) => {
  console.log('=== SERVER-TRACK FUNCTION CALLED ===');
  
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

    const payload: ServerTrackPayload = await req.json();
    const workspaceId = authResult.workspaceId!;

    // Get server-side fingerprint data
    const clientIp = payload.client_ip || 
                     req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';
    const userAgent = payload.user_agent || 
                      req.headers.get('user-agent') || 
                      'unknown';

    console.log('=== SERVER-TRACK RECEIVED ===');
    console.log('Event:', payload.event_type, '-', payload.event_name);
    console.log('Anonymous ID:', payload.anonymous_id || 'not provided');
    console.log('Email:', payload.email || 'not provided');
    console.log('Customer ID:', payload.customer_id || 'not provided');
    console.log('Client IP:', clientIp);
    console.log('Workspace:', workspaceId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate server-side fingerprint if no anonymous_id provided
    let effectiveAnonymousId = payload.anonymous_id;
    if (!effectiveAnonymousId && clientIp !== 'unknown') {
      effectiveAnonymousId = generateFingerprint(clientIp, userAgent);
      console.log('Generated fingerprint:', effectiveAnonymousId);
    }

    // === IDENTITY RESOLUTION ===
    let unifiedUserId: string | null = null;
    let isNewUser = false;
    let identityMerged = false;

    // Priority: email > customer_id > anonymous_id/fingerprint
    const identifiersToCheck = [
      { type: 'email', value: payload.email },
      { type: 'customer_id', value: payload.customer_id },
      { type: 'anonymous_id', value: effectiveAnonymousId },
    ].filter(i => i.value);

    // Try to find existing user
    for (const identifier of identifiersToCheck) {
      let query = supabase
        .from('users_unified')
        .select('id')
        .eq('workspace_id', workspaceId);

      if (identifier.type === 'email') {
        query = query.or(`primary_email.eq.${identifier.value},emails.cs.{${identifier.value}}`);
      } else if (identifier.type === 'customer_id') {
        query = query.contains('customer_ids', [identifier.value]);
      } else if (identifier.type === 'anonymous_id') {
        query = query.contains('anonymous_ids', [identifier.value]);
      }

      const { data: existingUser } = await query.single();

      if (existingUser) {
        unifiedUserId = existingUser.id;
        break;
      }
    }

    // If found by anonymous_id but we have email, check if we need to merge
    if (unifiedUserId && payload.email && effectiveAnonymousId) {
      // Check if we found user by anonymous_id but they don't have email yet
      const { data: currentUser } = await supabase
        .from('users_unified')
        .select('id, primary_email, anonymous_ids')
        .eq('id', unifiedUserId)
        .single();

      if (currentUser && !currentUser.primary_email) {
        // This is an anonymous user being identified!
        console.log('IDENTITY STITCHING: Anonymous user identified with email');
        
        // Check if there's another user with this email
        const { data: emailUser } = await supabase
          .from('users_unified')
          .select('id')
          .eq('workspace_id', workspaceId)
          .or(`primary_email.eq.${payload.email},emails.cs.{${payload.email}}`)
          .neq('id', unifiedUserId)
          .single();

        if (emailUser) {
          // Merge anonymous into identified
          console.log('Merging anonymous user into existing email user');
          const { data: mergeResult } = await supabase.rpc('merge_anonymous_to_identified', {
            p_workspace_id: workspaceId,
            p_anonymous_id: effectiveAnonymousId,
            p_identified_user_id: emailUser.id
          });
          
          if (mergeResult?.merged) {
            unifiedUserId = emailUser.id;
            identityMerged = true;
            console.log('Merge successful:', mergeResult);
          }
        } else {
          // Update anonymous user with email
          await supabase
            .from('users_unified')
            .update({
              primary_email: payload.email,
              emails: [payload.email],
              customer_ids: payload.customer_id ? [payload.customer_id] : [],
              phone: payload.phone || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', unifiedUserId);
          
          identityMerged = true;
          console.log('Anonymous user updated with email');
        }
      }
    }

    // Create new user if not found
    if (!unifiedUserId) {
      isNewUser = true;
      const { data: newUser, error: createError } = await supabase
        .from('users_unified')
        .insert({
          workspace_id: workspaceId,
          primary_email: payload.email || null,
          emails: payload.email ? [payload.email] : [],
          phone: payload.phone || null,
          customer_ids: payload.customer_id ? [payload.customer_id] : [],
          anonymous_ids: effectiveAnonymousId ? [effectiveAnonymousId] : [],
          traits: {},
          computed: {
            intent_score: 0,
            frequency_score: 10,
            depth_score: 0,
            drop_off_stage: 'browsing',
            source: payload.source || 'server-track'
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
    }

    // === CREATE EVENT ===
    const eventTime = payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString();
    
    // Generate dedupe key
    const dedupeKey = `${workspaceId}_${payload.event_name}_${effectiveAnonymousId || ''}_${payload.properties?.product_id || ''}_${eventTime.slice(0, 16)}`;
    const dedupeHash = btoa(dedupeKey).slice(0, 32);

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        workspace_id: workspaceId,
        unified_user_id: unifiedUserId,
        event_type: payload.event_type,
        event_name: payload.event_name,
        properties: payload.properties || {},
        context: {
          ip: clientIp,
          user_agent: userAgent,
          server_side: true,
          source: payload.source || 'server-track'
        },
        anonymous_id: effectiveAnonymousId,
        source: payload.source || 'server-track',
        event_time: eventTime,
        dedupe_key: dedupeHash,
        status: 'pending'
      })
      .select('id')
      .single();

    if (eventError) {
      // Check if duplicate
      if (eventError.code === '23505') {
        console.log('Duplicate event, skipping');
        return new Response(
          JSON.stringify({ 
            success: true, 
            duplicate: true,
            unified_user_id: unifiedUserId
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Error creating event:', eventError);
      return new Response(
        JSON.stringify({ error: 'Failed to create event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created event:', event.id);

    // === UPDATE COMPUTED TRAITS ===
    await supabase.rpc('update_computed_traits_fast', {
      p_unified_user_id: unifiedUserId,
      p_event_type: payload.event_type,
      p_event_name: payload.event_name,
      p_properties: payload.properties || {}
    });

    // === SCHEDULE SYNC JOBS ===
    let syncJobsCreated = 0;
    
    // Only schedule syncs if user has email
    if (payload.email || identityMerged) {
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
              event_id: event.id,
              job_type: 'event_track',
              status: 'pending',
              scheduled_at: now,
              payload: { trigger: 'server-track', server_side: true }
            });
          syncJobsCreated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event.id,
        unified_user_id: unifiedUserId,
        is_new_user: isNewUser,
        identity_merged: identityMerged,
        fingerprint_used: !payload.anonymous_id && effectiveAnonymousId?.startsWith('fp_'),
        sync_jobs_created: syncJobsCreated
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Server-track error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
