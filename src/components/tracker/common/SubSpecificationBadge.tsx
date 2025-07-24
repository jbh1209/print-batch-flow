import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEnhancedStageSpecifications } from "@/hooks/tracker/useEnhancedStageSpecifications";

interface SubSpecificationBadgeProps {
  jobId: string;
  stageId?: string | null;
  compact?: boolean;
  className?: string;
}

export const SubSpecificationBadge: React.FC<SubSpecificationBadgeProps> = ({
  jobId,
  stageId,
  compact = false,
  className = ""
}) => {
  const { specifications, isLoading } = useEnhancedStageSpecifications(jobId, stageId);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  if (!specifications || !specifications.length) {
    return (
      <Badge variant="secondary" className={`text-xs ${className}`}>
        No specs
      </Badge>
    );
  }

  if (compact) {
    // Show only the primary specification in compact mode
    const primary = specifications[0];
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge 
              variant="outline" 
              className={`text-xs bg-blue-50 border-blue-200 text-blue-700 ${className}`}
            >
              {primary.sub_specification || primary.stage_name}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              {specifications.map((spec, index) => (
                <div key={index} className="text-sm">
                  <strong>{spec.stage_name}:</strong> {spec.sub_specification || 'Standard'}
                  {spec.part_name && <div className="text-xs opacity-75">Part: {spec.part_name}</div>}
                  {spec.quantity && <div className="text-xs opacity-75">Qty: {spec.quantity}</div>}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full view - show all specifications
  return (
    <div className={`space-y-1 ${className}`}>
      {specifications.map((spec, index) => (
        <div key={index} className="space-y-1">
          <Badge 
            variant="outline" 
            className="text-xs bg-blue-50 border-blue-200 text-blue-700"
          >
            {spec.sub_specification || spec.stage_name}
          </Badge>
          {spec.part_name && (
            <Badge variant="secondary" className="text-xs ml-1">
              {spec.part_name}
            </Badge>
          )}
          {spec.quantity && (
            <span className="text-xs text-gray-500 ml-1">
              ({spec.quantity})
            </span>
          )}
        </div>
      ))}
    </div>
  );
};