
import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from './debugger';
import type { RowMappingResult, StageMapping } from './types';

export class EnhancedStageMapper {
  private logger: ExcelImportDebugger;
  private productionStages: any[] = [];
  private stageSpecifications: any[] = [];
  private printSpecifications: any[] = [];
  private excelMappings: any[] = [];

  constructor(logger: ExcelImportDebugger) {
    this.logger = logger;
  }

  async initialize() {
    // Load production stages
    const { data: stagesData } = await supabase
      .from('production_stages')
      .select('*')
      .eq('is_active', true);
    
    this.productionStages = stagesData || [];

    // Load stage specifications
    const { data: specsData } = await supabase
      .from('stage_specifications')
      .select('*')
      .eq('is_active', true);
    
    this.stageSpecifications = specsData || [];

    // Load print specifications
    const { data: printSpecsData } = await supabase
      .from('print_specifications')
      .select('*')
      .eq('is_active', true);
    
    this.printSpecifications = printSpecsData || [];

    // Load Excel import mappings - CRITICAL for exact matching
    const { data: mappingsData } = await supabase
      .from('excel_import_mappings')
      .select('*')
      .order('confidence_score', { ascending: false });
    
    this.excelMappings = mappingsData || [];
    
    this.logger.addDebugInfo(`🗂️ EnhancedStageMapper initialized with ${this.productionStages.length} stages, ${this.excelMappings.length} mappings`);
  }

  /**
   * STEP 1: Find exact database mappings ONLY - no fuzzy matching
   */
  private findExactMappingFromDatabase(description: string): any[] {
    if (!description) return [];

    const cleanDesc = description.toLowerCase().trim();
    
    // Find EXACT text matches only
    const exactMappings = this.excelMappings.filter(mapping => 
      mapping.excel_text.toLowerCase().trim() === cleanDesc
    );

    if (exactMappings.length > 0) {
      this.logger.addDebugInfo(`💯 EXACT MAPPING FOUND: "${description}" -> ${exactMappings.length} mappings`);
      return exactMappings;
    }

    this.logger.addDebugInfo(`❌ NO EXACT MAPPING: "${description}" - marked for user selection`);
    return [];
  }

  /**
   * STEP 2: Detect multi-stage scenarios from exact database mappings
   */
  private detectMultiStageFromMappings(exactMappings: any[], description: string): { isCoverText: boolean, mappings: any[] } {
    if (exactMappings.length <= 1) {
      return { isCoverText: false, mappings: exactMappings };
    }

    // Look for Cover/Text patterns in the mapping texts
    const coverMappings = exactMappings.filter(mapping => 
      mapping.excel_text.toLowerCase().includes('cover:') || 
      mapping.excel_text.toLowerCase().includes('(cover')
    );
    
    const textMappings = exactMappings.filter(mapping => 
      mapping.excel_text.toLowerCase().includes('text:') || 
      mapping.excel_text.toLowerCase().includes('(text')
    );

    if (coverMappings.length > 0 && textMappings.length > 0) {
      this.logger.addDebugInfo(`📖 MULTI-STAGE DETECTED: "${description}" -> Cover: ${coverMappings.length}, Text: ${textMappings.length}`);
      return { isCoverText: true, mappings: [...coverMappings, ...textMappings] };
    }

    // Multiple mappings but not Cover/Text - use all mappings
    this.logger.addDebugInfo(`🔀 MULTIPLE MAPPINGS: "${description}" -> ${exactMappings.length} stages`);
    return { isCoverText: false, mappings: exactMappings };
  }

  /**
   * STEP 3: Extract paper specifications from mapping text
   */
  private extractPaperSpecFromMapping(mappingText: string): string | null {
    const text = mappingText.toLowerCase();
    
    // Extract paper spec patterns like "fbb 230gsm", "bond 080gsm"
    const paperPatterns = [
      /([a-z]+)\s+(\d+)gsm/i,
      /([a-z]+)\s+(\d+)\s*mic/i,
      /(fbb|bond|matt|gloss|silk)\s+(\d+)/i
    ];

    for (const pattern of paperPatterns) {
      const match = text.match(pattern);
      if (match) {
        const paperSpec = `${match[1]} ${match[2]}${text.includes('gsm') ? 'gsm' : text.includes('mic') ? 'mic' : 'gsm'}`;
        
        // Find clean display name from print_specifications
        const cleanSpec = this.printSpecifications.find(spec => 
          spec.category === 'paper_type' && 
          spec.name.toLowerCase().includes(match[1].toLowerCase())
        );
        
        if (cleanSpec) {
          this.logger.addDebugInfo(`📄 PAPER SPEC EXTRACTED: "${mappingText}" -> "${cleanSpec.display_name}"`);
          return cleanSpec.display_name;
        }
        
        return paperSpec;
      }
    }

    return null;
  }

