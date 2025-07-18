
import type { ExcelImportDebugger } from './debugger';
import type { ParsedJob, GroupSpecifications, DeliverySpecification } from './types';
import { EnhancedStageMapper, type EnhancedStageMapperResult } from './enhancedStageMapper';

export interface EnhancedMappingResult {
  jobs: ParsedJob[];
  stats: {
    paperSpecsMapped: number;
    deliverySpecsMapped: number;
    totalJobs: number;
  };
  unmappedPaperSpecs: any[];
  unmappedDeliverySpecs: any[];
  userApprovedStageMappings?: Record<string, number>;
  // NEW: Include stage mapping results
  stageMappingResult?: EnhancedStageMapperResult;
}

export class EnhancedMappingProcessor {
  private enhancedStageMapper: EnhancedStageMapper;

  constructor(
    private logger: ExcelImportDebugger,
    private availableSpecs: any[] = []
  ) {
    this.enhancedStageMapper = new EnhancedStageMapper(logger, availableSpecs);
  }

  async initialize(): Promise<void> {
    this.logger.addDebugInfo(`🎯 EnhancedMappingProcessor initializing with ${this.availableSpecs.length} available specs`);
    await this.enhancedStageMapper.initialize();
  }

  async processJobsWithEnhancedMapping(
    jobs: ParsedJob[],
    paperColumnIndex: number,
    deliveryColumnIndex: number,
    excelRows: any[][],
    mapping?: any
  ): Promise<EnhancedMappingResult> {
    this.logger.addDebugInfo(`🎯 Processing ${jobs.length} jobs with enhanced mapping`);
    
    // Extract user-approved stage mappings if provided
    const userApprovedStageMappings: Record<string, number> = {};
    if (mapping) {
      Object.entries(mapping).forEach(([key, value]) => {
        if (key.startsWith('stage_') && typeof value === 'number' && value !== -1) {
          const stageId = key.replace('stage_', '');
          userApprovedStageMappings[stageId] = value;
        }
      });
    }

    // Process paper specifications if column is available
    const unmappedPaperSpecs: any[] = [];
    const unmappedDeliverySpecs: any[] = [];
    let paperSpecsMapped = 0;
    let deliverySpecsMapped = 0;

    // Process paper specifications
    if (paperColumnIndex !== -1) {
      jobs.forEach((job, index) => {
        const paperSpec = this.extractPaperSpecification(job, excelRows[index], paperColumnIndex);
        if (paperSpec) {
          job.paper_specifications = { paper: paperSpec };
          paperSpecsMapped++;
          this.logger.addDebugInfo(`📄 Mapped paper spec for ${job.wo_no}: ${paperSpec.description}`);
        }
      });
    }

    // Process delivery specifications
    if (deliveryColumnIndex !== -1) {
      jobs.forEach((job, index) => {
        const deliverySpec = this.extractDeliverySpecification(job, excelRows[index], deliveryColumnIndex);
        if (deliverySpec) {
          job.delivery_specifications = { delivery: deliverySpec };
          deliverySpecsMapped++;
          this.logger.addDebugInfo(`🚚 Mapped delivery spec for ${job.wo_no}: ${deliverySpec.description}`);
        }
      });
    }

    // CRITICAL FIX: Call stage mapper to create row mappings
    this.logger.addDebugInfo(`🎯 CALLING STAGE MAPPER to create row mappings for ${jobs.length} jobs`);
    
    // Convert user-approved mappings to stage mapping format
    const userApprovedMappings = Object.entries(userApprovedStageMappings).map(([stageId, columnIndex]) => ({
      stageId,
      stageName: `Stage ${stageId}`,
      category: 'prepress' as const,
      confidence: 1.0,
      specifications: []
    }));
    
    // Create enhanced stage mapper with user mappings
    const stageMapperWithUserMappings = new EnhancedStageMapper(
      this.logger,
      this.availableSpecs,
      userApprovedMappings
    );
    await stageMapperWithUserMappings.initialize();
    
    // Map jobs to stages and create row mappings
    const stageMappingResult = await stageMapperWithUserMappings.mapJobsToStages(
      jobs,
      [], // headers not needed for job-based mapping
      excelRows,
      0
    );
    
    this.logger.addDebugInfo(`🎯 STAGE MAPPING COMPLETE: ${stageMappingResult.stats.mappedRows} mapped, ${stageMappingResult.stats.printingOperations} printing ops`);

    const stats = {
      paperSpecsMapped,
      deliverySpecsMapped,
      totalJobs: jobs.length
    };

    return {
      jobs,
      stats,
      unmappedPaperSpecs,
      unmappedDeliverySpecs,
      userApprovedStageMappings,
      stageMappingResult // Include stage mapping results
    };
  }

  private extractPaperSpecification(job: ParsedJob, excelRow: any[], paperColumnIndex: number): any {
    if (!excelRow || paperColumnIndex >= excelRow.length) return null;
    
    const paperValue = excelRow[paperColumnIndex];
    if (!paperValue || String(paperValue).trim() === '') return null;
    
    return {
      description: String(paperValue).trim(),
      qty: job.qty,
      wo_qty: job.qty,
      specifications: String(paperValue).trim()
    };
  }

  private extractDeliverySpecification(job: ParsedJob, excelRow: any[], deliveryColumnIndex: number): any {
    if (!excelRow || deliveryColumnIndex >= excelRow.length) return null;
    
    const deliveryValue = excelRow[deliveryColumnIndex];
    if (!deliveryValue || String(deliveryValue).trim() === '') return null;
    
    return {
      description: String(deliveryValue).trim(),
      qty: job.qty,
      wo_qty: job.qty,
      specifications: String(deliveryValue).trim()
    };
  }
}
