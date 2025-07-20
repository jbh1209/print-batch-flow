import type { ExcelImportDebugger } from './debugger';
import type { GroupSpecifications, RowMappingResult, StageMapping } from './types';
import { supabase } from '@/integrations/supabase/client';

export class EnhancedStageMapper {
  private stages: any[] = [];

  constructor(
    private logger: ExcelImportDebugger
  ) {}

  async initialize(): Promise<void> {
    this.logger.addDebugInfo("Initializing enhanced stage mapper...");
    
    const { data, error } = await supabase
      .from('production_stages')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to load production stages: ${error.message}`);
    }

    this.stages = data || [];
    this.logger.addDebugInfo(`Loaded ${this.stages.length} stages`);
  }

  /**
   * Map Excel group specifications to production stages with intelligent matching
   */
  mapGroupsToStagesIntelligent(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): StageMapping[] {
    const mappings: StageMapping[] = [];

    // Handle cover/text detection for book jobs
    if (this.hasCoverTextPattern(printingSpecs)) {
      const { coverPaper, textPaper, coverPrintingOp, textPrintingOp } = this.extractCoverTextComponents(printingSpecs);
      
      if (coverPrintingOp) {
        mappings.push(coverPrintingOp.stageMapping);
      }
      if (textPrintingOp) {
        mappings.push(textPrintingOp.stageMapping);
      }
    } else {
      // Handle regular printing specs when not cover/text
      if (printingSpecs) {
        for (const [groupName, spec] of Object.entries(printingSpecs)) {
          const stageMapping = this.findBestStageMatch(groupName, spec.description || '', 'printing');
          if (stageMapping) {
            mappings.push({
              ...stageMapping,
              specifications: [groupName, spec.description || ''].filter(Boolean)
            });
          }
        }
      }
    }

    // Handle finishing specs
    if (finishingSpecs) {
      for (const [groupName, spec] of Object.entries(finishingSpecs)) {
        const stageMapping = this.findBestStageMatch(groupName, spec.description || '', 'finishing');
        if (stageMapping) {
          mappings.push({
            ...stageMapping,
            specifications: [groupName, spec.description || ''].filter(Boolean)
          });
        }
      }
    }

    // Handle prepress specs
    if (prepressSpecs) {
      for (const [groupName, spec] of Object.entries(prepressSpecs)) {
        const stageMapping = this.findBestStageMatch(groupName, spec.description || '', 'prepress');
        if (stageMapping) {
          mappings.push({
            ...stageMapping,
            specifications: [groupName, spec.description || ''].filter(Boolean)
          });
        }
      }
    }

    // Apply user-approved mappings
    if (userApprovedMappings) {
      userApprovedMappings.forEach(approvedMapping => {
        const existingMappingIndex = mappings.findIndex(mapping => mapping.specifications?.includes(approvedMapping.groupName));
        if (existingMappingIndex !== -1) {
          // Update existing mapping with user-approved values
          mappings[existingMappingIndex].stageId = approvedMapping.mappedStageId;
          mappings[existingMappingIndex].stageName = approvedMapping.mappedStageName;
        } else {
          // Add new mapping if it doesn't exist
          mappings.push({
            stageId: approvedMapping.mappedStageId,
            stageName: approvedMapping.mappedStageName,
            confidence: 100, // Assuming user approval means high confidence
            specifications: [approvedMapping.groupName]
          });
        }
      });
    }

    return mappings;
  }

  /**
   * Check if the printing specifications indicate a cover/text pattern
   */
  private hasCoverTextPattern(printingSpecs: GroupSpecifications | null): boolean {
    if (!printingSpecs) {
      return false;
    }

    const groupNames = Object.keys(printingSpecs).map(name => name.toLowerCase());
    return groupNames.some(name => name.includes('cover')) && groupNames.some(name => name.includes('text'));
  }

  /**
   * Extract cover and text components from printing specifications
   */
  private extractCoverTextComponents(printingSpecs: GroupSpecifications | null, paperSpecs: GroupSpecifications | null = null): any {
    let coverPaper: any = null;
    let textPaper: any = null;
    let coverPrintingOp: any = null;
    let textPrintingOp: any = null;

    if (paperSpecs) {
      coverPaper = Object.entries(paperSpecs).find(([groupName, spec]) =>
        groupName.toLowerCase().includes('cover')
      )?.[1];
      textPaper = Object.entries(paperSpecs).find(([groupName, spec]) =>
        groupName.toLowerCase().includes('text')
      )?.[1];
    }

    if (printingSpecs) {
      for (const [groupName, spec] of Object.entries(printingSpecs)) {
        const stageMapping = this.findBestStageMatch(groupName, spec.description || '', 'printing');
        const component = { groupName, spec, stageMapping };

        if (groupName.toLowerCase().includes('cover')) {
          coverPrintingOp = component;
        } else if (groupName.toLowerCase().includes('text')) {
          textPrintingOp = component;
        }
      }
    }

    return { coverPaper, textPaper, coverPrintingOp, textPrintingOp };
  }

  /**
   * Find the best matching production stage for a specification
   */
  private findBestStageMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging'
  ): Omit<StageMapping, 'specifications'> | null {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Define stage matching patterns
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
      ],
      packaging: [
        { names: ['packaging', 'packing'], patterns: ['pack', 'box', 'wrap', 'bag'] },
        { names: ['shrink wrap', 'shrinkwrap'], patterns: ['shrink', 'wrap'] },
        { names: ['boxing', 'box packing'], patterns: ['box'] },
        { names: ['delivery preparation'], patterns: ['delivery', 'prep'] }
      ]
    };
    
    const categoryPatterns = stagePatterns[category] || [];
    
    // Find matching stage
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
    
    this.logger.addDebugInfo(`No stage match found for: ${groupName} (${description})`);
    return null;
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

    // Handle cover/text detection for book jobs
    if (this.hasCoverTextPattern(printingSpecs)) {
      const { coverPaper, textPaper, coverPrintingOp, textPrintingOp } = this.extractCoverTextComponents(printingSpecs, paperSpecs);
      
      if (coverPaper && coverPrintingOp) {
        mappings.push({
          excelRowIndex: currentRowIndex,
          excelData: excelRows[currentRowIndex] || [],
          groupName: coverPrintingOp.groupName,
          description: coverPrintingOp.spec.description || '',
          qty: coverPaper.qty || 0, // FIX: Use cover paper quantity, not printing operation quantity
          woQty: coverPaper.wo_qty || 0,
          mappedStageId: coverPrintingOp.stageMapping?.stageId || null,
          mappedStageName: coverPrintingOp.stageMapping?.stageName || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: coverPrintingOp.stageMapping?.confidence || 0,
          category: 'printing',
          isUnmapped: !coverPrintingOp.stageMapping,
          manualOverride: false
        });
        currentRowIndex++;
      }

      if (textPaper && textPrintingOp) {
        mappings.push({
          excelRowIndex: currentRowIndex,
          excelData: excelRows[currentRowIndex] || [],
          groupName: textPrintingOp.groupName,
          description: textPrintingOp.spec.description || '',
          qty: textPaper.qty || 0, // FIX: Use text paper quantity, not printing operation quantity
          woQty: textPaper.wo_qty || 0,
          mappedStageId: textPrintingOp.stageMapping?.stageId || null,
          mappedStageName: textPrintingOp.stageMapping?.stageName || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: textPrintingOp.stageMapping?.confidence || 0,
          category: 'printing',
          isUnmapped: !textPrintingOp.stageMapping,
          manualOverride: false
        });
        currentRowIndex++;
      }
    } else {
      // Handle regular printing specs when not cover/text
      if (printingSpecs) {
        for (const [groupName, spec] of Object.entries(printingSpecs)) {
          const stageMapping = this.findBestStageMatch(groupName, spec.description || '', 'printing');
          
          mappings.push({
            excelRowIndex: currentRowIndex,
            excelData: excelRows[currentRowIndex] || [],
            groupName,
            description: spec.description || '',
            qty: spec.qty || 0,
            woQty: spec.wo_qty || 0,
            mappedStageId: stageMapping?.stageId || null,
            mappedStageName: stageMapping?.stageName || null,
            mappedStageSpecId: null,
            mappedStageSpecName: null,
            confidence: stageMapping?.confidence || 0,
            category: 'printing',
            isUnmapped: !stageMapping,
            manualOverride: false
          });
          currentRowIndex++;
        }
      }
    }

    // Handle finishing specs
    if (finishingSpecs) {
      for (const [groupName, spec] of Object.entries(finishingSpecs)) {
        const stageMapping = this.findBestStageMatch(groupName, spec.description || '', 'finishing');
        
        mappings.push({
          excelRowIndex: currentRowIndex,
          excelData: excelRows[currentRowIndex] || [],
          groupName,
          description: spec.description || '',
          qty: spec.qty || 0,
          woQty: spec.wo_qty || 0,
          mappedStageId: stageMapping?.stageId || null,
          mappedStageName: stageMapping?.stageName || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: stageMapping?.confidence || 0,
          category: 'finishing',
          isUnmapped: !stageMapping,
          manualOverride: false
        });
        currentRowIndex++;
      }
    }

    // Handle prepress specs
    if (prepressSpecs) {
      for (const [groupName, spec] of Object.entries(prepressSpecs)) {
        const stageMapping = this.findBestStageMatch(groupName, spec.description || '', 'prepress');
        
        mappings.push({
          excelRowIndex: currentRowIndex,
          excelData: excelRows[currentRowIndex] || [],
          groupName,
          description: spec.description || '',
          qty: spec.qty || 0,
          woQty: spec.wo_qty || 0,
          mappedStageId: stageMapping?.stageId || null,
          mappedStageName: stageMapping?.stageName || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: stageMapping?.confidence || 0,
          category: 'prepress',
          isUnmapped: !stageMapping,
          manualOverride: false
        });
        currentRowIndex++;
      }
    }

    return mappings;
  }
}
