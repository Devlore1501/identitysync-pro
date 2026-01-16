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

    const { workspace_id, test_type = 'simple', test_email } = await req.json();

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

    // Generate test data
    const testOrderId = `TEST_${Date.now()}`;
    const testCustomerId = `CUST_${Date.now()}`;
    const email = test_email || `test_${Date.now()}@example.com`;
    const anonymousId = `anon_test_${Date.now().toString(36)}`;

    if (test_type === 'order') {
      // Simulate a complete Shopify order with email
      // First, resolve/create identity using the database function
      const { data: identityResult, error: identityError } = await supabase
        .rpc('resolve_identity', {
          p_workspace_id: workspace_id,
          p_anonymous_id: anonymousId,
          p_email: email,
          p_customer_id: testCustomerId,
          p_source: 'shopify_webhook'
        });

      if (identityError) {
        console.error('Error resolving identity:', identityError);
        return new Response(
          JSON.stringify({ error: 'Failed to create identity', details: identityError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const unifiedUserId = identityResult;

      // Create the order event
      const orderEvent = {
        workspace_id,
        unified_user_id: unifiedUserId,
        event_name: 'Order Completed',
        event_type: 'order',
        source: 'shopify_webhook',
        event_time: new Date().toISOString(),
        anonymous_id: anonymousId,
        properties: {
          order_id: testOrderId,
          customer_id: testCustomerId,
          email: email,
          total: 99.99,
          subtotal: 89.99,
          currency: 'EUR',
          line_items: [
            { product_id: 'PROD_001', name: 'Test Product', quantity: 1, price: 49.99 },
            { product_id: 'PROD_002', name: 'Test Product 2', quantity: 2, price: 20.00 }
          ],
          shipping_address: {
            first_name: 'Test',
            last_name: 'User',
            city: 'Milano',
            country: 'IT'
          },
          test: true
        },
        context: {
          source: 'test-webhook-function',
          user_agent: req.headers.get('user-agent') || 'Unknown',
          ip: req.headers.get('x-forwarded-for') || 'unknown'
        },
        status: 'processed'
      };

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert(orderEvent)
        .select()
        .single();

      if (eventError) {
        console.error('Error inserting order event:', eventError);
        return new Response(
          JSON.stringify({ error: 'Failed to create order event', details: eventError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update computed traits
      await supabase.rpc('update_computed_traits_fast', {
        p_unified_user_id: unifiedUserId,
        p_event_type: 'order',
        p_event_name: 'Order Completed',
        p_properties: orderEvent.properties
      });

      // Get the created/updated unified user profile
      const { data: profile } = await supabase
        .from('users_unified')
        .select('id, primary_email, emails, customer_ids, traits, computed')
        .eq('id', unifiedUserId)
        .single();

      return new Response(
        JSON.stringify({ 
          success: true,
          test_type: 'order',
          message: 'Test order created successfully with email!',
          event_id: event.id,
          event_name: event.event_name,
          email: email,
          customer_id: testCustomerId,
          order_id: testOrderId,
          unified_user_id: unifiedUserId,
          profile: profile
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Simple test webhook (original behavior)
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
          test_type: 'simple',
          message: 'Test webhook event created successfully',
          event_id: event.id,
          event_name: event.event_name
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Test webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
