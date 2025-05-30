
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobStageInstance {
  id: string;
  job_id: string;
  job_table_name: string;
  category_id: string;
  production_stage_id: string;
  stage_order: number;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  started_by?: string;
  completed_by?: string;
  notes?: string;
  qr_scan_data: any;
  production_stage: {
    id: string;
    name: string;
    color: string;
    description?: string;
  };
}

export const useJobStageInstances = (jobId?: string, jobTableName?: string) => {
  const [jobStages, setJobStages] = useState<JobStageInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobStages = async () => {
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
      setJobStages(data || []);
    } catch (err) {
      console.error('❌ Error fetching job stage instances:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load job stage instances";
      setError(errorMessage);
      toast.error("Failed to load job stage instances");
    } finally {
      setIsLoading(false);
    }
  };

  const initializeJobStages = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      console.log('🔄 Initializing job stages...');
      
      const { data, error } = await supabase.rpc('initialize_job_stages', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Job stage initialization error:', error);
        throw new Error(`Failed to initialize job stages: ${error.message}`);
      }

      console.log('✅ Job stages initialized successfully');
      await fetchJobStages();
      return true;
    } catch (err) {
      console.error('❌ Error initializing job stages:', err);
      toast.error("Failed to initialize job stages");
      return false;
    }
  };

  const advanceJobStage = async (currentStageId: string, notes?: string) => {
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
  };

  const updateStageNotes = async (stageId: string, notes: string) => {
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
  };

  const recordQRScan = async (stageId: string, qrData: any) => {
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
  };

  useEffect(() => {
    fetchJobStages();
  }, [jobId, jobTableName]);

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
