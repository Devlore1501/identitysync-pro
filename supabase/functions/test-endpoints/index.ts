import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Test Endpoints - Temporary function to test collect and identify
 * This endpoint does NOT require API key authentication for testing purposes
 * 
 * POST /test-endpoints
 * { "action": "test_full_flow" }
 */

Deno.serve(async (req) => {
  console.log('=== TEST-ENDPOINTS FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('Time:', new Date().toISOString());

  // Handle CORS
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Supabase client created');

    // Get first workspace for testing
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name')
      .limit(1)
      .single();

    if (wsError || !workspace) {
      console.error('No workspace found:', wsError);
      return new Response(
        JSON.stringify({ error: 'No workspace found for testing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Using workspace:', workspace.id, workspace.name);

    const testAnonymousId = 'test-anon-' + Math.random().toString(36).substring(2, 10);
    const testEmail = `test-${Date.now()}@identitysync.dev`;
    const results: { step: string; success: boolean; details: unknown }[] = [];

    // ========================================
    // STEP 1: Simulate product_view event
    // ========================================
    console.log('=== STEP 1: product_view ===');
    console.log('anonymous_id:', testAnonymousId);

    const { data: userId1, error: resolveError1 } = await supabase.rpc('resolve_identity', {
      p_workspace_id: workspace.id,
      p_anonymous_id: testAnonymousId,
      p_source: 'test'
    });

    if (resolveError1) {
      console.error('resolve_identity error:', resolveError1);
      results.push({ step: 'product_view', success: false, details: resolveError1.message });
    } else {
      console.log('Unified user created/found:', userId1);
      
      // Insert product_view event
      const { data: event1, error: eventError1 } = await supabase
        .from('events')
        .insert({
          workspace_id: workspace.id,
          unified_user_id: userId1,
          anonymous_id: testAnonymousId,
          event_type: 'product',
          event_name: 'product_view',
          properties: { product_id: 'test-product-1', category: 'test-category' },
          context: { anonymous_id: testAnonymousId },
          source: 'test-endpoints'
        })
        .select('id')
        .single();

      if (eventError1) {
        console.error('event insert error:', eventError1);
        results.push({ step: 'product_view', success: false, details: eventError1.message });
      } else {
        console.log('product_view event created:', event1.id);
        results.push({ step: 'product_view', success: true, details: { event_id: event1.id, unified_user_id: userId1 } });
      }
    }

    // ========================================
    // STEP 2: Simulate add_to_cart event
    // ========================================
    console.log('=== STEP 2: add_to_cart ===');
    
    const { data: event2, error: eventError2 } = await supabase
      .from('events')
      .insert({
        workspace_id: workspace.id,
        unified_user_id: userId1,
        anonymous_id: testAnonymousId,
        event_type: 'cart',
        event_name: 'add_to_cart',
        properties: { product_id: 'test-product-1', price: 29.9 },
        context: { anonymous_id: testAnonymousId },
        source: 'test-endpoints'
      })
      .select('id')
      .single();

    if (eventError2) {
      console.error('event insert error:', eventError2);
      results.push({ step: 'add_to_cart', success: false, details: eventError2.message });
    } else {
      console.log('add_to_cart event created:', event2.id);
      results.push({ step: 'add_to_cart', success: true, details: { event_id: event2.id } });
    }

    // ========================================
    // STEP 3: Simulate checkout_started event
    // ========================================
    console.log('=== STEP 3: checkout_started ===');
    
    const { data: event3, error: eventError3 } = await supabase
      .from('events')
      .insert({
        workspace_id: workspace.id,
        unified_user_id: userId1,
        anonymous_id: testAnonymousId,
        event_type: 'checkout',
        event_name: 'checkout_started',
        properties: { checkout_id: 'chk_test_123', value: 29.9 },
        context: { anonymous_id: testAnonymousId },
        source: 'test-endpoints'
      })
      .select('id')
      .single();

    if (eventError3) {
      console.error('event insert error:', eventError3);
      results.push({ step: 'checkout_started', success: false, details: eventError3.message });
    } else {
      console.log('checkout_started event created:', event3.id);
      results.push({ step: 'checkout_started', success: true, details: { event_id: event3.id } });
    }

    // ========================================
    // STEP 4: Simulate identify (email capture)
    // ========================================
    console.log('=== STEP 4: identify ===');
    console.log('email:', testEmail);
    console.log('anonymous_id:', testAnonymousId);

    // Update the unified user with email
    const { error: updateError } = await supabase
      .from('users_unified')
      .update({
        primary_email: testEmail,
        emails: [testEmail],
        last_seen_at: new Date().toISOString()
      })
      .eq('id', userId1);

    if (updateError) {
      console.error('user update error:', updateError);
      results.push({ step: 'identify', success: false, details: updateError.message });
    } else {
      console.log('User updated with email:', testEmail);
      
      // Create identity record
      const { error: identityError } = await supabase
        .from('identities')
        .upsert({
          workspace_id: workspace.id,
          unified_user_id: userId1,
          identity_type: 'email',
          identity_value: testEmail,
          source: 'test-endpoints'
        }, { 
          onConflict: 'workspace_id,identity_type,identity_value',
          ignoreDuplicates: true 
        });

      if (identityError) {
        console.error('identity insert error:', identityError);
      }

      results.push({ step: 'identify', success: true, details: { unified_user_id: userId1, email: testEmail } });
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log('=== TEST COMPLETED ===');
    console.log('Results:', JSON.stringify(results, null, 2));

    // Verify data in DB
    const { data: verifyUser } = await supabase
      .from('users_unified')
      .select('*')
      .eq('id', userId1)
      .single();

    const { count: eventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('unified_user_id', userId1);

    console.log('Verified user:', verifyUser?.primary_email);
    console.log('Total events for user:', eventCount);

    return new Response(
      JSON.stringify({
        success: true,
        test_data: {
          anonymous_id: testAnonymousId,
          email: testEmail,
          unified_user_id: userId1,
          workspace_id: workspace.id
        },
        results,
        verification: {
          user_email: verifyUser?.primary_email,
          total_events: eventCount
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Test error:', error);
    return new Response(
      JSON.stringify({ error: 'Test failed', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
