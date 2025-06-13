
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUUIDArray } from "@/utils/uuidValidation";
import { useCategoryParts } from "@/hooks/tracker/useCategoryParts";
import { useWorkflowInitialization } from "@/hooks/tracker/useWorkflowInitialization";
import { PartMultiStageSelector } from "../factory/PartMultiStageSelector";

interface CategoryAssignModalProps {
  job: any;
  categories: any[];
  onClose: () => void;
  onAssign: () => void;
}

export const CategoryAssignModal: React.FC<CategoryAssignModalProps> = ({
  job,
  categories,
  onClose,
  onAssign
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<'category' | 'parts'>('category');
  const [partAssignments, setPartAssignments] = useState<Record<string, string>>({});
  const [isAssigning, setIsAssigning] = useState(false);
  const [orphanedJobs, setOrphanedJobs] = useState<string[]>([]);
  const [isCheckingWorkflow, setIsCheckingWorkflow] = useState(false);

  const { availableParts, multiPartStages, hasMultiPartStages, isLoading } = useCategoryParts(selectedCategoryId);
  const { repairJobWorkflow } = useWorkflowInitialization();

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

  const checkForOrphanedJobs = async (jobIds: string[]) => {
    try {
      setIsCheckingWorkflow(true);
      const orphaned = [];
      
      for (const jobId of jobIds) {
        // Check if job has category but no stage instances
        const { data: job, error: jobError } = await supabase
          .from('production_jobs')
          .select('id, category_id')
          .eq('id', jobId)
          .single();

        if (jobError || !job) continue;

        if (job.category_id) {
          // Check if stage instances exist
          const { data: stages, error: stageError } = await supabase
            .from('job_stage_instances')
            .select('id')
            .eq('job_id', jobId)
            .eq('job_table_name', 'production_jobs')
            .limit(1);

          if (!stageError && (!stages || stages.length === 0)) {
            orphaned.push(jobId);
          }
        }
      }
      
      setOrphanedJobs(orphaned);
    } catch (error) {
      console.error('Error checking for orphaned jobs:', error);
    } finally {
      setIsCheckingWorkflow(false);
    }
  };

  React.useEffect(() => {
    if (job) {
      const jobIds = job.isMultiple ? job.selectedIds : [job.id];
      checkForOrphanedJobs(jobIds);
    }
  }, [job]);

  const handleRepairWorkflow = async () => {
    if (orphanedJobs.length === 0) return;

    try {
      setIsAssigning(true);
      let successCount = 0;

      for (const jobId of orphanedJobs) {
        // Get the job's current category
        const { data: jobData, error: jobError } = await supabase
          .from('production_jobs')
          .select('category_id')
          .eq('id', jobId)
          .single();

        if (jobError || !jobData || !jobData.category_id) {
          console.error('Failed to get job category for repair:', jobError);
          continue;
        }

        const success = await repairJobWorkflow(jobId, 'production_jobs', jobData.category_id);
        if (success) successCount++;
      }

      if (successCount > 0) {
        toast.success(`Repaired workflow for ${successCount} job(s)`);
        setOrphanedJobs([]);
        onAssign();
      }
    } catch (error) {
      console.error('Error repairing workflows:', error);
      toast.error('Failed to repair workflows');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    console.log('📝 Category selected:', categoryId);
    setSelectedCategoryId(categoryId);
    setPartAssignments({});
    setCurrentStep('category');
  };

  const handleNextStep = () => {
    if (!selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }

    if (hasMultiPartStages && availableParts.length > 0) {
      console.log('✅ Moving to parts assignment step');
      setCurrentStep('parts');
    } else {
      console.log('⏭️ No multi-part stages, proceeding directly to assignment');
      handleAssignment();
    }
  };

  const handlePartAssignmentsChange = (assignments: Record<string, string>) => {
    console.log('🔄 Part assignments changed:', assignments);
    setPartAssignments(assignments);
  };

  const checkExistingStages = async (jobId: string): Promise<boolean> => {
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

  const initializeJobWithCategory = async (jobId: string, categoryId: string, partAssignments?: Record<string, string>) => {
    try {
      console.log('🔄 Initializing job with category:', { jobId, categoryId, partAssignments });

      // Check if stages already exist first
      const hasExistingStages = await checkExistingStages(jobId);
      if (hasExistingStages) {
        console.log('⚠️ Job already has stage instances, skipping initialization');
        return true;
      }

      // Use the appropriate database function based on whether we have part assignments
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

  const handleAssignment = async () => {
    if (!selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }

    // Validate part assignments if we have multi-part stages
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
        // Bulk assignment
        const validJobIds = validateUUIDArray(job.selectedIds, 'CategoryAssignModal bulk assignment');
        
        if (validJobIds.length === 0) {
          throw new Error('No valid job IDs found for bulk assignment');
        }

        let successCount = 0;
        let skippedCount = 0;

        for (const jobId of validJobIds) {
          try {
            // Update job with category
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

            // Initialize workflow
            const initialized = await initializeJobWithCategory(jobId, selectedCategoryId, hasMultiPartStages ? partAssignments : undefined);
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
        // Single job assignment
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

        // Initialize workflow
        const initialized = await initializeJobWithCategory(job.id, selectedCategoryId, hasMultiPartStages ? partAssignments : undefined);
        
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
      
      // Provide more specific error messages
      if (error.message && error.message.includes('duplicate key')) {
        toast.error('Some jobs already have workflows. Use the repair feature to fix orphaned jobs.');
      } else {
        toast.error(`Failed to assign category: ${error.message}`);
      }
    } finally {
      setIsAssigning(false);
    }
  };

  const handleBack = () => {
    setCurrentStep('category');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'category' ? 'Assign Category' : 'Assign Parts to Stages'}
            {job.isMultiple ? ` (${job.selectedIds?.length || 0} jobs)` : ` - ${job.wo_no || 'Unknown'}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Orphaned Jobs Alert */}
          {orphanedJobs.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="flex items-center justify-between">
                  <span>
                    {orphanedJobs.length} job(s) have categories but missing workflows. 
                    This can cause assignment errors.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRepairWorkflow}
                    disabled={isAssigning}
                    className="ml-2 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                  >
                    <Wrench className="h-3 w-3 mr-1" />
                    Repair
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {currentStep === 'category' && (
            <>
              <div>
                <Label className="text-sm font-medium mb-2 block">Select Category</Label>
                <Select value={selectedCategoryId} onValueChange={handleCategorySelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: category.color || '#6B7280' }}
                          />
                          <span>{category.name}</span>
                          <span className="text-xs text-gray-500">
                            ({category.sla_target_days || 0} days SLA)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Category:</strong> {selectedCategory.name}
                  </p>
                  <p className="text-sm text-blue-700">
                    <strong>SLA:</strong> {selectedCategory.sla_target_days} days
                  </p>
                  {isLoading && (
                    <p className="text-sm text-blue-600 mt-1">
                      Checking for multi-part stages...
                    </p>
                  )}
                  {!isLoading && hasMultiPartStages && (
                    <p className="text-sm text-blue-600 mt-1">
                      This category has multi-part stages. You'll be able to assign parts to specific stages.
                    </p>
                  )}
                  {!isLoading && !hasMultiPartStages && (
                    <p className="text-sm text-blue-600 mt-1">
                      Workflow will be initialized with all stages in pending status.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {currentStep === 'parts' && (
            <>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">
                  <strong>Category:</strong> {selectedCategory?.name}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Assign each part to the appropriate stage:
                </p>
              </div>

              <PartMultiStageSelector
                availableParts={availableParts}
                availableStages={multiPartStages}
                onPartAssignmentsChange={handlePartAssignmentsChange}
                initialAssignments={partAssignments}
              />
            </>
          )}

          <div className="flex gap-2 justify-end">
            {currentStep === 'parts' && (
              <Button variant="outline" onClick={handleBack} disabled={isAssigning}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={isAssigning}>
              Cancel
            </Button>
            {currentStep === 'category' && (
              <Button onClick={handleNextStep} disabled={isAssigning || !selectedCategoryId || isLoading}>
                {hasMultiPartStages && availableParts.length > 0 ? "Next: Assign Parts" : "Assign Category"}
              </Button>
            )}
            {currentStep === 'parts' && (
              <Button onClick={handleAssignment} disabled={isAssigning}>
                {isAssigning ? "Assigning..." : "Complete Assignment"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
