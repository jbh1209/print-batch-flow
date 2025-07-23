
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Package, Hash, Layers } from "lucide-react";
import { useCategoryParts } from "@/hooks/tracker/useCategoryParts";

interface PartAssignmentIndicatorProps {
  categoryId?: string;
  partAssignments?: Array<{
    part_name: string;
    quantity: number;
    stage_name: string;
  }>;
  compact?: boolean;
  className?: string;
}

export const PartAssignmentIndicator: React.FC<PartAssignmentIndicatorProps> = ({
  categoryId,
  partAssignments = [],
  compact = false,
  className = ""
}) => {
  const { hasMultiPartStages } = useCategoryParts(categoryId);

  if (!hasMultiPartStages && partAssignments.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {partAssignments.length > 0 ? (
          <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
            <Package className="h-3 w-3 mr-1" />
            {partAssignments.length} Parts
          </Badge>
        ) : hasMultiPartStages ? (
          <Badge variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-700">
            <Package className="h-3 w-3 mr-1" />
            Parts Needed
          </Badge>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {partAssignments.length > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
            <Package className="h-3 w-3" />
            Part Assignments
          </div>
          {partAssignments.map((assignment, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3 text-blue-500" />
                {assignment.part_name}
              </span>
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3 text-gray-400" />
                <span className="font-medium">{assignment.quantity}</span>
                <span className="text-gray-500">({assignment.stage_name})</span>
              </div>
            </div>
          ))}
        </div>
      ) : hasMultiPartStages ? (
        <Badge variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-700">
          <Package className="h-3 w-3 mr-1" />
          Part assignment required
        </Badge>
      ) : null}
    </div>
  );
};
