import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEnhancedStageSpecifications } from "@/hooks/tracker/useEnhancedStageSpecifications";
import { parsePaperSpecsFromNotes, formatPaperDisplay, extractPaperDisplayFromSpecDetails } from "@/utils/paperSpecUtils";

interface SubSpecificationBadgeProps {
  jobId: string;
  stageId?: string | null;
  stageName?: string;
  compact?: boolean;
  className?: string;
  partAssignment?: string | null;
  stageNotes?: string | null;
}

// Helper: detect printing stages
const isPrintingStage = (stageName: string): boolean => {
  const name = (stageName || "").toLowerCase();
  return (
    name.includes("print") ||
    name.includes("7900") ||
    name.includes("t250") ||
    name.includes("hp12000") ||
    name.includes("hp 12000") ||
    name.includes("large format")
  );
};

export const SubSpecificationBadge: React.FC<SubSpecificationBadgeProps> = ({
  jobId,
  stageId,
  stageName = "",
  compact = false,
  className = "",
  partAssignment = null,
  stageNotes = null,
}) => {
  const { specifications, isLoading } = useEnhancedStageSpecifications(jobId, stageId);

  const targetSpec = useMemo(() => {
    if (!specifications?.length) return undefined;

    // 1) Exact match by stage instance id
    const exact = stageId ? specifications.find((s) => s.stage_id === stageId) : undefined;
    if (exact) return exact;

    // 2) Match by part assignment (cover/text)
    const normPart = (partAssignment || "").toLowerCase();
    if (normPart && normPart !== "both") {
      const partMatch = specifications.find((s) => (s.part_name || "").toLowerCase().includes(normPart));
      if (partMatch) return partMatch;
    }

    // 3) Fallback to first
    return specifications[0];
  }, [specifications, stageId, partAssignment]);

  const paperDisplay = useMemo(() => {
    if (!isPrintingStage(stageName)) return undefined;

    // A) Highest priority: matrix parser details
    const fromDetails = extractPaperDisplayFromSpecDetails(targetSpec?.specification_details);
    if (fromDetails) return fromDetails;

    // B) Stage notes (prop)
    if (stageNotes && stageNotes.toLowerCase().includes("paper:")) {
      const parsed = parsePaperSpecsFromNotes(stageNotes);
      const disp = formatPaperDisplay(parsed);
      if (disp) return disp;
    }

    // C) Target spec notes
    if (targetSpec?.notes) {
      const parsed = parsePaperSpecsFromNotes(targetSpec.notes);
      const disp = formatPaperDisplay(parsed);
      if (disp) return disp;
    }

    return undefined;
  }, [targetSpec, stageNotes, stageName]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  // Don't show badge if no specifications AND no paper display for printing stages
  if ((!specifications || !specifications.length) && !paperDisplay) {
    if (isPrintingStage(stageName)) {
      console.debug("[SubSpecificationBadge] No paper display found for printing stage", {
        jobId,
        stageId,
        stageName,
        partAssignment,
      });
    }
    return null;
  }

  if (compact) {
    // Show stage + sub-spec + paper in compact mode
    const primary = specifications[0];
    const subSpec = primary.sub_specification || primary.stage_name;
    const displayText = paperDisplay ? `${subSpec} | ${paperDisplay}` : subSpec;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className={`text-xs bg-blue-50 border-blue-200 text-blue-700 ${className}`}>
              {displayText}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2">
              {specifications.map((spec, index) => (
                <div key={index} className="text-sm">
                  <strong>{spec.stage_name}:</strong> {spec.sub_specification || "Standard"}
                  {spec.part_name && <div className="text-xs opacity-75">Part: {spec.part_name}</div>}
                  {spec.quantity && <div className="text-xs opacity-75">Qty: {spec.quantity}</div>}
                </div>
              ))}
              {paperDisplay && (
                <div className="text-sm border-t pt-1">
                  <strong>Paper:</strong> {paperDisplay}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full view - show all specifications with paper details
  return (
    <div className={`space-y-2 ${className}`}>
      {specifications.map((spec, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {spec.sub_specification || spec.stage_name}
            </Badge>
            {index === 0 && paperDisplay && (
              <Badge variant="success" className="text-xs">
                Paper: {paperDisplay}
              </Badge>
            )}
          </div>
          <div className="text-xs opacity-75">
            {spec.part_name && <span className="mr-2">Part: {spec.part_name}</span>}
            {spec.quantity && <span>Qty: {spec.quantity}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SubSpecificationBadge;
