
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
   * Process job specifications and map to stages - RESTORED FUNCTIONALITY
   */
  async mapJobToStages(job: any, headers: string[], excelRows: any[][]): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo(`🎯 MAPPING JOB ${job.wo_no} TO STAGES WITH ENHANCED LOGIC`);
    
    const results: RowMappingResult[] = [];
    
    // Process printing specifications with multi-stage detection
    if (job.printing_specifications) {
      const printingResults = await this.processPrintingSpecsWithMultiStage(job.printing_specifications, job);
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
   * Process printing specifications with multi-stage detection - RESTORED
   */
  private async processPrintingSpecsWithMultiStage(printingSpecs: any, job: any): Promise<RowMappingResult[]> {
    const results: RowMappingResult[] = [];
    const printingRows: Array<{
      key: string;
      description: string;
      qty: number;
      wo_qty: number;
      specData: any;
    }> = [];
    
    // Collect all printing specifications with quantities
    for (const [key, spec] of Object.entries(printingSpecs)) {
      const specData = spec as any;
      if (!specData.description) continue;
      
      printingRows.push({
        key,
        description: specData.description,
        qty: specData.qty || 0,
        wo_qty: specData.wo_qty || 0,
        specData
      });
      
      this.logger.addDebugInfo(`📝 PRINTING ROW: "${specData.description}" - Qty: ${specData.qty}, WO_Qty: ${specData.wo_qty}`);
    }
    
    // Check for multi-stage scenario (Cover/Text)
    if (printingRows.length >= 2) {
      const isMultiStage = this.detectMultiStageScenario(printingRows);
      
      if (isMultiStage) {
        this.logger.addDebugInfo(`📖 MULTI-STAGE BOOK JOB DETECTED for ${job.wo_no}`);
        return this.generateMultiStageRows(printingRows, job);
      }
    }
    
    // Single stage processing
    for (const row of printingRows) {
      const mapping = this.findExactMappingFromDatabase(row.description);
      const paperSpec = this.extractPaperSpecFromText(row.description);
      
      if (mapping) {
        const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
        
        results.push({
          excelRowIndex: 0,
          excelData: [],
          groupName: 'printing',
          description: row.description,
          qty: row.qty,
          woQty: row.wo_qty,
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
          description: row.description,
          qty: row.qty,
          woQty: row.wo_qty,
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
   * Detect multi-stage scenario (Cover/Text) based on quantity differences
   */
  private detectMultiStageScenario(printingRows: any[]): boolean {
    if (printingRows.length < 2) return false;
    
    // Sort by quantity to identify potential cover/text split
    const sortedRows = [...printingRows].sort((a, b) => a.qty - b.qty);
    const minQty = sortedRows[0].qty;
    const maxQty = sortedRows[sortedRows.length - 1].qty;
    
    // Consider it multi-stage if there's a significant quantity difference
    const qtyRatio = maxQty > 0 ? minQty / maxQty : 0;
    const isMultiStage = qtyRatio < 0.8 && (maxQty - minQty) > 50; // 20% difference and at least 50 units
    
    this.logger.addDebugInfo(`🔍 MULTI-STAGE CHECK: Min: ${minQty}, Max: ${maxQty}, Ratio: ${qtyRatio.toFixed(2)}, IsMulti: ${isMultiStage}`);
    
    return isMultiStage;
  }

  /**
   * Generate multi-stage rows for Cover/Text scenarios
   */
  private generateMultiStageRows(printingRows: any[], job: any): RowMappingResult[] {
    const results: RowMappingResult[] = [];
    const dependencyGroupId = `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Sort by quantity - cover (lower) and text (higher)
    const sortedRows = [...printingRows].sort((a, b) => a.qty - b.qty);
    const coverRow = sortedRows[0];
    const textRow = sortedRows[sortedRows.length - 1];
    
    // Process Cover
    const coverMapping = this.findExactMappingFromDatabase(coverRow.description);
    const coverPaperSpec = this.extractPaperSpecFromText(coverRow.description);
    
    if (coverMapping) {
      const coverStage = this.productionStages.find(s => s.id === coverMapping.production_stage_id);
      
      results.push({
        excelRowIndex: 0,
        excelData: [],
        groupName: 'printing',
        description: `${coverStage?.name || 'Printing'} (Cover)`,
        qty: coverRow.qty,
        woQty: coverRow.wo_qty,
        mappedStageId: coverStage?.id || null,
        mappedStageName: coverStage?.name || null,
        mappedStageSpecId: null,
        mappedStageSpecName: null,
        confidence: coverMapping.confidence_score || 100,
        category: 'printing',
        isUnmapped: false,
        partType: 'cover',
        stageInstanceIndex: 0,
        dependencyGroupId,
        paperSpecification: coverPaperSpec
      });
    }
    
    // Process Text
    const textMapping = this.findExactMappingFromDatabase(textRow.description);
    const textPaperSpec = this.extractPaperSpecFromText(textRow.description);
    
    if (textMapping) {
      const textStage = this.productionStages.find(s => s.id === textMapping.production_stage_id);
      
      results.push({
        excelRowIndex: 0,
        excelData: [],
        groupName: 'printing',
        description: `${textStage?.name || 'Printing'} (Text)`,
        qty: textRow.qty,
        woQty: textRow.wo_qty,
        mappedStageId: textStage?.id || null,
        mappedStageName: textStage?.name || null,
        mappedStageSpecId: null,
        mappedStageSpecName: null,
        confidence: textMapping.confidence_score || 100,
        category: 'printing',
        isUnmapped: false,
        partType: 'text',
        stageInstanceIndex: 1,
        dependencyGroupId,
        paperSpecification: textPaperSpec
      });
    }
    
    this.logger.addDebugInfo(`📖 MULTI-STAGE GENERATED: Cover(${coverRow.qty}) + Text(${textRow.qty}) with dependency: ${dependencyGroupId}`);
    
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
   * Legacy methods for compatibility - restored with enhanced logic
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
