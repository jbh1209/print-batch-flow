
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ArrowRight, Trash2, RefreshCw } from "lucide-react";
import { useSafeCategoryManagement } from "@/hooks/tracker/useSafeCategoryManagement";

interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
}

interface SafeCategoryDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
  allCategories: Category[];
  onDeleted: () => void;
}

export const SafeCategoryDeleteDialog: React.FC<SafeCategoryDeleteDialogProps> = ({
  isOpen,
  onClose,
  category,
  allCategories,
  onDeleted
}) => {
  const {
    checkCategoryUsage,
    reassignJobsToCategory,
    safeDeleteCategory,
    isChecking,
    isReassigning,
    isDeleting
  } = useSafeCategoryManagement();

  const [usageStats, setUsageStats] = useState<any>(null);
  const [selectedTargetCategory, setSelectedTargetCategory] = useState<string>("");
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);
  const [step, setStep] = useState<'checking' | 'reassign' | 'confirm'>('checking');

  // Filter out the current category from available targets
  const availableCategories = allCategories.filter(cat => cat.id !== category.id);

  useEffect(() => {
    if (isOpen && category.id) {
      checkUsage();
    }
  }, [isOpen, category.id]);

  const checkUsage = async () => {
    setStep('checking');
    const stats = await checkCategoryUsage(category.id);
    setUsageStats(stats);
    
    if (stats?.can_delete) {
      setStep('confirm');
    } else {
      setStep('reassign');
    }
  };

  const handleReassign = async () => {
    if (!selectedTargetCategory) {
      return;
    }

    const result = await reassignJobsToCategory(category.id, selectedTargetCategory);
    if (result?.success) {
      // Recheck usage after reassignment
      await checkUsage();
    }
  };

  const handleDelete = async () => {
    const result = await safeDeleteCategory(category.id);
    if (result?.success) {
      onDeleted();
      onClose();
    }
  };

  const resetDialog = () => {
    setUsageStats(null);
    setSelectedTargetCategory("");
    setShowFinalConfirmation(false);
    setStep('checking');
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showFinalConfirmation} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete Category: {category.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {step === 'checking' && (
              <div className="flex items-center gap-2 py-4">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Checking category usage...</span>
              </div>
            )}

            {step === 'reassign' && usageStats && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Cannot delete category directly</strong>
                    <br />
                    {usageStats.blocking_reason}
                  </AlertDescription>
                </Alert>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Category Usage Statistics:</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Badge variant="outline">
                        {usageStats.production_jobs_count} Production Jobs
                      </Badge>
                    </div>
                    <div>
                      <Badge variant="outline">
                        {usageStats.job_stage_instances_count} Workflow Stages
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Step 1: Reassign Jobs to Another Category</h4>
                  <p className="text-sm text-gray-600">
                    Select a category to move all jobs and workflow stages to:
                  </p>
                  
                  <Select value={selectedTargetCategory} onValueChange={setSelectedTargetCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedTargetCategory && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: availableCategories.find(c => c.id === selectedTargetCategory)?.color }}
                        />
                        <span className="font-medium">
                          {availableCategories.find(c => c.id === selectedTargetCategory)?.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'confirm' && usageStats?.can_delete && (
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Category is ready for deletion. No jobs or workflow stages are currently using this category.
                  </AlertDescription>
                </Alert>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Safe to Delete</h4>
                  <p className="text-sm text-green-700">
                    This category can be safely deleted without affecting any existing jobs or workflows.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            
            {step === 'reassign' && (
              <Button 
                onClick={handleReassign}
                disabled={!selectedTargetCategory || isReassigning}
              >
                {isReassigning ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Reassigning...
                  </>
                ) : (
                  'Reassign Jobs'
                )}
              </Button>
            )}

            {step === 'confirm' && (
              <Button 
                variant="destructive"
                onClick={() => setShowFinalConfirmation(true)}
              >
                Delete Category
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showFinalConfirmation} onOpenChange={setShowFinalConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Final Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you absolutely sure you want to delete the category "{category.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Forever'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
