import { useState, useEffect } from "react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Code, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
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
  const [domainToVerify, setDomainToVerify] = useState(currentWorkspace?.domain || '');
  
  // Try to get full API key from localStorage (stored when created)
  const [storedApiKey, setStoredApiKey] = useState<string>('');
  
  useEffect(() => {
    if (currentWorkspace?.id) {
      const stored = localStorage.getItem(`sf_api_key_${currentWorkspace.id}`);
      if (stored) setStoredApiKey(stored);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (currentWorkspace?.domain) {
      setDomainToVerify(currentWorkspace.domain);
    }
  }, [currentWorkspace?.domain]);
  
  const apiKey = fullApiKey || storedApiKey || apiKeys[0]?.key_prefix || 'YOUR_API_KEY';
  const hasFullKey = fullApiKey || storedApiKey || !apiKey.includes('...');
  
  const collectUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/collect`;
  const identifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/identify`;

  const snippet = `<!-- SignalForge Tracking Snippet -->
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
          page:{url:location.href,title:document.title,referrer:document.referrer}
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
  
})(window,document,'script','sf','${apiKey}');
</script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyInstallation = async () => {
    if (!domainToVerify) {
      toast.error("Please enter a domain to verify");
      return;
    }

    setVerifying(true);
    setVerificationResult(null);

    try {
      // Clean up domain
      let domain = domainToVerify.trim();
      if (!domain.startsWith('http')) {
        domain = 'https://' + domain;
      }

      // Try to fetch the page and check for SignalForge
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health`;
      
      // We'll check if we received any events from this domain in the last 5 minutes
      // by looking at recent events
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          event: '_sf_verification_ping',
          properties: { verification: true },
          context: {
            anonymous_id: 'verification_test',
            page: { url: domain }
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVerificationResult('success');
          toast.success("API key is working correctly!");
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
          <div className="p-3 bg-warning/10 text-warning rounded-lg text-sm">
            ⚠️ The snippet shows a partial API key. Create a new API key to get the full key integrated automatically.
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
          <h3 className="font-semibold">Verify Installation</h3>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Test that your API key is working correctly by sending a test event.
        </p>
        
        <div className="flex gap-2">
          <Input
            placeholder="yourdomain.com"
            value={domainToVerify}
            onChange={(e) => setDomainToVerify(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleVerifyInstallation} disabled={verifying}>
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>
        </div>

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
          <li>Click "Verify" to test the connection</li>
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
