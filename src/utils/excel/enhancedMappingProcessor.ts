
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
    this.logger.addDebugInfo('🔧 Enhanced Mapping Processor initialized with FIXED paper spec flow');
  }

  /**
   * FIXED: Enhanced processing with proper paper specification validation and stage mapping
   */
  async processJobsWithEnhancedMapping(
    jobs: ParsedJob[],
    paperColumnIndex: number,
    deliveryColumnIndex: number,
    excelRows: any[][],
    userMapping?: any
  ): Promise<EnhancedMappingResult> {
    this.logger.addDebugInfo('🚀 STARTING FIXED ENHANCED PROCESSING');
    
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

    // FIXED: Process jobs with comprehensive validation and proper paper specification tracking
    for (const job of result.jobs) {
      this.logger.addDebugInfo(`📋 Processing job: ${job.wo_no}`);
      
      // Use the FIXED stage mapper with enhanced database lookup
      const stageMappings = await this.stageMapper.mapJobToStages(job, [], excelRows);
      
      this.logger.addDebugInfo(`   Generated ${stageMappings.length} stage mappings`);
      
      // FIXED: Process stage mappings with proper paper specification validation
      for (const mapping of stageMappings) {
        if (mapping.isUnmapped) {
          result.stats.unmappedItemsRequiringUserSelection++;
          result.unmappedStageItems.push({
            description: mapping.description,
            category: mapping.category,
            jobId: job.wo_no,
            qty: mapping.qty,
            woQty: mapping.woQty,
            reason: 'No exact database mapping found - requires user selection',
            paperSpecification: mapping.paperSpecification // Include paper spec even for unmapped items
          });
          
          this.logger.addDebugInfo(`❌ UNMAPPED ITEM: "${mapping.description}" - no database match`);
        } else {
          result.stats.stageMappingsApplied++;
          this.logger.addDebugInfo(`✅ MAPPED: "${mapping.description}" -> "${mapping.mappedStageName}" (${mapping.confidence}% confidence)`);
        }

        // FIXED: Enhanced paper specification tracking with proper validation
        if (mapping.paperSpecification && (mapping.category === 'printing' || mapping.category === 'paper')) {
          result.stats.paperSpecsMapped++;
          result.paperMappings.push({
            original: mapping.description,
            mapped: mapping.paperSpecification,
            jobId: job.wo_no,
            confidence: mapping.confidence || 100,
            partType: mapping.partType || 'single',
            format: mapping.paperSpecification, // FIXED: Use the actual paper specification
            stageName: mapping.mappedStageName || 'Unmapped',
            isUnmapped: mapping.isUnmapped
          });
          
          this.logger.addDebugInfo(`📄 PAPER SPEC TRACKED: "${mapping.paperSpecification}" for job ${job.wo_no} from "${mapping.description}"`);
        }
        
        // FIXED: Enhanced delivery specification tracking
        if (mapping.category === 'delivery') {
          result.stats.deliverySpecsMapped++;
          result.deliveryMappings.push({
            original: mapping.description,
            jobId: job.wo_no,
            qty: mapping.qty || 0,
            wo_qty: mapping.woQty || 0,
            mappedStageName: mapping.mappedStageName || 'Unmapped',
            confidence: mapping.confidence || 100,
            isUnmapped: mapping.isUnmapped
          });
          
          this.logger.addDebugInfo(`🚚 DELIVERY SPEC TRACKED: "${mapping.mappedStageName}" for job ${job.wo_no} from "${mapping.description}"`);
        }
      }
    }

    // FIXED: Enhanced completion logging with detailed validation
    this.logger.addDebugInfo(`✅ FIXED PROCESSING COMPLETE:`);
    this.logger.addDebugInfo(`   - Paper specs mapped: ${result.stats.paperSpecsMapped}`);
    this.logger.addDebugInfo(`   - Delivery specs mapped: ${result.stats.deliverySpecsMapped}`);
    this.logger.addDebugInfo(`   - Stage mappings applied: ${result.stats.stageMappingsApplied}`);
    this.logger.addDebugInfo(`   - Items requiring user selection: ${result.stats.unmappedItemsRequiringUserSelection}`);

    // FIXED: Enhanced unmapped items logging for debugging
    if (result.unmappedStageItems.length > 0) {
      this.logger.addDebugInfo(`⚠️ UNMAPPED ITEMS DETAIL:`);
      result.unmappedStageItems.forEach((item, index) => {
        this.logger.addDebugInfo(`   ${index + 1}. "${item.description}" (${item.category}) - ${item.reason} ${item.paperSpecification ? `[Paper: ${item.paperSpecification}]` : ''}`);
      });
    }

    // FIXED: Enhanced paper mappings validation logging
    if (result.paperMappings.length > 0) {
      this.logger.addDebugInfo(`📄 PAPER MAPPINGS VALIDATION:`);
      result.paperMappings.forEach((mapping, index) => {
        this.logger.addDebugInfo(`   ${index + 1}. "${mapping.original}" -> "${mapping.mapped}" (Stage: ${mapping.stageName}, Format: ${mapping.format})`);
      });
    }

    // FIXED: Enhanced delivery mappings validation logging
    if (result.deliveryMappings.length > 0) {
      this.logger.addDebugInfo(`🚚 DELIVERY MAPPINGS VALIDATION:`);
      result.deliveryMappings.forEach((mapping, index) => {
        this.logger.addDebugInfo(`   ${index + 1}. "${mapping.original}" -> "${mapping.mappedStageName}" (${mapping.isUnmapped ? 'UNMAPPED' : 'MAPPED'})`);
      });
    }

    return result;
  }
}
