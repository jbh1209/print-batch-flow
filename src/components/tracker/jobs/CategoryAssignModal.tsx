
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

export const CategoryAssignModal: React.FC<CategoryAssignModalProps> = ({
  job,
  categories,
  onClose,
  onAssign
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Reset selection when modal opens
  useEffect(() => {
    setSelectedCategoryId("");
  }, [job]);

  const handleCategoryChange = (categoryId: string) => {
    console.log('Category selection changed:', { categoryId, type: typeof categoryId });
    
    // Comprehensive validation to prevent invalid values
    if (!categoryId || 
        categoryId === "undefined" || 
        categoryId === "null" || 
        categoryId.trim() === "" ||
        categoryId === "0") {
      console.warn('Invalid category ID received, resetting selection:', categoryId);
      setSelectedCategoryId("");
      return;
    }
    
    // Verify the category exists in our categories list
    const categoryExists = categories.find(cat => cat.id === categoryId);
    if (!categoryExists) {
      console.error('Selected category not found in categories list:', categoryId);
      toast.error("Selected category is not valid");
      setSelectedCategoryId("");
      return;
    }
    
    setSelectedCategoryId(categoryId);
  };

  const handleAssign = async () => {
    console.log('Starting category assignment:', { 
      selectedCategoryId, 
      type: typeof selectedCategoryId,
      jobId: job.id || job.selectedIds,
      isMultiple: job.isMultiple 
    });

    // Frontend validation before API call
    if (!selectedCategoryId || 
        selectedCategoryId === "undefined" || 
        selectedCategoryId === "null" || 
        selectedCategoryId.trim() === "") {
      toast.error("Please select a valid category");
      return;
    }

    // Double-check category exists
    const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
    if (!selectedCategory) {
      toast.error("Selected category not found");
      setSelectedCategoryId(""); // Reset invalid selection
      return;
    }

    setIsAssigning(true);
    try {
      if (job.isMultiple && job.selectedIds) {
        // Bulk category assignment
        let successCount = 0;
        let errorCount = 0;

        for (const jobId of job.selectedIds) {
          try {
            console.log('Processing bulk job:', { jobId, categoryId: selectedCategoryId });
            
            // Update job with category
            const { error: updateError } = await supabase
              .from('production_jobs')
              .update({ 
                category_id: selectedCategoryId,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId);

            if (updateError) {
              console.error('Error updating job:', jobId, updateError);
              errorCount++;
              continue;
            }

            // Initialize workflow stages with validated category ID
            const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: selectedCategoryId
            });

            if (stageError) {
              console.error('Error initializing stages for job:', jobId, stageError);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            console.error('Error processing job:', jobId, err);
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
        console.log('Processing single job:', { jobId: job.id, categoryId: selectedCategoryId });
        
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ 
            category_id: selectedCategoryId,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw updateError;
        }

        // Initialize workflow stages with validated category ID
        const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: job.id,
          p_job_table_name: 'production_jobs',
          p_category_id: selectedCategoryId
        });

        if (stageError) {
          console.error('Workflow initialization error:', stageError);
          toast.error(`Category assigned but workflow initialization failed: ${stageError.message}`);
          return;
        }

        toast.success('Category assigned and workflow initialized');
      }

      onAssign();
      onClose();
    } catch (err) {
      console.error('Error assigning category:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to assign category: ${errorMessage}`);
    } finally {
      setIsAssigning(false);
    }
  };

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

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
              disabled={isAssigning || !selectedCategoryId || selectedCategoryId === ""}
            >
              {isAssigning ? "Assigning..." : "Assign Category"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
