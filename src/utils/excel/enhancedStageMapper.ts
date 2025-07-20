import type { ExcelImportDebugger } from './debugger';
import type { GroupSpecifications, RowMappingResult, StageMapping } from './types';
import { supabase } from '@/integrations/supabase/client';

export class EnhancedStageMapper {
  private stages: any[] = [];
  private mappings: any[] = [];
  
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
    
    // Load existing mappings
    const { data: mappingsData, error: mappingsError } = await supabase
      .from('excel_import_mappings')
      .select('*');
    
    if (mappingsError) {
      throw new Error(`Failed to load Excel mappings: ${mappingsError.message}`);
    }
    
    this.mappings = mappingsData || [];
    
    this.logger.addDebugInfo(`Enhanced mapper loaded ${this.stages.length} stages, ${this.mappings.length} mappings`);
  }

  mapGroupsToStagesIntelligent(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): StageMapping[] {
    const mappings: StageMapping[] = [];
    
    // Process printing specifications
    if (printingSpecs) {
      const printingMappings = this.mapSpecificationsToStages(printingSpecs, 'printing');
      mappings.push(...printingMappings);
    }
    
    // Process finishing specifications
    if (finishingSpecs) {
      const finishingMappings = this.mapSpecificationsToStages(finishingSpecs, 'finishing');
      mappings.push(...finishingMappings);
    }
    
    // Process prepress specifications
    if (prepressSpecs) {
      const prepressMappings = this.mapSpecificationsToStages(prepressSpecs, 'prepress');
      mappings.push(...prepressMappings);
    }
    
    this.logger.addDebugInfo(`Enhanced mapper created ${mappings.length} stage mappings`);
    return mappings;
  }

  createIntelligentRowMappings(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    excelRows: any[][],
    headers: string[],
    paperSpecs: GroupSpecifications | null
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    let currentRowIndex = 0;

    // LOGGING: Input specs received
    this.logger.addDebugInfo(`[ENHANCED MAPPER] createIntelligentRowMappings called with:`);
    this.logger.addDebugInfo(`[ENHANCED MAPPER] printingSpecs: ${JSON.stringify(printingSpecs, null, 2)}`);
    
    if (printingSpecs) {
      const printingMappings = this.createPrintingRowMappingsWithPaper(
        printingSpecs,
        excelRows,
        headers,
        currentRowIndex,
        paperSpecs
      );
      mappings.push(...printingMappings);
      currentRowIndex += Object.keys(printingSpecs).length;
    }

    if (finishingSpecs) {
      const finishingMappings = this.createCategoryRowMappings(
        finishingSpecs,
        'finishing',
        excelRows,
        headers,
        currentRowIndex
      );
      mappings.push(...finishingMappings);
      currentRowIndex += Object.keys(finishingSpecs).length;
    }

    if (prepressSpecs) {
      const prepressMappings = this.createCategoryRowMappings(
        prepressSpecs,
        'prepress',
        excelRows,
        headers,
        currentRowIndex
      );
      mappings.push(...prepressMappings);
      currentRowIndex += Object.keys(prepressSpecs).length;
    }

    this.logger.addDebugInfo(`Enhanced mapper created ${mappings.length} intelligent row mappings`);
    return mappings;
  }

  private createPrintingRowMappingsWithPaper(
    printingSpecs: GroupSpecifications,
    excelRows: any[][],
    headers: string[],
    startRowIndex: number,
    paperSpecs: GroupSpecifications | null
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    
    // LOGGING: Function entry
    this.logger.addDebugInfo(`[ENHANCED MAPPER] createPrintingRowMappingsWithPaper called with printingSpecs:`);
    this.logger.addDebugInfo(`[ENHANCED MAPPER] ${JSON.stringify(printingSpecs, null, 2)}`);
    
    // Convert printing specs to array for processing
    const printingOps = Object.entries(printingSpecs).map(([key, spec]) => ({
      key,
      spec,
      originalQty: spec.qty,
      originalWoQty: spec.wo_qty
    }));
    
    // LOGGING: PrintingOps array created
    this.logger.addDebugInfo(`[ENHANCED MAPPER] Created printingOps array with ${printingOps.length} operations:`);
    printingOps.forEach((op, i) => {
      this.logger.addDebugInfo(`[ENHANCED MAPPER] PrintingOp ${i}: Key="${op.key}", Qty=${op.spec.qty}, WO_Qty=${op.spec.wo_qty}, OriginalQty=${op.originalQty}`);
    });
    
    // Sort by quantity (ascending) - smallest = cover, largest = text
    const sortedPrintingOps = printingOps.sort((a, b) => (a.spec.qty || 0) - (b.spec.qty || 0));
    
    // LOGGING: After sorting
    this.logger.addDebugInfo(`[ENHANCED MAPPER] After sorting by quantity:`);
    sortedPrintingOps.forEach((op, i) => {
      this.logger.addDebugInfo(`[ENHANCED MAPPER] Sorted PrintingOp ${i}: Key="${op.key}", Qty=${op.spec.qty}, WO_Qty=${op.spec.wo_qty}`);
    });
    
    if (printingOps.length >= 2) {
      // Multi-part printing job (cover/text scenario)
      const coverPrintingOp = sortedPrintingOps[0]; // Smallest quantity
      const textPrintingOp = sortedPrintingOps[sortedPrintingOps.length - 1]; // Largest quantity
      
      // LOGGING: Cover and text operations identified
      this.logger.addDebugInfo(`[ENHANCED MAPPER] COVER PRINTING: Key="${coverPrintingOp.key}", spec.qty=${coverPrintingOp.spec.qty}, originalQty=${coverPrintingOp.originalQty}`);
      this.logger.addDebugInfo(`[ENHANCED MAPPER] TEXT PRINTING: Key="${textPrintingOp.key}", spec.qty=${textPrintingOp.spec.qty}, originalQty=${textPrintingOp.originalQty}`);
      
      // Create mappings for cover and text with individual quantities
      const coverMapping: RowMappingResult = {
        excelRowIndex: startRowIndex,
        excelData: excelRows[startRowIndex] || [],
        groupName: coverPrintingOp.key,
        description: coverPrintingOp.spec.description || '',
        qty: coverPrintingOp.spec.qty, // Individual quantity for cover
        woQty: coverPrintingOp.spec.wo_qty || 0,
        mappedStageId: null,
        mappedStageName: null,
        mappedStageSpecId: null,
        mappedStageSpecName: null,
        confidence: 0,
        category: 'printing',
        isUnmapped: true,
        manualOverride: false,
        partType: 'cover',
        paperSpecification: this.findBestPaperMatch(coverPrintingOp.spec.qty, paperSpecs)
      };
      
      const textMapping: RowMappingResult = {
        excelRowIndex: startRowIndex + 1,
        excelData: excelRows[startRowIndex + 1] || [],
        groupName: textPrintingOp.key,
        description: textPrintingOp.spec.description || '',
        qty: textPrintingOp.spec.qty, // Individual quantity for text
        woQty: textPrintingOp.spec.wo_qty || 0,
        mappedStageId: null,
        mappedStageName: null,
        mappedStageSpecId: null,
        mappedStageSpecName: null,
        confidence: 0,
        category: 'printing',
        isUnmapped: true,
        manualOverride: false,
        partType: 'text',
        paperSpecification: this.findBestPaperMatch(textPrintingOp.spec.qty, paperSpecs)
      };

      // LOGGING: Final mappings created
      this.logger.addDebugInfo(`[ENHANCED MAPPER] COVER MAPPING CREATED: qty=${coverMapping.qty}, woQty=${coverMapping.woQty}, partType=${coverMapping.partType}`);
      this.logger.addDebugInfo(`[ENHANCED MAPPER] TEXT MAPPING CREATED: qty=${textMapping.qty}, woQty=${textMapping.woQty}, partType=${textMapping.partType}`);
      
      // Apply intelligent stage mapping
      this.applyIntelligentStageMapping(coverMapping);
      this.applyIntelligentStageMapping(textMapping);
      
      mappings.push(coverMapping, textMapping);
    } else {
      // Single printing operation
      const singleOp = printingOps[0];
      const mapping: RowMappingResult = {
        excelRowIndex: startRowIndex,
        excelData: excelRows[startRowIndex] || [],
        groupName: singleOp.key,
        description: singleOp.spec.description || '',
        qty: singleOp.spec.qty,
        woQty: singleOp.spec.wo_qty || 0,
        mappedStageId: null,
        mappedStageName: null,
        mappedStageSpecId: null,
        mappedStageSpecName: null,
        confidence: 0,
        category: 'printing',
        isUnmapped: true,
        manualOverride: false,
        paperSpecification: this.findBestPaperMatch(singleOp.spec.qty, paperSpecs)
      };
      
      this.applyIntelligentStageMapping(mapping);
      mappings.push(mapping);
    }
    
    // LOGGING: Final mappings array
    this.logger.addDebugInfo(`[ENHANCED MAPPER] FINAL PRINTING MAPPINGS (${mappings.length}):`);
    mappings.forEach((mapping, i) => {
      this.logger.addDebugInfo(`[ENHANCED MAPPER] Final Mapping ${i}: qty=${mapping.qty}, woQty=${mapping.woQty}, partType=${mapping.partType}, mappedStageId=${mapping.mappedStageId}`);
    });
    
    return mappings;
  }

  private createCategoryRowMappings(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress',
    excelRows: any[][],
    headers: string[],
    startRowIndex: number
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    let currentRowIndex = startRowIndex;

    for (const [groupName, spec] of Object.entries(specs)) {
      const mapping: RowMappingResult = {
        excelRowIndex: currentRowIndex,
        excelData: excelRows[currentRowIndex] || [],
        groupName,
        description: spec.description || '',
        qty: spec.qty || 0,
        woQty: spec.wo_qty || 0,
        mappedStageId: null,
        mappedStageName: null,
        mappedStageSpecId: null,
        mappedStageSpecName: null,
        confidence: 0,
        category: category,
        isUnmapped: true,
        manualOverride: false
      };
      
      this.applyIntelligentStageMapping(mapping);
      mappings.push(mapping);
      currentRowIndex++;
    }

    return mappings;
  }
  
  private mapSpecificationsToStages(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress'
  ): StageMapping[] {
    const mappings: StageMapping[] = [];
    
    for (const [groupName, spec] of Object.entries(specs)) {
      const stageMapping = this.findBestStageMatch(groupName, spec.description || '', category);
      if (stageMapping) {
        mappings.push({
          ...stageMapping,
          specifications: [groupName, spec.description || ''].filter(Boolean)
        });
      }
    }
    
    return mappings;
  }

  private findBestStageMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress'
  ): Omit<StageMapping, 'specifications'> | null {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Define stage matching patterns based on category
    const stagePatterns = {
      printing: [
        { names: ['hp 12000', 'hp12000', '12000'], patterns: ['hp', '12000'] },
        { names: ['t250', 'xerox t250', 't-250'], patterns: ['t250', 't-250', 'xerox'] },
        { names: ['7900', 'hp 7900', 'hp7900'], patterns: ['7900'] },
        { names: ['digital printing', 'digital print'], patterns: ['digital'] },
        { names: ['offset printing', 'offset print'], patterns: ['offset'] }
      ],
      finishing: [
        { names: ['laminating', 'lamination'], patterns: ['laminat'] },
        { names: ['envelope printing'], patterns: ['envelope'] },
        { names: ['cutting', 'guillotine'], patterns: ['cut', 'guillotine'] },
        { names: ['folding'], patterns: ['fold'] },
        { names: ['binding'], patterns: ['bind', 'perfect', 'saddle'] }
      ],
      prepress: [
        { names: ['dtp', 'desktop publishing'], patterns: ['dtp', 'desktop'] },
        { names: ['proof', 'proofing'], patterns: ['proof'] },
        { names: ['plate making', 'plates'], patterns: ['plate'] }
      ]
    };
    
    const categoryPatterns = stagePatterns[category] || [];
    
    // Try to find matching stage in our loaded stages
    for (const stage of this.stages) {
      const stageName = stage.name.toLowerCase();
      
      // Direct name match with high confidence
      for (const pattern of categoryPatterns) {
        if (pattern.names.some(name => stageName.includes(name) || searchText.includes(name))) {
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence: 90,
            category
          };
        }
        
        // Pattern-based matching with medium confidence
        if (pattern.patterns.some(p => searchText.includes(p))) {
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence: 70,
            category
          };
        }
      }
    }
    
    return null;
  }

  private applyIntelligentStageMapping(mapping: RowMappingResult): void {
    // Find the best stage match using intelligent mapping
    const stageMatch = this.findBestStageMatch(
      mapping.groupName,
      mapping.description,
      mapping.category as 'printing' | 'finishing' | 'prepress'
    );
    
    if (stageMatch) {
      mapping.mappedStageId = stageMatch.stageId;
      mapping.mappedStageName = stageMatch.stageName;
      mapping.confidence = stageMatch.confidence;
      mapping.isUnmapped = false;
      
      this.logger.addDebugInfo(`[ENHANCED MAPPER] Applied stage mapping: ${mapping.groupName} -> ${stageMatch.stageName} (confidence: ${stageMatch.confidence})`);
    } else {
      this.logger.addDebugInfo(`[ENHANCED MAPPER] No stage mapping found for: ${mapping.groupName}`);
    }
  }

  private findBestPaperMatch(qty: number, paperSpecs: GroupSpecifications | null): string | null {
    if (!paperSpecs) return null;
    
    // Simple paper matching logic - find paper spec with closest quantity
    let bestMatch: string | null = null;
    let smallestDiff = Infinity;
    
    for (const [key, spec] of Object.entries(paperSpecs)) {
      const diff = Math.abs((spec.qty || 0) - qty);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestMatch = spec.description || key;
      }
    }
    
    return bestMatch;
  }
}
