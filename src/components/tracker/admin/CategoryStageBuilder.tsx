import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCategoryStages } from "@/hooks/tracker/useCategoryStages";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WorkflowStageCard } from "./WorkflowStageCard";
import { WorkflowPreview } from "./WorkflowPreview";
import { validateWorkflow, getWorkflowMetrics } from "@/utils/tracker/workflowValidation";
import { WorkflowSyncDialog } from "./WorkflowSyncDialog";

interface CategoryStageBuilderProps {
  categoryId: string;
  categoryName: string;
}

export const CategoryStageBuilder = ({ categoryId, categoryName }: CategoryStageBuilderProps) => {
  const { categoryStages, isLoading, error, addStageToCategory, updateCategoryStage, removeCategoryStage, reorderCategoryStages, fixStageOrdering } = useCategoryStages(categoryId);
  const { stages: availableStages } = useProductionStages();
  
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [estimatedHours, setEstimatedHours] = useState<number>(24);
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Validation
  const validation = validateWorkflow(categoryStages);
  const metrics = getWorkflowMetrics(categoryStages);

  const selectedStage = availableStages.find(stage => stage.id === selectedStageId);

  const handleStageOperationComplete = () => {
    // Automatically check for workflow changes after any stage operation
    setShowSyncDialog(true);
  };

  const handleAddStage = async () => {
    if (!selectedStageId) return;

    const nextOrder = Math.max(...categoryStages.map(s => s.stage_order), 0) + 1;
    
    const success = await addStageToCategory(categoryId, {
      production_stage_id: selectedStageId,
      stage_order: nextOrder,
      estimated_duration_hours: estimatedHours,
      is_required: true
    });

    if (success) {
      setSelectedStageId("");
      setEstimatedHours(24);
      handleStageOperationComplete();
    }
  };

  const handleUpdateStage = async (id: string, duration: number) => {
    const success = await updateCategoryStage(id, { estimated_duration_hours: duration });
    if (success) {
      handleStageOperationComplete();
    }
  };

  const handleRemoveStage = async (id: string) => {
    const success = await removeCategoryStage(id);
    if (success) {
      handleStageOperationComplete();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categoryStages.findIndex(stage => stage.id === String(active.id));
    const newIndex = categoryStages.findIndex(stage => stage.id === String(over.id));

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedStages = arrayMove(categoryStages, oldIndex, newIndex);
    
    // Update stage orders based on new positions
    const reorderData = reorderedStages.map((stage, index) => ({
      id: stage.id,
      stage_order: index + 1
    }));

    try {
      const success = await reorderCategoryStages(categoryId, reorderData);
      if (success) {
        handleStageOperationComplete();
      }
    } catch (error) {
      console.error('Failed to reorder stages:', error);
    }
  };

  const handleStageSelection = (stageId: string) => {
    setSelectedStageId(stageId);
  };

  const handleFixOrdering = async () => {
    const success = await fixStageOrdering(categoryId);
    if (success) {
      toast.success("Stage ordering fixed successfully");
    } else {
      toast.error("Failed to fix stage ordering");
    }
  };

  // Filter out stages that are already added to this category
  const usedStageIds = categoryStages.map(cs => cs.production_stage_id);
  const availableStagesFiltered = availableStages.filter(stage => 
    !usedStageIds.includes(stage.id) && stage.is_active
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Builder - {categoryName}</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner message="Loading workflow..." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Builder - {categoryName}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Create a sorted list of stages for consistent ordering
  const sortedCategoryStages = [...categoryStages].sort((a, b) => a.stage_order - b.stage_order);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Workflow Builder - {categoryName}
            <Badge variant="outline" className={`${validation.isValid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {validation.isValid ? 'Valid' : 'Invalid'}
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {metrics.complexity}
            </Badge>
            {validation.warnings.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleFixOrdering}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                Fix Ordering
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSyncDialog(true)}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Sync Jobs
            </Button>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Build the production workflow by adding and ordering stages. Jobs in this category will follow this exact sequence.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Validation Messages */}
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validation.errors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validation.warnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <div key={index}>• {warning}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Add New Stage */}
          <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="stage-select">Add Production Stage</Label>
                <Select value={selectedStageId} onValueChange={handleStageSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a production stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStagesFiltered.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="duration">Estimated Hours</Label>
                <Input
                  id="duration"
                  type="number"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(parseInt(e.target.value) || 24)}
                  className="w-24"
                  min="1"
                  max="168"
                />
              </div>
              
              <Button 
                onClick={handleAddStage} 
                disabled={!selectedStageId}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Stage
              </Button>
            </div>

          </div>

          {/* Current Workflow */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Current Workflow</h3>
              {sortedCategoryStages.length > 0 && (
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{metrics.totalStages} stages</span>
                  <span>{metrics.totalDuration}h total</span>
                  <span>{metrics.estimatedDays} days</span>
                </div>
              )}
            </div>

            {sortedCategoryStages.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="space-y-2">
                  <div className="text-lg font-medium">No stages added yet</div>
                  <div className="text-sm">Add your first production stage above to start building the workflow</div>
                </div>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortedCategoryStages.map(stage => stage.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {sortedCategoryStages.map((stage, index) => (
                      <WorkflowStageCard
                        key={stage.id}
                        stage={{
                          ...stage,
                          applies_to_parts: [],
                          part_rule_type: 'all_parts' as const,
                          production_stage: {
                            ...stage.production_stage
                          }
                        }}
                        onUpdate={handleUpdateStage}
                        onRemove={handleRemoveStage}
                        isFirst={index === 0}
                        isLast={index === sortedCategoryStages.length - 1}
                        totalStages={sortedCategoryStages.length}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Preview */}
      <WorkflowPreview categoryName={categoryName} stages={sortedCategoryStages} />

      {/* Workflow Sync Dialog */}
      <WorkflowSyncDialog
        isOpen={showSyncDialog}
        onClose={() => setShowSyncDialog(false)}
        categoryId={categoryId}
        categoryName={categoryName}
        onSyncComplete={() => {
          // Optionally refresh data or show success message
          console.log('Workflow sync completed');
        }}
      />
    </div>
  );
};
