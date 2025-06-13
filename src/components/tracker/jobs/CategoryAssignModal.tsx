
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUUIDArray } from "@/utils/uuidValidation";
import { useCategoryParts } from "@/hooks/tracker/useCategoryParts";
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

  const { availableParts, multiPartStages, hasMultiPartStages, isLoading } = useCategoryParts(selectedCategoryId);

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

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

  const initializeJobWithCategory = async (jobId: string, categoryId: string, partAssignments?: Record<string, string>) => {
    try {
      // First, clear any existing stage instances for this job
      await supabase
        .from('job_stage_instances')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs');

      // Initialize with the appropriate function based on whether we have part assignments
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

      return true;
    } catch (error) {
      console.error('Error initializing job stages:', error);
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

        const promises = validJobIds.map(async (jobId: string) => {
          // Update job with category
          await supabase
            .from('production_jobs')
            .update({ 
              category_id: selectedCategoryId,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

          // Initialize workflow
          await initializeJobWithCategory(jobId, selectedCategoryId, hasMultiPartStages ? partAssignments : undefined);
        });

        await Promise.all(promises);
        toast.success(`Successfully assigned category to ${validJobIds.length} jobs`);
      } else {
        // Single job assignment
        await supabase
          .from('production_jobs')
          .update({ 
            category_id: selectedCategoryId,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // Initialize workflow
        await initializeJobWithCategory(job.id, selectedCategoryId, hasMultiPartStages ? partAssignments : undefined);

        toast.success('Category assigned successfully');
      }

      onAssign();
      onClose();
    } catch (error) {
      console.error('❌ Assignment failed:', error);
      toast.error(`Failed to assign category: ${error.message}`);
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
