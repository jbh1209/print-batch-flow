import { supabase } from "@/integrations/supabase/client";

export interface IntelligentSuggestion {
  id?: string;
  suggestion_type: 'auto_correction' | 'highlighted_suggestion' | 'warning';
  confidence_level: 'high' | 'medium' | 'low';
  row_index: number;
  excel_text: string;
  original_mapping?: any;
  suggested_mapping: any;
  reasoning: string;
  pattern_id?: string;
  user_action?: 'accepted' | 'rejected' | 'ignored';
}

export interface LearningSession {
  id?: string;
  file_name: string;
  original_data: any;
  parsed_data: any;
  suggestions_generated: IntelligentSuggestion[];
  manual_corrections_count: number;
  session_completed: boolean;
}

export interface ManualCorrection {
  correction_type: 'stage_mapping' | 'paper_spec' | 'delivery_method' | 'address_pattern' | 'ignore_row';
  original_excel_text: string;
  original_system_mapping?: any;
  corrected_mapping: any;
  confidence_before?: number;
  row_index: number;
  correction_reason?: string;
}

export interface LearnedPattern {
  id?: string;
  pattern_type: 'geographic_delivery' | 'paper_spec_fix' | 'duplicate_detection' | 'stage_mapping';
  excel_text_pattern: string;
  learned_mapping: any;
  confidence_score: number;
  usage_count: number;
  accuracy_rate: number;
  is_active: boolean;
}

export class ExcelLearningEngine {
  private currentSessionId?: string;

  // Create a new learning session
  async createLearningSession(fileName: string, originalData: any, parsedData: any): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User must be authenticated to create learning session');

    const { data, error } = await supabase
      .from('excel_import_learning_sessions')
      .insert({
        file_name: fileName,
        uploaded_by: user.id,
        original_data: originalData,
        parsed_data: parsedData,
        suggestions_generated: [],
        manual_corrections_count: 0,
        session_completed: false
      })
      .select('id')
      .single();

    if (error) throw error;
    
