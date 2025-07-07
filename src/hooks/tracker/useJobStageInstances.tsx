
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface JobStageInstance {
  id: string;
  job_id: string;
  job_table_name: string;
  category_id: string | null;
  production_stage_id: string;
  stage_order: number;
  status: 'pending' | 'active' | 'completed' | 'reworked';
  started_at: string | null;
  completed_at: string | null;
  started_by: string | null;
  completed_by: string | null;
  notes: string | null;
  part_name: string | null;
  
  printer_id: string | null;
  qr_scan_data: any;
  rework_count: number | null;
  rework_reason: string | null;
  previous_stage_id: string | null;
  is_rework: boolean | null;
  proof_emailed_at: string | null;
  proof_approved_manually_at: string | null;
  client_email: string | null;
  client_name: string | null;
  proof_pdf_url: string | null;
  created_at: string;
  updated_at: string;
  production_stage: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
}

export const useJobStageInstances = (jobId?: string, jobTableName?: string) => {
  const [jobStages, setJobStages] = useState<JobStageInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobStages = useCallback(async () => {
    if (!jobId || !jobTableName) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching job stage instances...');

      const { data, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select(`
          *,
          production_stage:production_stages(
            id,
            name,
            color,
            description
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .order('stage_order');

      if (fetchError) {
        console.error('❌ Job stage instances fetch error:', fetchError);
        throw new Error(`Failed to fetch job stage instances: ${fetchError.message}`);
      }

      console.log('✅ Job stage instances fetched successfully:', data?.length || 0);
      
      // Type-safe mapping to ensure status is correctly typed
      const typedData: JobStageInstance[] = (data || []).map(item => ({
        ...item,
        status: item.status as 'pending' | 'active' | 'completed' | 'reworked',
        production_stage: item.production_stage as {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
        }
      }));
      
      setJobStages(typedData);
    } catch (err) {
      console.error('❌ Error fetching job stage instances:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load job stage instances";
      setError(errorMessage);
      toast.error("Failed to load job stage instances");
    } finally {
      setIsLoading(false);
    }
  }, [jobId, jobTableName]);

  const initializeJobStages = useCallback(async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      console.log('🔄 Initializing job stages (all pending)...');
      
      // Use the corrected function that doesn't auto-activate stages
      const { data, error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Job stage initialization error:', error);
        throw new Error(`Failed to initialize job stages: ${error.message}`);
      }

      console.log('✅ Job stages initialized successfully (all pending)');
      await fetchJobStages();
      return true;
    } catch (err) {
      console.error('❌ Error initializing job stages:', err);
      toast.error("Failed to initialize job stages");
      return false;
    }
  }, [fetchJobStages]);

  const advanceJobStage = useCallback(async (currentStageId: string, notes?: string) => {
    if (!jobId || !jobTableName) return false;

    try {
      console.log('🔄 Advancing job stage...');
      
      const { data, error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_current_stage_id: currentStageId,
        p_notes: notes || null
      });

      if (error) {
        console.error('❌ Job stage advancement error:', error);
        throw new Error(`Failed to advance job stage: ${error.message}`);
      }

      if (!data) {
        throw new Error('Stage advancement failed - stage may not be active');
      }

      console.log('✅ Job stage advanced successfully');
      toast.success("Job stage advanced successfully");
      await fetchJobStages();
      return true;
    } catch (err) {
      console.error('❌ Error advancing job stage:', err);
      toast.error("Failed to advance job stage");
      return false;
    }
  }, [jobId, jobTableName, fetchJobStages]);

  const updateStageNotes = useCallback(async (stageId: string, notes: string) => {
    try {
      console.log('🔄 Updating stage notes...');
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId);

      if (error) {
        console.error('❌ Stage notes update error:', error);
        throw new Error(`Failed to update stage notes: ${error.message}`);
      }

      console.log('✅ Stage notes updated successfully');
      toast.success("Stage notes updated successfully");
      await fetchJobStages();
      return true;
    } catch (err) {
      console.error('❌ Error updating stage notes:', err);
      toast.error("Failed to update stage notes");
      return false;
    }
  }, [fetchJobStages]);

  const recordQRScan = useCallback(async (stageId: string, qrData: any) => {
    try {
      console.log('🔄 Recording QR scan...');
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          qr_scan_data: qrData,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId);

      if (error) {
        console.error('❌ QR scan recording error:', error);
        throw new Error(`Failed to record QR scan: ${error.message}`);
      }

      console.log('✅ QR scan recorded successfully');
      await fetchJobStages();
      return true;
    } catch (err) {
      console.error('❌ Error recording QR scan:', err);
      toast.error("Failed to record QR scan");
      return false;
    }
  }, [fetchJobStages]);

  // Only fetch on mount if both jobId and jobTableName are provided
  useEffect(() => {
    if (jobId && jobTableName) {
      fetchJobStages();
    }
  }, [jobId, jobTableName, fetchJobStages]);

  return {
    jobStages,
    isLoading,
    error,
    fetchJobStages,
    initializeJobStages,
    advanceJobStage,
    updateStageNotes,
    recordQRScan
  };
};
