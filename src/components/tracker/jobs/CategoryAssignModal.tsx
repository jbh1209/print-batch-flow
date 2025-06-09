
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUUIDArray } from "@/utils/uuidValidation";

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

  const handleAssignment = async () => {
    if (!selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }

    setIsAssigning(true);

    try {
      if (job.isMultiple && Array.isArray(job.selectedIds)) {
        // Validate and clean the job IDs
        const validJobIds = validateUUIDArray(job.selectedIds, 'CategoryAssignModal bulk assignment');
        
        console.log('🔍 CategoryAssignModal - Bulk Assignment:', {
          rawSelectedIds: job.selectedIds,
          validJobIds,
          categoryId: selectedCategoryId
        });

        if (validJobIds.length === 0) {
          throw new Error('No valid job IDs found for bulk assignment');
        }

        // Bulk assignment
        const promises = validJobIds.map(async (jobId: string) => {
          // Update job with category
          const { error: updateError } = await supabase
            .from('production_jobs')
            .update({ 
              category_id: selectedCategoryId,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

          if (updateError) throw updateError;

          // Initialize workflow
          const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
            p_job_id: jobId,
            p_job_table_name: 'production_jobs',
            p_category_id: selectedCategoryId
          });

          if (stageError) throw stageError;
        });

        await Promise.all(promises);
        toast.success(`Successfully assigned category to ${validJobIds.length} jobs`);
      } else {
        // Single job assignment - VALIDATE JOB ID FIRST
        console.log('🔍 CategoryAssignModal - Single Assignment Validation:', {
          jobId: job.id,
          jobIdType: typeof job.id,
          jobIdUndefined: job.id === undefined,
          jobIdString: job.id === 'undefined',
          categoryId: selectedCategoryId,
          fullJob: job
        });

        // Check if job.id is valid
        if (!job.id || job.id === 'undefined' || typeof job.id !== 'string') {
          console.error('❌ Invalid job ID detected in single assignment:', job.id);
          throw new Error('Invalid job ID. Cannot assign category to job.');
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(job.id)) {
          console.error('❌ Job ID is not a valid UUID:', job.id);
          throw new Error('Invalid job ID format. Cannot assign category to job.');
        }

        console.log('✅ Job ID validation passed, proceeding with assignment');

        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ 
            category_id: selectedCategoryId,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (updateError) throw updateError;

        const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: job.id,
          p_job_table_name: 'production_jobs',
          p_category_id: selectedCategoryId
        });

        if (stageError) throw stageError;

        toast.success('Category assigned successfully');
      }

      onAssign();
      onClose();
    } catch (error) {
      console.error('Assignment failed:', error);
      toast.error(`Failed to assign category: ${error.message}`);
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
            Assign Category {job.isMultiple ? `(${job.selectedIds?.length || 0} jobs)` : `- ${job.wo_no || 'Unknown'}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Category</label>
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
              <p className="text-sm text-blue-600 mt-1">
                Workflow will be initialized with all stages in pending status.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isAssigning}>
              Cancel
            </Button>
            <Button onClick={handleAssignment} disabled={isAssigning || !selectedCategoryId}>
              {isAssigning ? "Assigning..." : "Assign Category"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
