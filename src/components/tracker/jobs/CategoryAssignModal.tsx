
import React, { useState } from "react";
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

  const handleAssign = async () => {
    if (!selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }

    setIsAssigning(true);
    try {
      console.log('🔄 Assigning category...', {
        jobId: job.id,
        categoryId: selectedCategoryId,
        isMultiple: job.isMultiple
      });

      if (job.isMultiple && job.selectedIds) {
        // Bulk category assignment
        for (const jobId of job.selectedIds) {
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
            throw updateError;
          }

          // Initialize workflow stages
          const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
            p_job_id: jobId,
            p_job_table_name: 'production_jobs',
            p_category_id: selectedCategoryId
          });

          if (stageError) {
            console.error('Error initializing stages for job:', jobId, stageError);
            // Continue with other jobs instead of failing completely
          }
        }

        toast.success(`Category assigned to ${job.selectedIds.length} jobs`);
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
          console.error('Error updating job:', updateError);
          throw updateError;
        }

        // Initialize workflow stages
        const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: job.id,
          p_job_table_name: 'production_jobs',
          p_category_id: selectedCategoryId
        });

        if (stageError) {
          console.error('Error initializing stages:', stageError);
          toast.error('Category assigned but workflow initialization failed');
          return;
        }

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
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
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
                ))}
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
