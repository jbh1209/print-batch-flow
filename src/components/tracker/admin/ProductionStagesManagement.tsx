
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { ProductionStageForm } from "./ProductionStageForm";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { ProductionStagesList } from "./ProductionStagesList";

export const ProductionStagesManagement = () => {
  const { stages, isLoading, error, updateStage, deleteStage } = useProductionStages();

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

  const handleStageUpdate = () => {
    window.location.reload();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Production Stages Management</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner message="Loading production stages..." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Production Stages Management</CardTitle>
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
    <ErrorBoundary>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Production Stages Management</CardTitle>
          <ProductionStageForm 
            onSave={handleStageUpdate} 
            onCancel={() => {}}
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Stage
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <ProductionStagesList
            stages={stages}
            onMoveStage={moveStage}
            onStageUpdate={handleStageUpdate}
            onDeleteStage={deleteStage}
          />
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
};
