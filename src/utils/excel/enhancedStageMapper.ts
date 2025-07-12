import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from './debugger';
import type { GroupSpecifications, RowMappingResult, StageMapping } from './types';

export interface MappingConfidence {
  stageId: string;
  stageName: string;
  confidence: number;
  source: 'database' | 'fuzzy' | 'pattern';
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'unknown';
}

export class EnhancedStageMapper {
  private stages: any[] = [];
  private existingMappings: Map<string, any> = new Map();
  
  constructor(private logger: ExcelImportDebugger) {}

  async initialize(): Promise<void> {
    this.logger.addDebugInfo("Initializing enhanced stage mapper...");
    
    // Load production stages
    const { data: stagesData, error: stagesError } = await supabase
      .from('production_stages')
      .select('*')
      .eq('is_active', true);
    
    if (stagesError) {
      throw new Error(`Failed to load production stages: ${stagesError.message}`);
    }
    
    this.stages = stagesData || [];
    
    // Load existing excel mappings
    const { data: mappingsData, error: mappingsError } = await supabase
      .from('excel_import_mappings')
      .select('*')
      .eq('is_verified', true)
      .order('confidence_score', { ascending: false });
    
    if (mappingsError) {
      this.logger.addDebugInfo(`Warning: Could not load existing mappings: ${mappingsError.message}`);
    } else {
      // Index mappings by text for quick lookup
      (mappingsData || []).forEach(mapping => {
        const key = mapping.excel_text.toLowerCase().trim();
        if (!this.existingMappings.has(key) || 
            (this.existingMappings.get(key)?.confidence_score || 0) < mapping.confidence_score) {
          this.existingMappings.set(key, mapping);
        }
      });
      this.logger.addDebugInfo(`Loaded ${this.existingMappings.size} verified mappings`);
    }
  }

  /**
   * Create intelligent row mappings with database-driven and fuzzy matching
   */
  createIntelligentRowMappings(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    excelRows: any[][],
    headers: string[]
  ): RowMappingResult[] {
    const rowMappings: RowMappingResult[] = [];
    let rowIndex = 0;

    // Process printing specifications
    if (printingSpecs) {
      rowMappings.push(...this.createCategoryRowMappings(
        printingSpecs, 'printing', excelRows, headers, rowIndex
      ));
      rowIndex += Object.keys(printingSpecs).length;
    }

    // Process finishing specifications
    if (finishingSpecs) {
      rowMappings.push(...this.createCategoryRowMappings(
        finishingSpecs, 'finishing', excelRows, headers, rowIndex
      ));
      rowIndex += Object.keys(finishingSpecs).length;
    }

    // Process prepress specifications
    if (prepressSpecs) {
      rowMappings.push(...this.createCategoryRowMappings(
        prepressSpecs, 'prepress', excelRows, headers, rowIndex
      ));
    }

    // Learn from new mappings
    this.learnFromMappings(rowMappings);

    return rowMappings;
  }

  /**
   * Create row mappings for a specific category with intelligent matching
   */
  private createCategoryRowMappings(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery',
    excelRows: any[][],
    headers: string[],
    startRowIndex: number
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    let currentRowIndex = startRowIndex;

    for (const [groupName, spec] of Object.entries(specs)) {
      const stageMapping = this.findIntelligentStageMatch(groupName, spec.description || '', category);
      
      mappings.push({
        excelRowIndex: currentRowIndex,
        excelData: excelRows[currentRowIndex] || [],
        groupName,
        description: spec.description || '',
        qty: spec.qty || 0,
        woQty: spec.wo_qty || 0,
        mappedStageId: stageMapping?.stageId || null,
        mappedStageName: stageMapping?.stageName || null,
        confidence: stageMapping?.confidence || 0,
        category: stageMapping?.category || category,
        isUnmapped: !stageMapping || stageMapping.confidence < 30,
        manualOverride: false
      });

      currentRowIndex++;
    }

    return mappings;
  }

