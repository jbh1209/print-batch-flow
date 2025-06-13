
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUUIDArray } from "@/utils/uuidValidation";

export const checkExistingStages = async (jobId: string): Promise<boolean> => {
  try {
    const { data: existingStages, error } = await supabase
      .from('job_stage_instances')
      .select('id')
      .eq('job_id', jobId)
      .eq('job_table_name', 'production_jobs')
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

export const initializeJobWithCategory = async (
  jobId: string, 
  categoryId: string, 
  partAssignments?: Record<string, string>
) => {
  try {
    console.log('🔄 Initializing job with category:', { jobId, categoryId, partAssignments });

    const hasExistingStages = await checkExistingStages(jobId);
    if (hasExistingStages) {
      console.log('⚠️ Job already has stage instances, skipping initialization');
      return true;
    }

    if (partAssignments && Object.keys(partAssignments).length > 0) {
      const { error } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_category_id: categoryId,
        p_part_assignments: partAssignments
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_category_id: categoryId
      });
      if (error) throw error;
    }

    console.log('✅ Job stages initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing job stages:', error);
    throw error;
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

  if (hasMultiPartStages && availableParts.length > 0) {
    const unassignedParts = availableParts.filter(part => !partAssignments[part]);
    if (unassignedParts.length > 0) {
      toast.error(`Please assign all parts: ${unassignedParts.join(', ')}`);
      return;
    }
  }

  setIsAssigning(true);

  try {
    if (job.isMultiple && Array.isArray(job.selectedIds)) {
      const validJobIds = validateUUIDArray(job.selectedIds, 'CategoryAssignModal bulk assignment');
      
      if (validJobIds.length === 0) {
        throw new Error('No valid job IDs found for bulk assignment');
      }

      let successCount = 0;
      let skippedCount = 0;

      for (const jobId of validJobIds) {
        try {
          const { error: updateError } = await supabase
            .from('production_jobs')
            .update({ 
              category_id: selectedCategoryId,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

          if (updateError) {
            console.error('❌ Error updating job:', updateError);
            throw updateError;
          }

          const initialized = await initializeJobWithCategory(
            jobId, 
            selectedCategoryId, 
            hasMultiPartStages ? partAssignments : undefined
          );
          
          if (initialized) {
            successCount++;
          } else {
            skippedCount++;
          }
        } catch (jobError) {
          console.error(`❌ Error processing job ${jobId}:`, jobError);
          skippedCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully assigned category to ${successCount} job(s)${skippedCount > 0 ? ` (${skippedCount} already had workflows)` : ''}`);
      } else {
        toast.warning('All selected jobs already have workflows assigned');
      }
    } else {
      const { error: updateError } = await supabase
        .from('production_jobs')
        .update({ 
          category_id: selectedCategoryId,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) {
        console.error('❌ Error updating job:', updateError);
        throw updateError;
      }

      const initialized = await initializeJobWithCategory(
        job.id, 
        selectedCategoryId, 
        hasMultiPartStages ? partAssignments : undefined
      );
      
      if (initialized) {
        toast.success('Category assigned successfully');
      } else {
        toast.success('Category updated (workflow already existed)');
      }
    }

    onAssign();
    onClose();
  } catch (error) {
    console.error('❌ Assignment failed:', error);
    
    if (error.message && error.message.includes('duplicate key')) {
      toast.error('Some jobs already have workflows. Use the repair feature to fix orphaned jobs.');
    } else {
      toast.error(`Failed to assign category: ${error.message}`);
    }
  } finally {
    setIsAssigning(false);
  }
};
