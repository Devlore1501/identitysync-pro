import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, 
  Key, 
  Settings, 
  Trash2, 
  Plus, 
  Edit,
  User,
  Globe,
  Zap,
  Clock
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

const actionIcons: Record<string, React.ReactNode> = {
  'create': <Plus className="w-4 h-4 text-green-500" />,
  'update': <Edit className="w-4 h-4 text-blue-500" />,
  'delete': <Trash2 className="w-4 h-4 text-red-500" />,
  'login': <User className="w-4 h-4 text-purple-500" />,
  'revoke': <Shield className="w-4 h-4 text-orange-500" />,
};

const resourceIcons: Record<string, React.ReactNode> = {
  'api_key': <Key className="w-4 h-4" />,
  'workspace': <Globe className="w-4 h-4" />,
  'destination': <Zap className="w-4 h-4" />,
  'settings': <Settings className="w-4 h-4" />,
  'user': <User className="w-4 h-4" />,
};

const actionLabels: Record<string, string> = {
  'create': 'Created',
  'update': 'Updated',
  'delete': 'Deleted',
  'login': 'Logged in',
  'revoke': 'Revoked',
};

const resourceLabels: Record<string, string> = {
  'api_key': 'API Key',
  'workspace': 'Workspace',
  'destination': 'Destination',
  'settings': 'Settings',
  'user': 'User',
};

const AuditLogs = () => {
  const [resourceFilter, setResourceFilter] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  
  const { data: logs = [], isLoading } = useAuditLogs({
    limit: 100,
    resourceType: resourceFilter,
    action: actionFilter,
  });

  const formatDetails = (details: Record<string, unknown>): string => {
    if (!details || Object.keys(details).length === 0) return '-';
    
    const entries = Object.entries(details)
      .filter(([key]) => !key.startsWith('_'))
      .slice(0, 3);
    
    return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground">Track all activity in your account</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select 
            value={resourceFilter || "all"} 
            onValueChange={(v) => setResourceFilter(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All resources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resources</SelectItem>
              <SelectItem value="api_key">API Keys</SelectItem>
              <SelectItem value="workspace">Workspaces</SelectItem>
              <SelectItem value="destination">Destinations</SelectItem>
              <SelectItem value="user">Users</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={actionFilter || "all"} 
            onValueChange={(v) => setActionFilter(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="create">Created</SelectItem>
              <SelectItem value="update">Updated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
              <SelectItem value="revoke">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs Table */}
        <div className="metric-card p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Activity Yet</h3>
              <p className="text-muted-foreground">
                Actions like creating API keys, configuring destinations, and updating settings will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {actionIcons[log.action] || <Edit className="w-4 h-4" />}
                        <span className="font-medium">
                          {actionLabels[log.action] || log.action}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {resourceIcons[log.resource_type] || <Settings className="w-4 h-4" />}
                        <Badge variant="outline">
                          {resourceLabels[log.resource_type] || log.resource_type}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">
                      {formatDetails(log.details)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(log.created_at), 'MMM d, HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogs;
