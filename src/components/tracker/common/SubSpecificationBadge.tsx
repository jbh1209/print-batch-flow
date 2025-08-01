import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEnhancedStageSpecifications } from "@/hooks/tracker/useEnhancedStageSpecifications";
import { supabase } from "@/integrations/supabase/client";
import { parsePaperSpecsFromNotes, formatPaperDisplay as formatPaperDisplayLegacy } from "@/utils/paperSpecUtils";
import { parseUnifiedSpecifications, formatPaperDisplay, type LegacySpecifications, type NormalizedSpecification } from "@/utils/specificationParser";
import { isPrintingStage } from "@/utils/stageUtils";

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
  const [legacyJobSpecs, setLegacyJobSpecs] = useState<LegacySpecifications | null>(null);
  const [paperLoading, setPaperLoading] = useState(false);

  // Fetch both normalized and legacy specifications
  useEffect(() => {
    const fetchAllSpecs = async () => {
      if (!jobId) return;
      
      setPaperLoading(true);
      try {
        // Fetch normalized specifications
        const { data: normalizedData, error: normalizedError } = await supabase.rpc('get_job_specifications', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs'
        });

        if (normalizedError) throw normalizedError;
        
        let normalizedSpecs = (normalizedData || []).filter((spec: JobPrintSpecification) => 
          spec.category === 'paper_type' || spec.category === 'paper_weight'
        );
        
        // Filter by part assignment if specified (for virtual stage entries)
        if (partAssignment && partAssignment !== 'both') {
          normalizedSpecs = normalizedSpecs.filter(spec => {
            const specPart = (spec.properties as any)?.part_assignment || 'both';
            return specPart === 'both' || specPart === partAssignment;
          });
        }
        
        setPaperSpecs(normalizedSpecs);

        // Fetch legacy specifications from production_jobs
        const { data: legacyData, error: legacyError } = await supabase
          .from('production_jobs')
          .select('paper_specifications, printing_specifications, finishing_specifications, delivery_specifications')
          .eq('id', jobId)
          .single();

        if (legacyError && legacyError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.warn('Error fetching legacy specifications:', legacyError);
        } else if (legacyData) {
          // Cast Json types to the expected format
          setLegacyJobSpecs({
            paper_specifications: legacyData.paper_specifications as Record<string, any> || {},
            printing_specifications: legacyData.printing_specifications as Record<string, any> || {},
            finishing_specifications: legacyData.finishing_specifications as Record<string, any> || {},
            delivery_specifications: legacyData.delivery_specifications as Record<string, any> || {}
          });
        }

      } catch (error) {
        console.error('Error fetching specifications:', error);
      } finally {
        setPaperLoading(false);
      }
    };

    fetchAllSpecs();
  }, [jobId, partAssignment]);

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

  // Get unified paper specifications only for printing stages
  let paperDisplay = '';
  if (shouldShowPaperSpecs) {
    const normalizedSpecs: NormalizedSpecification[] = paperSpecs.map(spec => ({
      category: spec.category,
      specification_id: spec.specification_id,
      name: spec.name,
      display_name: spec.display_name,
      properties: spec.properties
    }));

    const unifiedSpecs = parseUnifiedSpecifications(legacyJobSpecs, normalizedSpecs);
    paperDisplay = formatPaperDisplay(unifiedSpecs) || '';
    
    // If still no paper display, try to extract from filtered notes (legacy fallback)
    if (!paperDisplay && filteredSpecifications.length > 0) {
      const notesWithPaper = filteredSpecifications.find(spec => spec.notes?.toLowerCase().includes('paper:'));
      if (notesWithPaper) {
        const parsedPaper = parsePaperSpecsFromNotes(notesWithPaper.notes);
        paperDisplay = formatPaperDisplayLegacy(parsedPaper) || '';
      }
    }
  }

  if (compact) {
    // Show stage + sub-spec + paper in compact mode
    const primary = filteredSpecifications[0];
    if (!primary) {
      return (
        <Badge variant="secondary" className={`text-xs ${className}`}>
          No specs
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