import type { ExcelImportDebugger } from './debugger';
import type { GroupSpecifications, RowMappingResult, StageMapping } from './types';
import { supabase } from '@/integrations/supabase/client';
import { EnhancedStageMapper } from './enhancedStageMapper';

export interface CategoryAssignmentResult {
  categoryId: string | null;
  categoryName: string | null;
  confidence: number;
  mappedStages: StageMapping[];
  requiresCustomWorkflow: boolean;
  rowMappings?: RowMappingResult[];
  originalJob?: any; // Store original job data for preparation phase
}

export class ProductionStageMapper {
  private stages: any[] = [];
  private categories: any[] = [];
  private categoryStages: any[] = [];
  private enhancedMapper: EnhancedStageMapper;
  
  constructor(
    private logger: ExcelImportDebugger
  ) {
    this.enhancedMapper = new EnhancedStageMapper(logger);
  }

  async initialize(): Promise<void> {
    this.logger.addDebugInfo("Initializing production stage mapper...");
    
    // Initialize enhanced mapper first
    await this.enhancedMapper.initialize();
    
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
      .select(`
        *,
        production_stage:production_stages(*)
      `);
    
    if (categoryStagesError) {
      throw new Error(`Failed to load category stages: ${categoryStagesError.message}`);
    }
    
    this.categoryStages = categoryStagesData || [];
    
    this.logger.addDebugInfo(`Loaded ${this.stages.length} stages, ${this.categories.length} categories, ${this.categoryStages.length} relationships`);
  }

  /**
   * Map Excel group specifications to production stages with intelligent mapping
   */
  mapGroupsToStages(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    excelRows?: any[][]
  ): StageMapping[] {
    // Use enhanced mapper for intelligent stage mapping
    return this.enhancedMapper.mapGroupsToStagesIntelligent(
      printingSpecs,
      finishingSpecs,
      prepressSpecs
    );
  }

  /**
   * Create detailed row mappings for enhanced UI display using intelligent mapping
   */
  createDetailedRowMappings(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    excelRows: any[][],
    headers: string[]
  ): RowMappingResult[] {
    // Use enhanced mapper for intelligent mapping
    return this.enhancedMapper.createIntelligentRowMappings(
      printingSpecs,
      finishingSpecs,
      prepressSpecs,
      excelRows,
      headers,
      null // Paper specs not available at this level
    );
  }

