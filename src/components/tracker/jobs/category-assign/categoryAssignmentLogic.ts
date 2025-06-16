
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUUIDArray } from "@/utils/uuidValidation";

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
    console.log('🎯 Starting category assignment process:', {
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
          console.log(`✅ Multi-part workflow initialized for job ${jobId} - ALL STAGES SET TO PENDING`);
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
          console.log(`✅ Standard workflow initialized for job ${jobId} - ALL STAGES SET TO PENDING`);
        }
      }

      if (initSuccess) {
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
            console.log(`✅ Verified: Job ${jobId} has all stages in PENDING state as expected`);
          }
        }
      }
    }

    // Show appropriate success/warning messages
    if (successCount > 0) {
      const message = hasMultiPartStages && Object.keys(partAssignments).length > 0
        ? `Successfully assigned category and initialized multi-part workflow for ${successCount} job(s) - all stages are PENDING and waiting for operator action`
        : `Successfully assigned category and initialized workflow for ${successCount} job(s) - all stages are PENDING and waiting for operator action`;
      
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
