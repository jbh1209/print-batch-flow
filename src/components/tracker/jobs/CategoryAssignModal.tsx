
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProductionJob {
  id: string;
  wo_no: string;
  category_id?: string | null;
  isMultiple?: boolean;
  selectedIds?: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryAssignModalProps {
  job: ProductionJob;
  categories: Category[];
  onClose: () => void;
  onAssign: () => void;
}

export const CategoryAssignModal: React.FC<CategoryAssignModalProps> = ({
  job,
  categories,
  onClose,
  onAssign
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState(job.category_id || '');
  const [isLoading, setIsLoading] = useState(false);

  const isMultipleJobs = job.isMultiple && job.selectedIds && job.selectedIds.length > 1;

  const handleAssign = async () => {
    if (!selectedCategoryId) {
      toast.error('Please select a category');
      return;
    }

    setIsLoading(true);
    try {
      if (isMultipleJobs && job.selectedIds) {
        // Handle multiple jobs
        console.log('Assigning category to multiple jobs:', job.selectedIds);
        
        // Delete existing job stage instances for all selected jobs
        for (const jobId of job.selectedIds) {
          await supabase
            .from('job_stage_instances')
            .delete()
            .eq('job_id', jobId)
            .eq('job_table_name', 'production_jobs');
        }

        // Update all selected jobs with new category
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ 
            category_id: selectedCategoryId,
            updated_at: new Date().toISOString()
          })
          .in('id', job.selectedIds);

        if (updateError) throw updateError;

        // Initialize new workflow for all selected jobs
        for (const jobId of job.selectedIds) {
          const { error: initError } = await supabase.rpc('initialize_job_stages', {
            p_job_id: jobId,
            p_job_table_name: 'production_jobs',
            p_category_id: selectedCategoryId
          });

          if (initError) {
            console.error(`Failed to initialize workflow for job ${jobId}:`, initError);
            // Continue with other jobs even if one fails
          }
        }

        toast.success(`Category assigned and workflows initialized for ${job.selectedIds.length} jobs`);
      } else {
        // Handle single job
        console.log('Assigning category to single job:', job.id);
        
        // If job already has a category, we need to handle workflow reset
        if (job.category_id && job.category_id !== selectedCategoryId) {
          // Delete existing job stage instances
          await supabase
            .from('job_stage_instances')
            .delete()
            .eq('job_id', job.id)
            .eq('job_table_name', 'production_jobs');
        }

        // Update the job with new category
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ 
            category_id: selectedCategoryId,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (updateError) throw updateError;

        // Initialize new workflow
        const { error: initError } = await supabase.rpc('initialize_job_stages', {
          p_job_id: job.id,
          p_job_table_name: 'production_jobs',
          p_category_id: selectedCategoryId
        });

        if (initError) throw initError;

        toast.success(`Category assigned and workflow initialized for job ${job.wo_no}`);
      }
      
      onAssign();
      onClose();
    } catch (error) {
      console.error('Error assigning category:', error);
      toast.error('Failed to assign category');
    } finally {
      setIsLoading(false);
    }
  };

  const isChangingCategory = job.category_id && job.category_id !== selectedCategoryId;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isMultipleJobs ? `Assign Category to ${job.selectedIds?.length} Jobs` : 
             job.category_id ? 'Change Category' : 'Assign Category'}
          </DialogTitle>
          <DialogDescription>
            {isMultipleJobs ? 
              `Select a category for ${job.selectedIds?.length} selected jobs. This will determine the workflow stages for all jobs.` :
              `Select a category for job ${job.wo_no}. This will determine the workflow stages.`
            }
          </DialogDescription>
        </DialogHeader>

        {isChangingCategory && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Warning</p>
              <p className="text-amber-700">
                {isMultipleJobs ? 
                  'Changing the category will reset the current workflow progress for all selected jobs. All stage instances will be deleted and recreated.' :
                  'Changing the category will reset the current workflow progress. All stage instances will be deleted and recreated.'
                }
              </p>
            </div>
          </div>
        )}

        <div className="py-4">
          <Label className="text-base font-medium">Select Category</Label>
          <RadioGroup 
            value={selectedCategoryId} 
            onValueChange={setSelectedCategoryId}
            className="mt-3"
          >
            {categories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <RadioGroupItem value={category.id} id={category.id} />
                <Label 
                  htmlFor={category.id} 
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={isLoading || !selectedCategoryId}
          >
            {isLoading ? "Processing..." : 
             isMultipleJobs ? `Assign to ${job.selectedIds?.length} Jobs` :
             job.category_id ? "Change Category" : "Assign & Initialize"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
