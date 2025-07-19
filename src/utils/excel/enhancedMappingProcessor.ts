import type { ExcelImportDebugger } from './debugger';
import { PaperSpecificationParser, PaperMappingMatcher } from './paperSpecificationParser';
import { DeliverySpecificationMatcher } from './deliverySpecificationMatcher';
import type { ParsedJob } from './types';
import { supabase } from '@/integrations/supabase/client';

export interface EnhancedMappingResult {
  jobs: ParsedJob[];
  paperMappings: any[];
  deliveryMappings: any[];
  unmappedPaperSpecs: string[];
  unmappedDeliverySpecs: string[];
  enhancedDeliveryMappings: any[];
  userApprovedStageMappings?: Record<string, number>;
  stats: {
    totalJobs: number;
    paperSpecsMapped: number;
    deliverySpecsMapped: number;
    enhancedDeliveryMapped: number;
    averageConfidence: number;
  };
}

export class EnhancedMappingProcessor {
  private paperParser: PaperSpecificationParser;
  private paperMatcher: PaperMappingMatcher;
  private deliveryMatcher: DeliverySpecificationMatcher;
  private productionStages: Map<string, { id: string; name: string }> = new Map();

  constructor(
    private logger: ExcelImportDebugger,
    private availableSpecs: any[] = []
  ) {
    this.paperParser = new PaperSpecificationParser(logger);
    this.paperMatcher = new PaperMappingMatcher(logger);
    this.deliveryMatcher = new DeliverySpecificationMatcher(logger, availableSpecs);
  }

  /**
   * Initialize the processor and load production stages for stage name resolution
   */
  async initialize(): Promise<void> {
    this.logger.addDebugInfo("Initializing enhanced mapping processor...");
    
    // Load production stages for stage name resolution
    const { data: stagesData, error: stagesError } = await supabase
      .from('production_stages')
      .select('id, name')
      .eq('is_active', true);
    
    if (stagesError) {
      this.logger.addDebugInfo(`Warning: Could not load production stages: ${stagesError.message}`);
    } else {
      this.productionStages.clear();
      (stagesData || []).forEach(stage => {
        this.productionStages.set(stage.id, { id: stage.id, name: stage.name });
      });
      this.logger.addDebugInfo(`Loaded ${this.productionStages.size} production stages for stage name resolution`);
    }
  }

  /**
   * Get stage name by stage ID
   */
  private getStageNameById(stageId: string): string | null {
    const stage = this.productionStages.get(stageId);
    return stage ? stage.name : null;
  }

