
import type { ParsedJob, RowMappingResult } from './types';
import type { ExcelImportDebugger } from './debugger';
import { supabase } from '@/integrations/supabase/client';

interface StageSpecification {
  id: string;
  name: string;
  production_stage_id: string;
}

interface ProductionStage {
  id: string;
  name: string;
  category?: string;
  stage_specifications?: StageSpecification[];
}

interface ExcelImportMapping {
  id: string;
  excel_text: string;
  production_stage_id: string;
  stage_specification_id?: string;
  confidence_score: number;
  is_verified: boolean;
  mapping_type: string;
  print_specification_id?: string;
  paper_type_specification_id?: string;
  paper_weight_specification_id?: string;
}

interface PrintSpecification {
  id: string;
  name: string;
  display_name: string;
  category: string;
}

export interface EnhancedStageMapping {
  stageId: string;
  stageName: string;
  stageSpecId?: string;
  stageSpecName?: string;
  confidence: number;
  specifications: string[];
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging';
  instanceId?: string;
  quantity?: number;
  paperSpecification?: string;
  partType?: string;
  stageInstanceIndex?: number;
  dependencyGroupId?: string;
}

interface PrintingSpecGroup {
  [key: string]: {
    specs: Array<{ key: string; spec: any; stageMatch: any }>;
    stageId: string;
    stageName: string;
  };
}

export class EnhancedStageMapper {
  private productionStages: ProductionStage[] = [];
  private categories: any[] = [];
  private categoryStages: any[] = [];
  private excelImportMappings: ExcelImportMapping[] = [];
  private printSpecifications: PrintSpecification[] = [];
  private logger: ExcelImportDebugger;
  
  constructor(logger: ExcelImportDebugger) {
    this.logger = logger;
  }
  
  async initialize() {
    this.logger.addDebugInfo("🔄 Initializing EnhancedStageMapper with database data...");
    
    try {
      // Load production stages
      const { data: stagesData, error: stagesError } = await supabase
        .from('production_stages')
        .select('*')
        .eq('is_active', true);
      
      if (stagesError) {
        throw new Error(`Failed to load production stages: ${stagesError.message}`);
      }
      
      this.productionStages = stagesData || [];
      
      // Load excel import mappings
      const { data: mappingsData, error: mappingsError } = await supabase
        .from('excel_import_mappings')
        .select('*');
      
      if (mappingsError) {
        throw new Error(`Failed to load excel import mappings: ${mappingsError.message}`);
      }
      
      this.excelImportMappings = mappingsData || [];
      
      // Load print specifications for paper mapping
      const { data: specsData, error: specsError } = await supabase
        .from('print_specifications')
        .select('id, name, display_name, category')
        .eq('is_active', true)
        .in('category', ['paper_type', 'paper_weight']);
      
      if (specsError) {
        throw new Error(`Failed to load print specifications: ${specsError.message}`);
      }
      
      this.printSpecifications = specsData || [];
      
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
      
      this.logger.addDebugInfo(`✅ Loaded ${this.productionStages.length} stages, ${this.excelImportMappings.length} mappings, ${this.printSpecifications.length} print specs`);
    } catch (error) {
      this.logger.addDebugInfo(`❌ Failed to initialize EnhancedStageMapper: ${error}`);
      throw error;
    }
  }
  
  async mapJobToStages(job: ParsedJob, excelHeaders: string[], excelRows: any[][]): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo(`🎯 ENHANCED STAGE MAPPING for WO: ${job.wo_no}`);
    
    const rowMappings: RowMappingResult[] = [];
    let sequentialRowIndex = 0;
    
    // Process printing specifications with multi-stage detection
    if (job.printing_specifications) {
      this.logger.addDebugInfo(`📝 PROCESSING PRINTING SPECS WITH MULTI-STAGE DETECTION:`);
      const printingMappings = await this.processPrintingSpecificationsWithMultiStage(
        job.printing_specifications, 
        job.paper_specifications,
        excelRows, 
        sequentialRowIndex
      );
      
      rowMappings.push(...printingMappings);
      sequentialRowIndex += printingMappings.length;
    }
    
    // Map other specifications (finishing, prepress, etc.) with database mappings
    const specCategories = [
      { specs: job.finishing_specifications, category: 'finishing' as const },
      { specs: job.prepress_specifications, category: 'prepress' as const },
      { specs: job.delivery_specifications, category: 'delivery' as const },
      { specs: job.packaging_specifications, category: 'packaging' as const }
    ];
    
