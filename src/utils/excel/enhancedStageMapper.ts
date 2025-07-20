
import type { ExcelImportDebugger } from './debugger';
import type { ParsedJob, RowMappingResult, CoverTextDetection } from './types';
import { supabase } from '@/integrations/supabase/client';

export class EnhancedStageMapper {
  private productionStages: any[] = [];
  private stageSpecifications: any[] = [];
  private excelMappings: any[] = [];
  private deliverySpecifications: any[] = [];

  constructor(private logger: ExcelImportDebugger) {}

  async initialize(): Promise<void> {
    this.logger.addDebugInfo('🔧 Initializing Enhanced Stage Mapper...');
    
    // Load production stages
    const { data: stagesData, error: stagesError } = await supabase
      .from('production_stages')
      .select('*')
      .eq('is_active', true);
    
    if (stagesError) {
      this.logger.addDebugInfo(`❌ Error loading production stages: ${stagesError.message}`);
      throw new Error(`Failed to load production stages: ${stagesError.message}`);
    }
    
    this.productionStages = stagesData || [];
    this.logger.addDebugInfo(`✅ Loaded ${this.productionStages.length} production stages`);
    
    // Load print specifications
    const { data: specsData, error: specsError } = await supabase
      .from('print_specifications')
      .select('*')
      .eq('is_active', true);
    
    if (specsError) {
      this.logger.addDebugInfo(`❌ Error loading print specifications: ${specsError.message}`);
    } else {
      this.stageSpecifications = specsData || [];
      this.logger.addDebugInfo(`✅ Loaded ${this.stageSpecifications.length} print specifications`);
    }
    
    // FIXED: Load excel mappings with proper prioritization
    const { data: mappingsData, error: mappingsError } = await supabase
      .from('excel_import_mappings')
      .select('*')
      .order('production_stage_id', { ascending: false, nullsLast: true })
      .order('confidence_score', { ascending: false });
    
    if (mappingsError) {
      this.logger.addDebugInfo(`❌ Error loading excel mappings: ${mappingsError.message}`);
    } else {
      this.excelMappings = mappingsData || [];
      this.logger.addDebugInfo(`✅ Loaded ${this.excelMappings.length} excel mappings`);
    }
    
    // Load delivery specifications from print_specifications table
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('print_specifications')
      .select('*')
      .eq('category', 'delivery')
      .eq('is_active', true);
    
    if (deliveryError) {
      this.logger.addDebugInfo(`❌ Error loading delivery specifications: ${deliveryError.message}`);
    } else {
      this.deliverySpecifications = deliveryData || [];
      this.logger.addDebugInfo(`✅ Loaded ${this.deliverySpecifications.length} delivery specifications`);
    }
  }

  /**
   * FIXED: Enhanced job to stages mapping with proper paper specification and database priority
   */
  async mapJobToStages(
    job: ParsedJob,
    userApprovedMappings: any[] = [],
    excelRows: any[][] = []
  ): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo(`🎯 ENHANCED MAPPING - Job: ${job.wo_no}`);
    
    const mappings: RowMappingResult[] = [];
    let rowIndex = 0;

