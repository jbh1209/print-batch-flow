
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
   * Find exact database mapping - enhanced with better paper spec extraction
   */
  private findExactMappingFromDatabase(description: string): any {
    if (!description) return null;

    const cleanDesc = description.toLowerCase().trim();
    
    // Find EXACT text matches first
    const exactMapping = this.excelMappings.find(mapping => 
      mapping.excel_text.toLowerCase().trim() === cleanDesc
    );

    if (exactMapping) {
      this.logger.addDebugInfo(`💯 EXACT MAPPING FOUND: "${description}" -> Stage: ${exactMapping.production_stage_id}`);
      return exactMapping;
    }

    this.logger.addDebugInfo(`❌ NO EXACT MAPPING: "${description}" - will require user selection`);
    return null;
  }

  /**
   * Extract paper specifications from text with database mapping enhancement
   */
  private extractPaperSpecFromText(text: string): string | null {
    if (!text) return null;

    const lowerText = text.toLowerCase();
    
    // Enhanced paper spec patterns
    const paperPatterns = [
      /([a-z\s]+)\s*,?\s*(\d+)\s*gsm/i,
      /([a-z\s]+)\s*(\d+)\s*gsm/i,
      /(bond|fbb|matt|gloss|silk)\s*[+\s]*(\d+)\s*gsm/i,
      /(\d+)\s*gsm\s*([a-z\s]+)/i
    ];

    for (const pattern of paperPatterns) {
      const match = text.match(pattern);
      if (match) {
        let paperType = '';
        let weight = '';
        
        if (pattern.source.includes('\\d+.*gsm.*[a-z')) {
          // Weight first pattern
          weight = match[1];
          paperType = match[2];
        } else {
          // Type first pattern
          paperType = match[1];
          weight = match[2];
        }
        
        // Clean up type and find database equivalent
        paperType = paperType.trim().toLowerCase();
        
        // Map common paper types to database names
        const typeMapping: Record<string, string> = {
          'sappi laser pre print': 'Bond',
          'bond': 'Bond',
          'fbb': 'FBS',
          'matt': 'Matt Art',
          'gloss': 'Gloss Art',
          'silk': 'Silk'
        };
        
        const cleanType = typeMapping[paperType] || paperType;
        const result = `${cleanType} + ${weight.padStart(3, '0')}gsm`;
        
        this.logger.addDebugInfo(`📄 PAPER SPEC EXTRACTED: "${text}" -> "${result}"`);
        return result;
      }
    }

    return null;
  }

  /**
   * RESTORED: Process job specifications and map to stages using cover_text_detection
   */
  async mapJobToStages(job: any, headers: string[], excelRows: any[][]): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo(`🎯 MAPPING JOB ${job.wo_no} TO STAGES WITH RESTORED INTEGRATION`);
    
    const results: RowMappingResult[] = [];
    
    // PHASE 1: Check for cover/text detection from matrixParser FIRST
    if (job.cover_text_detection && job.cover_text_detection.isBookJob) {
      this.logger.addDebugInfo(`📖 BOOK JOB DETECTED - Using cover_text_detection from matrixParser`);
      const bookResults = await this.processBookJobWithCoverTextDetection(job);
      results.push(...bookResults);
    } else if (job.printing_specifications) {
      // PHASE 5: Single stage processing for non-book jobs
      this.logger.addDebugInfo(`📄 SINGLE STAGE JOB - Processing printing specs normally`);
      const printingResults = await this.processSingleStagePrinting(job.printing_specifications, job);
      results.push(...printingResults);
    }
    
    // Process other specification types
    const otherSpecTypes = ['finishing_specifications', 'delivery_specifications', 'prepress_specifications', 'packaging_specifications'];
    for (const specType of otherSpecTypes) {
      if (job[specType]) {
        const otherResults = await this.processOtherSpecs(job[specType], specType);
        results.push(...otherResults);
      }
    }
    
    this.logger.addDebugInfo(`🎯 JOB MAPPING COMPLETE: ${results.length} stage mappings generated`);
    return results;
  }

  /**
   * PHASE 2: Process book job using cover_text_detection from matrixParser
   */
  private async processBookJobWithCoverTextDetection(job: any): Promise<RowMappingResult[]> {
    const results: RowMappingResult[] = [];
    const coverTextDetection = job.cover_text_detection;
    
    if (!coverTextDetection || !coverTextDetection.components) {
      this.logger.addDebugInfo(`❌ No cover_text_detection components found`);
      return results;
    }

    this.logger.addDebugInfo(`📚 PROCESSING BOOK JOB with ${coverTextDetection.components.length} components`);
    this.logger.addDebugInfo(`📋 Dependency Group: ${coverTextDetection.dependencyGroupId}`);

    // Process each component (Cover/Text) using pre-matched data from matrixParser
    for (let i = 0; i < coverTextDetection.components.length; i++) {
      const component = coverTextDetection.components[i];
      
      this.logger.addDebugInfo(`🔧 Processing ${component.type.toUpperCase()} component:`);
      this.logger.addDebugInfo(`   Printing: "${component.printing.description}" - Qty: ${component.printing.qty}, WO_Qty: ${component.printing.wo_qty}`);
      
      if (component.paper) {
        this.logger.addDebugInfo(`   Paper: "${component.paper.description}" - Qty: ${component.paper.qty}, WO_Qty: ${component.paper.wo_qty}`);
      }

      // Find exact mapping for printing stage
      const printingMapping = this.findExactMappingFromDatabase(component.printing.description);
      
      // PHASE 3: Extract and map paper specification
      let paperSpec = null;
      if (component.paper) {
        paperSpec = this.extractPaperSpecFromText(component.paper.description);
      }

      if (printingMapping) {
        const stage = this.productionStages.find(s => s.id === printingMapping.production_stage_id);
        
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: 'printing',
          description: `${stage?.name || 'Printing'} (${component.type})`,
          qty: component.printing.qty,
          woQty: component.printing.wo_qty,
          mappedStageId: stage?.id || null,
          mappedStageName: stage?.name || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: printingMapping.confidence_score || 100,
          category: 'printing',
          isUnmapped: false,
          partType: component.type, // 'cover' or 'text'
          stageInstanceIndex: i, // 0 for cover, 1 for text
          dependencyGroupId: coverTextDetection.dependencyGroupId,
          paperSpecification: paperSpec
        });

        this.logger.addDebugInfo(`✅ ${component.type.toUpperCase()} MAPPED: "${component.printing.description}" -> "${stage?.name}" with paper: ${paperSpec || 'none'}`);
      } else {
        // No mapping found - mark for user selection
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: 'printing',
          description: `${component.printing.description} (${component.type})`,
          qty: component.printing.qty,
          woQty: component.printing.wo_qty,
          mappedStageId: null,
          mappedStageName: 'Requires User Selection',
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: 0,
          category: 'printing',
          isUnmapped: true,
          partType: component.type,
          stageInstanceIndex: i,
          dependencyGroupId: coverTextDetection.dependencyGroupId,
          paperSpecification: paperSpec
        });

        this.logger.addDebugInfo(`⚠️ ${component.type.toUpperCase()} UNMAPPED: "${component.printing.description}" - requires user selection`);
      }
    }

    return results;
  }

  /**
   * PHASE 5: Process single stage printing specifications (non-book jobs)
   */
  private async processSingleStagePrinting(printingSpecs: any, job: any): Promise<RowMappingResult[]> {
    const results: RowMappingResult[] = [];
    
    for (const [key, spec] of Object.entries(printingSpecs)) {
      const specData = spec as any;
      if (!specData.description) continue;
      
      this.logger.addDebugInfo(`📝 SINGLE STAGE PRINTING: "${specData.description}" - Qty: ${specData.qty}, WO_Qty: ${specData.wo_qty}`);
      
      const mapping = this.findExactMappingFromDatabase(specData.description);
      const paperSpec = this.extractPaperSpecFromText(specData.description);
      
      if (mapping) {
        const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
        
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: 'printing',
          description: specData.description,
          qty: specData.qty,
          woQty: specData.wo_qty,
          mappedStageId: stage?.id || null,
          mappedStageName: stage?.name || 'Unknown Stage',
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: mapping.confidence_score || 100,
          category: 'printing',
          isUnmapped: false,
          paperSpecification: paperSpec
        });
      } else {
        // No mapping found - mark for user selection
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: 'printing',
          description: specData.description,
          qty: specData.qty,
          woQty: specData.wo_qty,
          mappedStageId: null,
          mappedStageName: 'Requires User Selection',
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: 0,
          category: 'printing',
          isUnmapped: true,
          paperSpecification: paperSpec
        });
      }
    }
    
    return results;
  }

  /**
   * Process other specification types (finishing, delivery, etc.)
   */
  private async processOtherSpecs(specs: any, specType: string): Promise<RowMappingResult[]> {
    const results: RowMappingResult[] = [];
    const category = this.determineCategory(specType);
    
    for (const [key, spec] of Object.entries(specs)) {
      const specData = spec as any;
      if (!specData.description) continue;
      
      const mapping = this.findExactMappingFromDatabase(specData.description);
      
      if (mapping) {
        const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
        
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: category,
          description: specData.description,
          qty: specData.qty || 0,
          woQty: specData.wo_qty || 0,
          mappedStageId: stage?.id || null,
          mappedStageName: stage?.name || 'Unknown Stage',
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: mapping.confidence_score || 100,
          category,
          isUnmapped: false
        });
      } else {
        // No mapping found - mark for user selection
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: category,
          description: specData.description,
          qty: specData.qty || 0,
          woQty: specData.wo_qty || 0,
          mappedStageId: null,
          mappedStageName: 'Requires User Selection',
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: 0,
          category,
          isUnmapped: true
        });
      }
    }
    
    return results;
  }

  private determineCategory(specType: string): 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper' | 'unknown' {
    const name = specType.toLowerCase();
    if (name.includes('finish')) return 'finishing';
    if (name.includes('delivery') || name.includes('collect')) return 'delivery';
    if (name.includes('prepress') || name.includes('pre-press')) return 'prepress';
    if (name.includes('packaging') || name.includes('pack')) return 'packaging';
    if (name.includes('paper')) return 'paper';
    return 'unknown';
  }

  /**
   * Legacy methods for compatibility - maintained for backward compatibility
   */
  async processPrintingSpecificationsWithExactMapping(
    matrixRows: any[][],
    groupColumn: number,
    descriptionColumn: number,
    qtyColumn: number,
    woQtyColumn: number
  ): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo('🖨️ PROCESSING PRINTING WITH ENHANCED MAPPING');
    
    const results: RowMappingResult[] = [];

    matrixRows.forEach((row, index) => {
      const groupName = String(row[groupColumn] || '').toLowerCase();
      
      if (!groupName.includes('printing') && !groupName.includes('print')) {
        return;
      }

      const description = String(row[descriptionColumn] || '').trim();
      const qty = parseInt(String(row[qtyColumn] || '0')) || 0;
      const woQty = parseInt(String(row[woQtyColumn] || '0')) || 0;

      if (!description) return;

      const mapping = this.findExactMappingFromDatabase(description);
      const paperSpec = this.extractPaperSpecFromText(description);
      
      if (mapping) {
        const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
        
        results.push({
          excelRowIndex: index,
          excelData: row,
          groupName: 'printing',
          description,
          qty,
          woQty,
          mappedStageId: stage?.id || null,
          mappedStageName: stage?.name || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: mapping.confidence_score || 100,
          category: 'printing',
          isUnmapped: false,
          paperSpecification: paperSpec
        });
      } else {
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
          isUnmapped: true,
          paperSpecification: paperSpec
        });
      }
    });

    return results;
  }

  async processOtherSpecificationsWithExactMapping(
    matrixRows: any[][],
    groupColumn: number,
    descriptionColumn: number,
    qtyColumn: number,
    woQtyColumn: number
  ): Promise<RowMappingResult[]> {
    const results: RowMappingResult[] = [];

    matrixRows.forEach((row, index) => {
      const groupName = String(row[groupColumn] || '').toLowerCase();
      
      if (groupName.includes('printing') || groupName.includes('print')) {
        return;
      }

      const description = String(row[descriptionColumn] || '').trim();
      const qty = parseInt(String(row[qtyColumn] || '0')) || 0;
      const woQty = parseInt(String(row[woQtyColumn] || '0')) || 0;

      if (!description) return;

      const mapping = this.findExactMappingFromDatabase(description);
      
      if (mapping) {
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
      } else {
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
      }
    });

    return results;
  }

  async processAllSpecifications(
    matrixRows: any[][],
    groupColumn: number,
    descriptionColumn: number,
    qtyColumn: number,
    woQtyColumn: number
  ): Promise<RowMappingResult[]> {
    const printingResults = await this.processPrintingSpecificationsWithExactMapping(
      matrixRows, groupColumn, descriptionColumn, qtyColumn, woQtyColumn
    );
    
    const otherResults = await this.processOtherSpecificationsWithExactMapping(
      matrixRows, groupColumn, descriptionColumn, qtyColumn, woQtyColumn
    );
    
    return [...printingResults, ...otherResults];
  }
}
