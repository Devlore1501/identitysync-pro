import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Verify Shopify HMAC signature
async function verifyShopifyHmac(
  payload: string,
  hmacHeader: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return hmacHeader === computedHmac;
}

// Map Shopify line items to properties
function mapLineItems(lineItems: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return lineItems.map(item => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    sku: item.sku,
    name: item.name,
    title: item.title,
    quantity: item.quantity,
    price: item.price,
    vendor: item.vendor,
  }));
}

// Extract customer email from various Shopify payloads
function extractEmail(payload: Record<string, unknown>): string | null {
  return (
    (payload.email as string) ||
    (payload.customer as Record<string, unknown>)?.email ||
    (payload.contact_email as string) ||
    null
  ) as string | null;
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
    const shopifyTopic = req.headers.get('x-shopify-topic');
    const shopifyHmac = req.headers.get('x-shopify-hmac-sha256');
    const shopifyDomain = req.headers.get('x-shopify-shop-domain');
    
    if (!shopifyTopic) {
      return new Response(
        JSON.stringify({ error: 'Missing Shopify topic header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find workspace by domain
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, settings')
      .eq('platform', 'shopify')
      .or(`domain.eq.${shopifyDomain},platform_store_id.eq.${shopifyDomain}`)
      .single();

    if (workspaceError || !workspace) {
      // Try to find by settings
      const { data: workspaceBySettings } = await supabase
        .from('workspaces')
        .select('id, settings')
        .eq('platform', 'shopify')
        .limit(100);

      const matchedWorkspace = workspaceBySettings?.find(w => {
        const settings = w.settings as Record<string, unknown>;
        return settings?.shopify_domain === shopifyDomain;
      });

      if (!matchedWorkspace) {
        console.error('Workspace not found for domain:', shopifyDomain);
        return new Response(
          JSON.stringify({ error: 'Workspace not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Use matched workspace
      Object.assign(workspace || {}, matchedWorkspace);
    }

    const workspaceId = workspace?.id;
    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const webhookSecret = settings.shopify_webhook_secret as string;

    // Verify HMAC if secret is configured
    if (webhookSecret && shopifyHmac) {
      const isValid = await verifyShopifyHmac(rawBody, shopifyHmac, webhookSecret);
      if (!isValid) {
        console.error('Invalid Shopify HMAC signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Map Shopify topics to SignalForge events
    let eventName: string;
    let eventType: string;
    let properties: Record<string, unknown> = {};

    switch (shopifyTopic) {
      case 'orders/create':
      case 'orders/paid':
        eventName = 'Placed Order';
        eventType = 'purchase';
        properties = {
          order_id: payload.id,
          order_number: payload.order_number,
          total_price: payload.total_price,
          subtotal_price: payload.subtotal_price,
          total_tax: payload.total_tax,
          total_discounts: payload.total_discounts,
          currency: payload.currency,
          financial_status: payload.financial_status,
          fulfillment_status: payload.fulfillment_status,
          line_items: mapLineItems(payload.line_items || []),
          item_count: (payload.line_items as Array<unknown>)?.length || 0,
          shipping_address: payload.shipping_address,
          discount_codes: payload.discount_codes,
        };
        break;

      case 'checkouts/create':
      case 'checkouts/update':
        eventName = 'Started Checkout';
        eventType = 'begin_checkout';
        properties = {
          checkout_id: payload.id,
          checkout_token: payload.token,
          total_price: payload.total_price,
          subtotal_price: payload.subtotal_price,
          total_tax: payload.total_tax,
          total_discounts: payload.total_discounts,
          currency: payload.currency,
          line_items: mapLineItems(payload.line_items || []),
          item_count: (payload.line_items as Array<unknown>)?.length || 0,
          abandoned_checkout_url: payload.abandoned_checkout_url,
        };
        break;

      case 'carts/create':
      case 'carts/update':
        eventName = 'Add to Cart';
        eventType = 'add_to_cart';
        properties = {
          cart_token: payload.token,
          line_items: mapLineItems(payload.line_items || []),
          item_count: (payload.line_items as Array<unknown>)?.length || 0,
        };
        break;

      case 'customers/create':
      case 'customers/update':
        eventName = 'Customer Updated';
        eventType = 'identify';
        properties = {
          customer_id: payload.id,
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          phone: payload.phone,
          orders_count: payload.orders_count,
          total_spent: payload.total_spent,
          tags: payload.tags,
          accepts_marketing: payload.accepts_marketing,
        };
        break;

      default:
        eventName = `Shopify ${shopifyTopic}`;
        eventType = 'custom';
        properties = { raw_payload: payload };
    }

    const email = extractEmail(payload);
    const customerId = payload.customer?.id || payload.id;
    const anonymousId = `shopify_${customerId || payload.token || payload.id}`;

    // Find or create unified user
    let unifiedUserId: string | null = null;

    if (email) {
      // Try to find by email first
      const { data: existingUser } = await supabase
        .from('users_unified')
        .select('id')
        .eq('workspace_id', workspaceId)
        .contains('emails', [email])
        .single();

      if (existingUser) {
        unifiedUserId = existingUser.id;
        
        // Update last_seen_at and add customer_id if not present
        const { data: userData } = await supabase
          .from('users_unified')
          .select('customer_ids')
          .eq('id', unifiedUserId)
          .single();

        const customerIds = (userData?.customer_ids as string[]) || [];
        if (customerId && !customerIds.includes(String(customerId))) {
          customerIds.push(String(customerId));
        }

        await supabase
          .from('users_unified')
          .update({ 
            last_seen_at: new Date().toISOString(),
            customer_ids: customerIds,
            primary_email: email,
          })
          .eq('id', unifiedUserId);
      }
    }

    if (!unifiedUserId && customerId) {
      // Try to find by customer_id
      const { data: existingByCustomer } = await supabase
        .from('users_unified')
        .select('id')
        .eq('workspace_id', workspaceId)
        .contains('customer_ids', [String(customerId)])
        .single();

      if (existingByCustomer) {
        unifiedUserId = existingByCustomer.id;
        
        // Add email if available
        if (email) {
          const { data: userData } = await supabase
            .from('users_unified')
            .select('emails')
            .eq('id', unifiedUserId)
            .single();

          const emails = (userData?.emails as string[]) || [];
          if (!emails.includes(email)) {
            emails.push(email);
          }

          await supabase
            .from('users_unified')
            .update({ 
              last_seen_at: new Date().toISOString(),
              emails,
              primary_email: email,
            })
            .eq('id', unifiedUserId);
        }
      }
    }

    if (!unifiedUserId) {
      // Create new unified user
      const { data: newUser } = await supabase
        .from('users_unified')
        .insert({
          workspace_id: workspaceId,
          anonymous_ids: [anonymousId],
          emails: email ? [email] : [],
          primary_email: email,
          customer_ids: customerId ? [String(customerId)] : [],
          traits: {
            first_name: payload.customer?.first_name || payload.first_name,
            last_name: payload.customer?.last_name || payload.last_name,
            phone: payload.customer?.phone || payload.phone,
          },
        })
        .select('id')
        .single();

      if (newUser) {
        unifiedUserId = newUser.id;
        
        // Create identity records
        const identities = [];
        if (email) {
          identities.push({
            workspace_id: workspaceId,
            unified_user_id: unifiedUserId,
            identity_type: 'email',
            identity_value: email,
            source: 'shopify',
          });
        }
        if (customerId) {
          identities.push({
            workspace_id: workspaceId,
            unified_user_id: unifiedUserId,
            identity_type: 'customer_id',
            identity_value: String(customerId),
            source: 'shopify',
          });
        }
        if (identities.length > 0) {
          await supabase.from('identities').insert(identities);
        }
      }
    }

    // Generate dedupe key
    const dedupeKey = `shopify::${shopifyTopic}::${payload.id || payload.token}::${payload.updated_at || payload.created_at}`;

    // Check for duplicate
    const { data: existingEvent } = await supabase
      .from('events')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('dedupe_key', dedupeKey)
      .single();

    if (existingEvent) {
      return new Response(
        JSON.stringify({ success: true, message: 'Duplicate event ignored', event_id: existingEvent.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert event
    const { data: insertedEvent, error: insertError } = await supabase
      .from('events')
      .insert({
        workspace_id: workspaceId,
        unified_user_id: unifiedUserId,
        event_type: eventType,
        event_name: eventName,
        properties,
        context: {
          shopify_domain: shopifyDomain,
          shopify_topic: shopifyTopic,
        },
        anonymous_id: anonymousId,
        source: 'shopify',
        status: 'processed',
        dedupe_key: dedupeKey,
        event_time: payload.updated_at || payload.created_at || new Date().toISOString(),
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting Shopify event:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to process event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Queue sync jobs for enabled destinations
    if (insertedEvent) {
      const { data: destinations } = await supabase
        .from('destinations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('enabled', true);

      if (destinations && destinations.length > 0) {
        const syncJobs = destinations.map(dest => ({
          workspace_id: workspaceId,
          destination_id: dest.id,
          unified_user_id: unifiedUserId,
          event_id: insertedEvent.id,
          job_type: 'event_track',
          payload: {},
        }));

        await supabase.from('sync_jobs').insert(syncJobs);
      }

      // Update intent score
      if (unifiedUserId) {
        const scoreMap: Record<string, number> = {
          'purchase': 10,
          'begin_checkout': 8,
          'add_to_cart': 5,
          'custom': 1,
        };
        const scoreIncrement = scoreMap[eventType] || 1;

        const { data: user } = await supabase
          .from('users_unified')
          .select('computed')
          .eq('id', unifiedUserId)
          .single();

        const currentComputed = (user?.computed as Record<string, unknown>) || {};
        const currentScore = (currentComputed.intent_score as number) || 0;

        await supabase
          .from('users_unified')
          .update({
            computed: {
              ...currentComputed,
              intent_score: Math.min(currentScore + scoreIncrement, 100),
              last_event_type: eventType,
              last_order_date: eventType === 'purchase' ? new Date().toISOString() : currentComputed.last_order_date,
            },
          })
          .eq('id', unifiedUserId);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: insertedEvent?.id,
        message: `Processed ${shopifyTopic}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Shopify webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