    // FIXED: Process cover/text detection with proper paper specification assignment
    if (job.cover_text_detection?.isBookJob && job.cover_text_detection.components) {
      for (const component of job.cover_text_detection.components) {
        // Map printing component with paper specification
        const printingMapping = await this.createMappingForComponent(
          component.printing.description,
          component.printing.qty,
          component.printing.wo_qty,
          'printing',
          rowIndex++,
          excelRows,
          component.type,
          component.printing.subSpecifications || []
        );
        
        // FIXED: Assign paper specification from component analysis with proper formatting
        if (component.paper?.subSpecifications && component.paper.subSpecifications.length > 0) {
          const paperSpec = this.formatPaperSpecificationFromSubSpecs(component.paper.subSpecifications);
          if (paperSpec) {
            printingMapping.paperSpecification = paperSpec;
            this.logger.addDebugInfo(`📋 PAPER SPEC ASSIGNED to ${component.type}: "${paperSpec}"`);
          }
        } else {
          // Extract from printing description as fallback
          const extractedPaperSpec = this.extractPaperSpecFromText(component.printing.description);
          if (extractedPaperSpec) {
            printingMapping.paperSpecification = extractedPaperSpec;
            this.logger.addDebugInfo(`📋 PAPER SPEC EXTRACTED for ${component.type}: "${extractedPaperSpec}"`);
          }
        }
        
        mappings.push(printingMapping);
        
        // Map paper component if exists
        if (component.paper) {
          const paperMapping = await this.createMappingForComponent(
            component.paper.description,
            component.paper.qty,
            component.paper.wo_qty,
            'paper',
            rowIndex++,
            excelRows,
            `${component.type}_paper`,
            component.paper.subSpecifications || []
          );
          
          // Assign paper specification to paper component too
          const paperSpecForPaperComponent = this.formatPaperSpecificationFromSubSpecs(component.paper.subSpecifications || []);
          if (paperSpecForPaperComponent) {
            paperMapping.paperSpecification = paperSpecForPaperComponent;
          }
          
          mappings.push(paperMapping);
        }
      }
    }

    // Process other specifications
    const specCategories = [
      { specs: job.finishing_specifications, category: 'finishing' as const },
      { specs: job.prepress_specifications, category: 'prepress' as const },
      { specs: job.delivery_specifications, category: 'delivery' as const },
      { specs: job.packaging_specifications, category: 'packaging' as const }
    ];

    for (const { specs, category } of specCategories) {
      if (specs) {
        for (const [key, spec] of Object.entries(specs)) {
          const mapping = await this.createMappingForComponent(
            spec.description || key,
            spec.qty || 0,
            spec.wo_qty || 0,
            category,
            rowIndex++,
            excelRows
          );
          mappings.push(mapping);
        }
      }
    }

    // Process standalone printing specifications (non-book jobs)
    if (job.printing_specifications && !job.cover_text_detection?.isBookJob) {
      for (const [key, spec] of Object.entries(job.printing_specifications)) {
        const mapping = await this.createMappingForComponent(
          spec.description || key,
          spec.qty || 0,
          spec.wo_qty || 0,
          'printing',
          rowIndex++,
          excelRows
        );
        
        // FIXED: Extract and assign paper specification for standalone printing
        const paperSpec = this.extractPaperSpecFromText(spec.description || key);
        if (paperSpec) {
          mapping.paperSpecification = paperSpec;
          this.logger.addDebugInfo(`📋 PAPER SPEC ASSIGNED to standalone printing: "${paperSpec}"`);
        }
        
        mappings.push(mapping);
      }
    }

