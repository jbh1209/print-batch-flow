
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Clock } from "lucide-react";
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
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCategoryStages } from "@/hooks/tracker/useCategoryStages";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface CategoryStageBuilderProps {
  categoryId: string;
  categoryName: string;
}

interface SortableStageItemProps {
  stage: any;
  onUpdate: (id: string, duration: number) => void;
  onRemove: (id: string) => void;
}

const SortableStageItem = ({ stage, onUpdate, onRemove }: SortableStageItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>
      
      <div
        className="w-4 h-4 rounded-full"
        style={{ backgroundColor: stage.production_stage.color }}
      />
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{stage.production_stage.name}</span>
          <Badge variant="outline">Step {stage.stage_order}</Badge>
        </div>
        {stage.production_stage.description && (
          <p className="text-sm text-gray-600">{stage.production_stage.description}</p>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-400" />
        <Input
          type="number"
          value={stage.estimated_duration_hours}
          onChange={(e) => onUpdate(stage.id, parseInt(e.target.value) || 24)}
          className="w-20"
          min="1"
        />
        <span className="text-sm text-gray-500">hrs</span>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onRemove(stage.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const CategoryStageBuilder = ({ categoryId, categoryName }: CategoryStageBuilderProps) => {
  const { categoryStages, isLoading, error, addStageToCategory, updateCategoryStage, removeCategoryStage, reorderCategoryStages } = useCategoryStages(categoryId);
  const { stages: availableStages } = useProductionStages();
  
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [estimatedHours, setEstimatedHours] = useState<number>(24);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = categoryStages.findIndex(stage => stage.id === active.id);
      const newIndex = categoryStages.findIndex(stage => stage.id === over?.id);

      const reorderedStages = arrayMove(categoryStages, oldIndex, newIndex);
      
      // Update stage orders
      const reorderData = reorderedStages.map((stage, index) => ({
        id: stage.id,
        stage_order: index + 1
      }));

      await reorderCategoryStages(categoryId, reorderData);
    }
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
    }
  };

  const handleUpdateStage = async (id: string, duration: number) => {
    await updateCategoryStage(id, { estimated_duration_hours: duration });
  };

  const handleRemoveStage = async (id: string) => {
    await removeCategoryStage(id);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Builder - {categoryName}</CardTitle>
        <p className="text-sm text-gray-600">
          Build the production workflow by adding and ordering stages. Jobs in this category will follow this exact sequence.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Stage */}
        <div className="flex items-end gap-3 p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <Label htmlFor="stage-select">Add Production Stage</Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
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
            />
          </div>
          
          <Button 
            onClick={handleAddStage} 
            disabled={!selectedStageId}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Stage
          </Button>
        </div>

        {/* Current Workflow */}
        <div>
          <h3 className="text-lg font-medium mb-3">Current Workflow</h3>
          {categoryStages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No stages added yet. Add your first production stage above.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={categoryStages.map(stage => stage.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {categoryStages.map((stage) => (
                    <SortableStageItem
                      key={stage.id}
                      stage={stage}
                      onUpdate={handleUpdateStage}
                      onRemove={handleRemoveStage}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Workflow Summary */}
        {categoryStages.length > 0 && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Workflow Summary</h4>
            <div className="text-sm text-blue-800">
              <p>Total Stages: {categoryStages.length}</p>
              <p>Estimated Total Time: {categoryStages.reduce((sum, stage) => sum + stage.estimated_duration_hours, 0)} hours</p>
              <p className="mt-2">
                Jobs in this category will flow through: {' '}
                <span className="font-medium">
                  {categoryStages.map(s => s.production_stage.name).join(' → ')}
                </span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
