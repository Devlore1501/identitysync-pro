import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface Workspace {
  id: string;
  account_id: string;
  name: string;
  domain: string | null;
  platform: string | null;
  timezone: string;
  settings: Json;
  created_at: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = async () => {
    if (!profile?.account_id) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('account_id', profile.account_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching workspaces:', error);
      setLoading(false);
      return;
    }

    setWorkspaces(data || []);
    
    // Set first workspace as current if none selected
    if (data && data.length > 0 && !currentWorkspace) {
      const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
      const savedWorkspace = data.find(w => w.id === savedWorkspaceId);
      setCurrentWorkspace(savedWorkspace || data[0]);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [profile?.account_id]);

  const handleSetCurrentWorkspace = (workspace: Workspace) => {
    if (workspace.id === currentWorkspace?.id) return;
    
    setCurrentWorkspace(workspace);
    localStorage.setItem('currentWorkspaceId', workspace.id);
    
    // Invalida TUTTE le queries per forzare refresh con nuovo workspace
    queryClient.invalidateQueries();
    toast.info(`Caricamento dati ${workspace.name}...`);
  };

  return (
    <WorkspaceContext.Provider 
      value={{ 
        workspaces, 
        currentWorkspace, 
        setCurrentWorkspace: handleSetCurrentWorkspace, 
        loading,
        refetch: fetchWorkspaces 
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
