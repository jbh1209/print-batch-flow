
import React from "react";
import { Badge } from "@/components/ui/badge";
import { ProductionStageActions } from "./ProductionStageActions";

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

interface ProductionStageCardProps {
  stage: ProductionStage;
  maxOrderIndex: number;
  onMoveStage: (stageId: string, direction: 'up' | 'down') => Promise<void>;
  onStageUpdate: () => void;
  onDeleteStage: (stageId: string) => Promise<boolean>;
}

export const ProductionStageCard: React.FC<ProductionStageCardProps> = ({
  stage,
  maxOrderIndex,
  onMoveStage,
  onStageUpdate,
  onDeleteStage
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
            {stage.is_multi_part && <Badge variant="default">Multi-Part</Badge>}
          </div>
          {stage.description && (
            <p className="text-sm text-gray-600">{stage.description}</p>
          )}
          {stage.is_multi_part && stage.part_definitions.length > 0 && (
            <div className="flex gap-1 mt-1">
              {stage.part_definitions.map((part, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {part}
                </Badge>
              ))}
            </div>
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
