import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, MoveUp, MoveDown, Settings } from "lucide-react";
import { ProductionStageForm } from "./ProductionStageForm";
import { StagePermissionsManager } from "./StagePermissionsManager";
import { StageSpecificationsManager } from "./StageSpecificationsManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

interface ProductionStage {
  id: string;
  name: string;
  description?: string;
  order_index: number;
  color: string;
  is_active: boolean;
  supports_parts: boolean;
  // Enhanced timing fields
  running_speed_per_hour?: number;
  make_ready_time_minutes?: number;
  speed_unit?: 'sheets_per_hour' | 'items_per_hour' | 'minutes_per_item';
}

interface ProductionStageActionsProps {
  stage: ProductionStage;
  maxOrderIndex: number;
  onMoveStage: (stageId: string, direction: 'up' | 'down') => Promise<void>;
  onStageUpdate: () => void;
  onDeleteStage: (stageId: string) => Promise<boolean>;
}

export const ProductionStageActions: React.FC<ProductionStageActionsProps> = ({
  stage,
  maxOrderIndex,
  onMoveStage,
  onStageUpdate,
  onDeleteStage
}) => {
  const [isSpecsDialogOpen, setIsSpecsDialogOpen] = useState(false);

  const handleDelete = async () => {
    await onDeleteStage(stage.id);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMoveStage(stage.id, 'up')}
          disabled={stage.order_index === 1}
        >
          <MoveUp className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMoveStage(stage.id, 'down')}
          disabled={stage.order_index === maxOrderIndex}
        >
          <MoveDown className="h-3 w-3" />
        </Button>
      </div>
      
      {/* Stage Specifications Manager */}
      <Dialog open={isSpecsDialogOpen} onOpenChange={setIsSpecsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" title="Manage Specifications">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Specifications - {stage.name}</DialogTitle>
          </DialogHeader>
          <StageSpecificationsManager 
            stage={stage} 
            onUpdate={() => {
              // Optionally refresh stage data
              onStageUpdate();
            }}
          />
        </DialogContent>
      </Dialog>
      
      <StagePermissionsManager stage={stage} />
      
      <ProductionStageForm 
        stage={stage} 
        onSave={onStageUpdate}
        onCancel={() => {}}
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
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};