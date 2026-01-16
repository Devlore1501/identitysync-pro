import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { workspace_id } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: 'workspace_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify workspace exists
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a test event simulating a Shopify webhook
    const testEvent = {
      workspace_id,
      event_name: 'Test Webhook',
      event_type: 'test',
      source: 'shopify_webhook',
      event_time: new Date().toISOString(),
      properties: {
        test: true,
        message: 'Questo è un evento di test per verificare la connessione webhook',
        timestamp: Date.now()
      },
      context: {
        source: 'test-webhook-function',
        user_agent: req.headers.get('user-agent') || 'Unknown'
      },
      status: 'processed'
    };

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert(testEvent)
      .select()
      .single();

    if (eventError) {
      console.error('Error inserting test event:', eventError);
      return new Response(
        JSON.stringify({ error: 'Failed to create test event', details: eventError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test webhook event created successfully',
        event_id: event.id,
        event_name: event.event_name
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Test webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
