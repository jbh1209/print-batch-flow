import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Mail, 
  RefreshCw, 
  Ban, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search,
  Download,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProofLink {
  id: string;
  token: string;
  job_id: string;
  stage_instance_id: string;
  created_at: string;
  expires_at: string;
  is_used: boolean;
  client_response: string | null;
  client_notes: string | null;
  responded_at: string | null;
  viewed_at: string | null;
  resend_count: number;
  invalidated_at: string | null;
  proof_pdf_url?: string;
  production_jobs: {
    wo_no: string;
    customer: string | null;
    contact: string | null;
  };
  job_stage_instances: {
    production_stages: {
      name: string;
    };
  };
}

export const ProofLinkManagement = () => {
  const [proofLinks, setProofLinks] = useState<ProofLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const fetchProofLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-proof-approval/list-proof-links', {
        body: {
          status: statusFilter === 'all' ? null : statusFilter,
          searchTerm: searchTerm || null
        }
      });

      if (error) throw error;
      setProofLinks(data.proofLinks || []);
    } catch (error) {
      console.error('Error fetching proof links:', error);
      toast.error('Failed to load proof links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProofLinks();
  }, [statusFilter]);

  const handleResendEmail = async (proofLinkId: string) => {
    setIsProcessing(proofLinkId);
    try {
      const { error } = await supabase.functions.invoke('handle-proof-approval/resend-email', {
        body: { proofLinkId }
      });

      if (error) throw error;
      toast.success('Email resent successfully');
      fetchProofLinks();
    } catch (error) {
      console.error('Error resending email:', error);
      toast.error('Failed to resend email');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRegenerateLink = async (stageInstanceId: string) => {
    setIsProcessing(stageInstanceId);
    try {
      const { data, error } = await supabase.functions.invoke('handle-proof-approval/regenerate-link', {
        body: { stageInstanceId }
      });

      if (error) throw error;
      toast.success('New link generated and emailed to client');
      fetchProofLinks();
    } catch (error) {
      console.error('Error regenerating link:', error);
      toast.error('Failed to regenerate link');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleInvalidateLink = async (token: string) => {
    if (!confirm('Are you sure you want to invalidate this proof link?')) return;
    
    setIsProcessing(token);
    try {
      const { error } = await supabase.functions.invoke('handle-proof-approval/invalidate-link', {
        body: { token }
      });

      if (error) throw error;
      toast.success('Link invalidated successfully');
      fetchProofLinks();
    } catch (error) {
      console.error('Error invalidating link:', error);
      toast.error('Failed to invalidate link');
    } finally {
      setIsProcessing(null);
    }
  };

  const getStatusBadge = (link: ProofLink) => {
    const now = new Date();
    const expires = new Date(link.expires_at);
    
    if (link.invalidated_at) {
      return <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> Invalidated</Badge>;
    }
    if (link.client_response === 'approved') {
      return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Approved</Badge>;
    }
    if (link.client_response === 'changes_needed') {
      return <Badge variant="default" className="gap-1 bg-orange-600"><XCircle className="h-3 w-3" /> Changes Requested</Badge>;
    }
    if (link.is_used) {
      return <Badge variant="secondary">Used</Badge>;
    }
    if (expires < now) {
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Expired</Badge>;
    }
    if (link.viewed_at) {
      return <Badge variant="default" className="gap-1 bg-blue-600">Viewed - Pending</Badge>;
    }
    return <Badge variant="default" className="gap-1 bg-amber-600"><Clock className="h-3 w-3" /> Awaiting Response</Badge>;
  };

  const canResend = (link: ProofLink) => {
    return !link.is_used && !link.invalidated_at && new Date(link.expires_at) > new Date();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Proof Link Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by WO #, client name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchProofLinks()}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="w-48">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="changes_requested">Changes Requested</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={fetchProofLinks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Resend Count</TableHead>
                <TableHead>Response</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading proof links...
                  </TableCell>
                </TableRow>
              ) : proofLinks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No proof links found
                  </TableCell>
                </TableRow>
              ) : (
                proofLinks.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-mono font-semibold">
                      {link.production_jobs.wo_no}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{link.production_jobs.customer || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{link.production_jobs.contact}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(link)}</TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(link.expires_at) > new Date() ? (
                        formatDistanceToNow(new Date(link.expires_at), { addSuffix: true })
                      ) : (
                        <span className="text-red-600">Expired</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.resend_count > 0 && (
                        <Badge variant="outline">{link.resend_count}x</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.client_notes && (
                        <div className="text-xs max-w-xs truncate" title={link.client_notes}>
                          {link.client_notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canResend(link) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResendEmail(link.id)}
                              disabled={isProcessing === link.id}
                            >
                              <Mail className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRegenerateLink(link.stage_instance_id)}
                              disabled={isProcessing === link.stage_instance_id}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInvalidateLink(link.token)}
                              disabled={isProcessing === link.token}
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`https://printstream.impressweb.co.za/proof/${link.token}`, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};