  /**
   * Intelligent stage matching using multiple strategies
   */
  private findIntelligentStageMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery'
  ): MappingConfidence | null {
    const searchText = `${groupName} ${description}`.toLowerCase().trim();
    
    // Strategy 1: Database mapping lookup (highest confidence)
    const dbMapping = this.findDatabaseMapping(searchText);
    if (dbMapping) {
      const stage = this.stages.find(s => s.id === dbMapping.production_stage_id);
      if (stage) {
        return {
          stageId: stage.id,
          stageName: stage.name,
          confidence: Math.min(dbMapping.confidence_score + 10, 100), // Boost verified mappings
          source: 'database',
          category: this.inferStageCategory(stage.name)
        };
      }
    }

    // Strategy 2: Fuzzy string matching (medium confidence)
    const fuzzyMatch = this.findFuzzyMatch(searchText, category);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    // Strategy 3: Pattern-based matching (lower confidence)
    const patternMatch = this.findPatternMatch(groupName, description, category);
    if (patternMatch) {
      return patternMatch;
    }

    this.logger.addDebugInfo(`No intelligent match found for: ${groupName} (${description})`);
    return null;
  }

  /**
   * Find mapping in existing database
   */
  private findDatabaseMapping(searchText: string): any | null {
    // Exact match
    if (this.existingMappings.has(searchText)) {
      return this.existingMappings.get(searchText);
    }

    // Partial match
    for (const [mappedText, mapping] of this.existingMappings.entries()) {
      if (searchText.includes(mappedText) || mappedText.includes(searchText)) {
        // Reduce confidence for partial matches
        return {
          ...mapping,
          confidence_score: Math.max(mapping.confidence_score - 20, 50)
        };
      }
    }

    return null;
  }

  /**
   * Fuzzy string matching against stage names
   */
  private findFuzzyMatch(searchText: string, category: string): MappingConfidence | null {
    const categoryStages = this.stages.filter(stage => 
      this.inferStageCategory(stage.name) === category
    );

    let bestMatch: MappingConfidence | null = null;
    let bestScore = 0;

    for (const stage of categoryStages) {
      const stageName = stage.name.toLowerCase();
      const score = this.calculateSimilarity(searchText, stageName);
      
      if (score > bestScore && score > 0.4) { // Minimum 40% similarity
        bestScore = score;
        bestMatch = {
          stageId: stage.id,
          stageName: stage.name,
          confidence: Math.round(score * 80), // Max 80% confidence for fuzzy matches
          source: 'fuzzy',
          category: this.inferStageCategory(stage.name)
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return 1 - (distance / maxLen);
  }

  /**
   * Pattern-based matching (fallback)
   */
  private findPatternMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery'
  ): MappingConfidence | null {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Enhanced pattern matching with more specific patterns
    const enhancedPatterns = {
      printing: [
        { patterns: ['hp 12000', 'hp12000', '12000'], stageName: 'Printing - HP 12000', confidence: 85 },
        { patterns: ['t250', 'xerox t250', 't-250'], stageName: 'Printing - Xerox T250', confidence: 85 },
        { patterns: ['7900', 'hp 7900', 'hp7900'], stageName: 'Printing - HP 7900', confidence: 85 },
        { patterns: ['c8000', 'xerox c8000'], stageName: 'Printing - Xerox C8000', confidence: 85 },
        { patterns: ['digital print', 'digital'], stageName: 'Digital Printing', confidence: 70 },
        { patterns: ['large format', 'wide format'], stageName: 'Large Format Printing', confidence: 75 }
      ],
      finishing: [
        { patterns: ['laminat'], stageName: 'Laminating', confidence: 80 },
        { patterns: ['envelope print'], stageName: 'Envelope Printing', confidence: 85 },
        { patterns: ['cut', 'guillotine'], stageName: 'Cutting', confidence: 75 },
        { patterns: ['fold'], stageName: 'Folding', confidence: 75 },
        { patterns: ['bind', 'binding'], stageName: 'Binding', confidence: 75 },
        { patterns: ['perfect bind'], stageName: 'Perfect Binding', confidence: 80 },
        { patterns: ['saddle stitch'], stageName: 'Saddle Stitching', confidence: 80 }
      ],
      prepress: [
        { patterns: ['dtp', 'desktop'], stageName: 'DTP', confidence: 80 },
        { patterns: ['proof'], stageName: 'Proofing', confidence: 75 },
        { patterns: ['plate'], stageName: 'Plate Making', confidence: 75 },
        { patterns: ['rip', 'ripping'], stageName: 'RIP Processing', confidence: 75 }
      ]
    };

    const categoryPatterns = enhancedPatterns[category] || [];
    
    for (const patternGroup of categoryPatterns) {
      for (const pattern of patternGroup.patterns) {
        if (searchText.includes(pattern)) {
          // Find actual stage that matches this pattern
          const stage = this.stages.find(s => 
            s.name.toLowerCase().includes(pattern) || 
            s.name.toLowerCase().includes(patternGroup.stageName.toLowerCase())
          );
          
          if (stage) {
            return {
              stageId: stage.id,
              stageName: stage.name,
              confidence: patternGroup.confidence,
              source: 'pattern',
              category: this.inferStageCategory(stage.name)
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Infer stage category from stage name
   */
  private inferStageCategory(stageName: string): 'printing' | 'finishing' | 'prepress' | 'delivery' | 'unknown' {
    const name = stageName.toLowerCase();
    
    if (name.includes('print') || name.includes('hp') || name.includes('xerox') || name.includes('digital')) {
      return 'printing';
    }
    if (name.includes('finish') || name.includes('laminat') || name.includes('cut') || 
        name.includes('fold') || name.includes('bind') || name.includes('envelope')) {
      return 'finishing';
    }
    if (name.includes('prepress') || name.includes('dtp') || name.includes('proof') || 
        name.includes('plate') || name.includes('rip')) {
      return 'prepress';
    }
    if (name.includes('deliver') || name.includes('dispatch') || name.includes('ship')) {
      return 'delivery';
    }
    
    return 'unknown';
  }

  /**
   * Learn from successful mappings to improve future accuracy
   */
  private async learnFromMappings(mappings: RowMappingResult[]): Promise<void> {
    try {
      const newMappings = mappings
        .filter(m => !m.isUnmapped && m.confidence >= 70 && !m.manualOverride)
        .map(m => ({
          excel_text: `${m.groupName} ${m.description}`.toLowerCase().trim(),
          production_stage_id: m.mappedStageId,
          confidence_score: m.confidence,
          mapping_type: 'production_stage' as const,
          is_verified: m.confidence >= 85
        }));

      if (newMappings.length > 0) {
        // Use upsert to avoid conflicts
        await supabase
          .from('excel_import_mappings')
          .upsert(newMappings, { 
            onConflict: 'excel_text,production_stage_id',
            ignoreDuplicates: false 
          });
        
        this.logger.addDebugInfo(`Learned ${newMappings.length} new mappings`);
      }
    } catch (error) {
      this.logger.addDebugInfo(`Failed to learn from mappings: ${error}`);
    }
  }

  /**
   * Map groups to stages using intelligent mapping
   */
  mapGroupsToStagesIntelligent(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null
  ): StageMapping[] {
    const mappedStages: StageMapping[] = [];
    
    // Map printing specifications
    if (printingSpecs) {
      const printingMappings = this.mapSpecificationsToStagesIntelligent(printingSpecs, 'printing');
      mappedStages.push(...printingMappings);
    }
    
    // Map finishing specifications
    if (finishingSpecs) {
      const finishingMappings = this.mapSpecificationsToStagesIntelligent(finishingSpecs, 'finishing');
      mappedStages.push(...finishingMappings);
    }
    
    // Map prepress specifications
    if (prepressSpecs) {
      const prepressMappings = this.mapSpecificationsToStagesIntelligent(prepressSpecs, 'prepress');
      mappedStages.push(...prepressMappings);
    }
    
    // Apply DTP/PROOF deduplication logic
    const deduplicatedStages = this.applyDTPProofDeduplication(mappedStages);
    
    this.logger.addDebugInfo(`Intelligently mapped ${deduplicatedStages.length} stages from group specifications (${mappedStages.length - deduplicatedStages.length} duplicates removed)`);
    return deduplicatedStages;
  }

  /**
   * Map specifications to stages using intelligent matching
   */
  private mapSpecificationsToStagesIntelligent(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery'
  ): StageMapping[] {
    const mappings: StageMapping[] = [];
    
    for (const [groupName, spec] of Object.entries(specs)) {
      const stageMapping = this.findIntelligentStageMatch(groupName, spec.description || '', category);
      if (stageMapping) {
        mappings.push({
          stageId: stageMapping.stageId,
          stageName: stageMapping.stageName,
          confidence: stageMapping.confidence,
          category: stageMapping.category === 'unknown' ? 'printing' : stageMapping.category,
          specifications: [groupName, spec.description || ''].filter(Boolean)
        });
      }
    }
    
    return mappings;
  }

  /**
   * Apply DTP/PROOF deduplication logic - only keep one instance of each
   */
  private applyDTPProofDeduplication(stages: StageMapping[]): StageMapping[] {
    const seenStages = new Set<string>();
    const deduplicated: StageMapping[] = [];
    
    for (const stage of stages) {
      const stageName = stage.stageName.toLowerCase();
      
      // For DTP and PROOF stages, only keep the first occurrence
      if (stageName.includes('dtp') || stageName.includes('proof')) {
        const stageKey = stageName.includes('dtp') ? 'dtp' : 'proof';
        
        if (seenStages.has(stageKey)) {
          this.logger.addDebugInfo(`Dropping duplicate ${stageKey.toUpperCase()} stage: ${stage.stageName}`);
          continue; // Skip this duplicate
        }
        
        seenStages.add(stageKey);
        this.logger.addDebugInfo(`Keeping first occurrence of ${stageKey.toUpperCase()} stage: ${stage.stageName}`);
      }
      
      deduplicated.push(stage);
    }
    
    return deduplicated;
  }
}