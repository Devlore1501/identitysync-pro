import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export interface UtmCampaign {
  id: string;
  workspace_id: string;
  name: string;
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string | null;
  utm_term: string | null;
  full_url: string;
  short_code: string | null;
  clicks_count: number;
  events_count: number;
  conversions_count: number;
  revenue_attributed: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUtmCampaignInput {
  name: string;
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
}

function buildFullUrl(baseUrl: string, params: Omit<CreateUtmCampaignInput, 'name' | 'base_url'>): string {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', params.utm_source);
  url.searchParams.set('utm_medium', params.utm_medium);
  url.searchParams.set('utm_campaign', params.utm_campaign);
  if (params.utm_content) url.searchParams.set('utm_content', params.utm_content);
  if (params.utm_term) url.searchParams.set('utm_term', params.utm_term);
  return url.toString();
}

export function useUtmCampaigns() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  return useQuery({
    queryKey: ['utm-campaigns', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      const { data, error } = await supabase
        .from('utm_campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UtmCampaign[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateUtmCampaign() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  return useMutation({
    mutationFn: async (input: CreateUtmCampaignInput) => {
      if (!workspaceId) throw new Error('No workspace selected');

      const fullUrl = buildFullUrl(input.base_url, {
        utm_source: input.utm_source,
        utm_medium: input.utm_medium,
        utm_campaign: input.utm_campaign,
        utm_content: input.utm_content,
        utm_term: input.utm_term,
      });

      const { data, error } = await supabase
        .from('utm_campaigns')
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          base_url: input.base_url,
          utm_source: input.utm_source,
          utm_medium: input.utm_medium,
          utm_campaign: input.utm_campaign,
          utm_content: input.utm_content || null,
          utm_term: input.utm_term || null,
          full_url: fullUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utm-campaigns', workspaceId] });
      toast.success('Campagna UTM creata con successo');
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });
}

export function useDeleteUtmCampaign() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('utm_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utm-campaigns', workspaceId] });
      toast.success('Campagna UTM eliminata');
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });
}
