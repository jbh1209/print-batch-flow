import React from "react";
import { Badge } from "@/components/ui/badge";
import { ProductionStageActions } from "./ProductionStageActions";
import { Split } from "lucide-react";

interface ProductionStage {
  id: string;
  name: string;
  description?: string;
  order_index: number;
  color: string;
  is_active: boolean;
  supports_parts: boolean;
}

interface ProductionStageCardProps {
  stage: ProductionStage;
  maxOrderIndex: number;
  onMoveStage: (stageId: string, direction: 'up' | 'down') => Promise<void>;
  onStageUpdate: () => void;
  onDeleteStage: (stageId: string) => Promise<boolean>;
  allStages?: ProductionStage[];
}

export const ProductionStageCard: React.FC<ProductionStageCardProps> = ({
  stage,
  maxOrderIndex,
  onMoveStage,
  onStageUpdate,
  onDeleteStage,
  allStages = []
}) => {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{stage.name}</h3>
            <Badge variant="outline">Order: {stage.order_index}</Badge>
            {!stage.is_active && <Badge variant="secondary">Inactive</Badge>}
            {stage.supports_parts && (
              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                <Split className="h-3 w-3 mr-1" />
                Parts Support
              </Badge>
            )}
          </div>
          {stage.description && (
            <p className="text-sm text-gray-600">{stage.description}</p>
          )}
        </div>
      </div>
      <ProductionStageActions
        stage={stage}
        maxOrderIndex={maxOrderIndex}
        onMoveStage={onMoveStage}
        onStageUpdate={onStageUpdate}
        onDeleteStage={onDeleteStage}
      />
    </div>
  );
};