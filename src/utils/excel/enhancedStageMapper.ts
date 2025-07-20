
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
    const { data: stagesData, error: stagesError } = await supabase
      .from('production_stages')
      .select('*')
      .eq('is_active', true);
    
    if (stagesError) {
      this.logger.addDebugInfo(`❌ Error loading production stages: ${stagesError.message}`);
    }
    this.productionStages = stagesData || [];
    this.logger.addDebugInfo(`📋 Loaded ${this.productionStages.length} production stages`);

    // Load stage specifications
    const { data: specsData, error: specsError } = await supabase
      .from('stage_specifications')
      .select('*')
      .eq('is_active', true);
    
    if (specsError) {
      this.logger.addDebugInfo(`❌ Error loading stage specifications: ${specsError.message}`);
    }
    this.stageSpecifications = specsData || [];
    this.logger.addDebugInfo(`🔧 Loaded ${this.stageSpecifications.length} stage specifications`);

    // Load print specifications
    const { data: printSpecsData, error: printSpecsError } = await supabase
      .from('print_specifications')
      .select('*')
      .eq('is_active', true);
    
    if (printSpecsError) {
      this.logger.addDebugInfo(`❌ Error loading print specifications: ${printSpecsError.message}`);
    }
    this.printSpecifications = printSpecsData || [];

    // Load Excel import mappings - CRITICAL for exact matching
    const { data: mappingsData, error: mappingsError } = await supabase
      .from('excel_import_mappings')
      .select('*')
      .order('confidence_score', { ascending: false });
    
    if (mappingsError) {
      this.logger.addDebugInfo(`❌ Error loading excel mappings: ${mappingsError.message}`);
    }
    this.excelMappings = mappingsData || [];
    
    this.logger.addDebugInfo(`🗂️ EnhancedStageMapper initialized with ${this.productionStages.length} stages, ${this.excelMappings.length} mappings`);
  }

  /**
   * FIXED: Find exact database mapping with comprehensive logging
   */
  private findExactMappingFromDatabase(description: string): any {
    if (!description) {
      this.logger.addDebugInfo(`❌ MAPPING LOOKUP: Empty description provided`);
      return null;
    }

    const cleanDesc = description.toLowerCase().trim();
    this.logger.addDebugInfo(`🔍 MAPPING LOOKUP: "${description}" -> cleaned: "${cleanDesc}"`);
    
    // Log all available mappings for debugging
    this.logger.addDebugInfo(`📊 Available mappings: ${this.excelMappings.length} total`);
    this.excelMappings.forEach((mapping, index) => {
      if (index < 5) { // Only log first 5 to avoid spam
        this.logger.addDebugInfo(`   ${index + 1}. "${mapping.excel_text}" -> Stage: ${mapping.production_stage_id}, Spec: ${mapping.stage_specification_id}`);
      }
    });
    
    // Find EXACT text matches ONLY
    const exactMapping = this.excelMappings.find(mapping => {
      const mappingText = mapping.excel_text.toLowerCase().trim();
      const isMatch = mappingText === cleanDesc;
      
      if (isMatch) {
        this.logger.addDebugInfo(`🎯 EXACT MATCH FOUND: "${mapping.excel_text}" === "${description}"`);
      }
      
      return isMatch;
    });

    if (exactMapping) {
      this.logger.addDebugInfo(`💯 EXACT MAPPING FOUND: "${description}" -> Stage: ${exactMapping.production_stage_id}, Spec: ${exactMapping.stage_specification_id}, Confidence: ${exactMapping.confidence_score}`);
      return exactMapping;
    }

    this.logger.addDebugInfo(`❌ NO EXACT MAPPING: "${description}" - will require user selection (STRICT DATABASE ONLY)`);
    return null;
  }

  /**
   * FIXED: Extract paper specifications with proper type + weight format
   */
  private extractPaperSpecFromText(text: string): string | null {
    if (!text) return null;

    const lowerText = text.toLowerCase();
    this.logger.addDebugInfo(`📄 PAPER SPEC EXTRACTION: "${text}"`);
    
    // COMPREHENSIVE paper spec patterns to capture both type and weight
    const paperPatterns = [
      // Pattern: "Sappi Laser Pre Print, 80gsm" or "Pre Print, 80gsm"
      /(sappi\s+laser\s+pre\s+print|laser\s+pre\s+print|pre\s+print)\s*,?\s*(\d+)\s*gsm/i,
      // Pattern: "Bond, 80gsm" or "Bond 80gsm"
      /(bond)\s*,?\s*(\d+)\s*gsm/i,
      // Pattern: "Matt Art, 250gsm" or "Matt, 250gsm"
      /(matt\s+art|matt)\s*,?\s*(\d+)\s*gsm/i,
      // Pattern: "Gloss Art, 300gsm" or "Gloss, 300gsm"
      /(gloss\s+art|gloss)\s*,?\s*(\d+)\s*gsm/i,
      // Pattern: "FBB, 250gsm" or "FBS, 250gsm"
      /(fbb|fbs)\s*,?\s*(\d+)\s*gsm/i,
      // Pattern: "Silk, 150gsm"
      /(silk)\s*,?\s*(\d+)\s*gsm/i,
      // Pattern: "Art Paper, 300gsm"
      /(art\s+paper|art)\s*,?\s*(\d+)\s*gsm/i,
      // Generic pattern: "Type, Weightgsm" - must come last
      /([a-z\s]+?)\s*,\s*(\d+)\s*gsm/i
    ];

    let paperType = '';
    let weight = '';

    for (const pattern of paperPatterns) {
      const match = text.match(pattern);
      if (match) {
        paperType = match[1].trim();
        weight = match[2];
        this.logger.addDebugInfo(`📋 PATTERN MATCHED: "${match[0]}" -> Type: "${paperType}", Weight: "${weight}"`);
        break;
      }
    }

    if (!paperType || !weight) {
      this.logger.addDebugInfo(`❌ PAPER SPEC INCOMPLETE: type="${paperType}", weight="${weight}"`);
      return null;
    }

    // FIXED: Comprehensive type mapping to standardized names
    const typeMapping: Record<string, string> = {
      'sappi laser pre print': 'Bond',
      'laser pre print': 'Bond',
      'pre print': 'Bond',
      'bond': 'Bond',
      'fbb': 'FBS',
      'fbs': 'FBS',
      'matt art': 'Matt',
      'matt': 'Matt',
      'gloss art': 'Gloss',
      'gloss': 'Gloss',
      'silk': 'Silk',
      'art paper': 'Art',
      'art': 'Art'
    };
    
    const standardType = typeMapping[paperType.toLowerCase()] || paperType.charAt(0).toUpperCase() + paperType.slice(1);
    
    // FIXED FORMAT: "Type 000gsm" (e.g., "Bond 080gsm", "Matt 250gsm", "Gloss 300gsm")
    const formattedWeight = weight.padStart(3, '0');
    const result = `${standardType} ${formattedWeight}gsm`;
    
    this.logger.addDebugInfo(`✅ PAPER SPEC FORMATTED: "${text}" -> "${result}" (Type: ${standardType}, Weight: ${formattedWeight}gsm)`);
    return result;
  }

  /**
   * FIXED: Get stage specification name from database with proper error handling
   */
  private getStageSpecificationName(stageSpecId: string | null): string | null {
    if (!stageSpecId) {
      this.logger.addDebugInfo(`⚠️ No stage specification ID provided`);
      return null;
    }
    
    this.logger.addDebugInfo(`🔍 Looking up stage specification: ${stageSpecId}`);
    
    const spec = this.stageSpecifications.find(s => s.id === stageSpecId);
    if (spec) {
      this.logger.addDebugInfo(`✅ Found stage specification: "${spec.name}" (${spec.id})`);
      return spec.name;
    }
    
    this.logger.addDebugInfo(`❌ Stage specification not found: ${stageSpecId}`);
    return null;
  }

  /**
   * FIXED: Get production stage name from database with proper error handling
   */
  private getProductionStageName(stageId: string | null): string | null {
    if (!stageId) {
      this.logger.addDebugInfo(`⚠️ No production stage ID provided`);
      return null;
    }
    
    this.logger.addDebugInfo(`🔍 Looking up production stage: ${stageId}`);
    
    const stage = this.productionStages.find(s => s.id === stageId);
    if (stage) {
      this.logger.addDebugInfo(`✅ Found production stage: "${stage.name}" (${stage.id})`);
      return stage.name;
    }
    
    this.logger.addDebugInfo(`❌ Production stage not found: ${stageId}`);
    return null;
  }

  /**
   * RESTORED: Process job specifications and map to stages using cover_text_detection
   */
  async mapJobToStages(job: any, headers: string[], excelRows: any[][]): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo(`🎯 MAPPING JOB ${job.wo_no} TO STAGES WITH STRICT DATABASE MATCHING`);
    
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
    
    // Process other specification types with STRICT DATABASE MATCHING ONLY
    const otherSpecTypes = ['finishing_specifications', 'delivery_specifications', 'prepress_specifications', 'packaging_specifications'];
    for (const specType of otherSpecTypes) {
      if (job[specType]) {
        const otherResults = await this.processOtherSpecsStrictDatabaseOnly(job[specType], specType);
        results.push(...otherResults);
      }
    }
    
    this.logger.addDebugInfo(`🎯 JOB MAPPING COMPLETE: ${results.length} stage mappings generated (STRICT DATABASE MATCHING)`);
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

      // Find exact mapping for printing stage (STRICT DATABASE ONLY)
      const printingMapping = this.findExactMappingFromDatabase(component.printing.description);
      
      // PHASE 3: Extract and map paper specification with FIXED format
      let paperSpec = null;
      if (component.paper) {
        paperSpec = this.extractPaperSpecFromText(component.paper.description);
        this.logger.addDebugInfo(`📋 PAPER SPEC RESULT: "${component.paper.description}" -> "${paperSpec}"`);
      }

      if (printingMapping) {
        // FIXED: Proper stage name resolution with detailed logging
        const stageName = this.getProductionStageName(printingMapping.production_stage_id);
        const stageSpecName = this.getStageSpecificationName(printingMapping.stage_specification_id);
        
        if (!stageName) {
          this.logger.addDebugInfo(`❌ CRITICAL: Stage name not found for ID: ${printingMapping.production_stage_id}`);
        }
        
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: 'printing',
          description: `${stageName || 'Unknown Stage'} (${component.type})${stageSpecName ? ` - ${stageSpecName}` : ''}`,
          qty: component.printing.qty,
          woQty: component.printing.wo_qty,
          mappedStageId: printingMapping.production_stage_id || null,
          mappedStageName: stageName || 'Unknown Stage',
          mappedStageSpecId: printingMapping.stage_specification_id || null,
          mappedStageSpecName: stageSpecName,
          confidence: printingMapping.confidence_score || 100,
          category: 'printing',
          isUnmapped: false,
          partType: component.type, // 'cover' or 'text'
          stageInstanceIndex: i, // 0 for cover, 1 for text
          dependencyGroupId: coverTextDetection.dependencyGroupId,
          paperSpecification: paperSpec
        });

        this.logger.addDebugInfo(`✅ ${component.type.toUpperCase()} MAPPED: "${component.printing.description}" -> "${stageName || 'Unknown'}"${stageSpecName ? ` (${stageSpecName})` : ''} with paper: ${paperSpec || 'none'}`);
      } else {
        // No mapping found - mark for user selection (NO FALLBACK)
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

        this.logger.addDebugInfo(`⚠️ ${component.type.toUpperCase()} UNMAPPED: "${component.printing.description}" - requires user selection (NO FALLBACK)`);
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
        // FIXED: Proper stage name resolution with detailed logging
        const stageName = this.getProductionStageName(mapping.production_stage_id);
        const stageSpecName = this.getStageSpecificationName(mapping.stage_specification_id);
        
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: 'printing',
          description: `${specData.description}${stageSpecName ? ` - ${stageSpecName}` : ''}`,
          qty: specData.qty,
          woQty: specData.wo_qty,
          mappedStageId: mapping.production_stage_id || null,
          mappedStageName: stageName || 'Unknown Stage',
          mappedStageSpecId: mapping.stage_specification_id || null,
          mappedStageSpecName: stageSpecName,
          confidence: mapping.confidence_score || 100,
          category: 'printing',
          isUnmapped: false,
          paperSpecification: paperSpec
        });

        this.logger.addDebugInfo(`✅ SINGLE STAGE MAPPED: "${specData.description}" -> "${stageName || 'Unknown'}"${stageSpecName ? ` (${stageSpecName})` : ''} with paper: ${paperSpec || 'none'}`);
      } else {
        // No mapping found - mark for user selection (NO FALLBACK)
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

        this.logger.addDebugInfo(`⚠️ SINGLE STAGE UNMAPPED: "${specData.description}" - requires user selection (NO FALLBACK)`);
      }
    }
    
    return results;
  }

  /**
   * FIXED: Process other specification types with STRICT DATABASE MATCHING ONLY
   */
  private async processOtherSpecsStrictDatabaseOnly(specs: any, specType: string): Promise<RowMappingResult[]> {
    const results: RowMappingResult[] = [];
    const category = this.determineCategory(specType);
    
    this.logger.addDebugInfo(`🔍 PROCESSING ${specType.toUpperCase()} WITH STRICT DATABASE MATCHING ONLY`);
    
    for (const [key, spec] of Object.entries(specs)) {
      const specData = spec as any;
      if (!specData.description) continue;
      
      this.logger.addDebugInfo(`   Checking: "${specData.description}"`);
      
      // STRICT DATABASE MATCHING ONLY - NO FALLBACK
      const mapping = this.findExactMappingFromDatabase(specData.description);
      
      if (mapping) {
        // FIXED: Proper stage name resolution with detailed logging
        const stageName = this.getProductionStageName(mapping.production_stage_id);
        const stageSpecName = this.getStageSpecificationName(mapping.stage_specification_id);
        
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: category,
          description: `${specData.description}${stageSpecName ? ` - ${stageSpecName}` : ''}`,
          qty: specData.qty || 0,
          woQty: specData.wo_qty || 0,
          mappedStageId: mapping.production_stage_id || null,
          mappedStageName: stageName || 'Unknown Stage',
          mappedStageSpecId: mapping.stage_specification_id || null,
          mappedStageSpecName: stageSpecName,
          confidence: mapping.confidence_score || 100,
          category,
          isUnmapped: false
        });

        this.logger.addDebugInfo(`   ✅ EXACT MATCH FOUND: "${specData.description}" -> "${stageName || 'Unknown'}"${stageSpecName ? ` (${stageSpecName})` : ''}`);
      } else {
        // NO FALLBACK - Mark for user selection
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

        this.logger.addDebugInfo(`   ❌ NO EXACT MATCH: "${specData.description}" - REQUIRES USER SELECTION`);
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
        const stageName = this.getProductionStageName(mapping.production_stage_id);
        const stageSpecName = this.getStageSpecificationName(mapping.stage_specification_id);
        
        results.push({
          excelRowIndex: index,
          excelData: row,
          groupName: 'printing',
          description: `${description}${stageSpecName ? ` - ${stageSpecName}` : ''}`,
          qty,
          woQty,
          mappedStageId: mapping.production_stage_id || null,
          mappedStageName: stageName || 'Unknown Stage',
          mappedStageSpecId: mapping.stage_specification_id || null,
          mappedStageSpecName: stageSpecName,
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
          mappedStageName: 'Requires User Selection',
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

      // STRICT DATABASE MATCHING ONLY
      const mapping = this.findExactMappingFromDatabase(description);
      
      if (mapping) {
        const stageName = this.getProductionStageName(mapping.production_stage_id);
        const stageSpecName = this.getStageSpecificationName(mapping.stage_specification_id);
        
        results.push({
          excelRowIndex: index,
          excelData: row,
          groupName,
          description: `${description}${stageSpecName ? ` - ${stageSpecName}` : ''}`,
          qty,
          woQty,
          mappedStageId: mapping.production_stage_id || null,
          mappedStageName: stageName || 'Unknown Stage',
          mappedStageSpecId: mapping.stage_specification_id || null,
          mappedStageSpecName: stageSpecName,
          confidence: mapping.confidence_score || 100,
          category: this.determineCategory(groupName),
          isUnmapped: false
        });
      } else {
        // NO FALLBACK - Mark for user selection
        results.push({
          excelRowIndex: index,
          excelData: row,
          groupName,
          description,
          qty,
          woQty,
          mappedStageId: null,
          mappedStageName: 'Requires User Selection',
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
