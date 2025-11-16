import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEnhancedStageSpecifications } from "@/hooks/tracker/useEnhancedStageSpecifications";
import { supabase } from "@/integrations/supabase/client";
import { parsePaperSpecsFromNotes, formatPaperDisplay } from "@/utils/paperSpecUtils";

interface SubSpecificationBadgeProps {
  jobId: string;
  stageId?: string | null;
  stageName?: string;
  compact?: boolean;
  className?: string;
  partAssignment?: string | null;
  stageNotes?: string | null;
}

interface JobPrintSpecification {
  category: string;
  specification_id: string;
  name: string;
  display_name: string;
  properties: any;
}

// Helper to normalize various paper spec formats to a simple string
const toSimpleText = (val: unknown): string => {
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    // Extract string/number/boolean values from object
    return Object.values(val)
      .filter(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .map(String)
      .join(' ');
  }
  return '';
};

// Helper functions to detect stage types
const isPrintingStage = (stageName: string): boolean => {
  const name = stageName.toLowerCase();
  return name.includes('print') || 
         name.includes('7900') || 
         name.includes('t250') || 
         name.includes('hp12000') || 
         name.includes('hp 12000') ||
         name.includes('large format');
};

const isLaminationStage = (stageName: string): boolean => {
  const name = stageName.toLowerCase();
  return name.includes('laminat');
};

const isUVVarnishStage = (stageName: string): boolean => {
  const name = stageName.toLowerCase();
  return name.includes('uv') || name.includes('varnish');
};

export const SubSpecificationBadge: React.FC<SubSpecificationBadgeProps> = ({
  jobId,
  stageId,
  stageName = "",
  compact = false,
  className = "",
  partAssignment = null,
  stageNotes = null
}) => {
  const { specifications, isLoading } = useEnhancedStageSpecifications(jobId, stageId);
  const [paperSpecs, setPaperSpecs] = useState<JobPrintSpecification[]>([]);
  const [paperLoading, setPaperLoading] = useState(false);
  const [paperDisplayOverride, setPaperDisplayOverride] = useState<string | null>(null);

  // Fetch paper specifications for the job - use HP12000 stages data when partAssignment is provided
  // Only fetch paper specs for printing stages
  useEffect(() => {
    // Early return if this stage doesn't need paper specifications
    if (!isPrintingStage(stageName)) {
      setPaperSpecs([]);
      setPaperDisplayOverride(null);
      return;
    }
    const fetchPaperSpecs = async () => {
      if (!jobId) return;
      
      setPaperLoading(true);
      setPaperDisplayOverride(null);
      try {
        // Priority 0: If this specific stage instance has notes with Paper:, use that (matches schedule board logic)
        if (stageNotes && stageNotes.toLowerCase().includes('paper:')) {
          const parsed = parsePaperSpecsFromNotes(stageNotes);
          const display = formatPaperDisplay(parsed);
          if (display) {
            setPaperDisplayOverride(display);
            setPaperSpecs([]);
            return;
          }
        }
        // Priority 1: Use get_job_hp12000_stages, match by stage_instance_id first, then part_assignment
        const { data: hp12000Data, error: hp12000Error } = await supabase.rpc('get_job_hp12000_stages', {
          p_job_id: jobId
        });

        if (hp12000Error) throw hp12000Error;

        // Find exact match by stage_instance_id if available
        let stageData: any = stageId 
          ? (hp12000Data || []).find((stage: any) => stage.stage_instance_id === stageId)
          : null;

        // Fallback: match by part_assignment if no exact match
        if (!stageData && partAssignment && partAssignment !== 'both') {
          const normPart = String(partAssignment).toLowerCase();
          stageData = (hp12000Data || []).find((stage: any) => 
            String(stage.part_assignment || '').toLowerCase() === normPart
          );
        }

        if (stageData) {
          // Prioritize filtered_paper_specs, fallback to paper_specifications
          const rawPaperSpec = (stageData as any).filtered_paper_specs ?? stageData.paper_specifications;
          
          let paperText = '';
          if (typeof rawPaperSpec === 'string') {
            paperText = rawPaperSpec;
          } else if (rawPaperSpec && typeof rawPaperSpec === 'object') {
            if (Array.isArray(rawPaperSpec)) {
              // Array: join non-empty text values
              paperText = rawPaperSpec.map(toSimpleText).filter(Boolean).join(' ');
            } else {
              // Object: use first key if it's a keyed map, otherwise flatten
              const keys = Object.keys(rawPaperSpec);
              if (keys.length > 0) {
                // For compact display, use first key (typically the full paper description)
                paperText = keys[0];
              } else {
                paperText = toSimpleText(rawPaperSpec);
              }
            }
          }

          if (paperText) {
            setPaperDisplayOverride(paperText);
            setPaperSpecs([]); // Clear to avoid mixing sources
            return;
          }
        }

        // Fallback to job-level specifications
        const { data: jobSpecsData, error: jobSpecsError } = await supabase.rpc('get_job_specifications', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs'
        });

        if (jobSpecsError) throw jobSpecsError;
        
        let paperSpecs = (jobSpecsData || []).filter((spec: JobPrintSpecification) => 
          spec.category === 'paper_type' || spec.category === 'paper_weight'
        );

        // Filter by part assignment if specified (fallback filtering)
        if (partAssignment && partAssignment !== 'both') {
          const suffix = partAssignment === 'cover' ? '_Cover' : partAssignment === 'text' ? '_Text' : '';
          if (suffix) {
            paperSpecs = paperSpecs.filter(spec => spec.name.includes(suffix));
          }
        }
        
        setPaperSpecs(paperSpecs);
      } catch (error) {
        console.error('Error fetching paper specifications:', error);
      } finally {
        setPaperLoading(false);
      }
    };

    fetchPaperSpecs();
  }, [jobId, stageId, partAssignment, stageNotes, stageName]);

  if (isLoading || paperLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  // Don't show badge if no specifications AND no paper display for printing stages
  if ((!specifications || !specifications.length) && !paperDisplayOverride) {
    // Debug logging for printing stages with no paper display
    if (isPrintingStage(stageName)) {
      console.debug('[SubSpecificationBadge] No paper display found for printing stage', {
        jobId,
        stageId,
        stageName,
        partAssignment
      });
    }
    return null;
  }

  // Get paper details for display - prefer override from HP12000 RPC when available
  const paperType = paperSpecs.find(spec => spec.category === 'paper_type')?.display_name;
  const paperWeight = paperSpecs.find(spec => spec.category === 'paper_weight')?.display_name;
  let paperDisplay = (paperDisplayOverride || [paperWeight, paperType].filter(Boolean).join(' '));
  
// If no paper specs from job_print_specifications, try to extract from notes (prefer part-specific)
if (!paperDisplay && specifications.length > 0) {
  const normPart = (partAssignment || '').toLowerCase();
  let targetSpec = specifications.find(s => s.notes?.toLowerCase().includes('paper:') && (
    normPart === '' || normPart === 'both' ||
    (normPart === 'cover' && (s.part_name || '').toLowerCase().includes('cover')) ||
    (normPart === 'text' && (s.part_name || '').toLowerCase().includes('text'))
  ));
  // Fallback to any spec with Paper: if part-specific not found
  if (!targetSpec) {
    targetSpec = specifications.find(s => s.notes?.toLowerCase().includes('paper:'));
  }
  if (targetSpec?.notes) {
    const parsedPaper = parsePaperSpecsFromNotes(targetSpec.notes);
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