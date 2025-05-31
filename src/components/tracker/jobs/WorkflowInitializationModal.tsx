
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Package, Clock, AlertTriangle } from "lucide-react";
import { useCategories } from "@/hooks/tracker/useCategories";
import { useWorkflowInitialization } from "@/hooks/tracker/useWorkflowInitialization";
import { toast } from "sonner";

interface WorkflowInitializationModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: any[];
  onSuccess: () => void;
}

export const WorkflowInitializationModal: React.FC<WorkflowInitializationModalProps> = ({
  isOpen,
  onClose,
  jobs,
  onSuccess
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { initializeWorkflow, isInitializing } = useWorkflowInitialization();

  const handleInitialize = async () => {
    if (!selectedCategoryId) {
      toast.error('Please select a category');
      return;
    }

    console.log('Initializing workflow for jobs:', jobs);
    
    let successCount = 0;
    let errorCount = 0;

    for (const job of jobs) {
      try {
        const success = await initializeWorkflow(job.id, 'production_jobs', selectedCategoryId);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Failed to initialize workflow for job ${job.wo_no}:`, error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Workflow initialized for ${successCount} job(s)`);
    }
    
    if (errorCount > 0) {
      toast.error(`Failed to initialize ${errorCount} job(s)`);
    }

    onSuccess();
    onClose();
    setSelectedCategoryId("");
  };

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
  const jobsWithoutCategory = jobs.filter(job => !job.category_id);
  const jobsWithCategory = jobs.filter(job => job.category_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Initialize Production Workflow
          </DialogTitle>
          <DialogDescription>
            Set up production stages for the selected jobs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job Summary */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Selected Jobs ({jobs.length})</h4>
            
            {jobsWithoutCategory.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-green-600">✓ Ready for workflow initialization:</div>
                <div className="space-y-1">
                  {jobsWithoutCategory.slice(0, 3).map((job) => (
                    <div key={job.id} className="flex items-center gap-2 text-sm">
                      <Package className="h-3 w-3 text-gray-400" />
                      <span className="font-medium">{job.wo_no}</span>
                      {job.customer && <span className="text-gray-600">- {job.customer}</span>}
                    </div>
                  ))}
                  {jobsWithoutCategory.length > 3 && (
                    <div className="text-xs text-gray-500 ml-5">
                      +{jobsWithoutCategory.length - 3} more jobs
                    </div>
                  )}
                </div>
              </div>
            )}

            {jobsWithCategory.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Already have categories (will be skipped):
                </div>
                <div className="space-y-1">
                  {jobsWithCategory.slice(0, 2).map((job) => (
                    <div key={job.id} className="flex items-center gap-2 text-sm">
                      <Package className="h-3 w-3 text-gray-400" />
                      <span className="font-medium">{job.wo_no}</span>
                      <Badge variant="outline" className="text-xs">
                        {job.category}
                      </Badge>
                    </div>
                  ))}
                  {jobsWithCategory.length > 2 && (
                    <div className="text-xs text-gray-500 ml-5">
                      +{jobsWithCategory.length - 2} more jobs
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Category Selection */}
          {jobsWithoutCategory.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Select Production Category</h4>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
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

              {selectedCategory && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-blue-900">
                        {selectedCategory.name}
                      </div>
                      <div className="text-blue-700">
                        Target completion: {selectedCategory.sla_target_days} days
                      </div>
                      {selectedCategory.description && (
                        <div className="text-blue-600 mt-1">
                          {selectedCategory.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button 
            onClick={handleInitialize}
            disabled={isInitializing || categoriesLoading || (jobsWithoutCategory.length > 0 && !selectedCategoryId)}
            className="w-full sm:w-auto"
          >
            {isInitializing ? 'Initializing...' : `Initialize Workflow${jobsWithoutCategory.length > 0 ? ` (${jobsWithoutCategory.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