    specCategories.forEach(({ specs, category }) => {
      if (specs) {
        Object.entries(specs).forEach(([key, spec]) => {
          const actualQty = spec.qty || spec.wo_qty || 0;
          const actualWoQty = spec.wo_qty || spec.qty || 0;
          
          this.logger.addDebugInfo(`📍 ASSIGNED ROW INDEX: ${sequentialRowIndex} for "${key}" [${category}]`);
          
          const stageMatch = this.findBestStageMatchFromDatabase(key, spec.description || '', category);
          
          const mapping: RowMappingResult = {
            excelRowIndex: sequentialRowIndex,
            excelData: this.findRowDataInExcel(spec.description || key, excelRows),
            groupName: key,
            description: spec.description || key,
            qty: actualQty,
            woQty: actualWoQty,
            mappedStageId: stageMatch?.stageId || null,
            mappedStageName: stageMatch?.stageName || null,
            mappedStageSpecId: null,
            mappedStageSpecName: null,
            confidence: stageMatch?.confidence || 0,
            category,
            isUnmapped: !stageMatch,
            instanceId: `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
          };
          
          rowMappings.push(mapping);
          sequentialRowIndex++;
        });
      }
    });
    
    this.logger.addDebugInfo(`🏁 ENHANCED STAGE MAPPING COMPLETE: ${rowMappings.length} row mappings created`);
    rowMappings.forEach((mapping, i) => {
      this.logger.addDebugInfo(`   ${i + 1}. "${mapping.description}" [${mapping.category}] - Qty: ${mapping.qty}, Stage: "${mapping.mappedStageName || 'UNMAPPED'}" (confidence: ${mapping.confidence}), paper: ${mapping.paperSpecification || 'none'}`);
    });
    
    return rowMappings;
  }

  /**
   * Process printing specifications with multi-stage detection and proper Cover/Text logic
   */
  private async processPrintingSpecificationsWithMultiStage(
    printingSpecs: any,
    paperSpecs: any,
    excelRows: any[][],
    startingIndex: number
  ): Promise<RowMappingResult[]> {
    const mappings: RowMappingResult[] = [];
    
    // First, map all printing specs to their stages and group by stage
    const printingGroups: PrintingSpecGroup = {};
    
    for (const [key, spec] of Object.entries(printingSpecs)) {
      const stageMatch = this.findBestStageMatchFromDatabase(key, (spec as any)?.description || '', 'printing');
      
      if (stageMatch) {
        const groupKey = `${stageMatch.stageId}-${stageMatch.stageName}`;
        
        if (!printingGroups[groupKey]) {
          printingGroups[groupKey] = {
            specs: [],
            stageId: stageMatch.stageId,
            stageName: stageMatch.stageName
          };
        }
        
        printingGroups[groupKey].specs.push({
          key,
          spec,
          stageMatch
        });
      }
    }
    
    // Process each stage group with proper Cover/Text detection
    let currentIndex = startingIndex;
    
    for (const [groupKey, group] of Object.entries(printingGroups)) {
      if (group.specs.length === 1) {
        // Single printing spec for this stage
        const { key, spec, stageMatch } = group.specs[0];
        const actualQty = spec.qty || spec.wo_qty || 0;
        const actualWoQty = spec.wo_qty || spec.qty || 0;
        
        // Find matching paper specification using database mappings
        const paperSpec = await this.findMatchingPaperSpecFromDatabase(spec, paperSpecs);
        
        this.logger.addDebugInfo(`   📍 SINGLE PRINTING STAGE: "${key}" -> "${group.stageName}" (qty: ${actualQty}) with paper: ${paperSpec || 'none'}`);
        
        mappings.push({
          excelRowIndex: currentIndex,
          excelData: this.findRowDataInExcel(spec.description || key, excelRows),
          groupName: key,
          description: spec.description || key,
          qty: actualQty,
          woQty: actualWoQty,
          mappedStageId: group.stageId,
          mappedStageName: group.stageName,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: stageMatch.confidence,
          category: 'printing',
          isUnmapped: false,
          instanceId: `printing-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          paperSpecification: paperSpec,
          stageInstanceIndex: 0
        });
        
        currentIndex++;
      } else if (group.specs.length > 1) {
        // Multiple printing specs for same stage - apply Cover/Text logic
        this.logger.addDebugInfo(`   🔄 MULTIPLE PRINTING SPECS FOR STAGE: "${group.stageName}" (${group.specs.length} specs)`);
        
        // Generate dependency group ID for book job synchronization
        const dependencyGroupId = `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.logger.addDebugInfo(`   📚 BOOK JOB DETECTED - dependency group: ${dependencyGroupId}`);
        
        // Sort by quantity: smallest = cover, largest = text
        const sortedSpecs = [...group.specs].sort((a, b) => {
          const qtyA = a.spec.qty || a.spec.wo_qty || 0;
          const qtyB = b.spec.qty || b.spec.wo_qty || 0;
          return qtyA - qtyB;
        });
        
        for (let index = 0; index < sortedSpecs.length; index++) {
          const { key, spec, stageMatch } = sortedSpecs[index];
          const actualQty = spec.qty || spec.wo_qty || 0;
          const actualWoQty = spec.wo_qty || spec.qty || 0;
          
          const isCover = index === 0; // Smallest quantity = Cover
          const isText = index === sortedSpecs.length - 1; // Largest quantity = Text
          const partType = isCover ? 'Cover' : isText ? 'Text' : `Part ${index + 1}`;
          
          // Find matching paper specification using database mappings
          const paperSpec = await this.findMatchingPaperSpecFromDatabase(spec, paperSpecs);
          
          this.logger.addDebugInfo(`     📄 PART: "${partType}" - "${key}" (qty: ${actualQty}) with paper: ${paperSpec || 'none'}`);
          
          mappings.push({
            excelRowIndex: currentIndex,
            excelData: this.findRowDataInExcel(spec.description || key, excelRows),
            groupName: key,
            description: spec.description || key,
            qty: actualQty,
            woQty: actualWoQty,
            mappedStageId: group.stageId,
            mappedStageName: `${group.stageName} (${partType})`,
            mappedStageSpecId: null,
            mappedStageSpecName: null,
            confidence: stageMatch.confidence,
            category: 'printing',
            isUnmapped: false,
            instanceId: `printing-${partType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            paperSpecification: paperSpec,
            partType,
            stageInstanceIndex: index,
            dependencyGroupId
          });
          
          currentIndex++;
        }
      }
    }
    