  /**
   * STEP 4: Generate multi-row mappings for Cover/Text scenarios
   */
  private generateMultiRowMappings(
    mappings: any[], 
    description: string, 
    qty: number, 
    woQty: number, 
    excelRowIndex: number, 
    excelData: any[],
    isCoverText: boolean
  ): RowMappingResult[] {
    const results: RowMappingResult[] = [];
    const dependencyGroupId = `dependency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (isCoverText && mappings.length >= 2) {
      // Generate separate rows for Cover and Text
      const coverMappings = mappings.filter(m => 
        m.excel_text.toLowerCase().includes('cover:') || 
        m.excel_text.toLowerCase().includes('(cover')
      );
      
      const textMappings = mappings.filter(m => 
        m.excel_text.toLowerCase().includes('text:') || 
        m.excel_text.toLowerCase().includes('(text')
      );

      let stageInstanceIndex = 0;

      // Create Cover row
      if (coverMappings.length > 0) {
        const coverMapping = coverMappings[0];
        const stage = this.productionStages.find(s => s.id === coverMapping.production_stage_id);
        const paperSpec = this.extractPaperSpecFromMapping(coverMapping.excel_text);
        
        results.push({
          excelRowIndex,
          excelData,
          groupName: 'printing',
          description: `${stage?.name || 'Printing'} (Cover)`,
          qty: Math.floor(qty / 4), // Assume Cover is 1/4 of total for books
          woQty,
          mappedStageId: stage?.id || null,
          mappedStageName: stage?.name || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: coverMapping.confidence_score || 100,
          category: 'printing',
          isUnmapped: false,
          partType: 'cover',
          stageInstanceIndex: stageInstanceIndex++,
          dependencyGroupId,
          paperSpecification: paperSpec
        });
      }

      // Create Text row
      if (textMappings.length > 0) {
        const textMapping = textMappings[0];
        const stage = this.productionStages.find(s => s.id === textMapping.production_stage_id);
        const paperSpec = this.extractPaperSpecFromMapping(textMapping.excel_text);
        
        results.push({
          excelRowIndex,
          excelData,
          groupName: 'printing',
          description: `${stage?.name || 'Printing'} (Text)`,
          qty: qty - Math.floor(qty / 4), // Text gets remaining quantity
          woQty,
          mappedStageId: stage?.id || null,
          mappedStageName: stage?.name || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: textMapping.confidence_score || 100,
          category: 'printing',
          isUnmapped: false,
          partType: 'text',
          stageInstanceIndex: stageInstanceIndex++,
          dependencyGroupId,
          paperSpecification: paperSpec
        });
      }

      this.logger.addDebugInfo(`📖 MULTI-ROW GENERATED: "${description}" -> ${results.length} rows (Cover: ${results[0]?.qty}, Text: ${results[1]?.qty})`);
    } else if (mappings.length > 0) {
      // Single mapping or multiple non-Cover/Text mappings
      mappings.forEach((mapping, index) => {
        const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
        const paperSpec = this.extractPaperSpecFromMapping(mapping.excel_text);
        
        results.push({
          excelRowIndex,
          excelData,
          groupName: 'printing',
          description: stage?.name || description,
          qty,
          woQty,
          mappedStageId: stage?.id || null,
          mappedStageName: stage?.name || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: mapping.confidence_score || 100,
          category: 'printing',
          isUnmapped: false,
          stageInstanceIndex: index,
          paperSpecification: paperSpec
        });
      });
    }

    return results;
  }

  /**
   * MAIN METHOD: Process printing specifications with exact mapping only
   */
  async processPrintingSpecificationsWithExactMapping(
    matrixRows: any[][],
    groupColumn: number,
    descriptionColumn: number,
    qtyColumn: number,
    woQtyColumn: number
  ): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo('🖨️ PROCESSING PRINTING WITH EXACT MAPPINGS ONLY');
    
    const results: RowMappingResult[] = [];

    matrixRows.forEach((row, index) => {
      const groupName = String(row[groupColumn] || '').toLowerCase();
      
      // Only process printing rows
      if (!groupName.includes('printing') && !groupName.includes('print')) {
        return;
      }

      const description = String(row[descriptionColumn] || '').trim();
      const qty = parseInt(String(row[qtyColumn] || '0')) || 0;
      const woQty = parseInt(String(row[woQtyColumn] || '0')) || 0;

      if (!description) {
        this.logger.addDebugInfo(`⚠️ Skipping row ${index}: Empty description`);
        return;
      }

      // STEP 1: Find exact mappings only
      const exactMappings = this.findExactMappingFromDatabase(description);
      
      if (exactMappings.length === 0) {
        // No exact mapping - mark as unmapped for user selection
        results.push({
          excelRowIndex: index,
          excelData: row,
          groupName: 'printing',
          description,
          qty,
          woQty,
          mappedStageId: null,
          mappedStageName: null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: 0,
          category: 'printing',
          isUnmapped: true
        });
        return;
      }

      // STEP 2: Detect multi-stage scenarios
      const { isCoverText, mappings } = this.detectMultiStageFromMappings(exactMappings, description);
      
      // STEP 4: Generate row mappings
      const rowMappings = this.generateMultiRowMappings(
        mappings, 
        description, 
        qty, 
        woQty, 
        index, 
        row, 
        isCoverText
      );
      
      results.push(...rowMappings);
    });

    this.logger.addDebugInfo(`🎯 PRINTING PROCESSING COMPLETE: ${results.length} row mappings generated`);
    return results;
  }

  /**
   * Process other specification types (finishing, delivery, etc.) with exact mapping
   */
  async processOtherSpecificationsWithExactMapping(
    matrixRows: any[][],
    groupColumn: number,
    descriptionColumn: number,
    qtyColumn: number,
    woQtyColumn: number
  ): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo('🔧 PROCESSING OTHER SPECS WITH EXACT MAPPINGS ONLY');
    
    const results: RowMappingResult[] = [];

    matrixRows.forEach((row, index) => {
      const groupName = String(row[groupColumn] || '').toLowerCase();
      
      // Skip printing rows (handled separately)
      if (groupName.includes('printing') || groupName.includes('print')) {
        return;
      }

      const description = String(row[descriptionColumn] || '').trim();
      const qty = parseInt(String(row[qtyColumn] || '0')) || 0;
      const woQty = parseInt(String(row[woQtyColumn] || '0')) || 0;

      if (!description) return;

      // Find exact mappings only
      const exactMappings = this.findExactMappingFromDatabase(description);
      
      if (exactMappings.length === 0) {
        // No exact mapping - mark as unmapped
        results.push({
          excelRowIndex: index,
          excelData: row,
          groupName,
          description,
          qty,
          woQty,
          mappedStageId: null,
          mappedStageName: null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: 0,
          category: this.determineCategory(groupName),
          isUnmapped: true
        });
      } else {
        // Use first exact mapping
        const mapping = exactMappings[0];
        const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
        
        results.push({
          excelRowIndex: index,
          excelData: row,
          groupName,
          description,
          qty,
          woQty,
          mappedStageId: stage?.id || null,
          mappedStageName: stage?.name || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: mapping.confidence_score || 100,
          category: this.determineCategory(groupName),
          isUnmapped: false
        });
      }
    });

    return results;
  }

  private determineCategory(groupName: string): 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper' | 'unknown' {
    const name = groupName.toLowerCase();
    if (name.includes('finish')) return 'finishing';
    if (name.includes('delivery') || name.includes('collect')) return 'delivery';
    if (name.includes('prepress') || name.includes('pre-press')) return 'prepress';
    if (name.includes('packaging') || name.includes('pack')) return 'packaging';
    if (name.includes('paper')) return 'paper';
    return 'unknown';
  }

  /**
   * Main processing method - combines all specifications
   */
  async processAllSpecifications(
    matrixRows: any[][],
    groupColumn: number,
    descriptionColumn: number,
    qtyColumn: number,
    woQtyColumn: number
  ): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo('🚀 STARTING ENHANCED EXACT MAPPING PROCESSING');
    
    // Process printing with multi-stage detection
    const printingResults = await this.processPrintingSpecificationsWithExactMapping(
      matrixRows, groupColumn, descriptionColumn, qtyColumn, woQtyColumn
    );
    
    // Process other specifications
    const otherResults = await this.processOtherSpecificationsWithExactMapping(
      matrixRows, groupColumn, descriptionColumn, qtyColumn, woQtyColumn
    );
    
    const allResults = [...printingResults, ...otherResults];
    
    this.logger.addDebugInfo(`✅ EXACT MAPPING COMPLETE: ${allResults.length} total mappings (${printingResults.length} printing, ${otherResults.length} other)`);
    this.logger.addDebugInfo(`📊 Unmapped items: ${allResults.filter(r => r.isUnmapped).length} require user selection`);
    
    return allResults;
  }
}
