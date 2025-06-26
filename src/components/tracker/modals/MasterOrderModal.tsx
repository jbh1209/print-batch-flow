
import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Play, 
  Pause, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  User,
  Calendar,
  Package,
  FileText,
  Shield,
  Tags
} from "lucide-react";
import { useJobStageManagement } from "@/hooks/tracker/useJobStageManagement";
import { useStageActions } from "@/hooks/tracker/stage-management/useStageActions";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useProductionCategories } from "@/hooks/tracker/useProductionCategories";
import { batchAssignJobCategory } from "@/services/tracker/batchCategoryAssignmentService";
import { toast } from "sonner";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { MasterOrderModalAdminControls } from "./MasterOrderModalAdminControls";

interface MasterOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: AccessibleJob | null;
  onRefresh?: () => void;
}

export const MasterOrderModal: React.FC<MasterOrderModalProps> = ({
  isOpen,
  onClose,
  job,
  onRefresh
}) => {
  const [notes, setNotes] = useState("");
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [showAdminControls, setShowAdminControls] = useState(false);
  const [isAssigningCategory, setIsAssigningCategory] = useState(false);
  
  const { isManager, isAdmin } = useUserRole();
  const { categories } = useProductionCategories();
  const { startStage, completeStage, isProcessing } = useStageActions();
  
  const {
    jobStages,
    isLoading,
    refreshStages,
    getWorkflowProgress
  } = useJobStageManagement({
    jobId: job?.job_id || '',
    jobTableName: 'production_jobs',
    categoryId: job?.category_id
  });

  // Memoized refresh function to prevent infinite re-renders
  const handleRefresh = useCallback(async () => {
    if (job && isOpen) {
      await refreshStages();
    }
  }, [job, isOpen, refreshStages]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  const handleCategoryChange = async (newCategoryId: string) => {
    if (!job || !canUseAdminControls) return;
    
    setIsAssigningCategory(true);
    try {
      const result = await batchAssignJobCategory([job.job_id], newCategoryId);
      
      if (result.successCount > 0) {
        toast.success("Category updated successfully");
        await handleRefresh();
        onRefresh?.();
      } else {
        toast.error("Failed to update category");
      }
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error("Failed to update category");
    } finally {
      setIsAssigningCategory(false);
    }
  };

  if (!job) return null;

  const progress = getWorkflowProgress();
  const canUseAdminControls = isManager || isAdmin;

  const handleStageAction = async (stageId: string, action: 'start' | 'complete' | 'hold') => {
    try {
      let success = false;
      
      switch (action) {
        case 'start':
          success = await startStage(stageId);
          break;
        case 'complete':
          success = await completeStage(stageId, notes);
          setNotes("");
          break;
        case 'hold':
          // TODO: Implement hold functionality
          toast.info("Hold functionality coming soon");
          return;
      }

      if (success) {
        await refreshStages();
        onRefresh?.();
      }
    } catch (error) {
      console.error(`Failed to ${action} stage:`, error);
      toast.error(`Failed to ${action} stage`);
    }
  };

  const getStageStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="h-4 w-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
  };

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-orange-100 text-orange-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Master Order: {job.wo_no}
            </DialogTitle>
            {canUseAdminControls && (
              <Button
                variant={showAdminControls ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAdminControls(!showAdminControls)}
                className="flex items-center gap-2"
              >
                <Shield className="h-4 w-4" />
                {showAdminControls ? "Hide" : "Show"} Admin Controls
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Information */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-500">Customer</label>
              <p className="font-medium">{job.customer}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Reference</label>
              <p className="font-medium">{job.reference || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Due Date</label>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {job.due_date || 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Quantity</label>
              <p className="font-medium">{job.qty || 'N/A'}</p>
            </div>
            
            {/* Category Control - Full Width Row */}
            <div className="col-span-2 md:col-span-4">
              <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <Tags className="h-4 w-4" />
                Category
              </label>
              {canUseAdminControls ? (
                <Select
                  value={job.category_id || ""}
                  onValueChange={handleCategoryChange}
                  disabled={isAssigningCategory}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Category</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  {job.category_id ? (
                    <>
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: job.category_color }}
                      />
                      <span className="font-medium">{job.category_name}</span>
                    </>
                  ) : (
                    <span className="text-gray-500 italic">No Category</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Workflow Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Workflow Progress</h3>
              <Badge variant="outline">
                {progress.completed}/{progress.total} stages ({progress.percentage}%)
              </Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>

          {/* Stages List */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Production Stages</h3>
            {isLoading ? (
              <div className="text-center py-4">Loading stages...</div>
            ) : (
              <div className="space-y-2">
                {jobStages.map((stage) => (
                  <div key={stage.id}>
                    {showAdminControls && canUseAdminControls ? (
                      <MasterOrderModalAdminControls
                        stage={stage}
                        onRefresh={handleRefresh}
                      />
                    ) : (
                      <div
                        className={`p-4 border rounded-lg transition-colors ${
                          selectedStageId === stage.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                        onClick={() => setSelectedStageId(selectedStageId === stage.id ? null : stage.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStageStatusIcon(stage.status)}
                            <div>
                              <h4 className="font-medium">{stage.production_stage.name}</h4>
                              {stage.part_name && (
                                <p className="text-sm text-gray-600">Part: {stage.part_name}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={getStageStatusColor(stage.status)}>
                              {stage.status}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              Order: {stage.stage_order}
                            </span>
                          </div>
                        </div>

                        {/* Stage Details */}
                        {selectedStageId === stage.id && (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              {stage.started_at && (
                                <div>
                                  <label className="font-medium text-gray-500">Started At</label>
                                  <p>{new Date(stage.started_at).toLocaleString()}</p>
                                </div>
                              )}
                              {stage.completed_at && (
                                <div>
                                  <label className="font-medium text-gray-500">Completed At</label>
                                  <p>{new Date(stage.completed_at).toLocaleString()}</p>
                                </div>
                              )}
                              {stage.started_by && (
                                <div>
                                  <label className="font-medium text-gray-500">Started By</label>
                                  <p className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    User ID: {stage.started_by}
                                  </p>
                                </div>
                              )}
                              {stage.notes && (
                                <div className="col-span-2">
                                  <label className="font-medium text-gray-500">Notes</label>
                                  <p className="text-gray-700">{stage.notes}</p>
                                </div>
                              )}
                            </div>

                            {/* Basic Stage Actions for Non-Admin Users */}
                            {!showAdminControls && (
                              <div className="flex items-center gap-2">
                                {stage.status === 'pending' && (
                                  <Button
                                    onClick={() => handleStageAction(stage.id, 'start')}
                                    disabled={isProcessing}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                                  >
                                    <Play className="h-4 w-4" />
                                    Start Stage
                                  </Button>
                                )}
                                
                                {stage.status === 'active' && (
                                  <>
                                    <Button
                                      onClick={() => handleStageAction(stage.id, 'complete')}
                                      disabled={isProcessing}
                                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                      Complete Stage
                                    </Button>
                                    <Button
                                      onClick={() => handleStageAction(stage.id, 'hold')}
                                      disabled={isProcessing}
                                      variant="outline"
                                      className="flex items-center gap-2"
                                    >
                                      <Pause className="h-4 w-4" />
                                      Hold
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Notes input for completion */}
                            {stage.status === 'active' && !showAdminControls && (
                              <div className="space-y-2">
                                <Label htmlFor="completion-notes">Completion Notes (Optional)</Label>
                                <Textarea
                                  id="completion-notes"
                                  placeholder="Add notes about this stage completion..."
                                  value={notes}
                                  onChange={(e) => setNotes(e.target.value)}
                                  className="min-h-[80px]"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
