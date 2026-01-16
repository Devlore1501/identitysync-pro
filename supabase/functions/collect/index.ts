import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { validateApiKey } from '../_shared/auth.ts';

interface CollectPayload {
  event: string;
  properties?: Record<string, unknown>;
  context?: {
    anonymous_id?: string;
    session_id?: string;
    user_agent?: string;
    locale?: string;
    page?: {
      url?: string;
      title?: string;
      referrer?: string;
    };
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    };
  };
  timestamp?: string;
  consent?: {
    analytics?: boolean;
    marketing?: boolean;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key
    const authResult = await validateApiKey(apiKey);
    
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check scope
    if (!authResult.scopes?.includes('collect')) {
      return new Response(
        JSON.stringify({ error: 'API key does not have collect scope' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const payload: CollectPayload = await req.json();

    // Validate required fields
    if (!payload.event) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client info
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert into events_raw
    const { data, error } = await supabase
      .from('events_raw')
      .insert({
        workspace_id: authResult.workspaceId,
        payload: {
          event: payload.event,
          properties: payload.properties || {},
          context: payload.context || {},
          timestamp: payload.timestamp || new Date().toISOString(),
          consent: payload.consent,
        },
        source: 'js',
        ip_address: clientIp,
        user_agent: userAgent,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting event:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to process event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: data.id,
        message: 'Event received' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Collect error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
