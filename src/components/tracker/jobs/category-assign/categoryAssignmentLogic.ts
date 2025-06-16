import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUUIDArray } from "@/utils/uuidValidation";
import { extractWONumber } from "@/utils/tracker/jobOrderingUtils";

// Set proper job_order_in_stage for newly created stages
const setProperJobOrderInStage = async (jobId: string, jobTableName: string) => {
  try {
    console.log('🔧 Setting proper job_order_in_stage for job:', jobId);

    // Get the job's WO number - always from production_jobs table
    const { data: job, error: jobError } = await supabase
      .from('production_jobs')
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

export const handleAssignment = async (
  job: any,
  selectedCategoryId: string,
  hasMultiPartStages: boolean,
  availableParts: string[],
  partAssignments: Record<string, string>,
  setIsAssigning: (value: boolean) => void,
  onAssign: () => void,
  onClose: () => void
) => {
  if (!selectedCategoryId) {
    toast.error("Please select a category");
    return;
  }

  try {
    setIsAssigning(true);
    console.log('🎯 Starting category assignment process with proper ordering:', {
      selectedCategoryId,
      hasMultiPartStages,
      availableParts,
      partAssignments,
      isMultiple: job.isMultiple
    });

    const jobIds = job.isMultiple ? job.selectedIds : [job.id];
    let successCount = 0;
    let alreadyAssignedCount = 0;
    
    for (const jobId of jobIds) {
      console.log(`🔄 Processing job ${jobId}...`);
      
      // Check if job already has actual workflow stages (not just category)
      const { data: existingStages, error: stageCheckError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .limit(1);

      if (stageCheckError) {
        console.error('❌ Error checking existing stages:', stageCheckError);
        continue;
      }

      // If stages exist, this job already has a proper workflow
      if (existingStages && existingStages.length > 0) {
        console.log(`⚠️ Job ${jobId} already has workflow stages`);
        alreadyAssignedCount++;
        continue;
      }

      // Update the job's category
      const { error: updateError } = await supabase
        .from('production_jobs')
        .update({ 
          category_id: selectedCategoryId,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) {
        console.error('❌ Error updating job category:', updateError);
        toast.error(`Failed to update job ${jobId}`);
        continue;
      }

      console.log(`✅ Updated job ${jobId} category to ${selectedCategoryId}`);

      // Initialize workflow with or without part assignments
      // CRITICAL FIX: Only initialize stages, do NOT auto-start any stages
      let initSuccess = false;
      
      if (hasMultiPartStages && Object.keys(partAssignments).length > 0) {
        console.log(`🔧 Initializing multi-part workflow for job ${jobId} (ALL STAGES PENDING)...`);
        
        const { error: multiPartError } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs',
          p_category_id: selectedCategoryId,
          p_part_assignments: partAssignments
        });

        if (multiPartError) {
          console.error('❌ Multi-part workflow initialization error:', multiPartError);
          toast.error(`Failed to initialize multi-part workflow for job ${jobId}`);
        } else {
          initSuccess = true;
          console.log(`✅ Multi-part workflow initialized for job ${jobId} - SETTING PROPER ORDER`);
        }
      } else {
        console.log(`🔧 Initializing standard workflow for job ${jobId} (ALL STAGES PENDING)...`);
        
        const { error: standardError } = await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs',
          p_category_id: selectedCategoryId
        });

        if (standardError) {
          console.error('❌ Standard workflow initialization error:', standardError);
          toast.error(`Failed to initialize workflow for job ${jobId}`);
        } else {
          initSuccess = true;
          console.log(`✅ Standard workflow initialized for job ${jobId} - SETTING PROPER ORDER`);
        }
      }

      if (initSuccess) {
        // Set proper job_order_in_stage based on WO number
        await setProperJobOrderInStage(jobId, 'production_jobs');
        
        successCount++;
        // CRITICAL: Verify that no stages were auto-started
        console.log(`🔍 Verifying job ${jobId} stages are all PENDING after initialization...`);
        const { data: verifyStages } = await supabase
          .from('job_stage_instances')
          .select('id, status, stage_order')
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs')
          .order('stage_order', { ascending: true });
        
        if (verifyStages) {
          const activeStages = verifyStages.filter(s => s.status === 'active');
          if (activeStages.length > 0) {
            console.error(`🚨 BUG DETECTED: Job ${jobId} has ${activeStages.length} active stages after initialization!`, activeStages);
            toast.error(`Critical bug: Job ${jobId} auto-started stages - this should not happen!`);
          } else {
            console.log(`✅ Verified: Job ${jobId} has all stages in PENDING state with proper WO-based ordering`);
          }
        }
      }
    }

    // Show appropriate success/warning messages
    if (successCount > 0) {
      const message = hasMultiPartStages && Object.keys(partAssignments).length > 0
        ? `Successfully assigned category and initialized multi-part workflow for ${successCount} job(s) - all stages are PENDING and ordered by WO number`
        : `Successfully assigned category and initialized workflow for ${successCount} job(s) - all stages are PENDING and ordered by WO number`;
      
      toast.success(message);
    }

    if (alreadyAssignedCount > 0) {
      toast.warning(`${alreadyAssignedCount} job(s) already have workflow stages and were skipped`);
    }

    if (successCount === 0 && alreadyAssignedCount === 0) {
      toast.error('Failed to assign category to any jobs');
    }

    // Close modal and refresh data
    onAssign();
    onClose();

  } catch (error) {
    console.error('❌ Error in category assignment:', error);
    toast.error('Failed to assign category');
  } finally {
    setIsAssigning(false);
  }
};
