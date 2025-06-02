
import React from "react";
import { ProductionStageCard } from "./ProductionStageCard";

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

interface ProductionStagesListProps {
  stages: ProductionStage[];
  onMoveStage: (stageId: string, direction: 'up' | 'down') => Promise<void>;
  onStageUpdate: () => void;
  onDeleteStage: (stageId: string) => Promise<boolean>;
}

export const ProductionStagesList: React.FC<ProductionStagesListProps> = ({
  stages,
  onMoveStage,
  onStageUpdate,
  onDeleteStage
}) => {
  const maxOrderIndex = Math.max(...stages.map(s => s.order_index), 0);

  if (stages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No production stages found. Create your first stage to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stages.map((stage) => (
        <ProductionStageCard
          key={stage.id}
          stage={stage}
          maxOrderIndex={maxOrderIndex}
          onMoveStage={onMoveStage}
          onStageUpdate={onStageUpdate}
          onDeleteStage={onDeleteStage}
        />
      ))}
    </div>
  );
};
