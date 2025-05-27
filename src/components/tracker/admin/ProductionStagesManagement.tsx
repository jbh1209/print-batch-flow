
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Edit, MoveUp, MoveDown } from "lucide-react";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { ProductionStageForm } from "./ProductionStageForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const ProductionStagesManagement = () => {
  const { stages, isLoading, createStage, updateStage, deleteStage } = useProductionStages();

  const moveStage = async (stageId: string, direction: 'up' | 'down') => {
    const currentStage = stages.find(s => s.id === stageId);
    if (!currentStage) return;

    const currentIndex = currentStage.order_index;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    const targetStage = stages.find(s => s.order_index === targetIndex);
    if (!targetStage) return;

    // Swap order indices
    await updateStage(currentStage.id, { order_index: targetIndex });
    await updateStage(targetStage.id, { order_index: currentIndex });
  };

  const maxOrderIndex = Math.max(...stages.map(s => s.order_index), 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Production Stages Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading production stages...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Production Stages Management</CardTitle>
        <ProductionStageForm onSubmit={createStage} maxOrderIndex={maxOrderIndex} />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveStage(stage.id, 'up')}
                    disabled={stage.order_index === 1}
                  >
                    <MoveUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveStage(stage.id, 'down')}
                    disabled={stage.order_index === maxOrderIndex}
                  >
                    <MoveDown className="h-3 w-3" />
                  </Button>
                </div>
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{stage.name}</h3>
                    <Badge variant="outline">Order: {stage.order_index}</Badge>
                    {!stage.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {stage.description && (
                    <p className="text-sm text-gray-600">{stage.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ProductionStageForm 
                  stage={stage} 
                  onSubmit={(data) => updateStage(stage.id, data)}
                  maxOrderIndex={maxOrderIndex}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  }
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Production Stage</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{stage.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteStage(stage.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {stages.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No production stages found. Create your first stage to get started.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
