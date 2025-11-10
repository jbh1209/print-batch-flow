import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AutoApprovedJob {
  id: string; // stage instance id
  job_id: string;
  wo_no: string;
  customer: string;
  reference?: string;
  stage_name: string;
  proof_approved_manually_at: string;
  client_name?: string;
  client_email?: string;
  print_files_sent_to_printer_at?: string;
  print_files_sent_by?: string;
}

export const useAutoApprovedJobs = () => {
  const [jobs, setJobs] = useState<AutoApprovedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          proof_approved_manually_at,
          print_files_sent_to_printer_at,
          print_files_sent_by,
          client_name,
          client_email,
          production_stages!inner(name),
          production_jobs!inner(wo_no, customer, reference)
        `)
        .not('proof_approved_manually_at', 'is', null)
        .is('print_files_sent_to_printer_at', null)
        .ilike('production_stages.name', '%proof%')
        .order('proof_approved_manually_at', { ascending: true });

      if (fetchError) throw fetchError;

      const formattedJobs: AutoApprovedJob[] = (data || []).map((item: any) => ({
        id: item.id,
        job_id: item.job_id,
        wo_no: item.production_jobs.wo_no,
        customer: item.production_jobs.customer,
        reference: item.production_jobs.reference,
        stage_name: item.production_stages.name,
        proof_approved_manually_at: item.proof_approved_manually_at,
        client_name: item.client_name,
        client_email: item.client_email,
        print_files_sent_to_printer_at: item.print_files_sent_to_printer_at,
        print_files_sent_by: item.print_files_sent_by
      }));

      setJobs(formattedJobs);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching auto-approved jobs:', err);
      setError(err.message);
      toast.error('Failed to load auto-approved jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const markFilesSent = async (stageInstanceId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          print_files_sent_to_printer_at: new Date().toISOString(),
          print_files_sent_by: user?.id || null
        })
        .eq('id', stageInstanceId);

      if (updateError) throw updateError;

      toast.success('✅ Print files marked as sent to printer');
      await fetchJobs();
      return true;
    } catch (err: any) {
      console.error('Error marking files as sent:', err);
      toast.error('Failed to mark files as sent');
      return false;
    }
  };

  useEffect(() => {
    fetchJobs();

    // Real-time subscription for instant updates
    const channel = supabase
      .channel('auto_approved_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances',
          filter: 'proof_approved_manually_at=not.is.null'
        },
        () => {
          console.log('✅ Auto-approved jobs changed (realtime), refreshing...');
          fetchJobs();
        }
      )
      .subscribe();

    // Polling fallback - refresh every 5 minutes (300000ms)
    const pollingInterval = setInterval(() => {
      console.log('🔄 Auto-refresh: Polling auto-approved jobs...');
      fetchJobs();
    }, 300000); // 5 minutes

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, []);

  return {
    jobs,
    isLoading,
    error,
    refreshJobs: fetchJobs,
    markFilesSent,
    lastUpdated
  };
};
