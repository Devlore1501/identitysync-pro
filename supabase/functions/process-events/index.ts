import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Generate dedupe key from event properties
function generateDedupeKey(workspaceId: string, event: Record<string, unknown>): string {
  const context = event.context as Record<string, unknown> | undefined;
  const properties = event.properties as Record<string, unknown> | undefined;
  const parts = [
    workspaceId,
    event.event || '',
    context?.anonymous_id || '',
    properties?.product_id || '',
    event.timestamp || '',
  ];
  return parts.join('::');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get unprocessed raw events (limit to 100 per run)
    const { data: rawEvents, error: fetchError } = await supabase
      .from('events_raw')
      .select('*')
      .is('processed_at', null)
      .order('received_at', { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error('Error fetching raw events:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch raw events' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rawEvents || rawEvents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No events to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const rawEvent of rawEvents) {
      try {
        const payload = rawEvent.payload as Record<string, unknown>;
        const context = payload.context as Record<string, unknown> || {};
        const anonymousId = context.anonymous_id as string || null;
        const sessionId = context.session_id as string || null;

        // Find or resolve unified user
        let unifiedUserId: string | null = null;

        if (anonymousId) {
          // Try to find existing identity
          const { data: existingIdentity } = await supabase
            .from('identities')
            .select('unified_user_id')
            .eq('workspace_id', rawEvent.workspace_id)
            .eq('identity_type', 'anonymous_id')
            .eq('identity_value', anonymousId)
            .single();

          if (existingIdentity) {
            unifiedUserId = existingIdentity.unified_user_id;
            
            // Update last_seen_at
            await supabase
              .from('users_unified')
              .update({ last_seen_at: new Date().toISOString() })
              .eq('id', unifiedUserId);
          } else {
            // Create new unified user
            const { data: newUser } = await supabase
              .from('users_unified')
              .insert({
                workspace_id: rawEvent.workspace_id,
                anonymous_ids: [anonymousId],
              })
              .select('id')
              .single();

            if (newUser) {
              unifiedUserId = newUser.id;
              
              // Create identity record
              await supabase
                .from('identities')
                .insert({
                  workspace_id: rawEvent.workspace_id,
                  unified_user_id: unifiedUserId,
                  identity_type: 'anonymous_id',
                  identity_value: anonymousId,
                  source: rawEvent.source,
                });
            }
          }
        }

        // Map common event types
        const eventName = payload.event as string;
        const eventTypeMap: Record<string, string> = {
          'Page View': 'page_view',
          'page_view': 'page_view',
          'View Item': 'view_item',
          'view_item': 'view_item',
          'Add to Cart': 'add_to_cart',
          'add_to_cart': 'add_to_cart',
          'Begin Checkout': 'begin_checkout',
          'begin_checkout': 'begin_checkout',
          'Purchase': 'purchase',
          'purchase': 'purchase',
        };
        const eventType = eventTypeMap[eventName] || 'custom';

        // Generate dedupe key
        const dedupeKey = generateDedupeKey(rawEvent.workspace_id, payload);

        // Check for duplicate
        const { data: existingEvent } = await supabase
          .from('events')
          .select('id')
          .eq('workspace_id', rawEvent.workspace_id)
          .eq('dedupe_key', dedupeKey)
          .single();

        if (!existingEvent) {
          // Insert processed event
          const { data: insertedEvent, error: insertError } = await supabase
            .from('events')
            .insert({
              workspace_id: rawEvent.workspace_id,
              unified_user_id: unifiedUserId,
              event_type: eventType,
              event_name: eventName,
              properties: payload.properties || {},
              context: {
                ...context,
                ip_address: rawEvent.ip_address,
                user_agent: rawEvent.user_agent,
              },
              anonymous_id: anonymousId,
              session_id: sessionId,
              source: rawEvent.source,
              status: 'processed',
              dedupe_key: dedupeKey,
              consent_state: payload.consent || null,
              event_time: payload.timestamp as string || rawEvent.received_at,
              processed_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (insertError) {
            console.error('Error inserting event:', insertError);
            throw insertError;
          }

          // Queue sync job for enabled destinations
          if (insertedEvent) {
            const { data: destinations } = await supabase
              .from('destinations')
              .select('id')
              .eq('workspace_id', rawEvent.workspace_id)
              .eq('enabled', true);

            if (destinations && destinations.length > 0) {
              const syncJobs = destinations.map(dest => ({
                workspace_id: rawEvent.workspace_id,
                destination_id: dest.id,
                unified_user_id: unifiedUserId,
                event_id: insertedEvent.id,
                job_type: 'event_track',
                payload: {},
              }));

              await supabase.from('sync_jobs').insert(syncJobs);
            }
          }
        }

        // Mark raw event as processed
        await supabase
          .from('events_raw')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', rawEvent.id);

        processedCount++;
      } catch (err) {
        console.error('Error processing event:', err);
        
        // Mark as error
        await supabase
          .from('events_raw')
          .update({ 
            processed_at: new Date().toISOString(),
            error: err instanceof Error ? err.message : 'Unknown error'
          })
          .eq('id', rawEvent.id);
        
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Processing completed',
        total: rawEvents.length,
        processed: processedCount,
        errors: errorCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Process events error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