    return mappings;
  }

  /**
   * Find matching paper specification using database mappings first, then fallback
   */
  private async findMatchingPaperSpecFromDatabase(printingSpec: any, paperSpecs: any): Promise<string | undefined> {
    if (!paperSpecs) return undefined;
    
    const printingQty = printingSpec.qty || printingSpec.wo_qty || 0;
    
    // Find paper spec with closest quantity match
    let bestPaperKey = null;
    let smallestDiff = Infinity;
    
    for (const [paperKey, paperSpec] of Object.entries(paperSpecs)) {
      const paperQty = (paperSpec as any).qty || (paperSpec as any).wo_qty || 0;
      const diff = Math.abs(printingQty - paperQty);
      
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestPaperKey = paperKey;
      }
    }
    
    if (!bestPaperKey) return undefined;
    
    const rawPaperDescription = (paperSpecs as any)[bestPaperKey].description || bestPaperKey;
    
    this.logger.addDebugInfo(`🔍 PAPER MAPPING: Looking for database mapping for "${rawPaperDescription}"`);
    
    // First, try to find exact database mapping for paper specification
    const exactMapping = this.excelImportMappings.find(mapping => 
      mapping.mapping_type === 'paper_specification' && 
      mapping.excel_text.toLowerCase() === rawPaperDescription.toLowerCase()
    );
    
    if (exactMapping && exactMapping.print_specification_id) {
      // Get the clean specification from database
      const paperTypeSpec = this.printSpecifications.find(spec => 
        spec.id === exactMapping.print_specification_id && spec.category === 'paper_type'
      );
      
      const paperWeightSpec = this.printSpecifications.find(spec => 
        spec.id === exactMapping.print_specification_id && spec.category === 'paper_weight'
      );
      
      if (paperTypeSpec || paperWeightSpec) {
        const cleanSpec = paperTypeSpec ? paperTypeSpec.display_name : paperWeightSpec?.display_name;
        this.logger.addDebugInfo(`💯 EXACT PAPER MAPPING: "${rawPaperDescription}" -> "${cleanSpec}"`);
        return cleanSpec;
      }
    }
    
    // Try to find separate type and weight mappings
    const lowerDescription = rawPaperDescription.toLowerCase();
    
    let matchedType = '';
    let matchedWeight = '';
    
    // Look for paper type mapping
    const typeMapping = this.excelImportMappings.find(mapping => 
      mapping.mapping_type === 'paper_specification' && 
      lowerDescription.includes(mapping.excel_text.toLowerCase()) &&
      mapping.paper_type_specification_id
    );
    
    if (typeMapping && typeMapping.paper_type_specification_id) {
      const typeSpec = this.printSpecifications.find(spec => 
        spec.id === typeMapping.paper_type_specification_id && spec.category === 'paper_type'
      );
      if (typeSpec) {
        matchedType = typeSpec.display_name;
      }
    }
    
    // Look for paper weight mapping
    const weightMapping = this.excelImportMappings.find(mapping => 
      mapping.mapping_type === 'paper_specification' && 
      lowerDescription.includes(mapping.excel_text.toLowerCase()) &&
      mapping.paper_weight_specification_id
    );
    
    if (weightMapping && weightMapping.paper_weight_specification_id) {
      const weightSpec = this.printSpecifications.find(spec => 
        spec.id === weightMapping.paper_weight_specification_id && spec.category === 'paper_weight'
      );
      if (weightSpec) {
        matchedWeight = weightSpec.display_name;
      }
    }
    
    // Fallback to pattern matching if no database mappings found
    if (!matchedType && !matchedWeight) {
      // Find matching paper type from specifications
      for (const spec of this.printSpecifications.filter(s => s.category === 'paper_type')) {
        if (lowerDescription.includes(spec.name.toLowerCase()) || 
            lowerDescription.includes(spec.display_name.toLowerCase())) {
          matchedType = spec.display_name;
          break;
        }
      }
      
      // Find matching paper weight from specifications
      for (const spec of this.printSpecifications.filter(s => s.category === 'paper_weight')) {
        if (lowerDescription.includes(spec.name.toLowerCase().replace('gsm', '')) ||
            lowerDescription.includes(spec.display_name.toLowerCase().replace('gsm', ''))) {
          matchedWeight = spec.display_name;
          break;
        }
      }
    }
    
    // Construct clean specification
    if (matchedType && matchedWeight) {
      const cleanSpec = `${matchedType} ${matchedWeight}`;
      this.logger.addDebugInfo(`🔄 PAPER MAPPING: "${rawPaperDescription}" -> "${cleanSpec}"`);
      return cleanSpec;
    } else if (matchedType) {
      this.logger.addDebugInfo(`🔄 PAPER MAPPING: "${rawPaperDescription}" -> "${matchedType}"`);
      return matchedType;
    } else if (matchedWeight) {
      this.logger.addDebugInfo(`🔄 PAPER MAPPING: "${rawPaperDescription}" -> "${matchedWeight}"`);
      return matchedWeight;
    }
    
    // Fallback to raw description if no clean match found
    this.logger.addDebugInfo(`⚠️ NO PAPER MAPPING: "${rawPaperDescription}" - using raw description`);
    return rawPaperDescription;
  }
  
  /**
   * Find the best matching production stage using database mappings with enhanced priority
   */
  private findBestStageMatchFromDatabase(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging'
  ): { stageId: string; stageName: string; confidence: number } | null {
    const searchText = `${groupName} ${description}`.toLowerCase().trim();
    
    this.logger.addDebugInfo(`🔍 SEARCHING DATABASE MAPPINGS for: "${searchText}"`);
    
    // Sort mappings by priority: verified first, then by confidence score
    const sortedMappings = [...this.excelImportMappings]
      .filter(m => m.mapping_type === 'production_stage')
      .sort((a, b) => {
        // Prioritize verified mappings
        if (a.is_verified && !b.is_verified) return -1;
        if (!a.is_verified && b.is_verified) return 1;
        // Then by confidence score
        return b.confidence_score - a.confidence_score;
      });
    
    // 1. Try exact text matches first (highest priority)
    for (const mapping of sortedMappings) {
      if (mapping.excel_text.toLowerCase() === searchText) {
        const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
        if (stage) {
          const confidence = mapping.is_verified ? Math.min(100, mapping.confidence_score + 20) : mapping.confidence_score;
          this.logger.addDebugInfo(`💯 EXACT DATABASE MATCH: "${searchText}" -> "${stage.name}" (confidence: ${confidence}, verified: ${mapping.is_verified})`);
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence
          };
        }
      }
    }
    
    // 2. Try exact key matches (e.g., "perfect bound" matches key exactly)
    for (const mapping of sortedMappings) {
      if (groupName.toLowerCase() === mapping.excel_text.toLowerCase()) {
        const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
        if (stage) {
          const confidence = mapping.is_verified ? Math.min(95, mapping.confidence_score + 15) : Math.max(80, mapping.confidence_score - 10);
          this.logger.addDebugInfo(`🎯 KEY MATCH: "${groupName}" -> "${stage.name}" (confidence: ${confidence}, verified: ${mapping.is_verified})`);
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence
          };
        }
      }
    }
    
    // 3. Try description-only matches
    if (description) {
      for (const mapping of sortedMappings) {
        if (description.toLowerCase() === mapping.excel_text.toLowerCase()) {
          const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
          if (stage) {
            const confidence = mapping.is_verified ? Math.min(90, mapping.confidence_score + 10) : Math.max(75, mapping.confidence_score - 15);
            this.logger.addDebugInfo(`📝 DESCRIPTION MATCH: "${description}" -> "${stage.name}" (confidence: ${confidence}, verified: ${mapping.is_verified})`);
            return {
              stageId: stage.id,
              stageName: stage.name,
              confidence
            };
          }
        }
      }
    }
    
    // 4. Try partial matches (lower priority)
    for (const mapping of sortedMappings) {
      if (searchText.includes(mapping.excel_text.toLowerCase()) || mapping.excel_text.toLowerCase().includes(searchText)) {
        const stage = this.productionStages.find(s => s.id === mapping.production_stage_id);
        if (stage) {
          const confidence = Math.max(50, mapping.confidence_score - 30);
          this.logger.addDebugInfo(`🔄 PARTIAL DATABASE MATCH: "${searchText}" -> "${stage.name}" (confidence: ${confidence})`);
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence
          };
        }
      }
    }
    
    // Fallback to pattern matching if no database mapping found
    this.logger.addDebugInfo(`⚠️ NO DATABASE MATCH - falling back to pattern matching for: "${searchText}"`);
    return this.findBestStageMatchFromPatterns(groupName, description, category);
  }
  
  /**
   * Fallback pattern matching (kept as backup)
   */
  private findBestStageMatchFromPatterns(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging'
  ): { stageId: string; stageName: string; confidence: number } | null {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Define stage matching patterns (reduced confidence since it's fallback)
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
      ],
      delivery: [
        { names: ['delivery', 'courier'], patterns: ['deliver', 'courier'] },
        { names: ['collection', 'pickup'], patterns: ['collect', 'pickup'] }
      ]
    };
    
    const categoryPatterns = stagePatterns[category] || [];
    
    // Find matching stage
    for (const stage of this.productionStages) {
      const stageName = stage.name.toLowerCase();
      
      // Direct name match with medium confidence (fallback pattern)
      for (const pattern of categoryPatterns) {
        if (pattern.names.some(name => stageName.includes(name) || searchText.includes(name))) {
          this.logger.addDebugInfo(`🔄 PATTERN MATCH: "${searchText}" -> "${stage.name}" (confidence: 60)`);
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence: 60
          };
        }
        
        // Pattern-based matching with lower confidence
        if (pattern.patterns.some(p => searchText.includes(p))) {
          this.logger.addDebugInfo(`🔍 WEAK PATTERN MATCH: "${searchText}" -> "${stage.name}" (confidence: 40)`);
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence: 40
          };
        }
      }
    }
    
    this.logger.addDebugInfo(`❌ NO STAGE MATCH: "${searchText}"`);
    return null;
  }
  
  private findRowDataInExcel(description: string, excelRows: any[][]): any[] {
    const rowIndex = this.findRowIndexInExcel(description, excelRows);
    return rowIndex !== -1 ? excelRows[rowIndex] : [];
  }
  
  private findRowIndexInExcel(description: string, excelRows: any[][]): number {
    for (let i = 0; i < excelRows.length; i++) {
      const rowText = excelRows[i].join(' ').toLowerCase();
      if (rowText.includes(description.toLowerCase())) {
        return i;
      }
    }
    return -1;
  }
}