    this.currentSessionId = data.id;
    return data.id;
  }

  // Generate intelligent suggestions based on learned patterns
  async generateSuggestions(jobs: any[]): Promise<IntelligentSuggestion[]> {
    if (!this.currentSessionId) throw new Error('No active learning session');

    const suggestions: IntelligentSuggestion[] = [];
    
    // Get active learned patterns
    const { data: patterns } = await supabase
      .from('learned_correction_patterns')
      .select('*')
      .eq('is_active', true)
      .order('accuracy_rate', { ascending: false });

    if (!patterns) return suggestions;

    // Get geographic delivery patterns
    const { data: geoPatterns } = await supabase
      .from('geographic_delivery_patterns')
      .select('*')
      .eq('is_active', true);

    // Analyze each job for potential suggestions
    for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
      const job = jobs[jobIndex];
      
      // 1. Geographic delivery conflict detection
      const deliveryConflicts = this.detectDeliveryConflicts(job, geoPatterns || []);
      suggestions.push(...deliveryConflicts.map(conflict => ({
        suggestion_type: 'highlighted_suggestion' as const,
        confidence_level: 'high' as const,
        row_index: jobIndex,
        excel_text: job.delivery_specifications ? JSON.stringify(job.delivery_specifications) : '',
        suggested_mapping: conflict.suggested_correction,
        reasoning: conflict.reasoning
      })));

      // 2. Duplicate detection
      const duplicateWarnings = await this.detectDuplicatePatterns(job, jobIndex);
      suggestions.push(...duplicateWarnings);

      // 3. Paper specification corrections
      const paperCorrections = this.suggestPaperCorrections(job, jobIndex, patterns);
      suggestions.push(...paperCorrections);

      // 4. Stage mapping improvements
      const stageImprovements = this.suggestStageImprovements(job, jobIndex, patterns);
      suggestions.push(...stageImprovements);
    }

    // Store suggestions in database
    if (suggestions.length > 0) {
      const { error } = await supabase
        .from('intelligent_suggestions')
        .insert(
          suggestions.map(suggestion => ({
            learning_session_id: this.currentSessionId,
            suggestion_type: suggestion.suggestion_type,
            confidence_level: suggestion.confidence_level,
            row_index: suggestion.row_index,
            excel_text: suggestion.excel_text,
            original_mapping: suggestion.original_mapping || null,
            suggested_mapping: suggestion.suggested_mapping,
            reasoning: suggestion.reasoning,
            pattern_id: suggestion.pattern_id || null
          }))
        );

      if (error) console.error('Error storing suggestions:', error);

      // Update session with generated suggestions
      await supabase
        .from('excel_import_learning_sessions')
        .update({
          suggestions_generated: suggestions as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentSessionId);
    }

    return suggestions;
  }

  // Detect geographic delivery conflicts (like your East London example)
  private detectDeliveryConflicts(job: any, geoPatterns: any[]): Array<{
    suggested_correction: any;
    reasoning: string;
  }> {
    const conflicts = [];
    
    if (!job.delivery_specifications) return conflicts;
    
    const deliveryText = JSON.stringify(job.delivery_specifications).toLowerCase();
    const hasCollection = deliveryText.includes('collection') || deliveryText.includes('collect');
    
    // Check for geographic conflicts
    for (const pattern of geoPatterns) {
      const locationPattern = pattern.location_pattern.toLowerCase();
      
      if (deliveryText.includes(locationPattern)) {
        // East London + Collection = Should be courier
        if (hasCollection && pattern.delivery_method === 'courier') {
          conflicts.push({
            suggested_correction: {
              delivery_method: 'courier',
              service_level: pattern.min_service_level || 'overnight',
              original_conflict: 'Collection specified but location requires courier delivery'
            },
            reasoning: `${pattern.location_pattern} requires ${pattern.min_service_level || 'overnight'} courier delivery, but collection was specified. This is a geographic impossibility - suggest courier instead.`
          });
        }
      }
    }

    return conflicts;
  }

  // Detect potential duplicates from lazy copy-paste
  private async detectDuplicatePatterns(job: any, jobIndex: number): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    // Look for common duplicate indicators
    const duplicateIndicators = [
      'old line item',
      'delete this',
      'remove',
      'not needed',
      'duplicate',
      'copy of'
    ];

    const jobText = JSON.stringify(job).toLowerCase();
    
    for (const indicator of duplicateIndicators) {
      if (jobText.includes(indicator)) {
        suggestions.push({
          suggestion_type: 'warning',
          confidence_level: 'medium',
          row_index: jobIndex,
          excel_text: jobText,
          suggested_mapping: { action: 'review_for_removal' },
          reasoning: `Detected potential duplicate or outdated line item. Contains "${indicator}" which suggests this may be leftover from copying a previous quote.`
        });
      }
    }

    return suggestions;
  }

  // Suggest paper specification corrections based on learned patterns
  private suggestPaperCorrections(job: any, jobIndex: number, patterns: any[]): IntelligentSuggestion[] {
    const suggestions: IntelligentSuggestion[] = [];
    
    if (!job.paper_specifications) return suggestions;
    
    const paperText = JSON.stringify(job.paper_specifications);
    
    for (const pattern of patterns) {
      if (pattern.pattern_type === 'paper_spec_fix' && 
          paperText.includes(pattern.excel_text_pattern)) {
        
        suggestions.push({
          suggestion_type: pattern.confidence_score > 80 ? 'auto_correction' : 'highlighted_suggestion',
          confidence_level: pattern.confidence_score > 80 ? 'high' : 'medium',
          row_index: jobIndex,
          excel_text: paperText,
          suggested_mapping: pattern.learned_mapping,
          reasoning: `Based on ${pattern.usage_count} previous corrections (${Math.round(pattern.accuracy_rate * 100)}% accuracy), this paper specification should be: ${JSON.stringify(pattern.learned_mapping)}`,
          pattern_id: pattern.id
        });
      }
    }

    return suggestions;
  }

  // Suggest stage mapping improvements
  private suggestStageImprovements(job: any, jobIndex: number, patterns: any[]): IntelligentSuggestion[] {
    const suggestions: IntelligentSuggestion[] = [];
    
    // Look for stage mapping patterns in the job data
    const jobText = JSON.stringify(job);
    
    for (const pattern of patterns) {
      if (pattern.pattern_type === 'stage_mapping' && 
          jobText.includes(pattern.excel_text_pattern)) {
        
        suggestions.push({
          suggestion_type: pattern.confidence_score > 85 ? 'auto_correction' : 'highlighted_suggestion',
          confidence_level: pattern.confidence_score > 85 ? 'high' : 'medium',
          row_index: jobIndex,
          excel_text: jobText,
          suggested_mapping: pattern.learned_mapping,
          reasoning: `Stage mapping suggestion based on ${pattern.usage_count} previous corrections with ${Math.round(pattern.accuracy_rate * 100)}% accuracy`,
          pattern_id: pattern.id
        });
      }
    }

    return suggestions;
  }

  // Log manual corrections for learning
  async logManualCorrection(correction: ManualCorrection): Promise<void> {
    if (!this.currentSessionId) return;

    const { error } = await supabase
      .from('manual_corrections_log')
      .insert({
        learning_session_id: this.currentSessionId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        ...correction
      });

    if (error) console.error('Error logging correction:', error);

    // Update the learned patterns based on this correction
    await this.updateLearnedPatterns(correction);

    // Update session correction count
    await supabase
      .from('excel_import_learning_sessions')
      .update({ 
        manual_corrections_count: await this.getSessionCorrectionCount(),
        updated_at: new Date().toISOString()
      })
      .eq('id', this.currentSessionId);
  }

  // Update or create learned patterns from manual corrections
  private async updateLearnedPatterns(correction: ManualCorrection): Promise<void> {
    // Try to find existing pattern
    const { data: existingPattern } = await supabase
      .from('learned_correction_patterns')
      .select('*')
      .eq('pattern_type', correction.correction_type)
      .eq('excel_text_pattern', correction.original_excel_text)
      .single();

    if (existingPattern) {
      // Update existing pattern
      await supabase.rpc('update_pattern_accuracy', {
        p_pattern_id: existingPattern.id,
        p_was_correct: true // User made this correction, so it's correct
      });
    } else {
      // Create new pattern
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      const { error } = await supabase
        .from('learned_correction_patterns')
        .insert({
          pattern_type: correction.correction_type,
          excel_text_pattern: correction.original_excel_text,
          learned_mapping: correction.corrected_mapping,
          confidence_score: 70, // Start with moderate confidence
          usage_count: 1,
          accuracy_rate: 1.0, // 100% initially
          is_active: true,
          created_by: userId
        });

      if (error) console.error('Error creating learned pattern:', error);
    }
  }

  // Handle user feedback on suggestions
  async handleSuggestionFeedback(suggestionId: string, action: 'accepted' | 'rejected' | 'ignored', feedback?: string): Promise<void> {
    const { error } = await supabase
      .from('intelligent_suggestions')
      .update({
        user_action: action,
        user_feedback: feedback,
        applied_at: new Date().toISOString()
      })
      .eq('id', suggestionId);

    if (error) console.error('Error updating suggestion feedback:', error);

    // Update pattern accuracy based on feedback
    if (action !== 'ignored') {
      const { data: suggestion } = await supabase
        .from('intelligent_suggestions')
        .select('pattern_id')
        .eq('id', suggestionId)
        .single();

      if (suggestion?.pattern_id) {
        await supabase.rpc('update_pattern_accuracy', {
          p_pattern_id: suggestion.pattern_id,
          p_was_correct: action === 'accepted'
        });
      }
    }
  }

  // Complete the learning session
  async completeSession(): Promise<void> {
    if (!this.currentSessionId) return;

    await supabase
      .from('excel_import_learning_sessions')
      .update({
        session_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.currentSessionId);

    this.currentSessionId = undefined;
  }

  private async getSessionCorrectionCount(): Promise<number> {
    if (!this.currentSessionId) return 0;

    const { count } = await supabase
      .from('manual_corrections_log')
      .select('*', { count: 'exact', head: true })
      .eq('learning_session_id', this.currentSessionId);

    return count || 0;
  }

  // Get suggestions for current session
  async getSessionSuggestions(): Promise<IntelligentSuggestion[]> {
    if (!this.currentSessionId) return [];

    const { data, error } = await supabase
      .from('intelligent_suggestions')
      .select('*')
      .eq('learning_session_id', this.currentSessionId)
      .order('confidence_level', { ascending: false });

    if (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      suggestion_type: item.suggestion_type as 'auto_correction' | 'highlighted_suggestion' | 'warning',
      confidence_level: item.confidence_level as 'high' | 'medium' | 'low',
      row_index: item.row_index,
      excel_text: item.excel_text,
      original_mapping: item.original_mapping,
      suggested_mapping: item.suggested_mapping,
      reasoning: item.reasoning,
      pattern_id: item.pattern_id,
      user_action: item.user_action as 'accepted' | 'rejected' | 'ignored' | undefined
    }));
  }
}