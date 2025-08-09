import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEnhancedStageSpecifications } from "@/hooks/tracker/useEnhancedStageSpecifications";
import { specificationUnificationService } from "@/services/SpecificationUnificationService";
import { isPrintingStage } from "@/utils/stageUtils";
import { supabase } from "@/integrations/supabase/client";

interface SubSpecificationBadgeProps {
  jobId: string;
  stageId?: string | null;
  compact?: boolean;
  className?: string;
  partAssignment?: string;
}


export const SubSpecificationBadge: React.FC<SubSpecificationBadgeProps> = ({
  jobId,
  stageId,
  compact = false,
  className = "",
  partAssignment
}) => {
  const { specifications, isLoading } = useEnhancedStageSpecifications(jobId, stageId);
  const [unifiedSpecs, setUnifiedSpecs] = useState<any>(null);
  const [paperLoading, setPaperLoading] = useState(false);

  // Fetch unified specifications with paper details from stage notes
  useEffect(() => {
    const fetchUnifiedSpecs = async () => {
      if (!jobId) return;
      
      setPaperLoading(true);
      try {
        const result = await specificationUnificationService.getUnifiedSpecifications(jobId, 'production_jobs');
        
        // Also get paper specs from stage notes for the current stage
        if (stageId && partAssignment) {
          const { data: stageData } = await supabase
            .from('job_stage_instances')
            .select('notes, part_assignment')
            .eq('job_id', jobId)
            .eq('production_stage_id', stageId)
            .eq('part_assignment', partAssignment)
            .maybeSingle();
            
          if (stageData?.notes) {
            // Parse paper info from notes (format: "Bond 080gsm" or "FBB 230gsm")
            const paperMatch = stageData.notes.match(/([A-Za-z\s]+)\s+(\d+gsm)/);
            if (paperMatch) {
              const [, paperType, weight] = paperMatch;
              // Set the paper display in the result
              if (!result.textPaperDisplay) {
                result.textPaperDisplay = `${paperType.trim()} ${weight}`;
              }
              if (!result.coverPaperDisplay) {
                result.coverPaperDisplay = `${paperType.trim()} ${weight}`;
              }
            }
          }
        }
        
        setUnifiedSpecs(result);
      } catch (error) {
        console.error('Error fetching unified specifications:', error);
      } finally {
        setPaperLoading(false);
      }
    };

    fetchUnifiedSpecs();
  }, [jobId, stageId, partAssignment]);

  if (isLoading || paperLoading || !unifiedSpecs) {
    return (
      <Badge variant="outline" className={`text-xs animate-pulse ${className}`}>
        Loading...
      </Badge>
    );
  }

  // Early return for non-printing stages with basic stage name
  if (!specifications || !specifications.length) {
    // If we have a stage ID but no specifications, try to get the stage name
    if (stageId) {
      return (
        <Badge variant="outline" className={`text-xs bg-gray-50 border-gray-200 text-gray-700 ${className}`}>
          Stage
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className={`text-xs ${className}`}>
        No specs
      </Badge>
    );
  }

  // Filter specifications by part assignment if specified - no aggressive fallback
  const filteredSpecifications = partAssignment && partAssignment !== 'both' 
    ? specifications.filter(spec => {
        const specPart = spec.part_name || 'both';
        return specPart === 'both' || specPart === partAssignment;
      })
    : specifications;

  // Check if this is a printing stage that should show paper specs
  const shouldShowPaperSpecs = filteredSpecifications.some(spec => 
    isPrintingStage(spec.stage_name)
  );
  
  console.log(`🎯 SubSpecificationBadge Debug for job ${jobId}:`, {
    stageId,
    filteredSpecifications: filteredSpecifications.length,
    shouldShowPaperSpecs,
    hasUnifiedSpecs: !!unifiedSpecs,
    paperDisplay: unifiedSpecs?.textPaperDisplay || unifiedSpecs?.coverPaperDisplay,
    partAssignment
  });

  // Get part-specific paper specifications for printing stages
  let paperDisplay = '';
  if (shouldShowPaperSpecs && unifiedSpecs) {
    // First try to get from unifiedSpecs
    const stagePartAssignment = filteredSpecifications[0]?.part_name;
    paperDisplay = specificationUnificationService.getPartSpecificPaper(unifiedSpecs, stagePartAssignment);
  }
  
  // If no paperDisplay from unifiedSpecs, try to extract from notes field  
  if (!paperDisplay && filteredSpecifications.length > 0) {
    const notesWithPaper = filteredSpecifications.find(spec => spec.notes?.includes('Paper:'));
    if (notesWithPaper && notesWithPaper.notes) {
      const paperMatch = notesWithPaper.notes.match(/Paper:\s*(.+)/);
      if (paperMatch) {
        paperDisplay = paperMatch[1].trim();
      }
    }
  }

  if (compact) {
    // Show stage + sub-spec + paper in compact mode
    const primary = filteredSpecifications[0];
    if (!primary) {
      // Fallback to stage name if available
      return (
        <Badge variant="outline" className={`text-xs bg-gray-50 border-gray-200 text-gray-700 ${className}`}>
          {unifiedSpecs?.textPaperDisplay || unifiedSpecs?.coverPaperDisplay || 'Stage'}
        </Badge>
      );
    }
    const subSpec = primary.sub_specification || primary.stage_name;
    const displayText = paperDisplay && shouldShowPaperSpecs ? `${subSpec} | ${paperDisplay}` : subSpec;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge 
              variant="outline" 
              className={`text-xs bg-blue-50 border-blue-200 text-blue-700 ${className}`}
            >
              {displayText}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2">
              {filteredSpecifications.map((spec, index) => (
                <div key={index} className="text-sm">
                  <strong>{spec.stage_name}:</strong> {spec.sub_specification || 'Standard'}
                  {spec.part_name && <div className="text-xs opacity-75">Part: {spec.part_name}</div>}
                  {spec.quantity && <div className="text-xs opacity-75">Qty: {spec.quantity}</div>}
                </div>
              ))}
              {paperDisplay && shouldShowPaperSpecs && (
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
      {filteredSpecifications.map((spec, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className="text-xs bg-blue-50 border-blue-200 text-blue-700"
            >
              {spec.sub_specification || spec.stage_name}
            </Badge>
            {spec.part_name && (
              <Badge variant="secondary" className="text-xs">
                {spec.part_name}
              </Badge>
            )}
            {spec.quantity && (
              <span className="text-xs text-gray-500">
                ({spec.quantity})
              </span>
            )}
          </div>
          {paperDisplay && shouldShowPaperSpecs && (
            <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
              {paperDisplay}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
};