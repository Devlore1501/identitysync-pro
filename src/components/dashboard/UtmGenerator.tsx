import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, Link, Plus } from "lucide-react";
import { useCreateUtmCampaign, CreateUtmCampaignInput } from "@/hooks/useUtmCampaigns";
import { toast } from "sonner";

const SOURCES = [
  { value: 'google', label: 'Google' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'email', label: 'Email' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'affiliate', label: 'Affiliate' },
];

const MEDIUMS = [
  { value: 'cpc', label: 'CPC (Pay-per-click)' },
  { value: 'cpm', label: 'CPM (Pay-per-impression)' },
  { value: 'social', label: 'Social' },
  { value: 'email', label: 'Email' },
  { value: 'referral', label: 'Referral' },
  { value: 'organic', label: 'Organic' },
  { value: 'display', label: 'Display' },
  { value: 'video', label: 'Video' },
  { value: 'affiliate', label: 'Affiliate' },
];

export function UtmGenerator() {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [source, setSource] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [medium, setMedium] = useState('');
  const [customMedium, setCustomMedium] = useState('');
  const [campaign, setCampaign] = useState('');
  const [content, setContent] = useState('');
  const [term, setTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const createMutation = useCreateUtmCampaign();

  const effectiveSource = source === 'custom' ? customSource : source;
  const effectiveMedium = medium === 'custom' ? customMedium : medium;

  const generatedUrl = useMemo(() => {
    if (!baseUrl || !effectiveSource || !effectiveMedium || !campaign) return '';
    
    try {
      const url = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
      url.searchParams.set('utm_source', effectiveSource);
      url.searchParams.set('utm_medium', effectiveMedium);
      url.searchParams.set('utm_campaign', campaign);
      if (content) url.searchParams.set('utm_content', content);
      if (term) url.searchParams.set('utm_term', term);
      return url.toString();
    } catch {
      return '';
    }
  }, [baseUrl, effectiveSource, effectiveMedium, campaign, content, term]);

  const isValid = name && baseUrl && effectiveSource && effectiveMedium && campaign;

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success('URL copiato negli appunti');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!isValid) return;
    
    const input: CreateUtmCampaignInput = {
      name,
      base_url: baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`,
      utm_source: effectiveSource,
      utm_medium: effectiveMedium,
      utm_campaign: campaign,
      utm_content: content || undefined,
      utm_term: term || undefined,
    };

    createMutation.mutate(input, {
      onSuccess: () => {
        // Reset form
        setName('');
        setBaseUrl('');
        setSource('');
        setCustomSource('');
        setMedium('');
        setCustomMedium('');
        setCampaign('');
        setContent('');
        setTerm('');
      },
    });
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="h-5 w-5 text-primary" />
          Generatore UTM
        </CardTitle>
        <CardDescription>
          Crea link tracciabili per le tue campagne marketing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Nome Campagna */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome Campagna *</Label>
            <Input
              id="name"
              placeholder="Es: Black Friday 2024"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* URL Base */}
          <div className="space-y-2">
            <Label htmlFor="base-url">URL Base *</Label>
            <Input
              id="base-url"
              placeholder="https://tuosito.com/prodotto"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Source (utm_source) *</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona sorgente" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
                <SelectItem value="custom">Personalizzato...</SelectItem>
              </SelectContent>
            </Select>
            {source === 'custom' && (
              <Input
                placeholder="Inserisci sorgente personalizzata"
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Medium */}
          <div className="space-y-2">
            <Label>Medium (utm_medium) *</Label>
            <Select value={medium} onValueChange={setMedium}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona mezzo" />
              </SelectTrigger>
              <SelectContent>
                {MEDIUMS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
                <SelectItem value="custom">Personalizzato...</SelectItem>
              </SelectContent>
            </Select>
            {medium === 'custom' && (
              <Input
                placeholder="Inserisci mezzo personalizzato"
                value={customMedium}
                onChange={(e) => setCustomMedium(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Campaign */}
          <div className="space-y-2">
            <Label htmlFor="campaign">Campaign (utm_campaign) *</Label>
            <Input
              id="campaign"
              placeholder="Es: black-friday-2024"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            />
          </div>

          {/* Content (opzionale) */}
          <div className="space-y-2">
            <Label htmlFor="content">Content (utm_content) - opzionale</Label>
            <Input
              id="content"
              placeholder="Es: banner-top, cta-button"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Term (opzionale) */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="term">Term (utm_term) - opzionale</Label>
            <Input
              id="term"
              placeholder="Es: scarpe+running (per keyword ads)"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Preview URL */}
        {generatedUrl && (
          <div className="space-y-2 pt-4 border-t border-border/50">
            <Label>URL Generato</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={generatedUrl}
                className="font-mono text-sm bg-muted/50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={!isValid || createMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            {createMutation.isPending ? 'Salvataggio...' : 'Salva Campagna'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