    this.logger.addDebugInfo(`✅ ENHANCED MAPPING COMPLETE - Generated ${mappings.length} mappings for job ${job.wo_no}`);
    return mappings;
  }

  /**
   * FIXED: Create mapping with enhanced database lookup and paper specification handling
   */
  private async createMappingForComponent(
    description: string,
    qty: number,
    woQty: number,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper',
    rowIndex: number,
    excelRows: any[][],
    partType?: string,
    subSpecifications: string[] = []
  ): Promise<RowMappingResult> {
    
    this.logger.addDebugInfo(`🔍 MAPPING COMPONENT: "${description}" (${category})`);
    
    // FIXED: Enhanced database lookup with priority for valid production_stage_id
    const exactMapping = await this.findExactMappingFromDatabase(description, category);
    
    if (exactMapping) {
      this.logger.addDebugInfo(`✅ EXACT DATABASE MATCH: "${description}" -> Stage: ${exactMapping.stageName}, SubSpec: ${exactMapping.subSpecName || 'none'}`);
      
      return {
        excelRowIndex: rowIndex,
        excelData: excelRows[rowIndex] || [],
        groupName: description,
        description,
        qty,
        woQty,
        mappedStageId: exactMapping.stageId,
        mappedStageName: exactMapping.stageName,
        mappedStageSpecId: exactMapping.subSpecId || null,
        mappedStageSpecName: exactMapping.subSpecName || null,
        confidence: exactMapping.confidence,
        category: exactMapping.category,
        isUnmapped: false,
        manualOverride: false,
        paperSpecification: exactMapping.paperSpecification || null,
        partType: partType || 'single',
        stageInstanceIndex: 0
      };
    }
    
    // FIXED: No fallback mapping - unmapped if not in database
    this.logger.addDebugInfo(`❌ NO DATABASE MATCH for: "${description}" - marking as unmapped`);
    
    // Still extract paper specification even if unmapped
    const paperSpec = this.extractPaperSpecFromText(description);
    
    return {
      excelRowIndex: rowIndex,
      excelData: excelRows[rowIndex] || [],
      groupName: description,
      description,
      qty,
      woQty,
      mappedStageId: null,
      mappedStageName: null,
      mappedStageSpecId: null,
      mappedStageSpecName: null,
      confidence: 0,
      category: 'unknown',
      isUnmapped: true,
      manualOverride: false,
      paperSpecification: paperSpec,
      partType: partType || 'single',
      stageInstanceIndex: 0
    };
  }

  /**
   * FIXED: Enhanced database lookup with priority for valid production_stage_id
   */
  private async findExactMappingFromDatabase(
    text: string,
    category: string
  ): Promise<{
    stageId: string;
    stageName: string;
    subSpecId?: string;
    subSpecName?: string;
    confidence: number;
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper' | 'unknown';
    paperSpecification?: string;
  } | null> {
    
    const cleanText = text.trim().toLowerCase();
    this.logger.addDebugInfo(`🔍 DATABASE LOOKUP: "${cleanText}" (category: ${category})`);
    
    // FIXED: Find exact matches with priority for valid production_stage_id
    const exactMatches = this.excelMappings.filter(mapping => {
      const mappingText = mapping.excel_text?.toLowerCase().trim();
      return mappingText === cleanText;
    });
    
    if (exactMatches.length === 0) {
      this.logger.addDebugInfo(`❌ No exact matches found for: "${cleanText}"`);
      return null;
    }
    
    this.logger.addDebugInfo(`🎯 Found ${exactMatches.length} exact matches for: "${cleanText}"`);
    
    // FIXED: Prioritize mappings with valid production_stage_id over null values
    const validMappings = exactMatches.filter(m => m.production_stage_id !== null);
    const finalMatches = validMappings.length > 0 ? validMappings : exactMatches;
    
    const bestMapping = finalMatches[0]; // Take highest confidence (ordered by confidence_score desc)
    
    this.logger.addDebugInfo(`🏆 Selected mapping: production_stage_id=${bestMapping.production_stage_id}, delivery_specification_id=${bestMapping.delivery_method_specification_id}`);
    
    // FIXED: Enhanced stage name resolution
    if (bestMapping.production_stage_id) {
      const stage = this.productionStages.find(s => s.id === bestMapping.production_stage_id);
      if (stage) {
        const result = {
          stageId: stage.id,
          stageName: stage.name,
          confidence: bestMapping.confidence_score || 100,
          category: this.categorizeMappingType(category),
          paperSpecification: this.extractPaperSpecFromText(text)
        };
        
        // Add sub-specification if exists
        if (bestMapping.print_specification_id) {
          const subSpec = this.stageSpecifications.find(s => s.id === bestMapping.print_specification_id);
          if (subSpec) {
            (result as any).subSpecId = subSpec.id;
            (result as any).subSpecName = subSpec.name || subSpec.display_name;
          }
        }
        
        this.logger.addDebugInfo(`✅ RESOLVED PRODUCTION STAGE: "${result.stageName}" (${result.stageId})`);
        return result;
      } else {
        this.logger.addDebugInfo(`❌ Production stage not found in loaded data: ${bestMapping.production_stage_id}`);
      }
    }
    
    // Handle delivery specifications from print_specifications
    if (bestMapping.delivery_method_specification_id) {
      const deliverySpec = this.deliverySpecifications.find(d => d.id === bestMapping.delivery_method_specification_id);
      if (deliverySpec) {
        this.logger.addDebugInfo(`✅ RESOLVED DELIVERY SPEC: "${deliverySpec.name || deliverySpec.display_name}" (${deliverySpec.id})`);
        return {
          stageId: deliverySpec.id,
          stageName: deliverySpec.name || deliverySpec.display_name,
          confidence: bestMapping.confidence_score || 100,
          category: 'delivery'
        };
      } else {
        this.logger.addDebugInfo(`❌ Delivery specification not found in loaded data: ${bestMapping.delivery_method_specification_id}`);
      }
    }
    
    this.logger.addDebugInfo(`❌ No valid stage resolution for mapping: ${JSON.stringify(bestMapping)}`);
    return null;
  }

  /**
   * FIXED: Enhanced paper specification extraction with proper "Type Weightgsm" formatting
   */
  private extractPaperSpecFromText(text: string): string | null {
    if (!text) return null;
    
    const lowerText = text.toLowerCase();
    this.logger.addDebugInfo(`🔍 PAPER SPEC EXTRACTION: "${text}"`);
    
    // Extract weight
    const weightMatch = text.match(/(\d+)\s*gsm/i);
    const weight = weightMatch ? weightMatch[1].padStart(3, '0') : null;
    
    // Extract paper type with comprehensive patterns
    let paperType: string | null = null;
    const typePatterns = {
      'sappi laser pre print': 'Bond',
      'laser pre print': 'Bond', 
      'pre print': 'Bond',
      'bond': 'Bond',
      'matt art': 'Matt',
      'matt': 'Matt',
      'gloss art': 'Gloss',
      'gloss': 'Gloss',
      'silk': 'Silk',
      'art paper': 'Art',
      'art': 'Art',
      'fbb': 'FBS',
      'fbs': 'FBS'
    };
    
    for (const [pattern, standardType] of Object.entries(typePatterns)) {
      if (lowerText.includes(pattern)) {
        paperType = standardType;
        break;
      }
    }
    
    // FIXED: Format as "Type Weightgsm" if both components found
    if (paperType && weight) {
      const result = `${paperType} ${weight}gsm`;
      this.logger.addDebugInfo(`✅ PAPER SPEC EXTRACTED: "${result}" from "${text}"`);
      return result;
    }
    
    // Return weight only if no type found
    if (weight) {
      const result = `${weight}gsm`;
      this.logger.addDebugInfo(`⚠️ PARTIAL PAPER SPEC: "${result}" (no type) from "${text}"`);
      return result;
    }
    
    this.logger.addDebugInfo(`❌ NO PAPER SPEC FOUND in: "${text}"`);
    return null;
  }

  /**
   * FIXED: Format paper specification from sub-specifications array with proper "Type Weightgsm" format
   */
  private formatPaperSpecificationFromSubSpecs(subSpecs: string[]): string | null {
    if (!subSpecs || subSpecs.length === 0) return null;
    
    const weights = subSpecs.filter(spec => spec.includes('gsm'));
    const types = subSpecs.filter(spec => !spec.includes('gsm') && ['Bond', 'Matt', 'Gloss', 'Silk', 'Art', 'FBS'].includes(spec));
    
    if (types.length > 0 && weights.length > 0) {
      return `${types[0]} ${weights[0]}`;
    }
    
    return weights[0] || types[0] || null;
  }

  /**
   * Categorize mapping type for proper classification
   */
  private categorizeMappingType(category: string): 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper' | 'unknown' {
    const validCategories = ['printing', 'finishing', 'prepress', 'delivery', 'packaging', 'paper'];
    return validCategories.includes(category) ? category as any : 'unknown';
  }
}
