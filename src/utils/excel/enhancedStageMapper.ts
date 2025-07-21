import { supabase } from '@/integrations/supabase/client';
import type { ParsedJob, RowMappingResult, GroupSpecifications, StageMapping } from './types';
import type { ExcelImportDebugger } from './debugger';
import { stringSimilarity } from 'string-similarity-js';

export interface StageMappingResult {
  success: boolean;
  rowMappings: any;
  categoryAssignments: any;
  unmappedRows: any[];
  stats: {
    total: number;
    successful: number;
    failed: number;
  };
}

export class EnhancedStageMapper {
  private stages: any[] = [];
  private stageSpecs: any[] = [];
  private printSpecs: any[] = [];
  private verifiedMappings: any[] = [];
  private categories: any[] = [];
  private categoryStages: any[] = [];

  constructor(private logger: ExcelImportDebugger) {}

  async initialize(): Promise<void> {
    this.logger.addDebugInfo("Initializing enhanced stage mapper...");
    
    // Load stage specifications
    const { data: stageSpecsData, error: stageSpecsError } = await supabase
      .from('stage_specifications')
      .select('*');
    
    if (stageSpecsError) {
      throw new Error(`Failed to load stage specifications: ${stageSpecsError.message}`);
    }
    
    this.stageSpecs = stageSpecsData || [];
    this.logger.addDebugInfo(`Loaded ${this.stageSpecs.length} stage specifications`);
    
    // Load print specifications
    const { data: printSpecsData, error: printSpecsError } = await supabase
      .from('print_specifications')
      .select('*');
    
    if (printSpecsError) {
      throw new Error(`Failed to load print specifications: ${printSpecsError.message}`);
    }
    
    this.printSpecs = printSpecsData || [];
    this.logger.addDebugInfo(`Loaded ${this.printSpecs.length} print specifications`);
    
    // Load verified mappings
    const { data: mappingsData, error: mappingsError } = await supabase
      .from('excel_import_mappings')
      .select('*')
      .eq('is_verified', true);
    
    if (mappingsError) {
      throw new Error(`Failed to load verified mappings: ${mappingsError.message}`);
    }
    
    this.verifiedMappings = mappingsData || [];
    this.logger.addDebugInfo(`Loaded ${this.verifiedMappings.length} verified mappings`);
    
    // Load production stages
    const { data: stagesData, error: stagesError } = await supabase
      .from('production_stages')
      .select('*')
      .eq('is_active', true);
    
    if (stagesError) {
      throw new Error(`Failed to load production stages: ${stagesError.message}`);
    }
    
    this.stages = stagesData || [];
    
    // Load categories
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    
    if (categoriesError) {
      throw new Error(`Failed to load categories: ${categoriesError.message}`);
    }
    
    this.categories = categoriesData || [];
    
    // Load category-stage relationships
    const { data: categoryStagesData, error: categoryStagesError } = await supabase
      .from('category_production_stages')
      .select('*');
    
    if (categoryStagesError) {
      throw new Error(`Failed to load category stages: ${categoryStagesError.message}`);
    }
    
    this.categoryStages = categoryStagesData || [];
    
    this.logger.addDebugInfo(`Loaded ${this.stages.length} stages, ${this.categories.length} categories, ${this.categoryStages.length} relationships`);
  }

  /**
   * Map group specifications to production stages with intelligent mapping
   */
  mapGroupsToStagesIntelligent(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>,
    paperSpecs?: GroupSpecifications | null,
    packagingSpecs?: GroupSpecifications | null,
    deliverySpecs?: GroupSpecifications | null
  ): StageMapping[] {
    const mappings: StageMapping[] = [];
    
    // Process each specification category
    if (printingSpecs) {
      mappings.push(...this.mapSpecCategory(printingSpecs, 'printing', userApprovedMappings));
    }
    
    if (finishingSpecs) {
      mappings.push(...this.mapSpecCategory(finishingSpecs, 'finishing', userApprovedMappings));
    }
    
    if (prepressSpecs) {
      mappings.push(...this.mapSpecCategory(prepressSpecs, 'prepress', userApprovedMappings));
    }
    
    if (packagingSpecs) {
      mappings.push(...this.mapSpecCategory(packagingSpecs, 'packaging', userApprovedMappings));
    }
    
    if (deliverySpecs) {
      mappings.push(...this.mapSpecCategory(deliverySpecs, 'delivery', userApprovedMappings));
    }
    
    return mappings;
  }

