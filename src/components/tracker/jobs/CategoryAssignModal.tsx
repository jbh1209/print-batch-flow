
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

  // Debug logging
  useEffect(() => {
    console.log('📋 CategoryAssignModal mounted:', {
      job,
      categories,
      categoriesCount: categories?.length
    });
    
    console.log('🔍 Categories array detailed inspection:');
    categories?.forEach((cat, index) => {
      console.log(`Category ${index}:`, {
        name: cat.name,
        id: cat.id,
        idType: typeof cat.id,
        rawCategory: cat
      });
    });
  }, [job, categories]);

  const handleCategoryChange = (categoryId: string) => {
    console.log('🎯 Category selection started:', {
      receivedCategoryId: categoryId,
      receivedType: typeof categoryId,
      receivedLength: categoryId?.length
    });

    // Additional validation to ensure we have a proper string ID
    if (!categoryId || typeof categoryId !== 'string' || categoryId.trim() === '') {
      console.error('❌ Invalid category ID received:', categoryId);
      toast.error("Invalid category selection");
      return;
    }

    // Validate that the category exists in our list
    const categoryExists = categories.find(cat => String(cat.id) === String(categoryId));
    if (!categoryExists) {
      console.error('❌ Category not found in categories list:', {
        searchingFor: categoryId,
        availableCategories: categories.map(cat => ({ id: cat.id, name: cat.name }))
      });
      toast.error("Selected category not found");
      return;
    }

    console.log('✅ Valid category found and selected:', {
      categoryId,
      categoryName: categoryExists.name,
      categoryData: categoryExists
    });

    setSelectedCategoryId(categoryId);
  };

  const handleAssign = async () => {
    console.log('🔍 Assignment process starting with selectedCategoryId:', {
      selectedCategoryId,
      selectedCategoryIdType: typeof selectedCategoryId,
      selectedCategoryIdLength: selectedCategoryId?.length,
      isEmptyString: selectedCategoryId === '',
      isTrimmedEmpty: selectedCategoryId?.trim() === ''
    });

    // Enhanced validation
    if (!selectedCategoryId || typeof selectedCategoryId !== 'string' || selectedCategoryId.trim() === "") {
      console.error('❌ selectedCategoryId validation failed:', {
        selectedCategoryId,
        type: typeof selectedCategoryId,
        length: selectedCategoryId?.length,
        trimmed: selectedCategoryId?.trim()
      });
      toast.error("Please select a category");
      return;
    }

    // Find the selected category to validate it exists
    const selectedCategory = categories.find(cat => String(cat.id) === String(selectedCategoryId));
    if (!selectedCategory) {
      console.error('❌ Selected category not found in categories list:', {
        searchingFor: selectedCategoryId,
        searchingForType: typeof selectedCategoryId,
        availableCategories: categories.map(cat => ({ 
          id: cat.id, 
          idType: typeof cat.id,
          name: cat.name 
        }))
      });
      toast.error("Selected category not found");
      return;
    }

    console.log('✅ Valid category found for assignment:', {
      selectedCategory,
      finalCategoryId: selectedCategoryId,
      finalCategoryIdType: typeof selectedCategoryId
    });

    setIsAssigning(true);
    try {
      console.log('🔄 Starting assignment process...', {
        jobId: job.id,
        categoryId: selectedCategoryId,
        categoryName: selectedCategory.name,
        isMultiple: job.isMultiple
      });

      if (job.isMultiple && job.selectedIds) {
        // Bulk category assignment
        let successCount = 0;
        let errorCount = 0;

        for (const jobId of job.selectedIds) {
          try {
            console.log(`🔄 Processing job ${jobId} with category ${selectedCategoryId}`);
            
            // Update job with category
            const { error: updateError } = await supabase
              .from('production_jobs')
              .update({ 
                category_id: selectedCategoryId,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId);

            if (updateError) {
              console.error('❌ Error updating job:', jobId, updateError);
              errorCount++;
              continue;
            }

            console.log(`✅ Job ${jobId} updated, initializing stages...`);

            // Initialize workflow stages
            const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: selectedCategoryId
            });

            if (stageError) {
              console.error('❌ Error initializing stages for job:', jobId, stageError);
              errorCount++;
            } else {
              console.log(`✅ Stages initialized for job ${jobId}`);
              successCount++;
            }
          } catch (err) {
            console.error('❌ Error processing job:', jobId, err);
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
        console.log('🔄 Single job assignment starting...', {
          jobId: job.id,
          categoryId: selectedCategoryId,
          categoryIdType: typeof selectedCategoryId
        });
        
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

        console.log('✅ Job updated, initializing stages...');

        // Initialize workflow stages
        const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: job.id,
          p_job_table_name: 'production_jobs',
          p_category_id: selectedCategoryId
        });

        if (stageError) {
          console.error('❌ Error initializing stages:', stageError);
          toast.error('Category assigned but workflow initialization failed');
          return;
        }

        console.log('✅ Stages initialized successfully');
        toast.success('Category assigned and workflow initialized');
      }

      onAssign();
      onClose();
    } catch (err) {
      console.error('❌ Error assigning category:', err);
      toast.error('Failed to assign category');
    } finally {
      setIsAssigning(false);
    }
  };

  const selectedCategory = categories.find(cat => String(cat.id) === String(selectedCategoryId));

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
            <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => {
                  const categoryId = String(category.id); // Ensure string conversion
                  console.log('🎨 Rendering category option:', {
                    name: category.name,
                    id: categoryId,
                    originalId: category.id,
                    idType: typeof categoryId
                  });
                  
                  return (
                    <SelectItem key={categoryId} value={categoryId}>
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
                  );
                })}
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
            <Button onClick={handleAssign} disabled={isAssigning || !selectedCategoryId}>
              {isAssigning ? "Assigning..." : "Assign Category"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
