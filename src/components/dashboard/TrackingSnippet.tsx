import { useState, useEffect } from "react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Code, Loader2, CheckCircle2, XCircle, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface TrackingSnippetProps {
  fullApiKey?: string;
}

export function TrackingSnippet({ fullApiKey }: TrackingSnippetProps) {
  const { apiKeys } = useApiKeys();
  const { currentWorkspace } = useWorkspace();
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'success' | 'error' | null>(null);
  const [manualApiKey, setManualApiKey] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  // SECURITY: Only retrieve key prefix from localStorage (full key not stored for security)
  const [storedKeyPrefix, setStoredKeyPrefix] = useState<string>('');
  
  useEffect(() => {
    if (currentWorkspace?.id) {
      // Only retrieve the prefix, not the full key
      const storedPrefix = localStorage.getItem(`sf_api_key_prefix_${currentWorkspace.id}`);
      if (storedPrefix) setStoredKeyPrefix(storedPrefix);
      
      // SECURITY: Clean up any legacy full keys that may exist
      const legacyKey = localStorage.getItem(`sf_api_key_${currentWorkspace.id}`);
      if (legacyKey && !legacyKey.includes('...')) {
        // Remove full key and only keep prefix
        localStorage.removeItem(`sf_api_key_${currentWorkspace.id}`);
        const prefix = legacyKey.substring(0, 12) + '...';
        localStorage.setItem(`sf_api_key_prefix_${currentWorkspace.id}`, prefix);
        setStoredKeyPrefix(prefix);
      }
    }
  }, [currentWorkspace?.id]);
  
  // Priority: manual input > prop > show placeholder (no stored full keys for security)
  const apiKey = manualApiKey || fullApiKey || '';
  const hasFullKey = !!apiKey && !apiKey.includes('...');
  const displayKey = hasFullKey ? apiKey : (storedKeyPrefix || apiKeys[0]?.key_prefix || 'YOUR_API_KEY');
  
  const collectUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/collect`;
  const identifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/identify`;

  // Use the key for snippet display and verification
  const snippetKey = hasFullKey ? apiKey : displayKey;

  const snippet = `<!-- SignalForge Tracking Snippet - Behavioral Intelligence -->
<script>
(function(w,d,s,l,i){
  w.SignalForge=w.SignalForge||[];
  w.sf=function(){w.SignalForge.push(arguments)};
  w._sfKey=i;
  w._sfCollect='${collectUrl}';
  w._sfIdentify='${identifyUrl}';
  
  // Generate anonymous ID (persistent)
  var aid=localStorage.getItem('sf_aid');
  if(!aid){
    aid='anon_'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);
    localStorage.setItem('sf_aid',aid);
    localStorage.setItem('sf_first_seen',new Date().toISOString());
  }
  w._sfAid=aid;
  
  // Session ID (per session)
  var sid=sessionStorage.getItem('sf_sid');
  var isNewSession=!sid;
  if(!sid){
    sid='sess_'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);
    sessionStorage.setItem('sf_sid',sid);
    // Increment session count
    var sc=parseInt(localStorage.getItem('sf_session_count')||'0')+1;
    localStorage.setItem('sf_session_count',sc.toString());
  }
  w._sfSid=sid;
  w._sfSessionCount=parseInt(localStorage.getItem('sf_session_count')||'1');
  w._sfIsReturning=!!localStorage.getItem('sf_first_seen')&&w._sfSessionCount>1;
  
  // Get Facebook cookies for CAPI
  function getCookie(n){var v='; '+document.cookie;var p=v.split('; '+n+'=');if(p.length===2)return p.pop().split(';').shift()}
  w._sfFbp=getCookie('_fbp')||'';
  w._sfFbc=getCookie('_fbc')||'';
  
  // Track function with behavioral context
  w.sfTrack=function(event,props){
    var payload={
      event:event,
      properties:Object.assign({},props||{},{
        session_number:w._sfSessionCount,
        is_returning_visitor:w._sfIsReturning
      }),
      context:{
        anonymous_id:w._sfAid,
        session_id:w._sfSid,
        user_agent:navigator.userAgent,
        locale:navigator.language,
        page:{url:location.href,title:document.title,referrer:document.referrer},
        screen:{width:screen.width,height:screen.height},
        fbp:w._sfFbp,
        fbc:w._sfFbc
      },
      timestamp:new Date().toISOString()
    };
    fetch(w._sfCollect,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':w._sfKey},
      body:JSON.stringify(payload)
    }).catch(function(e){console.warn('SignalForge:',e)});
  };
  
  // Identify function  
  w.sfIdentify=function(email,traits){
    if(!email||!email.includes('@'))return;
    localStorage.setItem('sf_identified_email',email);
    fetch(w._sfIdentify,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':w._sfKey},
      body:JSON.stringify({
        anonymous_id:w._sfAid,
        email:email,
        traits:traits||{}
      })
    }).catch(function(e){console.warn('SignalForge:',e)});
  };
  
  // === SESSION START TRACKING (new session only) ===
  if(isNewSession){
    w.sfTrack('Session Start',{
      session_number:w._sfSessionCount,
      is_returning:w._sfIsReturning,
      first_seen:localStorage.getItem('sf_first_seen'),
      landing_page:location.pathname
    });
  }
  
  // === PAGE VIEW with enhanced context ===
  w.sfTrack('Page View',{
    path:location.pathname,
    query:location.search,
    page_type:location.pathname.includes('/products/')?'product':
              location.pathname.includes('/collections/')?'collection':
              location.pathname.includes('/cart')?'cart':
              location.pathname.includes('/checkout')?'checkout':
              location.pathname==='/'?'homepage':'other'
  });
  
  // === SCROLL DEPTH TRACKING ===
  var scrollMilestones={25:false,50:false,75:false,100:false};
  var trackScroll=function(){
    var h=document.documentElement;
    var pct=Math.round((h.scrollTop/(h.scrollHeight-h.clientHeight))*100)||0;
    [25,50,75,100].forEach(function(m){
      if(pct>=m&&!scrollMilestones[m]){
        scrollMilestones[m]=true;
        w.sfTrack('Scroll Depth',{percent:m,path:location.pathname});
      }
    });
  };
  var scrollTimer;
  window.addEventListener('scroll',function(){
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(trackScroll,200);
  });
  
  // === TIME ON PAGE (engagement tracking) ===
  var timeOnPage=0;
  var timeInterval=setInterval(function(){
    timeOnPage+=1;
    if(timeOnPage===30||timeOnPage===60||timeOnPage===120||timeOnPage===300){
      w.sfTrack('Time on Page',{seconds:timeOnPage,path:location.pathname,engaged:true});
    }
    if(timeOnPage>=300)clearInterval(timeInterval);
  },1000);
  
  // === EXIT INTENT ===
  var exitTracked=false;
  document.addEventListener('mouseout',function(e){
    if(!exitTracked&&e.clientY<10){
      exitTracked=true;
      w.sfTrack('Exit Intent',{
        path:location.pathname,
        time_on_page:timeOnPage,
        scroll_depth:Math.max.apply(null,Object.keys(scrollMilestones).filter(function(k){return scrollMilestones[k]}).map(Number))||0
      });
    }
  });
  
  // === SHOPIFY AUTO-TRACKING ===
  if(w.Shopify){
    var currency=w.Shopify.currency?w.Shopify.currency.active:'USD';
    
    // === COLLECTION/CATEGORY VIEW ===
    if(location.pathname.includes('/collections/')&&!location.pathname.includes('/products/')){
      var collHandle=location.pathname.split('/collections/')[1]?.split('/')[0]?.split('?')[0]||'';
      var collTitle=document.querySelector('h1')?.textContent?.trim()||collHandle;
      w.sfTrack('View Category',{
        collection_handle:collHandle,
        category:collHandle,
        category_name:collTitle,
        url:location.href
      });
    }
    
    // === PRODUCT VIEW (enhanced with category) ===
    if(w.ShopifyAnalytics&&w.ShopifyAnalytics.meta&&w.ShopifyAnalytics.meta.product){
      var p=w.ShopifyAnalytics.meta.product;
      // Track products viewed for depth calculation
      var viewedProducts=JSON.parse(localStorage.getItem('sf_viewed_products')||'[]');
      if(!viewedProducts.includes(p.id.toString())){
        viewedProducts.push(p.id.toString());
        localStorage.setItem('sf_viewed_products',JSON.stringify(viewedProducts.slice(-50)));
      }
      
      w.sfTrack('Product Viewed',{
        product_id:p.id,
        product_name:p.title||p.type,
        product_handle:location.pathname.split('/products/')[1]?.split('?')[0]||'',
        product_type:p.type,
        vendor:p.vendor,
        category:p.type||p.vendor,
        collection_handle:document.querySelector('[data-collection-handle]')?.dataset?.collectionHandle||'',
        variant_id:p.variants?p.variants[0]?.id:null,
        price:p.variants?(p.variants[0]?.price||0)/100:0,
        currency:currency,
        total_products_viewed:viewedProducts.length
      });
    }
    
    // === SEARCH TRACKING ===
    if(location.pathname.includes('/search')){
      var q=new URLSearchParams(location.search).get('q')||'';
      w.sfTrack('Search',{
        query:q,
        url:location.href,
        results_count:document.querySelectorAll('[data-product-id]').length||
                      document.querySelectorAll('.product-card,.product-item').length||0
      });
    }
    
    // === PRODUCT CLICK from listings ===
    document.querySelectorAll('a[href*="/products/"]').forEach(function(link){
      link.addEventListener('click',function(){
        var href=link.getAttribute('href')||'';
        var handle=href.split('/products/')[1]?.split('?')[0]||'';
        var currentColl=location.pathname.includes('/collections/')?
          location.pathname.split('/collections/')[1]?.split('/')[0]:'';
        w.sfTrack('Product Click',{
          product_handle:handle,
          from_url:location.href,
          from_collection:currentColl,
          from_page_type:location.pathname.includes('/collections/')?'collection':
                         location.pathname.includes('/search')?'search':'other'
        });
      });
    });
    
    // === CART OPERATIONS (fetch hook) ===
    var origFetch=w.fetch;
    w.fetch=function(url,opts){
      if(url){
        // Add to Cart
        if(url.includes('/cart/add')){
          try{
            var body=opts&&opts.body?JSON.parse(opts.body):{};
            w.sfTrack('Add to Cart',{
              product_id:body.id,
              quantity:body.quantity||1,
              currency:currency,
              properties:body.properties||{}
            });
          }catch(e){}
        }
        // Remove from Cart
        if(url.includes('/cart/change')){
          try{
            var body=opts&&opts.body?JSON.parse(opts.body):{};
            if(body.quantity===0){
              w.sfTrack('Remove from Cart',{line:body.line,currency:currency});
            }else{
              w.sfTrack('Update Cart',{line:body.line,quantity:body.quantity,currency:currency});
            }
          }catch(e){}
        }
      }
      return origFetch.apply(this,arguments);
    };
    
    // === CART VIEWED ===
    document.querySelectorAll('[href="/cart"],[data-cart-toggle],[class*="cart-icon"],[class*="cart-drawer"]').forEach(function(el){
      el.addEventListener('click',function(){
        w.sfTrack('Cart Viewed',{currency:currency,trigger:'click'});
      });
    });
    if(location.pathname==='/cart'){
      w.sfTrack('Cart Viewed',{currency:currency,trigger:'page_load'});
    }
    
    // === CHECKOUT TRACKING ===
    if(location.pathname.includes('/checkout')){
      w.sfTrack('Begin Checkout',{
        url:location.href,
        currency:currency,
        step:location.pathname.includes('/information')?'information':
             location.pathname.includes('/shipping')?'shipping':
             location.pathname.includes('/payment')?'payment':'started'
      });
      
      // Email capture from checkout
      var emailInput=document.querySelector('input[name="email"],input[type="email"],#checkout_email,#email');
      if(emailInput){
        // Capture on blur
        emailInput.addEventListener('blur',function(){
          var email=emailInput.value;
          if(email&&email.includes('@')){
            localStorage.setItem('sf_checkout_email',email);
            w.sfIdentify(email,{source:'checkout_form',checkout_step:'email_entered'});
          }
        });
        // Check if already filled
        if(emailInput.value&&emailInput.value.includes('@')){
          localStorage.setItem('sf_checkout_email',emailInput.value);
          w.sfIdentify(emailInput.value,{source:'checkout_form'});
        }
      }
      
      // Customer ID from Shopify
      if(w.ShopifyAnalytics&&w.ShopifyAnalytics.meta&&w.ShopifyAnalytics.meta.page){
        var custId=w.ShopifyAnalytics.meta.page.customerId;
        if(custId){
          w.sfTrack('Checkout Customer',{customer_id:custId,currency:currency});
        }
      }
    }
    
    // === PURCHASE (Thank you page) ===
    if(location.pathname.includes('/thank_you')||location.pathname.includes('/orders/')){
      if(w.Shopify.checkout){
        var c=w.Shopify.checkout;
        var checkoutEmail=c.email||localStorage.getItem('sf_checkout_email');
        
        w.sfTrack('Purchase',{
          order_id:c.order_id,
          total:c.total_price/100,
          subtotal:c.subtotal_price/100,
          tax:c.total_tax/100,
          shipping:(c.shipping_rate?c.shipping_rate.price/100:0),
          currency:c.currency||'USD',
          email:checkoutEmail,
          customer_id:c.customer_id||null,
          discount_code:c.discount?c.discount.code:'',
          discount_amount:c.discount?c.discount.amount/100:0,
          item_count:c.line_items?c.line_items.length:0,
          line_items:c.line_items?c.line_items.map(function(i){
            return{
              product_id:i.product_id,
              variant_id:i.variant_id,
              quantity:i.quantity,
              price:i.price/100,
              name:i.title,
              sku:i.sku
            }
          }):[]
        });
        
        // Identify with purchase data
        if(checkoutEmail){
          w.sfIdentify(checkoutEmail,{
            first_name:c.billing_address?c.billing_address.first_name:'',
            last_name:c.billing_address?c.billing_address.last_name:'',
            customer_id:c.customer_id||null,
            order_id:c.order_id,
            last_order_total:c.total_price/100,
            source:'purchase_complete'
          });
          localStorage.removeItem('sf_checkout_email');
        }
      }
    }
    
    // === CUSTOMER SESSION (logged in users) ===
    if(w.__st&&w.__st.cid){
      w.sfTrack('Customer Session',{customer_id:w.__st.cid,logged_in:true});
    }
    // Try ShopifyAnalytics for customer data
    if(w.ShopifyAnalytics&&w.ShopifyAnalytics.meta&&w.ShopifyAnalytics.meta.page){
      var pg=w.ShopifyAnalytics.meta.page;
      if(pg.customerId){
        var customerEmail=localStorage.getItem('sf_identified_email');
        if(customerEmail){
          w.sfIdentify(customerEmail,{customer_id:pg.customerId,source:'shopify_session'});
        }
      }
    }
  }
  
  // === POPUP/FORM TRACKING ===
  // Klaviyo
  if(w._klOnsite){
    try{
      w._klOnsite.push(['openForm',function(f){
        w.sfTrack('Form Viewed',{form_type:'popup',provider:'klaviyo',form_id:f?.formId||''});
      }]);
      w._klOnsite.push(['submitForm',function(e){
        w.sfTrack('Form Submitted',{form_type:'popup',provider:'klaviyo',email:e.email||''});
        if(e.email)w.sfIdentify(e.email,{source:'klaviyo_popup'});
      }]);
    }catch(e){}
  }
  // Privy
  if(w.Privy){
    try{
      w.Privy('onFormSubmit',function(e){
        w.sfTrack('Form Submitted',{form_type:'popup',provider:'privy',email:e.email||''});
        if(e.email)w.sfIdentify(e.email,{source:'privy_popup'});
      });
    }catch(e){}
  }
  // Justuno
  if(w.juapp){
    try{
      w.juapp('onConversion',function(e){
        w.sfTrack('Form Submitted',{form_type:'popup',provider:'justuno'});
        if(e.email)w.sfIdentify(e.email,{source:'justuno_popup'});
      });
    }catch(e){}
  }
  
  // Generic form tracking
  document.querySelectorAll('form').forEach(function(form){
    form.addEventListener('submit',function(){
      var email=form.querySelector('input[type="email"]');
      if(email&&email.value){
        w.sfTrack('Form Submitted',{form_type:'inline',email:email.value});
        w.sfIdentify(email.value,{source:'form_submit'});
      }
    });
  });
  
  // === NEWSLETTER FOOTER TRACKING ===
  var footerForms=document.querySelectorAll('footer form,form[action*="subscribe"],form[class*="newsletter"]');
  footerForms.forEach(function(form){
    var emailField=form.querySelector('input[type="email"]');
    if(emailField){
      emailField.addEventListener('blur',function(){
        if(emailField.value&&emailField.value.includes('@')){
          w.sfTrack('Newsletter Intent',{email:emailField.value,location:'footer'});
        }
      });
    }
  });
  
})(window,document,'script','sf','${snippetKey}');
</script>`;


  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyInstallation = async () => {
    const keyToVerify = manualApiKey || apiKey;
    
    if (!keyToVerify || keyToVerify.includes('...') || keyToVerify === 'YOUR_API_KEY') {
      toast.error("Please enter a valid full API key to verify");
      setShowManualInput(true);
      return;
    }

    setVerifying(true);
    setVerificationResult(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': keyToVerify,
        },
        body: JSON.stringify({
          event: '_sf_verification_ping',
          properties: { verification: true },
          context: {
            anonymous_id: 'verification_test_' + Date.now(),
            page: { url: 'verification-test' }
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVerificationResult('success');
          toast.success("API key is working correctly!");
          // SECURITY: Only store the prefix, not the full key
          if (currentWorkspace?.id) {
            const keyPrefix = keyToVerify.substring(0, 12) + '...';
            localStorage.setItem(`sf_api_key_prefix_${currentWorkspace.id}`, keyPrefix);
            setStoredKeyPrefix(keyPrefix);
          }
        } else {
          setVerificationResult('error');
          toast.error("Verification failed: " + (data.error || 'Unknown error'));
        }
      } else {
        setVerificationResult('error');
        const errorData = await response.json().catch(() => ({}));
        toast.error("Verification failed: " + (errorData.error || 'API key may be invalid'));
      }
    } catch (error) {
      setVerificationResult('error');
      toast.error("Verification failed. Check your API key.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Snippet Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">JavaScript Tracking Snippet</h3>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        
        {!hasFullKey && (
          <div className="p-3 bg-warning/10 text-warning rounded-lg text-sm space-y-2">
            <p>⚠️ The snippet shows a partial API key. Either:</p>
            <ul className="list-disc list-inside ml-2 text-xs">
              <li>Create a new API key (recommended - it will be saved automatically)</li>
              <li>Or enter your full API key below</li>
            </ul>
          </div>
        )}

        {/* Manual API Key Input */}
        {(!hasFullKey || showManualInput) && (
          <div className="flex gap-2 items-center">
            <KeyRound className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Paste your full API key (sf_pk_...)"
              value={manualApiKey}
              onChange={(e) => {
                setManualApiKey(e.target.value);
                // SECURITY: Do not auto-store full keys, only store prefix after verification
              }}
              className="flex-1 font-mono text-sm"
            />
          </div>
        )}
        
        <div className="bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-80">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
            {snippet}
          </pre>
        </div>
      </div>

      {/* Verification Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Verify API Key</h3>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Test that your API key is working correctly by sending a test event.
        </p>
        
        <Button onClick={handleVerifyInstallation} disabled={verifying} className="w-full">
          {verifying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Test API Key
            </>
          )}
        </Button>

        {verificationResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            verificationResult === 'success' 
              ? 'bg-green-500/10 text-green-600' 
              : 'bg-destructive/10 text-destructive'
          }`}>
            {verificationResult === 'success' ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>API key verified! Events are being tracked successfully.</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                <span>Verification failed. Check that your API key is correct and not revoked.</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="space-y-3 text-sm pt-4 border-t border-border">
        <p className="font-medium">Quick Start:</p>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Copy the snippet above</li>
          <li>Add it to your website's <code className="bg-muted px-1 rounded">&lt;head&gt;</code> tag</li>
          <li>Page views are tracked automatically</li>
          <li>Click "Test API Key" to verify the connection</li>
        </ol>

        <p className="font-medium mt-4">Custom Events:</p>
        <div className="space-y-2">
          <div>
            <code className="text-xs bg-muted px-2 py-1 rounded block">
              sfTrack('View Item', {"{"} product_id: 'SKU123', price: 29.99 {"}"});
            </code>
          </div>
          <div>
            <code className="text-xs bg-muted px-2 py-1 rounded block">
              sfIdentify('user@example.com', {"{"} name: 'John Doe' {"}"});
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
