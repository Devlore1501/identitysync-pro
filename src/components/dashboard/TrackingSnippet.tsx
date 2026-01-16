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
  
  // Try to get full API key from localStorage (stored when created)
  const [storedApiKey, setStoredApiKey] = useState<string>('');
  
  useEffect(() => {
    if (currentWorkspace?.id) {
      const stored = localStorage.getItem(`sf_api_key_${currentWorkspace.id}`);
      if (stored) setStoredApiKey(stored);
    }
  }, [currentWorkspace?.id]);
  
  // Priority: manual input > prop > localStorage > show placeholder
  const apiKey = manualApiKey || fullApiKey || storedApiKey || '';
  const hasFullKey = !!apiKey && !apiKey.includes('...');
  const displayKey = hasFullKey ? apiKey : (apiKeys[0]?.key_prefix || 'YOUR_API_KEY');
  
  const collectUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/collect`;
  const identifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/identify`;

  // Use the key for snippet display and verification
  const snippetKey = hasFullKey ? apiKey : displayKey;

  const snippet = `<!-- SignalForge Tracking Snippet - Full Funnel Tracking -->
<script>
(function(w,d,s,l,i){
  w.SignalForge=w.SignalForge||[];
  w.sf=function(){w.SignalForge.push(arguments)};
  w._sfKey=i;
  w._sfCollect='${collectUrl}';
  w._sfIdentify='${identifyUrl}';
  
  // Generate anonymous ID
  var aid=localStorage.getItem('sf_aid');
  if(!aid){aid='anon_'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);localStorage.setItem('sf_aid',aid)}
  w._sfAid=aid;
  
  // Session ID
  var sid=sessionStorage.getItem('sf_sid');
  if(!sid){sid='sess_'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);sessionStorage.setItem('sf_sid',sid)}
  w._sfSid=sid;
  
  // Get Facebook cookies for CAPI
  function getCookie(n){var v='; '+document.cookie;var p=v.split('; '+n+'=');if(p.length===2)return p.pop().split(';').shift()}
  w._sfFbp=getCookie('_fbp')||'';
  w._sfFbc=getCookie('_fbc')||'';
  
  // Track function
  w.sfTrack=function(event,props){
    fetch(w._sfCollect,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':w._sfKey},
      body:JSON.stringify({
        event:event,
        properties:props||{},
        context:{
          anonymous_id:w._sfAid,
          session_id:w._sfSid,
          user_agent:navigator.userAgent,
          locale:navigator.language,
          page:{url:location.href,title:document.title,referrer:document.referrer},
          fbp:w._sfFbp,
          fbc:w._sfFbc
        },
        timestamp:new Date().toISOString()
      })
    }).catch(function(e){console.warn('SignalForge:',e)});
  };
  
  // Identify function  
  w.sfIdentify=function(email,traits){
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
  
  // Auto-track page views
  w.sfTrack('Page View',{path:location.pathname});
  
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
  
  // === TIME ON PAGE ===
  var timeOnPage=0;
  var timeInterval=setInterval(function(){
    timeOnPage+=1;
    if(timeOnPage===30||timeOnPage===60||timeOnPage===120){
      w.sfTrack('Time on Page',{seconds:timeOnPage,path:location.pathname});
    }
    if(timeOnPage>=120)clearInterval(timeInterval);
  },1000);
  
  // === EXIT INTENT ===
  var exitTracked=false;
  document.addEventListener('mouseout',function(e){
    if(!exitTracked&&e.clientY<10){
      exitTracked=true;
      w.sfTrack('Exit Intent',{path:location.pathname});
    }
  });
  
  // === SHOPIFY AUTO-TRACKING ===
  if(w.Shopify){
    var currency=w.Shopify.currency?w.Shopify.currency.active:'USD';
    
    // Collection view
    if(location.pathname.includes('/collections/')&&!location.pathname.includes('/products/')){
      var collHandle=location.pathname.split('/collections/')[1]?.split('/')[0]||'';
      w.sfTrack('View Collection',{collection_handle:collHandle,url:location.href});
    }
    
    // Product view (on product pages)
    if(w.ShopifyAnalytics&&w.ShopifyAnalytics.meta&&w.ShopifyAnalytics.meta.product){
      var p=w.ShopifyAnalytics.meta.product;
      w.sfTrack('View Item',{
        product_id:p.id,
        product_name:p.type,
        variant_id:p.variants?p.variants[0].id:null,
        price:p.variants?p.variants[0].price/100:0,
        currency:currency
      });
    }
    
    // Search tracking
    if(location.pathname.includes('/search')){
      var q=new URLSearchParams(location.search).get('q')||'';
      w.sfTrack('Search',{query:q,url:location.href});
    }
    
    // Product click tracking (on collection pages)
    document.querySelectorAll('a[href*="/products/"]').forEach(function(link){
      link.addEventListener('click',function(){
        var href=link.getAttribute('href')||'';
        var handle=href.split('/products/')[1]?.split('?')[0]||'';
        w.sfTrack('Product Click',{product_handle:handle,from_url:location.href});
      });
    });
    
    // Hook fetch for cart operations
    var origFetch=w.fetch;
    w.fetch=function(url,opts){
      if(url){
        // Add to Cart
        if(url.includes('/cart/add')){
          try{
            var body=opts&&opts.body?JSON.parse(opts.body):{};
            w.sfTrack('Add to Cart',{product_id:body.id,quantity:body.quantity||1,currency:currency});
          }catch(e){}
        }
        // Remove from Cart
        if(url.includes('/cart/change')){
          try{
            var body=opts&&opts.body?JSON.parse(opts.body):{};
            if(body.quantity===0){
              w.sfTrack('Remove from Cart',{line:body.line,currency:currency});
            }
          }catch(e){}
        }
      }
      return origFetch.apply(this,arguments);
    };
    
    // Cart viewed (mini cart / drawer)
    document.querySelectorAll('[href="/cart"],[data-cart-toggle],[class*="cart-icon"]').forEach(function(el){
      el.addEventListener('click',function(){w.sfTrack('Cart Viewed',{currency:currency});});
    });
    
    // Checkout start
    if(location.pathname.includes('/checkout')){
      w.sfTrack('Begin Checkout',{url:location.href,currency:currency});
    }
    
    // Thank you page (purchase complete)
    if(location.pathname.includes('/thank_you')||location.pathname.includes('/orders/')){
      if(w.Shopify.checkout){
        var c=w.Shopify.checkout;
        w.sfTrack('Purchase',{
          order_id:c.order_id,
          total:c.total_price/100,
          subtotal:c.subtotal_price/100,
          currency:c.currency||'USD',
          line_items:c.line_items?c.line_items.map(function(i){
            return{product_id:i.product_id,variant_id:i.variant_id,quantity:i.quantity,price:i.price/100}
          }):[]
        });
        if(c.email){w.sfIdentify(c.email,{first_name:c.billing_address?c.billing_address.first_name:'',last_name:c.billing_address?c.billing_address.last_name:''})}
      }
    }
  }
  
  // === POPUP/FORM TRACKING ===
  // Klaviyo
  if(w._klOnsite){
    try{
      w._klOnsite.push(['openForm',function(){w.sfTrack('Form Viewed',{form_type:'popup',provider:'klaviyo'})}]);
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
          // Save the working key
          if (currentWorkspace?.id) {
            localStorage.setItem(`sf_api_key_${currentWorkspace.id}`, keyToVerify);
            setStoredApiKey(keyToVerify);
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
                if (currentWorkspace?.id && e.target.value.startsWith('sf_pk_')) {
                  localStorage.setItem(`sf_api_key_${currentWorkspace.id}`, e.target.value);
                  setStoredApiKey(e.target.value);
                }
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
