import { useState } from "react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code } from "lucide-react";
import { toast } from "sonner";

interface TrackingSnippetProps {
  apiKey?: string;
}

export function TrackingSnippet({ apiKey: providedApiKey }: TrackingSnippetProps) {
  const { apiKeys } = useApiKeys();
  const [copied, setCopied] = useState(false);
  
  const apiKey = providedApiKey || apiKeys[0]?.key_prefix || 'YOUR_API_KEY';
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
  
})(window,document,'script','sf','${apiKey.replace('...', '[YOUR_FULL_KEY]')}');
</script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
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
      
      <div className="bg-muted/50 rounded-lg p-4 overflow-x-auto">
        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
          {snippet}
        </pre>
      </div>

      <div className="space-y-3 text-sm">
        <p className="font-medium">Installation:</p>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Replace <code className="bg-muted px-1 rounded">[YOUR_FULL_KEY]</code> with your actual API key</li>
          <li>Add this snippet to your website's <code className="bg-muted px-1 rounded">&lt;head&gt;</code> tag</li>
          <li>Page views are tracked automatically</li>
        </ol>

        <p className="font-medium mt-4">Usage:</p>
        <div className="space-y-2">
          <div>
            <code className="text-xs bg-muted px-2 py-1 rounded block">
              sfTrack('View Item', {"{"} product_id: 'SKU123', price: 29.99 {"}"});
            </code>
            <span className="text-xs text-muted-foreground">Track custom events</span>
          </div>
          <div>
            <code className="text-xs bg-muted px-2 py-1 rounded block">
              sfIdentify('user@example.com', {"{"} name: 'John Doe' {"}"});
            </code>
            <span className="text-xs text-muted-foreground">Identify users after login/signup</span>
          </div>
        </div>
      </div>
    </div>
  );
}
