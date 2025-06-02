
import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, MoveUp, MoveDown } from "lucide-react";
import { ProductionStageForm } from "./ProductionStageForm";
import { StagePermissionsManager } from "./StagePermissionsManager";
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
  is_multi_part: boolean;
  part_definitions: string[];
}

interface ProductionStageActionsProps {
  stage: ProductionStage;
  maxOrderIndex: number;
  onMoveStage: (stageId: string, direction: 'up' | 'down') => Promise<void>;
  onStageUpdate: () => void;
  onDeleteStage: (stageId: string) => Promise<void>;
}

export const ProductionStageActions: React.FC<ProductionStageActionsProps> = ({
  stage,
  maxOrderIndex,
  onMoveStage,
  onStageUpdate,
  onDeleteStage
}) => {
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
            <AlertDialogAction onClick={() => onDeleteStage(stage.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
