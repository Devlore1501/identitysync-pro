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