  /**
   * Process jobs with enhanced mapping for paper and delivery specifications
   * AND populate printing, finishing, prepress specifications
   */
  async processJobsWithEnhancedMapping(
    jobs: ParsedJob[],
    paperColumnIndex: number = -1,
    deliveryColumnIndex: number = -1,
    rawExcelData?: any[][],
    userMapping?: any // Accept user-approved column mappings
  ): Promise<EnhancedMappingResult> {
    // Debug user mappings at the start
    this.logger.addDebugInfo(`ENHANCED MAPPING DEBUG: Processing ${jobs.length} jobs with user mappings`);
    this.logger.addDebugInfo(`ENHANCED MAPPING DEBUG: User mapping object: ${JSON.stringify(userMapping, null, 2)}`);
    
    // Extract and count user-approved stage mappings
    const userStageMappings = this.extractUserStageMappings(userMapping);
    this.logger.addDebugInfo(`ENHANCED MAPPING DEBUG: Found ${Object.keys(userStageMappings).length} user-approved stage mappings:`);
    Object.entries(userStageMappings).forEach(([stageId, columnIndex]) => {
      const stageName = this.getStageNameById(stageId);
      this.logger.addDebugInfo(`  - Stage ${stageName} (${stageId}) -> Column ${columnIndex}`);
    });
    
    this.logger.addDebugInfo(`Starting enhanced mapping for ${jobs.length} jobs`);

    const result: EnhancedMappingResult = {
      jobs: [...jobs],
      paperMappings: [],
      deliveryMappings: [],
      enhancedDeliveryMappings: [],
      unmappedPaperSpecs: [],
      unmappedDeliverySpecs: [],
      userApprovedStageMappings: userStageMappings,
      stats: {
        totalJobs: jobs.length,
        paperSpecsMapped: 0,
        deliverySpecsMapped: 0,
        enhancedDeliveryMapped: 0,
        averageConfidence: 0
      }
    };

    let totalConfidence = 0;
    let mappingCount = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      
      // Process paper specifications
      if (paperColumnIndex !== -1 && rawExcelData && rawExcelData[i + 1]) {
        const paperText = rawExcelData[i + 1][paperColumnIndex];
        await this.processPaperSpecification(job, paperText, result);
      }

      // Process delivery specifications  
      if (deliveryColumnIndex !== -1 && rawExcelData && rawExcelData[i + 1]) {
        const deliveryText = rawExcelData[i + 1][deliveryColumnIndex];
        await this.processDeliverySpecification(job, deliveryText, result);
      }

      // Process existing paper fields if available
      if (job.paper_type || job.paper_weight) {
        const combinedText = `${job.paper_type || ''} ${job.paper_weight || ''}`.trim();
        if (combinedText) {
          await this.processPaperSpecification(job, combinedText, result);
        }
      }

      // CRITICAL FIX: Populate printing, finishing, and prepress specifications
      // This is what was missing! These need to be populated for the stage mapping to work
      // BUT preserve user-approved stage mappings from column mapping dialog
      // Pass the raw Excel row data to access individual column values
      await this.populateWorkflowSpecifications(job, rawExcelData ? rawExcelData[i + 1] : null, userMapping);
    }

    // Calculate average confidence
    if (mappingCount > 0) {
      result.stats.averageConfidence = totalConfidence / mappingCount;
    }

    this.logger.addDebugInfo(`Enhanced mapping completed: ${result.stats.paperSpecsMapped} paper specs, ${result.stats.deliverySpecsMapped} delivery specs`);

