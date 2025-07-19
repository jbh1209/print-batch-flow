
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
}

export class EnhancedStageMapper {
  private productionStages: ProductionStage[] = [];
  private categories: any[] = [];
  private categoryStages: any[] = [];
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
      
      this.logger.addDebugInfo(`✅ Loaded ${this.productionStages.length} stages, ${this.categories.length} categories, ${this.categoryStages.length} relationships`);
    } catch (error) {
      this.logger.addDebugInfo(`❌ Failed to initialize EnhancedStageMapper: ${error}`);
      throw error;
    }
  }
  
  async mapJobToStages(job: ParsedJob, excelHeaders: string[], excelRows: any[][]): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo(`🎯 ENHANCED STAGE MAPPING for WO: ${job.wo_no}`);
    
    const rowMappings: RowMappingResult[] = [];
    
    // Map printing specifications with FIXED quantity extraction and stage matching
    if (job.printing_specifications) {
      this.logger.addDebugInfo(`📝 PROCESSING PRINTING SPECS:`);
      Object.entries(job.printing_specifications).forEach(([key, spec]) => {
        this.logger.addDebugInfo(`   - Spec "${key}": qty=${spec.qty}, wo_qty=${spec.wo_qty}, desc="${spec.description}"`);
        
        // CRITICAL FIX: Use the quantities from the spec, with proper fallbacks
        const actualQty = spec.qty || spec.wo_qty || 0;
        const actualWoQty = spec.wo_qty || spec.qty || 0;
        
        this.logger.addDebugInfo(`   ✅ QUANTITIES RESOLVED: actualQty=${actualQty}, actualWoQty=${actualWoQty}`);
        
        // NEW: Find stage match for this specification
        const stageMatch = this.findBestStageMatch(key, spec.description || '', 'printing');
        
        const mapping: RowMappingResult = {
          excelRowIndex: this.findRowIndexInExcel(spec.description || key, excelRows),
          excelData: this.findRowDataInExcel(spec.description || key, excelRows),
          groupName: key,
          description: spec.description || key,
          qty: actualQty, // FIXED: Use resolved quantity
          woQty: actualWoQty, // FIXED: Use resolved WO quantity
          mappedStageId: stageMatch?.stageId || null,
          mappedStageName: stageMatch?.stageName || null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: stageMatch?.confidence || 0,
          category: 'printing',
          isUnmapped: !stageMatch, // Only unmapped if no stage match found
          instanceId: `printing-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };
        
        this.logger.addDebugInfo(`🎯 CREATED ROW MAPPING: "${mapping.description}" with qty=${mapping.qty}, woQty=${mapping.woQty}, stage="${mapping.mappedStageName || 'UNMAPPED'}"`);
        rowMappings.push(mapping);
      });
    }
    
    // Map other specifications (finishing, prepress, etc.) with same fix
    const specCategories = [
      { specs: job.finishing_specifications, category: 'finishing' as const },
      { specs: job.prepress_specifications, category: 'prepress' as const },
      { specs: job.delivery_specifications, category: 'delivery' as const },
      { specs: job.packaging_specifications, category: 'packaging' as const }
    ];
    
    specCategories.forEach(({ specs, category }) => {
      if (specs) {
        Object.entries(specs).forEach(([key, spec]) => {
          // CRITICAL FIX: Apply same quantity resolution logic
          const actualQty = spec.qty || spec.wo_qty || 0;
          const actualWoQty = spec.wo_qty || spec.qty || 0;
          
          // NEW: Find stage match for this specification
          const stageMatch = this.findBestStageMatch(key, spec.description || '', category);
          
          const mapping: RowMappingResult = {
            excelRowIndex: this.findRowIndexInExcel(spec.description || key, excelRows),
            excelData: this.findRowDataInExcel(spec.description || key, excelRows),
            groupName: key,
            description: spec.description || key,
            qty: actualQty, // FIXED: Use resolved quantity
            woQty: actualWoQty, // FIXED: Use resolved WO quantity
            mappedStageId: stageMatch?.stageId || null,
            mappedStageName: stageMatch?.stageName || null,
            mappedStageSpecId: null,
            mappedStageSpecName: null,
            confidence: stageMatch?.confidence || 0,
            category,
            isUnmapped: !stageMatch, // Only unmapped if no stage match found
            instanceId: `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
          };
          
          rowMappings.push(mapping);
        });
      }
    });
    
    this.logger.addDebugInfo(`🏁 ENHANCED STAGE MAPPING COMPLETE: ${rowMappings.length} row mappings created`);
    rowMappings.forEach((mapping, i) => {
      this.logger.addDebugInfo(`   ${i + 1}. "${mapping.description}" [${mapping.category}] - Qty: ${mapping.qty}, WO_Qty: ${mapping.woQty}, Stage: "${mapping.mappedStageName || 'UNMAPPED'}"`);
    });
    
    return rowMappings;
  }
  
  /**
   * Find the best matching production stage for a specification
   * Copied and adapted from ProductionStageMapper
   */
  private findBestStageMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging'
  ): { stageId: string; stageName: string; confidence: number } | null {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Define stage matching patterns (same as ProductionStageMapper)
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
      
      // Direct name match with high confidence
      for (const pattern of categoryPatterns) {
        if (pattern.names.some(name => stageName.includes(name) || searchText.includes(name))) {
          this.logger.addDebugInfo(`🎯 DIRECT MATCH: "${searchText}" -> "${stage.name}" (confidence: 90)`);
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence: 90
          };
        }
        
        // Pattern-based matching with medium confidence
        if (pattern.patterns.some(p => searchText.includes(p))) {
          this.logger.addDebugInfo(`🔍 PATTERN MATCH: "${searchText}" -> "${stage.name}" (confidence: 70)`);
          return {
            stageId: stage.id,
            stageName: stage.name,
            confidence: 70
          };
        }
      }
    }
    
    this.logger.addDebugInfo(`❌ NO STAGE MATCH: "${searchText}"`);
    return null;
  }
  
  private findRowIndexInExcel(description: string, excelRows: any[][]): number {
    // Find the row index in Excel data that matches this description
    for (let i = 0; i < excelRows.length; i++) {
      const rowText = excelRows[i].join(' ').toLowerCase();
      if (rowText.includes(description.toLowerCase())) {
        return i;
      }
    }
    return -1;
  }
  
  private findRowDataInExcel(description: string, excelRows: any[][]): any[] {
    const rowIndex = this.findRowIndexInExcel(description, excelRows);
    return rowIndex !== -1 ? excelRows[rowIndex] : [];
  }
}