  /**
   * Create intelligent row mappings for UI display
   */
  createIntelligentRowMappings(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    excelRows: any[][],
    headers: string[],
    paperSpecs?: GroupSpecifications | null,
    packagingSpecs?: GroupSpecifications | null,
    deliverySpecs?: GroupSpecifications | null
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    let rowIndex = 0;
    
    // Create mappings for printing specifications
    if (printingSpecs) {
      mappings.push(...this.createRowMappingsForCategory(printingSpecs, 'printing', rowIndex));
      rowIndex += Object.keys(printingSpecs).length;
    }
    
    // Create mappings for finishing specifications
    if (finishingSpecs) {
      mappings.push(...this.createRowMappingsForCategory(finishingSpecs, 'finishing', rowIndex));
      rowIndex += Object.keys(finishingSpecs).length;
    }
    
    // Create mappings for prepress specifications
    if (prepressSpecs) {
      mappings.push(...this.createRowMappingsForCategory(prepressSpecs, 'prepress', rowIndex));
      rowIndex += Object.keys(prepressSpecs).length;
    }
    
    // Create mappings for packaging specifications
    if (packagingSpecs) {
      mappings.push(...this.createRowMappingsForCategory(packagingSpecs, 'packaging', rowIndex));
      rowIndex += Object.keys(packagingSpecs).length;
    }
    
    // Create mappings for delivery specifications
    if (deliverySpecs) {
      mappings.push(...this.createRowMappingsForCategory(deliverySpecs, 'delivery', rowIndex));
      rowIndex += Object.keys(deliverySpecs).length;
    }
    
    return mappings;
  }

  /**
   * Map specifications for a specific category
   */
  private mapSpecCategory(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress' | 'packaging' | 'delivery',
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): StageMapping[] {
    const mappings: StageMapping[] = [];
    
    for (const [groupName, spec] of Object.entries(specs)) {
      // Check for user-approved mapping first
      const userMapping = userApprovedMappings?.find(
        m => m.groupName === groupName && m.category === category
      );
      
      if (userMapping) {
        mappings.push({
          stageId: userMapping.mappedStageId,
          stageName: userMapping.mappedStageName,
          confidence: 100,
          category,
          specifications: [groupName]
        });
      } else {
        // Use intelligent mapping
        const mapping = this.findBestStageMatch(groupName, spec.description || '', category);
        if (mapping) {
          mappings.push({
            ...mapping,
            specifications: [groupName]
          });
        }
      }
    }
    
    return mappings;
  }

  /**
   * Create row mappings for a specific category
   */
  private createRowMappingsForCategory(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress' | 'packaging' | 'delivery',
    startRowIndex: number
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    let currentRowIndex = startRowIndex;

    for (const [groupName, spec] of Object.entries(specs)) {
      const stageMapping = this.findBestStageMatch(groupName, spec.description || '', category);
      
      mappings.push({
        excelRowIndex: currentRowIndex,
        excelData: [],
        groupName,
        description: spec.description || '',
        qty: spec.qty || 0,
        woQty: spec.wo_qty || 0,
        mappedStageId: stageMapping?.stageId || null,
        mappedStageName: stageMapping?.stageName || null,
        mappedStageSpecId: null,
        mappedStageSpecName: null,
        confidence: stageMapping?.confidence || 0,
        category: stageMapping?.category || 'unknown',
        isUnmapped: !stageMapping,
        manualOverride: false
      });

      currentRowIndex++;
    }

    return mappings;
  }

  /**
   * Find the best matching production stage for a specification
   */
  private findBestStageMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'packaging' | 'delivery'
  ): Omit<StageMapping, 'specifications'> | null {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Check verified mappings first
    for (const mapping of this.verifiedMappings) {
      if (mapping.excel_text.toLowerCase() === searchText.toLowerCase()) {
        const stage = this.stages.find(s => s.id === mapping.production_stage_id);
        if (stage) {
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence: 100,
            category
          };
        }
      }
    }
    
    // Fallback to fuzzy matching
    let bestMatch = null;
    let bestScore = 0;

    for (const stage of this.stages) {
      const similarity = this.calculateSimilarity(searchText, stage.name);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = {
          stageId: stage.id,
          stageName: stage.name,
          confidence: similarity * 100,
          category
        };
      }
    }

    return bestScore > 0.5 ? bestMatch : null;
  }

  /**
   * Calculate similarity between two strings with better normalization
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const cleanStr1 = str1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const cleanStr2 = str2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    // Return 1.0 for exact matches after cleaning
    if (cleanStr1 === cleanStr2) return 1.0;
    
    return stringSimilarity(cleanStr1, cleanStr2);
  }
}