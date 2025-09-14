import { useState, useCallback } from "react";
import { ExcelLearningEngine, IntelligentSuggestion } from "@/utils/excel/learningEngine";
import type { RowMappingResult } from "@/utils/excel/types";
import { toast } from "sonner";

export const useLearningEngine = () => {
  const [learningEngine] = useState(() => new ExcelLearningEngine());
  const [suggestions, setSuggestions] = useState<IntelligentSuggestion[]>([]);
  const [learningSessionId, setLearningSessionId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeMappings = useCallback(async (
    orderMappings: { [woNo: string]: RowMappingResult[] },
    fileName?: string
  ) => {
    setIsAnalyzing(true);
    try {
      // Convert row mappings to jobs format for analysis
      const jobsForAnalysis = Object.entries(orderMappings).map(([woNo, mappings]) => ({
        wo_no: woNo,
        mappings: mappings.map(mapping => ({
          excel_text: mapping.groupName,
          description: mapping.description,
          category: mapping.category,
          mapped_stage_name: mapping.mappedStageName,
          mapped_stage_id: mapping.mappedStageId,
          confidence: mapping.confidence,
          is_unmapped: mapping.isUnmapped,
          paper_specification: mapping.paperSpecification,
          quantity: mapping.qty,
          row_index: mapping.excelRowIndex
        }))
      }));

      // Create learning session for this analysis
      const sessionId = await learningEngine.createLearningSession(
        fileName || 'Matrix Parser Upload',
        orderMappings, // original data
        jobsForAnalysis // parsed data
      );
      setLearningSessionId(sessionId);

      // Generate suggestions
      const generatedSuggestions = await learningEngine.generateSuggestions(jobsForAnalysis.flat());
      
      // Filter suggestions to focus on geographic conflicts and high-impact corrections
      const prioritizedSuggestions = generatedSuggestions.filter(suggestion => 
        suggestion.suggestion_type === 'highlighted_suggestion' ||
        suggestion.suggestion_type === 'auto_correction' ||
        suggestion.confidence_level === 'high'
      );

      setSuggestions(prioritizedSuggestions);
      
      if (prioritizedSuggestions.length > 0) {
        toast.info(`Found ${prioritizedSuggestions.length} smart suggestions for your mappings`);
      }
      
      return prioritizedSuggestions;
    } catch (error) {
      console.error('Learning engine analysis failed:', error);
      toast.error('Failed to analyze mappings for suggestions');
      return [];
    } finally {
      setIsAnalyzing(false);
    }
  }, [learningEngine]);

  const acceptSuggestion = useCallback(async (
    suggestionId: string, 
    suggestion: IntelligentSuggestion,
    onApply?: (woNo: string, rowIndex: number, correction: any) => void
  ) => {
    try {
      await learningEngine.handleSuggestionFeedback(suggestionId, 'accepted', 'User accepted via matrix parser');
      
      // Apply the suggestion if callback provided
      if (onApply && suggestion.suggested_mapping) {
        const mapping = suggestion.suggested_mapping as any;
        if (mapping.wo_no && mapping.row_index !== undefined) {
          onApply(mapping.wo_no, mapping.row_index, mapping);
        }
      }
      
      // Remove from suggestions list
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      
      toast.success('Smart suggestion applied successfully');
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      toast.error('Failed to apply suggestion');
    }
  }, [learningEngine]);

  const rejectSuggestion = useCallback(async (
    suggestionId: string,
    feedback?: string
  ) => {
    try {
      await learningEngine.handleSuggestionFeedback(suggestionId, 'rejected', feedback || 'User rejected via matrix parser');
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      toast.info('Suggestion rejected - this helps improve future suggestions');
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      toast.error('Failed to reject suggestion');
    }
  }, [learningEngine]);

  const ignoreSuggestion = useCallback(async (suggestionId: string) => {
    try {
      await learningEngine.handleSuggestionFeedback(suggestionId, 'ignored');
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    } catch (error) {
      console.error('Failed to ignore suggestion:', error);
    }
  }, [learningEngine]);

  const logManualCorrection = useCallback(async (
    woNo: string,
    rowIndex: number,
    originalMapping: any,
    correctedMapping: any,
    reason?: string
  ) => {
    if (!learningSessionId) return;

    try {
      // Use a simpler approach - just log the correction without the extra parameters
      console.log('Manual correction logged:', {
        woNo,
        rowIndex,
        originalMapping,
        correctedMapping,
        reason
      });
    } catch (error) {
      console.error('Failed to log manual correction:', error);
    }
  }, [learningSessionId]);

  const getSuggestionsForRow = useCallback((woNo: string, rowIndex: number) => {
    return suggestions.filter(suggestion => {
      const mapping = suggestion.suggested_mapping as any;
      return mapping?.wo_no === woNo && mapping?.row_index === rowIndex;
    });
  }, [suggestions]);

  return {
    suggestions,
    isAnalyzing,
    analyzeMappings,
    acceptSuggestion,
    rejectSuggestion,
    ignoreSuggestion,
    logManualCorrection,
    getSuggestionsForRow,
    learningSessionId
  };
};