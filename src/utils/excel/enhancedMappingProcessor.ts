
import type { ParsedJob } from './types';
import type { ExcelImportDebugger } from './debugger';
import { EnhancedStageMapper } from './enhancedStageMapper';
import { PaperMappingService } from './paperMappingService';

export interface EnhancedMappingResult {
  jobs: ParsedJob[];
  stats: {
    paperSpecsMapped: number;
    deliverySpecsMapped: number;
    stageMappingsApplied: number;
    unmappedItemsRequiringUserSelection: number;
  };
  unmappedPaperSpecs: string[];
  unmappedDeliverySpecs: string[];
  unmappedStageItems: any[];
  userApprovedStageMappings?: Record<string, number>;
  paperMappings: any[];
  deliveryMappings: any[];
  enhancedDeliveryMappings: any[];
}

export class EnhancedMappingProcessor {
  private logger: ExcelImportDebugger;
  private availableSpecs: any[];
  private stageMapper: EnhancedStageMapper;
  private paperMappingService: PaperMappingService;

  constructor(logger: ExcelImportDebugger, availableSpecs: any[] = []) {
    this.logger = logger;
    this.availableSpecs = availableSpecs;
    this.stageMapper = new EnhancedStageMapper(logger);
    this.paperMappingService = new PaperMappingService(logger);
  }

  async initialize() {
    await this.stageMapper.initialize();
    await this.paperMappingService.initialize();
    this.logger.addDebugInfo('🔧 Enhanced Mapping Processor initialized with COMPREHENSIVE FIXES');
  }

  /**
   * FIXED: Process jobs with enhanced mapping using comprehensive fixes
   */
  async processJobsWithEnhancedMapping(
    jobs: ParsedJob[],
    paperColumnIndex: number,
    deliveryColumnIndex: number,
    excelRows: any[][],
    userMapping?: any
  ): Promise<EnhancedMappingResult> {
    this.logger.addDebugInfo('🚀 STARTING COMPREHENSIVE ENHANCED PROCESSING');
    
    const result: EnhancedMappingResult = {
      jobs: [...jobs],
      stats: {
        paperSpecsMapped: 0,
        deliverySpecsMapped: 0,
        stageMappingsApplied: 0,
        unmappedItemsRequiringUserSelection: 0
      },
      unmappedPaperSpecs: [],
      unmappedDeliverySpecs: [],
      unmappedStageItems: [],
      paperMappings: [],
      deliveryMappings: [],
      enhancedDeliveryMappings: []
    };

    // Process jobs with comprehensive fixes approach
    for (const job of result.jobs) {
      this.logger.addDebugInfo(`📋 Processing job: ${job.wo_no}`);
      
      // Use the FIXED stage mapper that properly handles all scenarios
      const stageMappings = await this.stageMapper.mapJobToStages(job, [], excelRows);
      
      this.logger.addDebugInfo(`   Generated ${stageMappings.length} stage mappings`);
      
      // Process the stage mappings and update stats with FIXED validation
      for (const mapping of stageMappings) {
        if (mapping.isUnmapped) {
          result.stats.unmappedItemsRequiringUserSelection++;
          result.unmappedStageItems.push({
            description: mapping.description,
            category: mapping.category,
            jobId: job.wo_no,
            qty: mapping.qty,
            woQty: mapping.woQty,
            reason: 'No exact database mapping found - requires user selection'
          });
        } else {
          result.stats.stageMappingsApplied++;
          
          // Track paper specifications with FIXED validation
          if (mapping.paperSpecification && mapping.category === 'printing') {
            result.stats.paperSpecsMapped++;
            result.paperMappings.push({
              original: mapping.description,
              mapped: mapping.paperSpecification,
              jobId: job.wo_no,
              confidence: mapping.confidence || 100,
              partType: mapping.partType || 'single',
              format: 'Type WeightGsm' // e.g., "Bond 080gsm", "Gloss 250gsm"
            });
            
            this.logger.addDebugInfo(`📄 PAPER SPEC TRACKED: "${mapping.paperSpecification}" for job ${job.wo_no}`);
          }
          
          // Track delivery specifications with FIXED validation
          if (mapping.category === 'delivery') {
            result.stats.deliverySpecsMapped++;
            result.deliveryMappings.push({
              original: mapping.description,
              jobId: job.wo_no,
              qty: mapping.qty || 0,
              wo_qty: mapping.woQty || 0,
              mappedStageName: mapping.mappedStageName,
              confidence: mapping.confidence || 100
            });
            
            this.logger.addDebugInfo(`🚚 DELIVERY SPEC TRACKED: "${mapping.mappedStageName}" for job ${job.wo_no}`);
          }
        }
      }
    }

    this.logger.addDebugInfo(`✅ COMPREHENSIVE PROCESSING COMPLETE:`);
    this.logger.addDebugInfo(`   - Paper specs mapped: ${result.stats.paperSpecsMapped}`);
    this.logger.addDebugInfo(`   - Delivery specs mapped: ${result.stats.deliverySpecsMapped}`);
    this.logger.addDebugInfo(`   - Stage mappings applied: ${result.stats.stageMappingsApplied}`);
    this.logger.addDebugInfo(`   - Items requiring user selection: ${result.stats.unmappedItemsRequiringUserSelection}`);

    // FIXED: Log detailed unmapped items for debugging
    if (result.unmappedStageItems.length > 0) {
      this.logger.addDebugInfo(`⚠️ UNMAPPED ITEMS DETAIL:`);
      result.unmappedStageItems.forEach((item, index) => {
        this.logger.addDebugInfo(`   ${index + 1}. "${item.description}" (${item.category}) - ${item.reason}`);
      });
    }

    // FIXED: Log detailed paper mappings for validation
    if (result.paperMappings.length > 0) {
      this.logger.addDebugInfo(`📄 PAPER MAPPINGS DETAIL:`);
      result.paperMappings.forEach((mapping, index) => {
        this.logger.addDebugInfo(`   ${index + 1}. "${mapping.original}" -> "${mapping.mapped}" (${mapping.format})`);
      });
    }

    return result;
  }
}
