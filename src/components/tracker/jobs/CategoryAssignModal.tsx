
import React, { useState, useEffect, useCallback } from "react";
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

// Comprehensive UUID validation
const isValidUUID = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (!value || value.trim() === '') return false;
  
  // Check for common invalid values
  const invalidValues = ['undefined', 'null', '0', 'false', 'true', 'NaN'];
  if (invalidValues.includes(value)) return false;
  
  // UUID regex validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

// Defensive category validation
const validateCategory = (categoryId: unknown, categories: any[]): string | null => {
  console.log('🔍 CategoryAssignModal: Validating category input:', {
    value: categoryId,
    type: typeof categoryId,
    stringified: JSON.stringify(categoryId)
  });
  
  // Step 1: Basic type and content validation
  if (!isValidUUID(categoryId)) {
    console.error('❌ Invalid UUID format:', categoryId);
    return null;
  }
  
  // Step 2: Verify category exists in our list
  const category = categories.find(cat => cat?.id === categoryId);
  if (!category) {
    console.error('❌ Category not found in list:', categoryId);
    return null;
  }
  
  console.log('✅ Category validation passed:', {
    categoryId,
    categoryName: category.name
  });
  
  return categoryId;
};

export const CategoryAssignModal: React.FC<CategoryAssignModalProps> = ({
  job,
  categories,
  onClose,
  onAssign
}) => {
  // State with explicit typing and safe initialization
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>("");

  // Safe category selection handler with comprehensive validation
  const handleCategorySelection = useCallback((value: string) => {
    console.log('🎯 CategoryAssignModal: Category selection triggered:', {
      rawValue: value,
      type: typeof value,
      length: value?.length
    });
    
    // Clear any previous validation errors
    setValidationError("");
    
    // Validate the selection
    const validatedCategoryId = validateCategory(value, categories);
    
    if (validatedCategoryId === null) {
      setValidationError("Invalid category selection. Please try again.");
      setSelectedCategoryId(""); // Reset to empty state
      toast.error("Invalid category selection detected");
      return;
    }
    
    // Safe to set the validated category ID
    setSelectedCategoryId(validatedCategoryId);
    console.log('✅ Category successfully selected:', validatedCategoryId);
  }, [categories]);

  // Reset modal state when job changes
  useEffect(() => {
    console.log('🔄 CategoryAssignModal: Resetting modal state for job:', job?.wo_no || job?.id);
    setSelectedCategoryId("");
    setValidationError("");
  }, [job]);

  // Enhanced assignment handler with multiple validation layers
  const handleAssignment = async () => {
    console.log('🚀 CategoryAssignModal: Starting assignment process');
    
    // Pre-flight validation
    if (!selectedCategoryId || selectedCategoryId.trim() === "") {
      toast.error("Please select a category before assigning");
      return;
    }
    
    // Final validation before database call
    const finalValidatedId = validateCategory(selectedCategoryId, categories);
    if (finalValidatedId === null) {
      toast.error("Selected category is invalid. Please select again.");
      setSelectedCategoryId(""); // Reset invalid state
      return;
    }
    
    console.log('✅ Final validation passed, proceeding with database operations');
    
    setIsAssigning(true);
    
    try {
      if (job.isMultiple && Array.isArray(job.selectedIds)) {
        // Bulk assignment with individual validation
        let successCount = 0;
        let errorCount = 0;
        
        for (const jobId of job.selectedIds) {
          if (!isValidUUID(jobId)) {
            console.error('❌ Invalid job ID in bulk operation:', jobId);
            errorCount++;
            continue;
          }
          
          try {
            // Update job with validated category
            const { error: updateError } = await supabase
              .from('production_jobs')
              .update({ 
                category_id: finalValidatedId,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId);

            if (updateError) {
              console.error('❌ Database update error for job:', jobId, updateError);
              errorCount++;
              continue;
            }

            // Initialize workflow with validated IDs
            const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: finalValidatedId
            });

            if (stageError) {
              console.error('❌ Workflow initialization error for job:', jobId, stageError);
              errorCount++;
            } else {
              successCount++;
              console.log('✅ Successfully processed job:', jobId);
            }
          } catch (err) {
            console.error('❌ Unexpected error processing job:', jobId, err);
            errorCount++;
          }
        }
        
        // Report results
        if (successCount > 0) {
          toast.success(`Successfully assigned category to ${successCount} job${successCount > 1 ? 's' : ''}`);
        }
        if (errorCount > 0) {
          toast.error(`Failed to assign category to ${errorCount} job${errorCount > 1 ? 's' : ''}`);
        }
      } else {
        // Single job assignment
        if (!isValidUUID(job.id)) {
          throw new Error('Invalid job ID format');
        }
        
        // Update job with validated category
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ 
            category_id: finalValidatedId,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (updateError) {
          console.error('❌ Database update error:', updateError);
          throw updateError;
        }

        // Initialize workflow with validated IDs
        const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: job.id,
          p_job_table_name: 'production_jobs',
          p_category_id: finalValidatedId
        });

        if (stageError) {
          console.error('❌ Workflow initialization error:', stageError);
          throw stageError;
        }

        console.log('✅ Single job assignment completed successfully');
        toast.success('Category assigned and workflow initialized successfully');
      }

      // Success cleanup
      onAssign();
      onClose();
    } catch (error) {
      console.error('❌ Assignment operation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to assign category: ${errorMessage}`);
    } finally {
      setIsAssigning(false);
    }
  };

  // Safe category lookup for display
  const selectedCategory = categories.find(cat => cat?.id === selectedCategoryId);
  const isValidSelection = selectedCategoryId !== "" && isValidUUID(selectedCategoryId);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign Category {job.isMultiple ? `(${job.selectedIds?.length || 0} jobs)` : `- ${job.wo_no || 'Unknown'}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Category</label>
            <Select 
              value={selectedCategoryId} 
              onValueChange={handleCategorySelection}
            >
              <SelectTrigger className={validationError ? "border-red-500" : ""}>
                <SelectValue placeholder="Choose a category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.length > 0 ? (
                  categories.map((category) => {
                    // Additional safety check for category data
                    if (!category?.id || !isValidUUID(category.id)) {
                      console.warn('⚠️ Skipping invalid category:', category);
                      return null;
                    }
                    
                    return (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: category.color || '#6B7280' }}
                          />
                          <span>{category.name || 'Unnamed Category'}</span>
                          <span className="text-xs text-gray-500">
                            ({category.sla_target_days || 0} days SLA)
                          </span>
                        </div>
                      </SelectItem>
                    );
                  }).filter(Boolean)
                ) : (
                  <SelectItem value="no-categories" disabled>
                    No categories available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            
            {/* Validation error display */}
            {validationError && (
              <p className="text-sm text-red-600 mt-1">{validationError}</p>
            )}
            
            {/* Debug info for development */}
            {selectedCategoryId && (
              <div className="text-xs text-gray-500 mt-1">
                Selected ID: {selectedCategoryId} | Valid: {isValidSelection ? 'Yes' : 'No'}
              </div>
            )}
          </div>

          {/* Category info display */}
          {selectedCategory && isValidSelection && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Category:</strong> {selectedCategory.name}
              </p>
              <p className="text-sm text-blue-700">
                <strong>SLA:</strong> {selectedCategory.sla_target_days} days
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Workflow will be initialized with all stages in pending status.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={isAssigning}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAssignment} 
              disabled={isAssigning || !isValidSelection || validationError !== ""}
            >
              {isAssigning ? "Assigning..." : "Assign Category"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
