
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle, Plus, Minus, ArrowUpDown } from "lucide-react";
import { WorkflowSyncService } from "@/services/WorkflowSyncService";

interface WorkflowSyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
  onSyncComplete: () => void;
}

export const WorkflowSyncDialog = ({ isOpen, onClose, categoryId, categoryName, onSyncComplete }: WorkflowSyncDialogProps) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSync, setIsSync] = useState(false);
  const [changes, setChanges] = useState<any>(null);
  const [syncOptions, setSyncOptions] = useState({
    addNewStages: true,
    removeObsoleteStages: true,
    updateStageOrders: true
  });

  useEffect(() => {
    if (isOpen && categoryId) {
      detectChanges();
    }
  }, [isOpen, categoryId]);

  const detectChanges = async () => {
    setIsDetecting(true);
    try {
      const changeDetection = await WorkflowSyncService.detectWorkflowChanges(categoryId);
      setChanges(changeDetection);
    } catch (error) {
      console.error('Error detecting changes:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSync = async () => {
    setIsSync(true);
    try {
      const success = await WorkflowSyncService.syncJobsToWorkflow(categoryId, syncOptions);
      if (success) {
        onSyncComplete();
        onClose();
      }
    } catch (error) {
      console.error('Error syncing workflow:', error);
    } finally {
      setIsSync(false);
    }
  };

  const handleSyncOptionChange = (option: keyof typeof syncOptions, checked: boolean) => {
    setSyncOptions(prev => ({ ...prev, [option]: checked }));
  };

  if (isDetecting) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detecting Workflow Changes</DialogTitle>
            <DialogDescription>
              Analyzing existing jobs against the updated workflow...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!changes) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {changes.hasChanges ? (
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            Workflow Changes Detected - {categoryName}
          </DialogTitle>
          <DialogDescription>
            {changes.hasChanges 
              ? `Found workflow changes affecting ${changes.affectedJobsCount} active jobs.`
              : "No workflow changes detected. All jobs are up to date."
            }
          </DialogDescription>
        </DialogHeader>

        {changes.hasChanges ? (
          <div className="space-y-6">
            {/* Change Summary */}
            <div className="space-y-4">
              {changes.changeDetails.addedStages.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Added Stages ({changes.changeDetails.addedStages.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {changes.changeDetails.addedStages.map((stage, index) => (
                      <Badge key={index} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {stage.stage_name} (Order: {stage.stage_order})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {changes.changeDetails.removedStages.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Minus className="h-4 w-4 text-red-600" />
                    <span className="font-medium">Removed Stages ({changes.changeDetails.removedStages.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {changes.changeDetails.removedStages.map((stage, index) => (
                      <Badge key={index} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {stage.stage_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {changes.changeDetails.reorderedStages.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpDown className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Reordered Stages ({changes.changeDetails.reorderedStages.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {changes.changeDetails.reorderedStages.map((stage, index) => (
                      <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {stage.stage_name} ({stage.old_order} → {stage.new_order})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sync Options */}
            <div className="space-y-4">
              <h4 className="font-medium">Synchronization Options</h4>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="addNewStages"
                    checked={syncOptions.addNewStages}
                    onCheckedChange={(checked) => handleSyncOptionChange('addNewStages', !!checked)}
                  />
                  <label htmlFor="addNewStages" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Add new stages to existing jobs
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="removeObsoleteStages"
                    checked={syncOptions.removeObsoleteStages}
                    onCheckedChange={(checked) => handleSyncOptionChange('removeObsoleteStages', !!checked)}
                  />
                  <label htmlFor="removeObsoleteStages" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Remove stages that are no longer in workflow
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="updateStageOrders"
                    checked={syncOptions.updateStageOrders}
                    onCheckedChange={(checked) => handleSyncOptionChange('updateStageOrders', !!checked)}
                  />
                  <label htmlFor="updateStageOrders" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Update stage order to match workflow
                  </label>
                </div>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will only affect jobs with pending stages. Completed or in-progress stages will not be modified.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600">All jobs are already synchronized with the current workflow.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {changes.hasChanges && (
            <Button 
              onClick={handleSync} 
              disabled={isSync || (!syncOptions.addNewStages && !syncOptions.removeObsoleteStages && !syncOptions.updateStageOrders)}
            >
              {isSync ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Syncing Jobs...
                </>
              ) : (
                `Sync ${changes.affectedJobsCount} Jobs`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
