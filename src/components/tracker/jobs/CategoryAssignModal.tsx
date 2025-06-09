
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CategoryAssignModalProps {
  job: any;
  categories: any[];
  onClose: () => void;
  onAssign: () => void;
}

// UUID validation utility
const isValidUUID = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Safe value validator
const isSafeValue = (value: any): boolean => {
  if (!value) return false;
  if (typeof value !== 'string') return false;
  if (value === 'undefined' || value === 'null' || value === '0' || value.trim() === '') return false;
  return isValidUUID(value);
};

export const CategoryAssignModal: React.FC<CategoryAssignModalProps> = ({
  job,
  categories,
  onClose,
  onAssign
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Reset selection when modal opens with additional safety checks
  useEffect(() => {
    console.log('CategoryAssignModal: Modal opened, resetting selection');
    setSelectedCategoryId("");
  }, [job]);

  const handleCategoryChange = (categoryId: string) => {
    console.log('CategoryAssignModal: Raw value received from Select:', { 
      value: categoryId, 
      type: typeof categoryId,
      stringified: JSON.stringify(categoryId)
    });
    
    // Immediate safety check - reject any unsafe values
    if (!isSafeValue(categoryId)) {
      console.error('CategoryAssignModal: UNSAFE VALUE DETECTED AND REJECTED:', {
        value: categoryId,
        type: typeof categoryId,
        isString: typeof categoryId === 'string',
        isUndefinedString: categoryId === 'undefined',
        isNullString: categoryId === 'null',
        isEmpty: categoryId === '',
        isZero: categoryId === '0'
      });
      
      // Force reset to empty and show error
      setSelectedCategoryId("");
      toast.error("Invalid category selection detected. Please try again.");
      return;
    }
    
    // Additional verification that category exists in our list
    const categoryExists = categories.find(cat => cat.id === categoryId);
    if (!categoryExists) {
      console.error('CategoryAssignModal: Category not found in list:', categoryId);
      setSelectedCategoryId("");
      toast.error("Selected category is not valid");
      return;
    }
    
    console.log('CategoryAssignModal: Valid category selected:', {
      categoryId,
      categoryName: categoryExists.name
    });
    
    setSelectedCategoryId(categoryId);
  };

  const handleAssign = async () => {
    console.log('CategoryAssignModal: Starting assignment process');
    console.log('CategoryAssignModal: Pre-validation state:', { 
      selectedCategoryId, 
      type: typeof selectedCategoryId,
      isValid: isSafeValue(selectedCategoryId),
      jobId: job.id || job.selectedIds,
      isMultiple: job.isMultiple 
    });

    // Final validation before API call
    if (!isSafeValue(selectedCategoryId)) {
      console.error('CategoryAssignModal: FINAL VALIDATION FAILED:', {
        value: selectedCategoryId,
        type: typeof selectedCategoryId,
        reason: 'Invalid UUID format or unsafe value'
      });
      toast.error("Please select a valid category before assigning");
      return;
    }

    // Triple-check category exists
    const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
    if (!selectedCategory) {
      console.error('CategoryAssignModal: Category verification failed:', selectedCategoryId);
      toast.error("Selected category not found");
      setSelectedCategoryId(""); // Reset invalid selection
      return;
    }

    console.log('CategoryAssignModal: All validations passed, proceeding with assignment');

    setIsAssigning(true);
    try {
      if (job.isMultiple && job.selectedIds) {
        // Bulk category assignment
        let successCount = 0;
        let errorCount = 0;

        for (const jobId of job.selectedIds) {
          try {
            console.log('CategoryAssignModal: Processing bulk job:', { jobId, categoryId: selectedCategoryId });
            
            // Validate jobId is also a valid UUID
            if (!isValidUUID(jobId)) {
              console.error('CategoryAssignModal: Invalid job ID detected:', jobId);
              errorCount++;
              continue;
            }
            
            // Update job with category
            const { error: updateError } = await supabase
              .from('production_jobs')
              .update({ 
                category_id: selectedCategoryId,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId);

            if (updateError) {
              console.error('CategoryAssignModal: Error updating job:', jobId, updateError);
              errorCount++;
              continue;
            }

            // Initialize workflow stages with validated category ID
            console.log('CategoryAssignModal: Calling initialize_job_stages_auto with:', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: selectedCategoryId
            });

            const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: selectedCategoryId
            });

            if (stageError) {
              console.error('CategoryAssignModal: Error initializing stages for job:', jobId, stageError);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            console.error('CategoryAssignModal: Error processing job:', jobId, err);
            errorCount++;
          }
        }

        if (successCount > 0) {
          toast.success(`Category assigned to ${successCount} jobs`);
        }
        if (errorCount > 0) {
          toast.error(`Failed to assign category to ${errorCount} jobs`);
        }
      } else {
        // Single job assignment
        console.log('CategoryAssignModal: Processing single job:', { jobId: job.id, categoryId: selectedCategoryId });
        
        // Validate single job ID
        if (!isValidUUID(job.id)) {
          console.error('CategoryAssignModal: Invalid single job ID:', job.id);
          throw new Error('Invalid job ID format');
        }
        
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ 
            category_id: selectedCategoryId,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (updateError) {
          console.error('CategoryAssignModal: Database update error:', updateError);
          throw updateError;
        }

        // Initialize workflow stages with validated category ID
        console.log('CategoryAssignModal: Calling initialize_job_stages_auto with:', {
          p_job_id: job.id,
          p_job_table_name: 'production_jobs',
          p_category_id: selectedCategoryId
        });

        const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: job.id,
          p_job_table_name: 'production_jobs',
          p_category_id: selectedCategoryId
        });

        if (stageError) {
          console.error('CategoryAssignModal: Workflow initialization error:', stageError);
          toast.error(`Category assigned but workflow initialization failed: ${stageError.message}`);
          return;
        }

        toast.success('Category assigned and workflow initialized');
      }

      onAssign();
      onClose();
    } catch (err) {
      console.error('CategoryAssignModal: Error assigning category:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to assign category: ${errorMessage}`);
    } finally {
      setIsAssigning(false);
    }
  };

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
  const isValidSelection = isSafeValue(selectedCategoryId);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign Category {job.isMultiple ? `(${job.selectedIds?.length} jobs)` : `- ${job.wo_no}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Select Category</label>
            <Select 
              value={selectedCategoryId || ""} 
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.length > 0 ? (
                  categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        <span>{category.name}</span>
                        <span className="text-xs text-gray-500">
                          ({category.sla_target_days} days SLA)
                        </span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-categories" disabled>
                    No categories available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            
            {/* Debug info - can be removed later */}
            {selectedCategoryId && (
              <div className="text-xs text-gray-500 mt-1">
                Selected: {selectedCategoryId} (Valid: {isValidSelection ? 'Yes' : 'No'})
              </div>
            )}
          </div>

          {selectedCategory && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>SLA:</strong> {selectedCategory.sla_target_days} days
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Workflow will be initialized with all stages in pending status.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isAssigning}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={isAssigning || !isValidSelection}
            >
              {isAssigning ? "Assigning..." : "Assign Category"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
