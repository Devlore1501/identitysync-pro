import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Globe, 
  Trash2, 
  Loader2, 
  AlertTriangle,
  Check,
  Settings
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { canAddWorkspace, getPlanLimits, getPlanById } from "@/lib/plans";
import { toast } from "sonner";

interface WorkspaceManagerProps {
  onWorkspaceChange?: () => void;
}

export function WorkspaceManager({ onWorkspaceChange }: WorkspaceManagerProps) {
  const { workspaces, currentWorkspace, setCurrentWorkspace, refetch } = useWorkspace();
  const { profile } = useAuth();
  
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    domain: "",
    platform: "shopify",
  });

  // Get account plan (default to 'starter' if not set)
  const accountPlan = "starter"; // In production, fetch from accounts table
  const limits = getPlanLimits(accountPlan);
  const planConfig = getPlanById(accountPlan);
  const canAdd = canAddWorkspace(accountPlan, workspaces.length);

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name.trim()) {
      toast.error("Inserisci un nome per il workspace");
      return;
    }

    if (!canAdd) {
      toast.error(`Il tuo piano ${planConfig?.name} permette solo ${limits.workspaces} sito/i`);
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from("workspaces")
        .insert({
          account_id: profile?.account_id!,
          name: newWorkspace.name,
          domain: newWorkspace.domain || null,
          platform: newWorkspace.platform || null,
        });

      if (error) throw error;

      await refetch();
      setDialogOpen(false);
      setNewWorkspace({ name: "", domain: "", platform: "shopify" });
      toast.success("Workspace creato con successo!");
      onWorkspaceChange?.();
    } catch (error) {
      toast.error("Errore nella creazione del workspace");
      console.error(error);
    }
    setIsCreating(false);
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (workspaces.length <= 1) {
      toast.error("Non puoi eliminare l'ultimo workspace");
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("workspaces")
        .delete()
        .eq("id", workspaceId);

      if (error) throw error;

      // If deleting current workspace, switch to another
      if (currentWorkspace?.id === workspaceId) {
        const remaining = workspaces.find(w => w.id !== workspaceId);
        if (remaining) setCurrentWorkspace(remaining);
      }

      await refetch();
      toast.success("Workspace eliminato");
      onWorkspaceChange?.();
    } catch (error) {
      toast.error("Errore nell'eliminazione del workspace");
      console.error(error);
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with limits */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">I Tuoi Siti</h3>
          <p className="text-sm text-muted-foreground">
            {workspaces.length} di {limits.workspaces === -1 ? "∞" : limits.workspaces} siti utilizzati
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi Sito
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi Nuovo Sito</DialogTitle>
              <DialogDescription>
                Configura un nuovo workspace per tracciare un altro sito.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome</label>
                <Input
                  placeholder="Il Mio Secondo Store"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Dominio</label>
                <Input
                  placeholder="www.miosecondosito.com"
                  value={newWorkspace.domain}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, domain: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Piattaforma</label>
                <Select 
                  value={newWorkspace.platform} 
                  onValueChange={(value) => setNewWorkspace({ ...newWorkspace, platform: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona piattaforma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shopify">Shopify</SelectItem>
                    <SelectItem value="woocommerce">WooCommerce</SelectItem>
                    <SelectItem value="magento">Magento</SelectItem>
                    <SelectItem value="prestashop">PrestaShop</SelectItem>
                    <SelectItem value="custom">Altro / Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleCreateWorkspace} disabled={isCreating}>
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crea Workspace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Upgrade prompt if at limit */}
      {!canAdd && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium">Limite siti raggiunto</p>
            <p className="text-sm text-muted-foreground">
              Passa a un piano superiore per aggiungere più siti.
            </p>
            <Button variant="link" className="h-auto p-0 mt-1" asChild>
              <a href="/pricing">Vedi piani →</a>
            </Button>
          </div>
        </div>
      )}

      {/* Workspace list */}
      <div className="space-y-3">
        {workspaces.map((workspace) => {
          const isActive = currentWorkspace?.id === workspace.id;
          
          return (
            <div
              key={workspace.id}
              className={`p-4 rounded-lg border transition-colors ${
                isActive 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => setCurrentWorkspace(workspace)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{workspace.name}</span>
                      {isActive && (
                        <Badge variant="default" className="text-xs">Attivo</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {workspace.domain || "Nessun dominio"}
                      {workspace.platform && (
                        <span className="ml-2 text-xs">• {workspace.platform}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isActive && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setCurrentWorkspace(workspace)}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Seleziona
                    </Button>
                  )}
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={workspaces.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Elimina Workspace</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare "{workspace.name}"? Questa azione è irreversibile
                          e tutti i dati associati verranno persi.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteWorkspace(workspace.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Elimina"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
