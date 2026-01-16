import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * IdentitySync - Klaviyo Test Initializer
 * 
 * This function forces a profile update to Klaviyo to make sf_* properties visible.
 * Run ONCE after deploy to "initialize" Klaviyo properties.
 * 
 * After running this:
 * 1. Go to Klaviyo → Profiles
 * 2. Search for test email
 * 3. Properties sf_* will now be visible and usable in triggers
 */

interface KlaviyoProfile {
  type: 'profile';
  id?: string;
  attributes: {
    email: string;
    external_id?: string;
    properties: Record<string, unknown>;
  };
}

async function upsertKlaviyoProfile(
  apiKey: string, 
  profile: KlaviyoProfile
): Promise<{ success: boolean; error?: string; profileId?: string }> {
  
  console.log('=== KLAVIYO PROFILE UPDATE INIT ===');
  console.log(`Email: ${profile.attributes.email}`);
  console.log(`Properties being sent:`, Object.keys(profile.attributes.properties));
  
  const response = await fetch('https://a.klaviyo.com/api/profiles/', {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'Content-Type': 'application/json',
      'revision': '2024-02-15',
    },
    body: JSON.stringify({ data: profile }),
  });

  // Handle duplicate profile (409)
  if (response.status === 409) {
    const existing = await response.json();
    const profileId = existing?.errors?.[0]?.meta?.duplicate_profile_id;
    
    console.log(`Profile exists, updating: ${profileId}`);
    
    if (profileId) {
      const updateResponse = await fetch(`https://a.klaviyo.com/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Klaviyo-API-Key ${apiKey}`,
          'Content-Type': 'application/json',
          'revision': '2024-02-15',
        },
        body: JSON.stringify({ 
          data: { 
            type: 'profile',
            id: profileId,
            attributes: {
              properties: profile.attributes.properties
            }
          } 
        }),
      });
      
      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        console.error('Update failed:', error);
        return { success: false, error, profileId };
      }
      
      console.log('✅ Profile updated successfully');
      return { success: true, profileId };
    }
  }

  if (!response.ok) {
    const error = await response.text();
    console.error('Create failed:', error);
    return { success: false, error };
  }

  const result = await response.json();
  console.log('✅ Profile created successfully');
  return { success: true, profileId: result?.data?.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional email override
    let testEmail = 'test@identitysync.dev';
    try {
      const body = await req.json();
      if (body?.email) {
        testEmail = body.email;
      }
    } catch {
      // Use default email
    }

    console.log('=== INIT KLAVIYO TEST ===');
    console.log(`Test email: ${testEmail}`);

    // Get first enabled Klaviyo destination
    const { data: destinations, error: destError } = await supabase
      .from('destinations')
      .select('*')
      .eq('type', 'klaviyo')
      .eq('enabled', true)
      .limit(1);

    if (destError || !destinations || destinations.length === 0) {
      console.error('No Klaviyo destination found:', destError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No enabled Klaviyo destination configured. Go to Settings → Destinations and add Klaviyo.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const destination = destinations[0];
    const klaviyoApiKey = destination.config?.api_key as string;

    if (!klaviyoApiKey) {
      console.error('Klaviyo API key not found in destination config');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Klaviyo API key not configured in destination' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build test profile with ALL sf_* properties
    const now = new Date().toISOString();
    const testProperties = {
      // === IDENTIFICATION ===
      sf_unified_user_id: 'test-user-init-001',
      sf_first_seen_at: now,
      sf_last_seen_at: now,
      
      // === CORE BEHAVIORAL SCORES ===
      sf_intent_score: 65,
      sf_frequency_score: 45,
      sf_depth_score: 30,
      sf_recency_days: 0,
      
      // === BEHAVIORAL SIGNALS ===
      sf_top_category: 'Test Category',
      sf_drop_off_stage: 'checkout_abandoned',
      sf_dropoff_stage: 'checkout_abandoned', // Also include without underscore variant
      
      // === ENGAGEMENT COUNTS ===
      sf_viewed_products_7d: 5,
      sf_viewed_products_7d_count: 5, // Alternative name
      sf_categories_viewed: 3,
      sf_session_count_30d: 7,
      sf_atc_7d: 2,
      sf_atc_7d_count: 2, // Alternative name
      
      // === ABANDONMENT TIMESTAMPS (CRITICAL FOR TRIGGERS) ===
      sf_cart_abandoned_at: now,
      sf_checkout_abandoned_at: now,
      sf_checkout_started_14d: true,
      
      // === REVENUE METRICS ===
      sf_lifetime_value: 0,
      sf_total_spent: 0, // Alternative name
      sf_orders_count: 0,
      sf_total_orders: 0, // Alternative name
      
      // === EMAIL ENGAGEMENT ===
      sf_email_opens_30d: 0,
      sf_email_clicks_30d: 0,
      sf_email_engagement_score: 0,
      sf_is_subscribed: false,
      sf_last_klaviyo_event: null,
      
      // === METADATA ===
      sf_computed_at: now,
      sf_source: 'init-klaviyo-test',
      sf_test_profile: true,
    };

    console.log('');
    console.log('📤 Klaviyo profile update sent:');
    console.log(`   email=${testEmail}`);
    console.log(`   properties=[${Object.keys(testProperties).join(', ')}]`);
    console.log('');

    const profile: KlaviyoProfile = {
      type: 'profile',
      attributes: {
        email: testEmail,
        external_id: 'test-init-001',
        properties: testProperties,
      },
    };

    const result = await upsertKlaviyoProfile(klaviyoApiKey, profile);

    if (result.success) {
      console.log('');
      console.log('✅ SUCCESS! Properties should now be visible in Klaviyo');
      console.log(`   Go to: Klaviyo → Profiles → Search "${testEmail}"`);
      console.log('   You should see all sf_* properties');
      console.log('');
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Profile updated! Properties are now visible in Klaviyo.',
          email: testEmail,
          propertiesSent: Object.keys(testProperties),
          profileId: result.profileId,
          nextSteps: [
            `1. Go to Klaviyo → Profiles`,
            `2. Search for "${testEmail}"`,
            `3. Click on the profile`,
            `4. You should see: sf_checkout_abandoned_at, sf_drop_off_stage, sf_intent_score, etc.`,
            `5. Now you can create triggers using these properties!`
          ]
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('❌ Failed to update profile:', result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error,
          message: 'Failed to update Klaviyo profile'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
