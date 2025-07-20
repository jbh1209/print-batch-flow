
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
    this.logger.addDebugInfo('🔧 Enhanced Mapping Processor initialized with ENHANCED EXACT MAPPING approach');
  }

  /**
   * Process jobs with enhanced mapping using database mappings with fallback to user selection
   */
  async processJobsWithEnhancedMapping(
    jobs: ParsedJob[],
    paperColumnIndex: number,
    deliveryColumnIndex: number,
    excelRows: any[][],
    userMapping?: any
  ): Promise<EnhancedMappingResult> {
    this.logger.addDebugInfo('🚀 STARTING ENHANCED PROCESSING WITH RESTORED FUNCTIONALITY');
    
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

    // Process jobs with enhanced mapping logic
    for (const job of result.jobs) {
      if (job.printing_specifications || job.finishing_specifications || job.delivery_specifications) {
        await this.processJobWithEnhancedMapping(job, result, excelRows);
      }
    }

    this.logger.addDebugInfo(`✅ ENHANCED PROCESSING COMPLETE:`);
    this.logger.addDebugInfo(`   - Paper specs mapped: ${result.stats.paperSpecsMapped}`);
    this.logger.addDebugInfo(`   - Delivery specs mapped: ${result.stats.deliverySpecsMapped}`);
    this.logger.addDebugInfo(`   - Stage mappings applied: ${result.stats.stageMappingsApplied}`);
    this.logger.addDebugInfo(`   - Items requiring user selection: ${result.stats.unmappedItemsRequiringUserSelection}`);

    return result;
  }

  private async processJobWithEnhancedMapping(
    job: ParsedJob,
    result: EnhancedMappingResult,
    excelRows: any[][]
  ): Promise<void> {
    // Process printing specifications with enhanced paper mapping
    if (job.printing_specifications) {
      await this.processGroupSpecificationsEnhanced(
        job.printing_specifications,
        'printing',
        job,
        result,
        excelRows
      );
    }

    // Process finishing specifications
    if (job.finishing_specifications) {
      await this.processGroupSpecificationsEnhanced(
        job.finishing_specifications,
        'finishing',
        job,
        result,
        excelRows
      );
    }

    // Process delivery specifications
    if (job.delivery_specifications) {
      await this.processGroupSpecificationsEnhanced(
        job.delivery_specifications,
        'delivery',
        job,
        result,
        excelRows
      );
    }
  }

  private async processGroupSpecificationsEnhanced(
    groupSpecs: any,
    groupType: string,
    job: ParsedJob,
    result: EnhancedMappingResult,
    excelRows: any[][]
  ): Promise<void> {
    this.logger.addDebugInfo(`🔍 Processing ${groupType} specifications with ENHANCED MAPPING for job ${job.wo_no}`);

    for (const [key, spec] of Object.entries(groupSpecs)) {
      const specData = spec as any;
      
      if (!specData.description) continue;

      // Enhanced paper specification mapping for printing
      if (groupType === 'printing') {
        const paperSpec = await this.paperMappingService.mapPaperSpecification(specData.description);
        if (paperSpec && paperSpec !== specData.description) {
          specData.paper_specification = paperSpec;
          result.stats.paperSpecsMapped++;
          this.logger.addDebugInfo(`📄 PAPER MAPPED: "${specData.description}" -> "${paperSpec}"`);
          
          // Add to paper mappings array for tracking
          result.paperMappings.push({
            original: specData.description,
            mapped: paperSpec,
            jobId: job.wo_no,
            confidence: 100
          });
        } else {
          // No paper mapping found
          result.unmappedPaperSpecs.push(specData.description);
        }
      }

      // For delivery specifications, attempt enhanced mapping
      if (groupType === 'delivery') {
        // Try to map delivery specifications
        result.stats.deliverySpecsMapped++;
        result.deliveryMappings.push({
          original: specData.description,
          jobId: job.wo_no,
          qty: specData.qty || 0,
          wo_qty: specData.wo_qty || 0
        });
      }

      result.stats.stageMappingsApplied++;
    }
  }
}
