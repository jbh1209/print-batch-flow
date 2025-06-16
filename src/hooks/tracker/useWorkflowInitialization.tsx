
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractWONumber, getNextOrderInStage } from "@/utils/tracker/jobOrderingUtils";

export const useWorkflowInitialization = () => {
  const [isInitializing, setIsInitializing] = useState(false);

  const checkExistingStages = async (jobId: string, jobTableName: string): Promise<boolean> => {
    try {
      const { data: existingStages, error } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .limit(1);

      if (error) {
        console.error('Error checking existing stages:', error);
        return false;
      }

      return existingStages && existingStages.length > 0;
    } catch (error) {
      console.error('Error in checkExistingStages:', error);
      return false;
    }
  };

  // Set proper job_order_in_stage for newly created stages
  const setProperJobOrderInStage = async (jobId: string, jobTableName: string) => {
    try {
      console.log('🔧 Setting proper job_order_in_stage for job:', jobId);

      // Get the job's WO number
      const { data: job, error: jobError } = await supabase
        .from(jobTableName)
        .select('wo_no')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        console.error('Error fetching job WO number:', jobError);
        return;
      }

      const woNumber = extractWONumber(job.wo_no);
      console.log('📋 Job WO number extracted:', woNumber, 'from', job.wo_no);

      // Get all stages for this job
      const { data: jobStages, error: stagesError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (stagesError || !jobStages) {
        console.error('Error fetching job stages:', stagesError);
        return;
      }

      // For each stage, calculate the proper order based on WO number
      for (const jobStage of jobStages) {
        // Get existing jobs in this stage to determine proper order
        const { data: existingInStage, error: existingError } = await supabase
          .from('job_stage_instances')
          .select(`
            id, 
            job_order_in_stage,
            production_jobs!inner(wo_no)
          `)
          .eq('production_stage_id', jobStage.production_stage_id)
          .eq('job_table_name', jobTableName)
          .neq('id', jobStage.id);

        if (existingError) {
          console.error('Error fetching existing stages:', existingError);
          continue;
        }

        // Calculate proper order based on WO number sequence
        let properOrder = 1;
        if (existingInStage && existingInStage.length > 0) {
          // Sort existing jobs by WO number and find where this job should fit
          const sortedExisting = existingInStage
            .map(stage => ({
              ...stage,
              woNumber: extractWONumber(stage.production_jobs.wo_no)
            }))
            .sort((a, b) => a.woNumber - b.woNumber);

          // Find the position where this job should be inserted
          let insertPosition = sortedExisting.length + 1;
          for (let i = 0; i < sortedExisting.length; i++) {
            if (woNumber < sortedExisting[i].woNumber) {
              insertPosition = i + 1;
              break;
            }
          }
          properOrder = insertPosition;

          // Update existing jobs that should come after this one
          for (let i = insertPosition - 1; i < sortedExisting.length; i++) {
            const existingStage = sortedExisting[i];
            await supabase
              .from('job_stage_instances')
              .update({ job_order_in_stage: i + 2 })
              .eq('id', existingStage.id);
          }
        }

        // Update this job's order
        const { error: updateError } = await supabase
          .from('job_stage_instances')
          .update({ job_order_in_stage: properOrder })
          .eq('id', jobStage.id);

        if (updateError) {
          console.error('Error updating job order:', updateError);
        } else {
          console.log(`✅ Set job_order_in_stage to ${properOrder} for stage ${jobStage.production_stage_id}`);
        }
      }

    } catch (error) {
      console.error('Error in setProperJobOrderInStage:', error);
    }
  };

  const initializeWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      setIsInitializing(true);
      console.log('🔄 Initializing workflow - ALL STAGES WILL BE PENDING...', { jobId, jobTableName, categoryId });

      // Check if workflow already exists
      const hasExisting = await checkExistingStages(jobId, jobTableName);
      if (hasExisting) {
        console.log('⚠️ Workflow already exists for this job');
        toast.info('Workflow already exists for this job');
        return true; // Return true since the job does have a workflow
      }

      // Use the database function to initialize workflow - ALL STAGES SHOULD BE PENDING
      const { error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Database error during workflow initialization:', error);
        throw new Error(`Failed to initialize workflow: ${error.message}`);
      }

      console.log('✅ Workflow initialized successfully - SETTING PROPER JOB ORDER...');
      
      // Set proper job_order_in_stage based on WO number
      await setProperJobOrderInStage(jobId, jobTableName);
      
      // CRITICAL: Verify that no stages were auto-started
      const { data: verifyStages } = await supabase
        .from('job_stage_instances')
        .select('id, status, stage_order, production_stages(name)')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .order('stage_order', { ascending: true });
      
      if (verifyStages) {
        const activeStages = verifyStages.filter(s => s.status === 'active');
        if (activeStages.length > 0) {
          console.error(`🚨 CRITICAL BUG: Job ${jobId} has ${activeStages.length} active stages after initialization!`, activeStages);
          toast.error(`CRITICAL BUG: Auto-started ${activeStages.length} stages - this should not happen!`);
        } else {
          console.log(`✅ VERIFIED: Job ${jobId} has all ${verifyStages.length} stages in PENDING state as expected`);
        }
      }
      
      toast.success('Production workflow initialized successfully - all stages are PENDING and await operator action');
      return true;
    } catch (err) {
      console.error('❌ Error initializing workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeWorkflowWithPartAssignments = async (
    jobId: string, 
    jobTableName: string, 
    categoryId: string, 
    partAssignments?: Record<string, string>
  ) => {
    try {
      setIsInitializing(true);
      console.log('🔄 Initializing workflow with part assignments - ALL STAGES WILL BE PENDING...', { 
        jobId, 
        jobTableName, 
        categoryId, 
        partAssignments 
      });

      // Check if workflow already exists
      const hasExisting = await checkExistingStages(jobId, jobTableName);
      if (hasExisting) {
        console.log('⚠️ Workflow already exists for this job');
        toast.info('Workflow already exists for this job');
        return true; // Return true since the job does have a workflow
      }

      // Use the enhanced function for multi-part categories - ALL STAGES SHOULD BE PENDING
      const { error } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId,
        p_part_assignments: partAssignments || null
      });

      if (error) {
        console.error('❌ Database error during part-aware workflow initialization:', error);
        throw new Error(`Failed to initialize workflow with part assignments: ${error.message}`);
      }

      console.log('✅ Multi-part workflow initialized successfully - SETTING PROPER JOB ORDER...');
      
      // Set proper job_order_in_stage based on WO number
      await setProperJobOrderInStage(jobId, jobTableName);
      
      // CRITICAL: Verify that no stages were auto-started
      const { data: verifyStages } = await supabase
        .from('job_stage_instances')
        .select('id, status, stage_order, production_stages(name)')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .order('stage_order', { ascending: true });
      
      if (verifyStages) {
        const activeStages = verifyStages.filter(s => s.status === 'active');
        if (activeStages.length > 0) {
          console.error(`🚨 CRITICAL BUG: Job ${jobId} has ${activeStages.length} active stages after initialization!`, activeStages);
          toast.error(`CRITICAL BUG: Auto-started ${activeStages.length} stages - this should not happen!`);
        } else {
          console.log(`✅ VERIFIED: Job ${jobId} has all ${verifyStages.length} stages in PENDING state as expected`);
        }
      }
      
      toast.success('Multi-part workflow initialized successfully - all stages are PENDING and await operator action');
      return true;
    } catch (err) {
      console.error('❌ Error initializing multi-part workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  const repairJobWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      setIsInitializing(true);
      console.log('🔧 Repairing job workflow - ALL STAGES WILL BE PENDING...', { jobId, jobTableName, categoryId });

      // Delete any existing orphaned stages first
      const { error: deleteError } = await supabase
        .from('job_stage_instances')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (deleteError) {
        console.error('❌ Error cleaning up existing stages:', deleteError);
        // Don't throw here, just log and continue
      }

      // Initialize fresh workflow - ALL STAGES SHOULD BE PENDING
      const { error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Database error during workflow repair:', error);
        throw new Error(`Failed to repair workflow: ${error.message}`);
      }

      console.log('✅ Job workflow repaired successfully - SETTING PROPER JOB ORDER...');
      
      // Set proper job_order_in_stage based on WO number
      await setProperJobOrderInStage(jobId, jobTableName);
      
      // CRITICAL: Verify that no stages were auto-started
      const { data: verifyStages } = await supabase
        .from('job_stage_instances')
        .select('id, status, stage_order, production_stages(name)')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .order('stage_order', { ascending: true });
      
      if (verifyStages) {
        const activeStages = verifyStages.filter(s => s.status === 'active');
        if (activeStages.length > 0) {
          console.error(`🚨 CRITICAL BUG: Job ${jobId} has ${activeStages.length} active stages after repair!`, activeStages);
          toast.error(`CRITICAL BUG: Auto-started ${activeStages.length} stages during repair - this should not happen!`);
        } else {
          console.log(`✅ VERIFIED: Job ${jobId} has all ${verifyStages.length} stages in PENDING state after repair`);
        }
      }
      
      return true;
    } catch (err) {
      console.error('❌ Error repairing workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to repair workflow';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  return {
    initializeWorkflow,
    initializeWorkflowWithPartAssignments,
    repairJobWorkflow,
    isInitializing
  };
};
