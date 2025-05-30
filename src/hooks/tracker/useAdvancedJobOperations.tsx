import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkUpdateData {
  status?: string;
  category_id?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
}

interface BatchAssignmentData {
  batch_name: string;
  batch_type: string;
  job_ids: string[];
}

export const useAdvancedJobOperations = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Bulk update multiple jobs
  const bulkUpdateJobs = useCallback(async (jobIds: string[], updateData: BulkUpdateData) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Bulk updating jobs...', { jobIds, updateData });
      
      const { error } = await supabase
        .from('production_jobs')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .in('id', jobIds);

      if (error) throw error;

      toast.success(`Successfully updated ${jobIds.length} jobs`);
      return true;
    } catch (err) {
      console.error('❌ Error bulk updating jobs:', err);
      toast.error('Failed to update jobs');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Assign jobs to batch
  const assignJobsToBatch = useCallback(async (data: BatchAssignmentData) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Assigning jobs to batch...', data);
      
      // Create new batch entry (simplified - could be enhanced with actual batch system)
      const batchData = {
        name: data.batch_name,
        type: data.batch_type,
        job_count: data.job_ids.length,
        created_at: new Date().toISOString()
      };

      // Update jobs with batch reference
      const { error } = await supabase
        .from('production_jobs')
        .update({
          // For now, store batch info in a JSON field or reference field
          reference: `Batch: ${data.batch_name}`,
          updated_at: new Date().toISOString()
        })
        .in('id', data.job_ids);

      if (error) throw error;

      toast.success(`Successfully assigned ${data.job_ids.length} jobs to batch "${data.batch_name}"`);
      return true;
    } catch (err) {
      console.error('❌ Error assigning jobs to batch:', err);
      toast.error('Failed to assign jobs to batch');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Duplicate jobs
  const duplicateJobs = useCallback(async (jobIds: string[]) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Duplicating jobs...', jobIds);
      
      // Fetch original jobs
      const { data: originalJobs, error: fetchError } = await supabase
        .from('production_jobs')
        .select('*')
        .in('id', jobIds);

      if (fetchError) throw fetchError;

      // Create duplicated jobs
      const duplicatedJobs = originalJobs?.map(job => ({
        ...job,
        id: undefined, // Let database generate new ID
        wo_no: `${job.wo_no}-COPY-${Date.now()}`,
        status: 'queued',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        qr_code_data: null,
        qr_code_url: null
      }));

      const { error: insertError } = await supabase
        .from('production_jobs')
        .insert(duplicatedJobs || []);

      if (insertError) throw insertError;

      toast.success(`Successfully duplicated ${jobIds.length} jobs`);
      return true;
    } catch (err) {
      console.error('❌ Error duplicating jobs:', err);
      toast.error('Failed to duplicate jobs');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Archive completed jobs
  const archiveJobs = useCallback(async (jobIds: string[]) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Archiving jobs...', jobIds);
      
      const { error } = await supabase
        .from('production_jobs')
        .update({
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .in('id', jobIds);

      if (error) throw error;

      toast.success(`Successfully archived ${jobIds.length} jobs`);
      return true;
    } catch (err) {
      console.error('❌ Error archiving jobs:', err);
      toast.error('Failed to archive jobs');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Export jobs data
  const exportJobs = useCallback(async (jobIds: string[]) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Exporting jobs...', jobIds);
      
      const { data: jobs, error } = await supabase
        .from('production_jobs')
        .select(`
          *,
          category:categories(name, color)
        `)
        .in('id', jobIds);

      if (error) throw error;

      // Create CSV content
      const csvHeaders = [
        'WO Number', 'Customer', 'Category', 'Status', 'Due Date', 
        'Created Date', 'Reference'
      ];
      
      const csvRows = jobs?.map(job => [
        job.wo_no,
        job.customer || '',
        job.category?.name || '',
        job.status,
        job.due_date || '',
        new Date(job.created_at).toLocaleDateString(),
        job.reference || ''
      ]);

      const csvContent = [csvHeaders, ...(csvRows || [])].map(row => 
        row.map(field => `"${field}"`).join(',')
      ).join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jobs-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${jobIds.length} jobs`);
      return true;
    } catch (err) {
      console.error('❌ Error exporting jobs:', err);
      toast.error('Failed to export jobs');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Sync job data from external source
  const syncJobData = useCallback(async (jobId: string, externalData: any) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Syncing job data...', { jobId, externalData });
      
      const syncedData = {
        customer: externalData.customer,
        reference: externalData.reference,
        due_date: externalData.due_date,
        qty: externalData.quantity,
        location: externalData.location,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('production_jobs')
        .update(syncedData)
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job data synchronized successfully');
      return true;
    } catch (err) {
      console.error('❌ Error syncing job data:', err);
      toast.error('Failed to sync job data');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    isProcessing,
    bulkUpdateJobs,
    assignJobsToBatch,
    duplicateJobs,
    archiveJobs,
    exportJobs,
    syncJobData
  };
};
