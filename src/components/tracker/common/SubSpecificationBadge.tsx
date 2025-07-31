import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEnhancedStageSpecifications } from "@/hooks/tracker/useEnhancedStageSpecifications";
import { supabase } from "@/integrations/supabase/client";
import { parsePaperSpecsFromNotes, formatPaperDisplay } from "@/utils/paperSpecUtils";

interface SubSpecificationBadgeProps {
  jobId: string;
  stageId?: string | null;
  compact?: boolean;
  className?: string;
  partAssignment?: string;
}

interface JobPrintSpecification {
  category: string;
  specification_id: string;
  name: string;
  display_name: string;
  properties: any;
}

export const SubSpecificationBadge: React.FC<SubSpecificationBadgeProps> = ({
  jobId,
  stageId,
  compact = false,
  className = "",
  partAssignment
}) => {
  const { specifications, isLoading } = useEnhancedStageSpecifications(jobId, stageId);
  const [paperSpecs, setPaperSpecs] = useState<JobPrintSpecification[]>([]);
  const [paperLoading, setPaperLoading] = useState(false);

  // Fetch paper specifications for the job
  useEffect(() => {
    const fetchPaperSpecs = async () => {
      if (!jobId) return;
      
      setPaperLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_job_specifications', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs'
        });

        if (error) throw error;
        
        let paperSpecs = (data || []).filter((spec: JobPrintSpecification) => 
          spec.category === 'paper_type' || spec.category === 'paper_weight'
        );
        
        // Filter by part assignment if specified (for virtual stage entries)
        if (partAssignment && partAssignment !== 'both') {
          paperSpecs = paperSpecs.filter(spec => {
            const specPart = (spec.properties as any)?.part_assignment || 'both';
            return specPart === 'both' || specPart === partAssignment;
          });
        }
        
        setPaperSpecs(paperSpecs);
      } catch (error) {
        console.error('Error fetching paper specifications:', error);
      } finally {
        setPaperLoading(false);
      }
    };

    fetchPaperSpecs();
  }, [jobId]);

  if (isLoading || paperLoading) {
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

  // Get paper details for display - first try from job_print_specifications, then from notes
  const paperType = paperSpecs.find(spec => spec.category === 'paper_type')?.display_name;
  const paperWeight = paperSpecs.find(spec => spec.category === 'paper_weight')?.display_name;
  let paperDisplay = [paperWeight, paperType].filter(Boolean).join(' ');
  
  // If no paper specs from job_print_specifications, try to extract from notes
  if (!paperDisplay && specifications.length > 0) {
    const notesWithPaper = specifications.find(spec => spec.notes?.toLowerCase().includes('paper:'));
    if (notesWithPaper) {
      const parsedPaper = parsePaperSpecsFromNotes(notesWithPaper.notes);
      paperDisplay = formatPaperDisplay(parsedPaper) || '';
    }
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
            <Badge 
              variant="outline" 
              className={`text-xs bg-blue-50 border-blue-200 text-blue-700 ${className}`}
            >
              {displayText}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2">
              {specifications.map((spec, index) => (
                <div key={index} className="text-sm">
                  <strong>{spec.stage_name}:</strong> {spec.sub_specification || 'Standard'}
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
          {paperDisplay && index === 0 && (
            <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
              {paperDisplay}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
};