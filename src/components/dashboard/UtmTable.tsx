import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Trash2, Search, BarChart3, ArrowUpDown } from "lucide-react";
import { useUtmCampaigns, useDeleteUtmCampaign, UtmCampaign } from "@/hooks/useUtmCampaigns";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SortField = 'created_at' | 'events_count' | 'conversions_count' | 'revenue_attributed';
type SortOrder = 'asc' | 'desc';

export function UtmTable() {
  const { data: campaigns, isLoading } = useUtmCampaigns();
  const deleteMutation = useDeleteUtmCampaign();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success('URL copiato negli appunti');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredCampaigns = campaigns
    ?.filter((c) => {
      const searchLower = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(searchLower) ||
        c.utm_source.toLowerCase().includes(searchLower) ||
        c.utm_medium.toLowerCase().includes(searchLower) ||
        c.utm_campaign.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortOrder === 'asc' ? 1 : -1;
      
      if (sortField === 'created_at') {
        return modifier * (new Date(aVal as string).getTime() - new Date(bVal as string).getTime());
      }
      return modifier * ((aVal as number) - (bVal as number));
    });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Performance Campagne UTM
              </CardTitle>
              <CardDescription>
                Monitora le performance dei tuoi link tracciati
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca campagne..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredCampaigns?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? 'Nessuna campagna trovata' : 'Nessuna campagna UTM creata'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Source / Medium / Campaign</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('events_count')}
                      >
                        Eventi
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('conversions_count')}
                      >
                        Conversioni
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('revenue_attributed')}
                      >
                        Revenue
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('created_at')}
                      >
                        Data
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns?.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {campaign.utm_source}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {campaign.utm_medium}
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-primary/5">
                            {campaign.utm_campaign}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{campaign.events_count.toLocaleString()}</TableCell>
                      <TableCell>{campaign.conversions_count.toLocaleString()}</TableCell>
                      <TableCell>{formatCurrency(campaign.revenue_attributed)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(campaign.created_at), 'dd MMM yyyy', { locale: it })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(campaign.full_url)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa campagna?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. I dati statistici verranno persi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
