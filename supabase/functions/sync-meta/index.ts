import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface MetaEventData {
  event_name: string;
  event_time: number;
  event_id: string;
  event_source_url?: string;
  action_source: 'website' | 'app' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
  user_data: {
    em?: string[];  // Hashed emails
    ph?: string[];  // Hashed phones
    external_id?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;   // Facebook click ID
    fbp?: string;   // Facebook browser ID
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_name?: string;
    content_category?: string;
    content_ids?: string[];
    content_type?: string;
    contents?: Array<{
      id: string;
      quantity: number;
      item_price?: number;
    }>;
    num_items?: number;
    order_id?: string;
  };
}

// Hash data for Meta (SHA-256, lowercase, trimmed)
async function hashForMeta(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Map SignalForge events to Meta standard events
function mapEventToMeta(eventType: string, eventName: string): string {
  const eventMap: Record<string, string> = {
    'page_view': 'PageView',
    'view_item': 'ViewContent',
    'add_to_cart': 'AddToCart',
    'begin_checkout': 'InitiateCheckout',
    'purchase': 'Purchase',
    'Started Checkout': 'InitiateCheckout',
    'Placed Order': 'Purchase',
    'Add to Cart': 'AddToCart',
    'View Item': 'ViewContent',
  };
  return eventMap[eventType] || eventMap[eventName] || eventName;
}

// Send events to Meta Conversions API
async function sendToMetaCAPI(
  pixelId: string,
  accessToken: string,
  events: MetaEventData[],
  testEventCode?: string
): Promise<{ success: boolean; error?: string; events_received?: number }> {
  const url = `https://graph.facebook.com/v18.0/${pixelId}/events`;
  
  const body: Record<string, unknown> = {
    data: events,
    access_token: accessToken,
  };
  
  if (testEventCode) {
    body.test_event_code = testEventCode;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('Meta CAPI error:', result);
    return { 
      success: false, 
      error: result.error?.message || 'Unknown error' 
    };
  }
  
  return { 
    success: true, 
    events_received: result.events_received 
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get Meta credentials from environment (global secrets)
    const globalAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    const globalPixelId = Deno.env.get('META_PIXEL_ID');
    
    console.log('[META] Starting sync-meta function');
    console.log(`[META] Global credentials configured: ${!!globalAccessToken && !!globalPixelId}`);

    // Get pending sync jobs for Meta destinations (limit 50)
    const { data: jobs, error: jobsError } = await supabase
      .from('sync_jobs')
      .select(`
        *,
        destination:destinations(*),
        unified_user:users_unified(*),
        event:events(*)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .lt('attempts', 3)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (jobsError) {
      console.error('[META] Error fetching sync jobs:', jobsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sync jobs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter only Meta jobs
    const metaJobs = (jobs || []).filter(job => job.destination?.type === 'meta');

    if (metaJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending Meta jobs', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[META] Processing ${metaJobs.length} jobs`);

    let successCount = 0;
    let failCount = 0;

    // Group jobs by destination for batching
    const jobsByDestination: Record<string, typeof metaJobs> = {};
    for (const job of metaJobs) {
      const destId = job.destination_id;
      if (!jobsByDestination[destId]) {
        jobsByDestination[destId] = [];
      }
      jobsByDestination[destId].push(job);
    }

    // Process each destination's jobs as a batch
    for (const [destId, destJobs] of Object.entries(jobsByDestination)) {
      const destination = destJobs[0].destination;
      
      if (!destination?.enabled) {
        console.log(`[META] Destination ${destId} is disabled, skipping ${destJobs.length} jobs`);
        for (const job of destJobs) {
          await supabase
            .from('sync_jobs')
            .update({ 
              status: 'failed', 
              last_error: 'Destination disabled',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
        }
        failCount += destJobs.length;
        continue;
      }

      const config = destination.config as Record<string, unknown>;
      
      // Use destination config first, fallback to global secrets
      const pixelId = (config?.pixel_id as string) || globalPixelId;
      const accessToken = (config?.access_token as string) || globalAccessToken;
      const testEventCode = config?.test_event_code as string | undefined;

      if (!pixelId || !accessToken) {
        console.error(`[META] Missing credentials for destination ${destId}`);
        for (const job of destJobs) {
          await supabase
            .from('sync_jobs')
            .update({ 
              status: 'failed', 
              last_error: 'Meta Pixel ID or Access Token not configured',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
        }
        failCount += destJobs.length;
        continue;
      }
      
      console.log(`[META] Processing ${destJobs.length} jobs for destination ${destination.name}`);

      // Mark all jobs as running
      for (const job of destJobs) {
        await supabase
          .from('sync_jobs')
          .update({ 
            status: 'running', 
            started_at: new Date().toISOString(),
            attempts: job.attempts + 1 
          })
          .eq('id', job.id);
      }

      // Build Meta events
      const metaEvents: MetaEventData[] = [];
      
      for (const job of destJobs) {
        if (job.job_type !== 'event_track' || !job.event) continue;
        
        const event = job.event;
        const user = job.unified_user;
        const properties = event.properties as Record<string, unknown>;
        const context = event.context as Record<string, unknown>;
        
        // Hash user data
        const userData: MetaEventData['user_data'] = {
          client_ip_address: context?.ip_address as string,
          client_user_agent: context?.user_agent as string,
        };
        
        if (user?.primary_email) {
          userData.em = [await hashForMeta(user.primary_email)];
        }
        if (user?.phone) {
          userData.ph = [await hashForMeta(user.phone)];
        }
        if (user?.id) {
          userData.external_id = [await hashForMeta(user.id)];
        }
        
        // Extract Facebook cookies if present
        if (context?.fbc) userData.fbc = context.fbc as string;
        if (context?.fbp) userData.fbp = context.fbp as string;
        
        // Build custom data
        const customData: MetaEventData['custom_data'] = {
          currency: (properties?.currency as string) || 'USD',
        };
        
        if (properties?.value || properties?.total) {
          customData.value = Number(properties.value || properties.total) || 0;
        }
        if (properties?.product_name || properties?.name) {
          customData.content_name = (properties.product_name || properties.name) as string;
        }
        if (properties?.category) {
          customData.content_category = properties.category as string;
        }
        if (properties?.product_id) {
          customData.content_ids = [String(properties.product_id)];
          customData.content_type = 'product';
        }
        if (properties?.order_id) {
          customData.order_id = String(properties.order_id);
        }
        if (properties?.quantity) {
          customData.num_items = Number(properties.quantity);
        }
        
        // Handle line items for purchase events
        if (properties?.line_items && Array.isArray(properties.line_items)) {
          customData.contents = (properties.line_items as Array<Record<string, unknown>>).map(item => ({
            id: String(item.product_id || item.sku || item.id),
            quantity: Number(item.quantity) || 1,
            item_price: Number(item.price) || undefined,
          }));
          customData.content_ids = customData.contents.map(c => c.id);
          customData.num_items = customData.contents.reduce((sum, c) => sum + c.quantity, 0);
        }
        
        const metaEvent: MetaEventData = {
          event_name: mapEventToMeta(event.event_type, event.event_name),
          event_time: Math.floor(new Date(event.event_time).getTime() / 1000),
          event_id: event.id,
          event_source_url: (properties?.url || context?.page_url) as string,
          action_source: 'website',
          user_data: userData,
          custom_data: customData,
        };
        
        metaEvents.push(metaEvent);
      }

      if (metaEvents.length === 0) {
        for (const job of destJobs) {
          await supabase
            .from('sync_jobs')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
        }
        successCount += destJobs.length;
        continue;
      }

      // Send batch to Meta
      const result = await sendToMetaCAPI(pixelId, accessToken, metaEvents, testEventCode);

      if (result.success) {
        for (const job of destJobs) {
          await supabase
            .from('sync_jobs')
            .update({ 
              status: 'completed', 
              completed_at: new Date().toISOString() 
            })
            .eq('id', job.id);
        }
        successCount += destJobs.length;
        
        await supabase
          .from('destinations')
          .update({ last_sync_at: new Date().toISOString(), last_error: null })
          .eq('id', destId);
      } else {
        for (const job of destJobs) {
          const newStatus = job.attempts >= 2 ? 'failed' : 'pending';
          const scheduledAt = job.attempts >= 2 
            ? null 
            : new Date(Date.now() + Math.pow(2, job.attempts) * 60000).toISOString();
          
          await supabase
            .from('sync_jobs')
            .update({ 
              status: newStatus,
              last_error: result.error,
              scheduled_at: scheduledAt,
              completed_at: newStatus === 'failed' ? new Date().toISOString() : null
            })
            .eq('id', job.id);
          
          if (newStatus === 'failed') failCount++;
        }
        
        await supabase
          .from('destinations')
          .update({ last_error: result.error })
          .eq('id', destId);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Meta sync completed',
        processed: metaJobs.length,
        success: successCount,
        failed: failCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Meta sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
