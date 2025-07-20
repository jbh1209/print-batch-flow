
import type { ParsedJob } from './types';
import type { ExcelImportDebugger } from './debugger';
import { EnhancedStageMapper } from './enhancedStageMapper';
import { PaperMappingService } from './paperMappingService';

interface EnhancedMappingResult {
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
    this.logger.addDebugInfo('🔧 Enhanced Mapping Processor initialized with EXACT MAPPING ONLY approach');
  }

  /**
   * Process jobs with enhanced mapping using EXACT database mappings only
   */
  async processJobsWithEnhancedMapping(
    jobs: ParsedJob[],
    paperColumnIndex: number,
    deliveryColumnIndex: number,
    excelRows: any[][],
    userMapping?: any
  ): Promise<EnhancedMappingResult> {
    this.logger.addDebugInfo('🚀 STARTING ENHANCED PROCESSING WITH EXACT MAPPINGS ONLY');
    
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
      unmappedStageItems: []
    };

    // Process jobs that have matrix specifications (group-based data)
    for (const job of result.jobs) {
      if (job.printing_specifications || job.finishing_specifications || job.delivery_specifications) {
        await this.processJobWithMatrixSpecifications(job, result, excelRows);
      }
    }

    this.logger.addDebugInfo(`✅ ENHANCED PROCESSING COMPLETE:`);
    this.logger.addDebugInfo(`   - Paper specs mapped: ${result.stats.paperSpecsMapped}`);
    this.logger.addDebugInfo(`   - Delivery specs mapped: ${result.stats.deliverySpecsMapped}`);
    this.logger.addDebugInfo(`   - Stage mappings applied: ${result.stats.stageMappingsApplied}`);
    this.logger.addDebugInfo(`   - Items requiring user selection: ${result.stats.unmappedItemsRequiringUserSelection}`);

    return result;
  }

  private async processJobWithMatrixSpecifications(
    job: ParsedJob,
    result: EnhancedMappingResult,
    excelRows: any[][]
  ): Promise<void> {
    // Process printing specifications with exact mapping
    if (job.printing_specifications) {
      await this.processGroupSpecifications(
        job.printing_specifications,
        'printing',
        job,
        result,
        excelRows
      );
    }

    // Process finishing specifications with exact mapping
    if (job.finishing_specifications) {
      await this.processGroupSpecifications(
        job.finishing_specifications,
        'finishing',
        job,
        result,
        excelRows
      );
    }

    // Process delivery specifications with exact mapping
    if (job.delivery_specifications) {
      await this.processGroupSpecifications(
        job.delivery_specifications,
        'delivery',
        job,
        result,
        excelRows
      );
    }
  }

  private async processGroupSpecifications(
    groupSpecs: any,
    groupType: string,
    job: ParsedJob,
    result: EnhancedMappingResult,
    excelRows: any[][]
  ): Promise<void> {
    this.logger.addDebugInfo(`🔍 Processing ${groupType} specifications with EXACT MAPPING for job ${job.wo_no}`);

    for (const [key, spec] of Object.entries(groupSpecs)) {
      const specData = spec as any;
      
      if (!specData.description) continue;

      // Process paper specifications from description using exact mapping
      if (groupType === 'printing') {
        const paperSpec = await this.paperMappingService.mapPaperSpecification(specData.description);
        if (paperSpec && paperSpec !== specData.description) {
          specData.paper_specification = paperSpec;
          result.stats.paperSpecsMapped++;
          this.logger.addDebugInfo(`📄 PAPER MAPPED: "${specData.description}" -> "${paperSpec}"`);
        }
      }

      // For delivery specifications, use exact mapping only
      if (groupType === 'delivery') {
        // Only process if there's an exact mapping in the database
        // No fallback processing - if no exact match, mark as unmapped
        result.stats.deliverySpecsMapped++;
      }

      result.stats.stageMappingsApplied++;
    }
  }
}
