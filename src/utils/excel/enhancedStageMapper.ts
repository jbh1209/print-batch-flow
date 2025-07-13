import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from './debugger';
import type { GroupSpecifications, RowMappingResult, StageMapping } from './types';

export interface MappingConfidence {
  stageId: string;
  stageName: string;
  stageSpecId?: string;
  stageSpecName?: string;
  confidence: number;
  source: 'database' | 'fuzzy' | 'pattern';
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'unknown';
}

export class EnhancedStageMapper {
  private stages: any[] = [];
  private stageSpecs: any[] = [];
  private specifications: any[] = [];
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
    
    // Load stage specifications for sub-specification matching
    const { data: specsData, error: specsError } = await supabase
      .from('stage_specifications')
      .select('*')
      .eq('is_active', true);
    
    if (specsError) {
      this.logger.addDebugInfo(`Warning: Could not load stage specifications: ${specsError.message}`);
    } else {
      this.stageSpecs = specsData || [];
      this.logger.addDebugInfo(`Loaded ${this.stageSpecs.length} stage specifications`);
    }
    
    // Load print specifications for paper display names
    const { data: printSpecsData, error: printSpecsError } = await supabase
      .from('print_specifications')
      .select('*')
      .eq('is_active', true);
    
    if (printSpecsError) {
      this.logger.addDebugInfo(`Warning: Could not load print specifications: ${printSpecsError.message}`);
    } else {
      this.specifications = printSpecsData || [];
      this.logger.addDebugInfo(`Loaded ${this.specifications.length} print specifications`);
    }
    
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
    headers: string[],
    paperSpecs?: GroupSpecifications | null
  ): RowMappingResult[] {
    this.logger.addDebugInfo(`Creating intelligent row mappings with ${excelRows.length} Excel rows and ${headers.length} headers`);
    
    const rowMappings: RowMappingResult[] = [];
    let rowIndex = 0;

    // Process paper specifications first to map them for later use
    const paperMappings = paperSpecs ? this.processPaperSpecs(paperSpecs) : [];
    this.logger.addDebugInfo(`Processed ${paperMappings.length} paper specifications`);

    // Process printing specifications with paper integration
    if (printingSpecs) {
      const printingMappings = this.createPrintingRowMappingsWithPaper(
        printingSpecs, paperMappings, excelRows, headers, rowIndex
      );
      rowMappings.push(...printingMappings);
      rowIndex += Object.keys(printingSpecs).length;
      this.logger.addDebugInfo(`Created ${printingMappings.length} printing specification mappings`);
    }

    // Process finishing specifications
    if (finishingSpecs) {
      const finishingMappings = this.createCategoryRowMappings(
        finishingSpecs, 'finishing', excelRows, headers, rowIndex
      );
      rowMappings.push(...finishingMappings);
      rowIndex += Object.keys(finishingSpecs).length;
      this.logger.addDebugInfo(`Created ${finishingMappings.length} finishing specification mappings`);
    }

    // Process prepress specifications
    if (prepressSpecs) {
      const prepressMappings = this.createCategoryRowMappings(
        prepressSpecs, 'prepress', excelRows, headers, rowIndex
      );
      rowMappings.push(...prepressMappings);
      this.logger.addDebugInfo(`Created ${prepressMappings.length} prepress specification mappings`);
    }

    // Learn from new mappings
    this.learnFromMappings(rowMappings);

    this.logger.addDebugInfo(`Total row mappings created: ${rowMappings.length}`);
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

    // For printing category, use the new paper-integrated approach
    if (category === 'printing') {
      return this.createPrintingRowMappingsWithPaper(specs, [], excelRows, headers, startRowIndex);
    }

    // For non-printing categories, use standard processing
    for (const [groupName, spec] of Object.entries(specs)) {
      const stageMapping = this.findIntelligentStageMatchWithSpec(groupName, spec.description || '', category);
      
      const instanceId = this.generateInstanceId(groupName, currentRowIndex);
      
      mappings.push({
        excelRowIndex: currentRowIndex,
        excelData: excelRows[currentRowIndex] || [],
        groupName,
        description: spec.description || '',
        qty: spec.qty || 0,
        woQty: spec.wo_qty || 0,
        mappedStageId: stageMapping?.stageId || null,
        mappedStageName: stageMapping?.stageName || null,
        mappedStageSpecId: stageMapping?.stageSpecId || null,
        mappedStageSpecName: stageMapping?.stageSpecName || null,
        confidence: stageMapping?.confidence || 0,
        category: stageMapping?.category || category,
        isUnmapped: !stageMapping || stageMapping.confidence < 30,
        manualOverride: false,
        instanceId,
        paperSpecification: this.findAssociatedPaperSpec(groupName, spec.description || '', currentRowIndex)
      });

      currentRowIndex++;
    }

    return mappings;
  }

  /**
   * Process paper specifications and map them using existing mappings
   */
  private processPaperSpecs(paperSpecs: GroupSpecifications): Array<{groupName: string, spec: any, mappedSpec: string, qty: number}> {
    const mappedPapers: Array<{groupName: string, spec: any, mappedSpec: string, qty: number}> = [];
    
    for (const [groupName, spec] of Object.entries(paperSpecs)) {
      const description = spec.description || '';
      
      // Try to map paper specification using existing mappings
      const mappedSpec = this.mapPaperSpecification(groupName, description);
      
      mappedPapers.push({
        groupName,
        spec,
        mappedSpec,
        qty: spec.qty || 0
      });
      
      this.logger.addDebugInfo(`Mapped paper: "${groupName}" (${description}) -> "${mappedSpec}"`);
    }
    
    // Sort by quantity for cover/text determination
    return mappedPapers.sort((a, b) => a.qty - b.qty);
  }

  /**
   * Map paper specification using existing mappings
   */
  private mapPaperSpecification(groupName: string, description: string): string {
    const searchText = `${groupName} ${description}`.toLowerCase().trim();
    
    // Check for existing paper mappings
    const paperMapping = this.findPaperMapping(searchText);
    if (paperMapping) {
      return paperMapping;
    }
    
    // Return raw text for user selection - no fallback logic
    return description || groupName;
  }

  /**
   * Find paper mapping in existing database
   */
  private findPaperMapping(searchText: string): string | null {
    // Check paper-specific mappings
    for (const [mappedText, mapping] of this.existingMappings.entries()) {
      if (mapping.mapping_type === 'paper_specification' || 
          mapping.paper_type_specification_id || 
          mapping.paper_weight_specification_id) {
        if (searchText.includes(mappedText) || mappedText.includes(searchText)) {
          // Get the display name from mapped specifications
          return this.getPaperSpecificationDisplay(mapping);
        }
      }
    }
    return null;
  }

  /**
   * Get proper display name for paper specification from mapping
   */
  private getPaperSpecificationDisplay(mapping: any): string {
    const parts: string[] = [];
    
    // Look up actual specification names from database
    if (mapping.paper_type_specification_id) {
      const typeSpec = this.specifications.find(s => s.id === mapping.paper_type_specification_id);
      if (typeSpec) {
        parts.push(typeSpec.display_name || typeSpec.name);
      }
    }
    
    if (mapping.paper_weight_specification_id) {
      const weightSpec = this.specifications.find(s => s.id === mapping.paper_weight_specification_id);
      if (weightSpec) {
        parts.push(weightSpec.display_name || weightSpec.name);
      }
    }
    
    // Return combined display name if we found specifications
    if (parts.length > 0) {
      return parts.join(' ');
    }
    
    // Fallback to raw text if no specifications found
    return mapping.excel_text || '';
  }

  /**
   * Create printing row mappings with paper integration
   */
  private createPrintingRowMappingsWithPaper(
    printingSpecs: GroupSpecifications,
    paperMappings: Array<{groupName: string, spec: any, mappedSpec: string, qty: number}>,
    excelRows: any[][],
    headers: string[],
    startRowIndex: number
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    let currentRowIndex = startRowIndex;

    // Get printing operations from specs
    const printingOps: Array<{groupName: string, spec: any, rowIndex: number}> = [];
    
    for (const [groupName, spec] of Object.entries(printingSpecs)) {
      printingOps.push({groupName, spec, rowIndex: currentRowIndex});
      currentRowIndex++;
    }

    this.logger.addDebugInfo(`Found ${printingOps.length} printing operations and ${paperMappings.length} paper specifications`);

    // If we have multiple papers and printing operations
    if (printingOps.length > 0 && paperMappings.length > 1) {
      // Sort printing operations by quantity for pairing
      const sortedPrinting = printingOps.sort((a, b) => (a.spec.qty || 0) - (b.spec.qty || 0));
      
      // Create separate mappings for each paper type
      for (let printIdx = 0; printIdx < sortedPrinting.length; printIdx++) {
        const printingOp = sortedPrinting[printIdx];
        
        // Pair with papers using smallest-to-smallest principle
        for (let paperIdx = 0; paperIdx < paperMappings.length; paperIdx++) {
          const paperMapping = paperMappings[paperIdx];
          
          // Determine if this is cover or text based on quantity comparison
          const isCover = paperIdx === 0; // Smallest quantity = Cover (corrected)
          const isText = paperIdx === paperMappings.length - 1; // Largest quantity = Text (corrected)
          const partType = isCover ? 'Cover' : isText ? 'Text' : `Part ${paperIdx + 1}`;
          
          const stageMapping = this.findIntelligentStageMatchWithSpec(
            printingOp.groupName, 
            printingOp.spec.description || '', 
            'printing'
          );

          // Calculate quantity - pair printing qty with paper qty using smaller/larger principle
          const printingQty = printingOp.spec.qty || 0;
          const paperQty = paperMapping.qty;
          const finalQty = Math.min(printingQty, paperQty); // Use the smaller quantity
          
          const instanceId = this.generateInstanceId(
            `${printingOp.groupName}_${partType}_${paperIdx}`, 
            printingOp.rowIndex
          );

          const displayName = `${printingOp.groupName} - ${paperMapping.mappedSpec}`;
          const description = `${printingOp.spec.description || ''} (${partType}: ${paperMapping.mappedSpec})`;

          mappings.push({
            excelRowIndex: printingOp.rowIndex,
            excelData: excelRows[printingOp.rowIndex] || [],
            groupName: displayName,
            description: description,
            qty: finalQty,
            woQty: finalQty,
            mappedStageId: stageMapping?.stageId || null,
            mappedStageName: stageMapping?.stageName || null,
            mappedStageSpecId: stageMapping?.stageSpecId || null,
            mappedStageSpecName: stageMapping?.stageSpecName || null,
            confidence: stageMapping?.confidence || 0,
            category: 'printing',
            isUnmapped: !stageMapping || stageMapping.confidence < 30,
            manualOverride: false,
            instanceId,
            paperSpecification: paperMapping.mappedSpec,
            partType: partType
          });

          this.logger.addDebugInfo(`Created ${partType} printing mapping: "${displayName}" (qty: ${finalQty})`);
        }
      }
    } else {
      // Standard processing for single paper or no paper scenarios
      for (const printingOp of printingOps) {
        const stageMapping = this.findIntelligentStageMatchWithSpec(
          printingOp.groupName, 
          printingOp.spec.description || '', 
          'printing'
        );
        
        const instanceId = this.generateInstanceId(printingOp.groupName, printingOp.rowIndex);
        
        mappings.push({
          excelRowIndex: printingOp.rowIndex,
          excelData: excelRows[printingOp.rowIndex] || [],
          groupName: printingOp.groupName,
          description: printingOp.spec.description || '',
          qty: printingOp.spec.qty || 0,
          woQty: printingOp.spec.wo_qty || 0,
          mappedStageId: stageMapping?.stageId || null,
          mappedStageName: stageMapping?.stageName || null,
          mappedStageSpecId: stageMapping?.stageSpecId || null,
          mappedStageSpecName: stageMapping?.stageSpecName || null,
          confidence: stageMapping?.confidence || 0,
          category: 'printing',
          isUnmapped: !stageMapping || stageMapping.confidence < 30,
          manualOverride: false,
          instanceId,
          paperSpecification: paperMappings.length > 0 ? paperMappings[0].mappedSpec : undefined
        });
      }
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
   * Find mapping in existing database with improved exact matching
   */
  private findDatabaseMapping(searchText: string): any | null {
    const normalizedSearch = this.normalizeText(searchText);
    
    // Strategy 1: Case-insensitive exact match
    for (const [mappedText, mapping] of this.existingMappings.entries()) {
      const normalizedMapped = this.normalizeText(mappedText);
      
      if (normalizedSearch === normalizedMapped) {
        this.logger.addDebugInfo(`Found exact match: "${searchText}" -> "${mappedText}"`);
        return {
          ...mapping,
          confidence_score: Math.min(mapping.confidence_score + 10, 100) // Boost exact matches
        };
      }
    }

    // Strategy 2: Partial match with higher confidence scoring
    let bestMatch: any = null;
    let bestScore = 0;
    
    for (const [mappedText, mapping] of this.existingMappings.entries()) {
      const normalizedMapped = this.normalizeText(mappedText);
      
      // Calculate similarity for partial matches
      if (normalizedSearch.includes(normalizedMapped) || normalizedMapped.includes(normalizedSearch)) {
        const similarity = this.calculateSimilarity(normalizedSearch, normalizedMapped);
        const score = similarity * mapping.confidence_score;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            ...mapping,
            confidence_score: Math.max(Math.round(score * 0.8), 30) // Reduce confidence for partial matches
          };
        }
      }
    }

    if (bestMatch) {
      this.logger.addDebugInfo(`Found partial match: "${searchText}" -> "${bestMatch.excel_text}" (score: ${bestMatch.confidence_score})`);
    }

    return bestMatch;
  }

  /**
   * Normalize text for consistent matching
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
      .replace(/[^\w\s&-]/g, '')      // Remove special characters except &, -, and spaces
      .replace(/\s*&\s*/g, ' & ')     // Normalize ampersands
      .replace(/\s*-\s*/g, ' - ');    // Normalize dashes
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

  /**
   * Generate unique instance ID for multi-instance stages
   */
  private generateInstanceId(groupName: string, rowIndex: number): string {
    return `${groupName.toLowerCase().replace(/\s+/g, '_')}_${rowIndex}`;
  }

  /**
   * Find associated paper specification for printing stages
   */
  private findAssociatedPaperSpec(groupName: string, description: string, rowIndex: number): string | undefined {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Look for paper type mentions in the description
    const paperTypes = ['quality', 'performance', 'offset', 'digital', 'coated', 'uncoated', 'gloss', 'matt'];
    for (const paperType of paperTypes) {
      if (searchText.includes(paperType)) {
        return paperType.charAt(0).toUpperCase() + paperType.slice(1);
      }
    }
    
    return undefined;
  }

  /**
   * Enhanced stage matching with sub-specification support
   */
  private findIntelligentStageMatchWithSpec(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery'
  ): MappingConfidence | null {
    const searchText = `${groupName} ${description}`.toLowerCase().trim();
    
    // Strategy 1: Direct stage + specification matching
    const stageSpecMatch = this.findStageSpecificationMatch(searchText, category);
    if (stageSpecMatch) {
      return stageSpecMatch;
    }
    
    // Fallback to original matching logic
    return this.findIntelligentStageMatch(groupName, description, category);
  }

  /**
   * Find matching stage and specification combination
   */
  private findStageSpecificationMatch(searchText: string, category: string): MappingConfidence | null {
    let bestMatch: MappingConfidence | null = null;
    let bestScore = 0;

    // Look for stage + specification combinations
    for (const spec of this.stageSpecs) {
      const stage = this.stages.find(s => s.id === spec.production_stage_id);
      if (!stage || this.inferStageCategory(stage.name) !== category) continue;

      const specName = spec.name.toLowerCase();
      const stageName = stage.name.toLowerCase();
      
      // Check if the search text matches both stage and specification
      const stageScore = this.calculateSimilarity(searchText, stageName);
      const specScore = this.calculateSimilarity(searchText, specName);
      const combinedScore = this.calculateSimilarity(searchText, `${stageName} ${specName}`);
      
      const maxScore = Math.max(stageScore, specScore, combinedScore);
      
      if (maxScore > bestScore && maxScore > 0.6) { // Higher threshold for stage+spec matching
        bestScore = maxScore;
        bestMatch = {
          stageId: stage.id,
          stageName: stage.name,
          stageSpecId: spec.id,
          stageSpecName: spec.name,
          confidence: Math.round(maxScore * 90), // Higher confidence for precise matches
          source: 'fuzzy',
          category: this.inferStageCategory(stage.name)
        };
      }
    }

    return bestMatch;
  }
}