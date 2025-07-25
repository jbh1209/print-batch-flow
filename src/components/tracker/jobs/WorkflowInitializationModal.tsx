import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings, FolderOpen } from "lucide-react";
import { useCategories } from "@/hooks/tracker/useCategories";
import { useWorkflowInitialization } from "@/hooks/tracker/useWorkflowInitialization";
import { CustomWorkflowModal } from "./CustomWorkflowModal";
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
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { initializeWorkflow, isInitializing } = useWorkflowInitialization();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [workflowType, setWorkflowType] = useState<"category" | "custom">("category");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [selectedJobForCustom, setSelectedJobForCustom] = useState<any>(null);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const isSingleJob = jobs.length === 1;

  const handleCategoryWorkflow = async () => {
    if (!selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }

    try {
      let successCount = 0;
      
      for (const job of jobs) {
        const success = await initializeWorkflow(job.id, 'production_jobs', selectedCategoryId);
        if (success) successCount++;
      }

      if (successCount === jobs.length) {
        toast.success(`Successfully initialized ${successCount} job${jobs.length > 1 ? 's' : ''} with category workflow`);
        onSuccess();
        onClose();
      } else {
        toast.warning(`Initialized ${successCount} of ${jobs.length} jobs. Some may have already had workflows.`);
        onSuccess();
      }
    } catch (err) {
      console.error('Error in bulk workflow initialization:', err);
      toast.error("Failed to initialize workflows");
    }
  };

  const handleCustomWorkflow = () => {
    if (!isSingleJob) {
      toast.error("Custom workflows can only be created for individual jobs");
      return;
    }
    
    setSelectedJobForCustom(jobs[0]);
    setShowCustomModal(true);
  };

  const handleCustomWorkflowSuccess = () => {
    setShowCustomModal(false);
    setSelectedJobForCustom(null);
    onSuccess();
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[90vw] max-w-lg h-auto max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle>Initialize Production Workflow</DialogTitle>
            <DialogDescription>
              Choose how to set up the production workflow for {jobs.length} selected job{jobs.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            {/* Workflow Type Selection */}
            <div className="space-y-3">
              <Card 
                className={`cursor-pointer transition-all ${workflowType === 'category' ? 'ring-2 ring-green-500' : 'hover:bg-gray-50'}`}
                onClick={() => setWorkflowType('category')}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center space-x-2">
                    <FolderOpen className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm">Category Template</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-xs">
                    Use predefined stages from a product category. Best for standard jobs.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all ${workflowType === 'custom' ? 'ring-2 ring-green-500' : 'hover:bg-gray-50'} ${!isSingleJob ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => isSingleJob && setWorkflowType('custom')}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center space-x-2">
                    <Settings className="h-4 w-4 text-purple-600" />
                    <CardTitle className="text-sm">Custom Workflow</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-xs">
                    Manually select and order production stages. Perfect for unique jobs.
                    {!isSingleJob && (
                      <span className="block mt-1 text-red-600 text-xs">
                        * Only available for single jobs
                      </span>
                    )}
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            {/* Category Selection */}
            {workflowType === 'category' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Select Category
                  </label>
                  <Select 
                    value={selectedCategoryId} 
                    onValueChange={setSelectedCategoryId}
                    disabled={categoriesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: category.color }}
                            />
                            <span>{category.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCategory && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-sm mb-1">Category Details</h4>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><strong>SLA Target:</strong> {selectedCategory.sla_target_days} days</p>
                      {selectedCategory.description && (
                        <p><strong>Description:</strong> {selectedCategory.description}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Workflow Info */}
            {workflowType === 'custom' && (
              <div className="p-3 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-sm mb-1">Custom Workflow</h4>
                <p className="text-xs text-gray-600 mb-2">
                  You'll be able to select individual production stages and arrange them in your preferred order.
                </p>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-purple-700 border-purple-300 text-xs">
                    Job: {jobs[0]?.wo_no}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex justify-end space-x-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={isInitializing}
              size="sm"
            >
              Cancel
            </Button>
            
            {workflowType === 'category' ? (
              <Button 
                onClick={handleCategoryWorkflow}
                disabled={!selectedCategoryId || isInitializing || categoriesLoading}
                className="bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Initialize with Category
              </Button>
            ) : (
              <Button 
                onClick={handleCustomWorkflow}
                disabled={!isSingleJob}
                className="bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                Create Custom Workflow
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Workflow Modal */}
      {showCustomModal && selectedJobForCustom && (
        <CustomWorkflowModal
          isOpen={showCustomModal}
          onClose={() => {
            setShowCustomModal(false);
            setSelectedJobForCustom(null);
          }}
          job={selectedJobForCustom}
          onSuccess={handleCustomWorkflowSuccess}
        />
      )}
    </>
  );
};