  /**
   * Create row mappings for a specific category
   */
  private createRowMappingsForCategory(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery',
    excelRows: any[][],
    headers: string[],
    startRowIndex: number
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    let currentRowIndex = startRowIndex;

    for (const [groupName, spec] of Object.entries(specs)) {
      const stageMapping = this.findBestStageMatch(groupName, spec.description || '', category);
      
      mappings.push({
        excelRowIndex: currentRowIndex,
        excelData: excelRows[currentRowIndex] || [],
        groupName,
        description: spec.description || '',
        qty: spec.qty || 0,
        woQty: spec.wo_qty || 0,
        mappedStageId: stageMapping?.stageId || null,
        mappedStageName: stageMapping?.stageName || null,
        mappedStageSpecId: null, // Basic mapper doesn't handle sub-specs
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
   * Map individual group specifications to stages
   */
  private mapSpecificationsToStages(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery'
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

  /**
   * Find the best matching production stage for a specification
   */
  private findBestStageMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery'
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
        { names: ['binding'], patterns: ['bind', 'perfect', 'saddle'] },
        { names: ['packaging'], patterns: ['pack', 'box'] }
      ],
      prepress: [
        { names: ['dtp', 'desktop publishing'], patterns: ['dtp', 'desktop'] },
        { names: ['proof', 'proofing'], patterns: ['proof'] },
        { names: ['plate making', 'plates'], patterns: ['plate'] }
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

  /**
   * Assign the best category based on mapped stages with detailed row mappings
   */
  assignCategoryWithDetails(
    mappedStages: StageMapping[],
    rowMappings: RowMappingResult[]
  ): CategoryAssignmentResult {
    this.logger.addDebugInfo(`Analyzing ${mappedStages.length} mapped stages for category assignment`);
    
    const categoryScores = new Map<string, number>();
    const categoryStageMatches = new Map<string, string[]>();
    
    // Score categories based on how many required stages match
    for (const category of this.categories) {
      const requiredStages = this.categoryStages
        .filter(cs => cs.category_id === category.id)
        .map(cs => cs.production_stage_id);
      
      const mappedStageIds = mappedStages.map(ms => ms.stageId);
      const matchingStages = requiredStages.filter(stageId => 
        mappedStageIds.includes(stageId)
      );
      
      if (matchingStages.length > 0) {
        const score = (matchingStages.length / requiredStages.length) * 100;
        categoryScores.set(category.id, score);
        categoryStageMatches.set(category.id, matchingStages);
        
        this.logger.addDebugInfo(`Category "${category.name}": ${matchingStages.length}/${requiredStages.length} stages matched (${score.toFixed(1)}%)`);
      }
    }
    
    // Find best category match
    let bestCategoryId: string | null = null;
    let bestScore = 0;
    
    for (const [categoryId, score] of categoryScores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestCategoryId = categoryId;
      }
    }
    
    const unmappedRowsCount = rowMappings.filter(rm => rm.isUnmapped).length;
    
    if (bestCategoryId && bestScore >= 50) {
      const category = this.categories.find(c => c.id === bestCategoryId);
      return {
        categoryId: bestCategoryId,
        categoryName: category?.name || 'Unknown',
        confidence: bestScore,
        mappedStages,
        requiresCustomWorkflow: bestScore < 80 || unmappedRowsCount > 0,
        rowMappings
      };
    }
    
    // No good category match - will need custom workflow
    this.logger.addDebugInfo("No suitable category found, will create custom workflow");
    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      mappedStages,
      requiresCustomWorkflow: true,
      rowMappings
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  assignCategory(mappedStages: StageMapping[]): CategoryAssignmentResult {
    this.logger.addDebugInfo(`Analyzing ${mappedStages.length} mapped stages for category assignment`);
    
    const categoryScores = new Map<string, number>();
    const categoryStageMatches = new Map<string, string[]>();
    
    // Score categories based on how many required stages match
    for (const category of this.categories) {
      const requiredStages = this.categoryStages
        .filter(cs => cs.category_id === category.id)
        .map(cs => cs.production_stage_id);
      
      const mappedStageIds = mappedStages.map(ms => ms.stageId);
      const matchingStages = requiredStages.filter(stageId => 
        mappedStageIds.includes(stageId)
      );
      
      if (matchingStages.length > 0) {
        const score = (matchingStages.length / requiredStages.length) * 100;
        categoryScores.set(category.id, score);
        categoryStageMatches.set(category.id, matchingStages);
        
        this.logger.addDebugInfo(`Category "${category.name}": ${matchingStages.length}/${requiredStages.length} stages matched (${score.toFixed(1)}%)`);
      }
    }
    
    // Find best category match
    let bestCategoryId: string | null = null;
    let bestScore = 0;
    
    for (const [categoryId, score] of categoryScores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestCategoryId = categoryId;
      }
    }
    
    if (bestCategoryId && bestScore >= 50) {
      const category = this.categories.find(c => c.id === bestCategoryId);
      return {
        categoryId: bestCategoryId,
        categoryName: category?.name || 'Unknown',
        confidence: bestScore,
        mappedStages,
        requiresCustomWorkflow: bestScore < 80 // Require custom workflow if not a perfect match
      };
    }
    
    // No good category match - will need custom workflow
    this.logger.addDebugInfo("No suitable category found, will create custom workflow");
    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      mappedStages,
      requiresCustomWorkflow: true
    };
  }

  /**
   * Create category-stage relationships for a new dynamic category
   */
  async createDynamicCategory(
    mappedStages: StageMapping[],
    jobReference: string
  ): Promise<string> {
    const categoryName = `Auto-Generated: ${jobReference}`;
    
    // Create new category
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        name: categoryName,
        description: `Auto-generated category based on Excel import specifications`,
        sla_target_days: 3,
        requires_part_assignment: false
      })
      .select()
      .single();
    
    if (categoryError) {
      throw new Error(`Failed to create dynamic category: ${categoryError.message}`);
    }
    
    // Create category-stage relationships
    const categoryStageInserts = mappedStages.map((stage, index) => ({
      category_id: category.id,
      production_stage_id: stage.stageId,
      stage_order: index + 1,
      is_required: true,
      estimated_duration_hours: 24
    }));
    
    const { error: stagesError } = await supabase
      .from('category_production_stages')
      .insert(categoryStageInserts);
    
    if (stagesError) {
      // Clean up category if stage creation fails
      await supabase.from('categories').delete().eq('id', category.id);
      throw new Error(`Failed to create category stages: ${stagesError.message}`);
    }
    
    this.logger.addDebugInfo(`Created dynamic category "${categoryName}" with ${mappedStages.length} stages`);
    return category.id;
  }
}