    return result;
  }

  /**
   * Populate workflow specifications from Excel row data or job fields
   * PRESERVES user-approved mappedStageId values from column mapping dialog
   */
  private async populateWorkflowSpecifications(job: ParsedJob, excelRow: any[] | null, userMapping?: any): Promise<void> {
    this.logger.addDebugInfo(`Populating workflow specifications for job ${job.wo_no}`);

    // If user has provided explicit stage mappings, preserve those and skip text-based detection
    if (userMapping && this.hasUserStageMapping(userMapping)) {
      this.logger.addDebugInfo(`ENHANCED MAPPING DEBUG: Applying user stage mappings for job ${job.wo_no}`);
      this.logger.addDebugInfo(`ENHANCED MAPPING DEBUG: Job ${job.wo_no} - Excel row data: ${JSON.stringify(excelRow?.slice(0, 10))}...`);
      await this.applyUserStageMapping(job, userMapping, excelRow);
      
      // Debug what was stored after applying user mappings
      const specsWithUserMappings = this.countSpecificationsWithUserMappings(job);
      this.logger.addDebugInfo(`ENHANCED MAPPING DEBUG: Job ${job.wo_no} now has ${specsWithUserMappings} specifications with user mappings`);
      return;
    }

    // Initialize specification objects if they don't exist, but preserve existing ones
    if (!job.printing_specifications) {
      job.printing_specifications = {};
    }
    if (!job.finishing_specifications) {
      job.finishing_specifications = {};
    }
    if (!job.prepress_specifications) {
      job.prepress_specifications = {};
    }
    if (!job.packaging_specifications) {
      job.packaging_specifications = {};
    }

    // Preserve existing mappedStageId values from user-approved mappings
    const preserveExistingMappings = (specObj: any) => {
      const existingMappings: Record<string, string> = {};
      Object.entries(specObj).forEach(([key, spec]: [string, any]) => {
        if (spec && typeof spec === 'object' && spec.mappedStageId) {
          existingMappings[key] = spec.mappedStageId;
        }
      });
      return existingMappings;
    };

    const existingPrintingMappings = preserveExistingMappings(job.printing_specifications);
    const existingFinishingMappings = preserveExistingMappings(job.finishing_specifications);
    const existingPrepressMappings = preserveExistingMappings(job.prepress_specifications);

    this.logger.addDebugInfo(`Job ${job.wo_no} - Preserving existing mappings:
      - Printing: ${Object.keys(existingPrintingMappings).length} mappings
      - Finishing: ${Object.keys(existingFinishingMappings).length} mappings  
      - Prepress: ${Object.keys(existingPrepressMappings).length} mappings`);

    // Extract printing specifications from job data
    if (job.specifications) {
      const specs = job.specifications.toLowerCase();
      
      // Common printing operations
      if (specs.includes('4/0') || specs.includes('1/0') || specs.includes('4/4')) {
        job.printing_specifications.color_process = {
          description: specs.includes('4/4') ? '4/4 Color Process' : 
                      specs.includes('4/0') ? '4/0 Color Process' : '1/0 Color Process',
          specifications: specs.includes('4/4') ? '4/4' : 
                         specs.includes('4/0') ? '4/0' : '1/0',
          qty: job.qty || 1,
          // PRESERVE user-approved mappedStageId if it exists
          ...(existingPrintingMappings.color_process && { mappedStageId: existingPrintingMappings.color_process })
        };
      }
      
      if (specs.includes('digital') || specs.includes('litho') || specs.includes('offset')) {
        job.printing_specifications.print_method = {
          description: specs.includes('digital') ? 'Digital Printing' :
                      specs.includes('litho') ? 'Lithographic Printing' : 'Offset Printing',
          specifications: specs.includes('digital') ? 'Digital' :
                         specs.includes('litho') ? 'Litho' : 'Offset',
          qty: job.qty || 1,
          // PRESERVE user-approved mappedStageId if it exists
          ...(existingPrintingMappings.print_method && { mappedStageId: existingPrintingMappings.print_method })
        };
      }
    }

    // Extract finishing specifications
    if (job.specifications) {
      const specs = job.specifications.toLowerCase();
      
      // Common finishing operations
      if (specs.includes('laminate') || specs.includes('gloss') || specs.includes('matt')) {
        job.finishing_specifications.lamination = {
          description: specs.includes('gloss') ? 'Gloss Lamination' :
                      specs.includes('matt') ? 'Matt Lamination' : 'Standard Lamination',
          specifications: specs.includes('gloss') ? 'Gloss' :
                         specs.includes('matt') ? 'Matt' : 'Standard',
          qty: job.qty || 1,
          // PRESERVE user-approved mappedStageId if it exists
          ...(existingFinishingMappings.lamination && { mappedStageId: existingFinishingMappings.lamination })
        };
      }
      
      if (specs.includes('cut') || specs.includes('trim') || specs.includes('guillotine')) {
        job.finishing_specifications.cutting = {
          description: 'Cutting/Trimming Required',
          specifications: 'Cut to Size',
          qty: job.qty || 1,
          // PRESERVE user-approved mappedStageId if it exists
          ...(existingFinishingMappings.cutting && { mappedStageId: existingFinishingMappings.cutting })
        };
      }
      
      if (specs.includes('fold') || specs.includes('crease')) {
        job.finishing_specifications.folding = {
          description: 'Folding/Creasing Required',
          specifications: 'Fold',
          qty: job.qty || 1,
          // PRESERVE user-approved mappedStageId if it exists
          ...(existingFinishingMappings.folding && { mappedStageId: existingFinishingMappings.folding })
        };
      }
    }

    // Extract prepress specifications
    if (job.specifications) {
      const specs = job.specifications.toLowerCase();
      
      if (specs.includes('proof') || specs.includes('approve')) {
        job.prepress_specifications.proofing = {
          description: 'Proofing Required',
          specifications: 'Proof for Approval',
          qty: 1,
          // PRESERVE user-approved mappedStageId if it exists
          ...(existingPrepressMappings.proofing && { mappedStageId: existingPrepressMappings.proofing })
        };
      }
      
      if (specs.includes('artwork') || specs.includes('design')) {
        job.prepress_specifications.artwork = {
          description: 'Artwork/Design Required',
          specifications: 'Artwork Setup',
          qty: 1,
          // PRESERVE user-approved mappedStageId if it exists
          ...(existingPrepressMappings.artwork && { mappedStageId: existingPrepressMappings.artwork })
        };
      }
    }

    // Log final specifications with mappedStageId preservation status
    this.logger.addDebugInfo(`Job ${job.wo_no} specifications populated with preserved mappings:
      - Printing: ${JSON.stringify(job.printing_specifications)}
      - Finishing: ${JSON.stringify(job.finishing_specifications)}
      - Prepress: ${JSON.stringify(job.prepress_specifications)}`);
  }

  private async processPaperSpecification(
    job: ParsedJob,
    paperText: string,
    result: EnhancedMappingResult
  ): Promise<void> {
    if (!paperText) return;

    const paperSpec = this.paperParser.parsePaperSpecification(paperText);
    if (!paperSpec) {
      result.unmappedPaperSpecs.push(paperText);
      return;
    }

    // Try to find matching specifications in the system
    const paperMapping = await this.paperMatcher.findBestPaperMatch(
      paperSpec,
      this.availableSpecs
    );

    if (paperMapping) {
      // Update job with enhanced paper specifications
      if (!job.paper_specifications) {
        job.paper_specifications = {};
      }

      job.paper_specifications.parsed_paper = {
        type: paperMapping.paperType,
        weight: paperMapping.paperWeight,
        confidence: paperMapping.confidence,
        original_text: paperText,
        color: paperSpec.color,
        size: paperSpec.size,
        finish: paperSpec.finish
      };

      // Also update legacy fields for compatibility
      job.paper_type = paperMapping.paperType;
      job.paper_weight = parseFloat(String(paperMapping.paperWeight)) || 0;

      result.paperMappings.push({
        woNo: job.wo_no,
        originalText: paperText,
        mapping: paperMapping,
        confidence: paperMapping.confidence
      });

      result.stats.paperSpecsMapped++;
    } else {
      result.unmappedPaperSpecs.push(paperText);
    }
  }

  private async processDeliverySpecification(
    job: ParsedJob,
    deliveryText: string,
    result: EnhancedMappingResult
  ): Promise<void> {
    if (!deliveryText) return;

    const deliverySpec = this.paperParser.parseDeliverySpecification(deliveryText);
    if (!deliverySpec) {
      result.unmappedDeliverySpecs.push(deliveryText);
      return;
    }

    // Enhanced delivery method detection
    const enhancedMapping = this.deliveryMatcher.enhanceDeliveryDetection({ id: '', name: '', ...deliverySpec }, deliveryText);
    
    // Update job with delivery specifications
    if (!job.delivery_specifications) {
      job.delivery_specifications = {};
    }

    job.delivery_specifications.parsed_delivery = {
      method: deliverySpec.method,
      address: deliverySpec.address,
      contact: deliverySpec.contact,
      notes: deliverySpec.notes,
      confidence: deliverySpec.confidence,
      original_text: deliveryText
    };

    // Add enhanced delivery mapping if available
    if (enhancedMapping) {
      job.delivery_specifications.enhanced_delivery = {
        specification_id: enhancedMapping.specificationId,
        specification_name: enhancedMapping.specificationName,
        method: enhancedMapping.method,
        confidence: enhancedMapping.confidence,
        detected_features: enhancedMapping.detectedFeatures,
        original_text: deliveryText
      };

      result.enhancedDeliveryMappings.push({
        woNo: job.wo_no,
        originalText: deliveryText,
        mapping: enhancedMapping,
        confidence: enhancedMapping.confidence
      });

      result.stats.enhancedDeliveryMapped++;
    }

    result.deliveryMappings.push({
      woNo: job.wo_no,
      originalText: deliveryText,
      mapping: deliverySpec,
      confidence: deliverySpec.confidence
    });

    result.stats.deliverySpecsMapped++;
  }

  /**
   * Check if user has provided explicit stage mappings in their column mapping
   */
  private hasUserStageMapping(userMapping: any): boolean {
    if (!userMapping) return false;
    
    // Check if there are any stage mappings in the user's column mapping
    // New format: "stage_<uuid>" -> column index
    return Object.keys(userMapping).some(key => 
      key.startsWith('stage_') && 
      userMapping[key] !== undefined && 
      userMapping[key] !== -1 && 
      userMapping[key] !== null
    );
  }

  /**
   * Apply user-approved stage mappings to job specifications
   * SURGICAL FIX: Store with original group names and correct categories for proper detection
   */
  private async applyUserStageMapping(job: ParsedJob, userMapping: any, excelRow?: any[]): Promise<void> {
    this.logger.addDebugInfo(`Applying user stage mappings for job ${job.wo_no}`);
    
    // Initialize specification objects
    if (!job.printing_specifications) job.printing_specifications = {};
    if (!job.finishing_specifications) job.finishing_specifications = {};
    if (!job.prepress_specifications) job.prepress_specifications = {};
    if (!job.delivery_specifications) job.delivery_specifications = {};
    if (!job.packaging_specifications) job.packaging_specifications = {};

    // Extract stage mappings from user column mapping and apply them to the job
    const stageMappingsApplied = [];
    
    Object.entries(userMapping).forEach(([key, columnIndex]) => {
      if (key.startsWith('stage_') && columnIndex !== -1 && columnIndex !== null && columnIndex !== undefined) {
        const stageId = key.replace('stage_', '');
        
        // Get the stage name from our loaded production stages
        const stageName = this.getStageNameById(stageId);
        if (!stageName) {
          this.logger.addDebugInfo(`Job ${job.wo_no} - Warning: Could not find stage name for stage ID ${stageId}, skipping`);
          return;
        }
        
        // Get the actual value from the Excel row for this column
        const columnValue = excelRow && excelRow[columnIndex as number] 
          ? String(excelRow[columnIndex as number]).trim() 
          : '';
        
        // SURGICAL FIX: Determine correct category based on stage name/type
        const stageCategory = this.determineStageCategory(stageName);
        
        // SURGICAL FIX: Use stage name as the key (not user_stage_prefix) for proper matching
        const stageSpec = {
          description: `User Mapped Production Stage`,
          specifications: columnValue || `[User Approved Stage - No Excel Data]`,
          qty: job.qty || 1,
          mappedStageId: stageId, // Critical value #1 for preservation
          mappedStageName: stageName, // Critical value #2 for preservation
          originalColumnIndex: columnIndex,
          confidence: 100 // High confidence since user explicitly mapped it
        };
        
        // SURGICAL FIX: Store in correct category using stage name as key
        switch (stageCategory) {
          case 'finishing':
            job.finishing_specifications[stageName] = stageSpec;
            break;
          case 'prepress':
            job.prepress_specifications[stageName] = stageSpec;
            break;
          case 'delivery':
            job.delivery_specifications[stageName] = stageSpec;
            break;
          case 'packaging':
            job.packaging_specifications[stageName] = stageSpec;
            break;
          default:
            job.printing_specifications[stageName] = stageSpec;
            break;
        }
        
        stageMappingsApplied.push({
          stageId,
          stageName,
          category: stageCategory,
          columnIndex,
          value: columnValue || '[No Excel Data]'
        });
        
        this.logger.addDebugInfo(`Job ${job.wo_no} - Applied user stage mapping: ${stageName} (${stageId}) -> Column ${columnIndex} [${stageCategory}] = "${columnValue || '[No Excel Data]'}"`);
      }
    });

    this.logger.addDebugInfo(`Job ${job.wo_no} - Applied ${stageMappingsApplied.length} user stage mappings:
      ${JSON.stringify(stageMappingsApplied, null, 2)}`);
  }

  /**
   * Determine the correct category for a stage based on its name
   */
  private determineStageCategory(stageName: string): string {
    const lowerName = stageName.toLowerCase();
    
    // Finishing operations
    if (lowerName.includes('cut') || lowerName.includes('trim') || lowerName.includes('fold') || 
        lowerName.includes('stitch') || lowerName.includes('bind') || lowerName.includes('staple') ||
        lowerName.includes('perforate') || lowerName.includes('score') || lowerName.includes('laminate') ||
        lowerName.includes('uv') || lowerName.includes('varnish') || lowerName.includes('emboss') ||
        lowerName.includes('saddle') || lowerName.includes('perfect') || lowerName.includes('spiral')) {
      return 'finishing';
    }
    
    // Prepress operations
    if (lowerName.includes('prepress') || lowerName.includes('proof') || lowerName.includes('plate') ||
        lowerName.includes('artwork') || lowerName.includes('design') || lowerName.includes('typeset')) {
      return 'prepress';
    }
    
    // Delivery operations
    if (lowerName.includes('deliver') || lowerName.includes('dispatch') || lowerName.includes('ship') ||
        lowerName.includes('collect') || lowerName.includes('pack') || lowerName.includes('box')) {
      return 'delivery';
    }
    
    // Packaging operations
    if (lowerName.includes('packaging') || lowerName.includes('package')) {
      return 'packaging';
    }
    
    // Default to printing for everything else
    return 'printing';
  }

  /**
   * Extract user-approved stage mappings from mapping object
   */
  private extractUserStageMappings(userMapping?: any): Record<string, number> {
    if (!userMapping) return {};
    
    const stageMappings: Record<string, number> = {};
    
    Object.entries(userMapping).forEach(([key, value]) => {
      if (key.startsWith('stage_') && typeof value === 'number' && value !== -1) {
        const stageId = key.replace('stage_', '');
        stageMappings[stageId] = value;
      }
    });
    
    return stageMappings;
  }

  /**
   * Count specifications with user mappings in a job
   */
  private countSpecificationsWithUserMappings(job: ParsedJob): number {
    let count = 0;
    
    // Check printing specifications
    if (job.printing_specifications) {
      Object.values(job.printing_specifications).forEach((spec: any) => {
        if (spec?.mappedStageId) count++;
      });
    }
    
    // Check finishing specifications
    if (job.finishing_specifications) {
      Object.values(job.finishing_specifications).forEach((spec: any) => {
        if (spec?.mappedStageId) count++;
      });
    }
    
    // Check prepress specifications
    if (job.prepress_specifications) {
      Object.values(job.prepress_specifications).forEach((spec: any) => {
        if (spec?.mappedStageId) count++;
      });
    }
    
    // Check packaging specifications
    if (job.packaging_specifications) {
      Object.values(job.packaging_specifications).forEach((spec: any) => {
        if (spec?.mappedStageId) count++;
      });
    }
    
    return count;
  }

  /**
   * Extract unique paper types and weights for bulk specification creation
   */
  extractUniquePaperSpecs(jobs: ParsedJob[]): {
    paperTypes: Set<string>;
    paperWeights: Set<string>;
    combinations: Array<{ type: string; weight: string; frequency: number }>;
  } {
    const paperTypes = new Set<string>();
    const paperWeights = new Set<string>();
    const combinationMap = new Map<string, number>();

    for (const job of jobs) {
      const paperSpecs = job.paper_specifications?.parsed_paper;
      if (paperSpecs) {
        if (paperSpecs.type) {
          paperTypes.add(paperSpecs.type);
        }
        if (paperSpecs.weight) {
          paperWeights.add(paperSpecs.weight);
        }
        
        if (paperSpecs.type && paperSpecs.weight) {
          const combo = `${paperSpecs.type}|${paperSpecs.weight}`;
          combinationMap.set(combo, (combinationMap.get(combo) || 0) + 1);
        }
      }
    }

    const combinations = Array.from(combinationMap.entries()).map(([combo, frequency]) => {
      const [type, weight] = combo.split('|');
      return { type, weight, frequency };
    }).sort((a, b) => b.frequency - a.frequency);

    return { paperTypes, paperWeights, combinations };
  }
}