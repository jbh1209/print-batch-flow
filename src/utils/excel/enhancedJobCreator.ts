import type { ExcelImportDebugger } from './debugger';
import type { ParsedJob, RowMappingResult } from './types';
import { DirectJobCreator, type DirectJobResult } from '@/services/DirectJobCreator';

export interface EnhancedJobCreationResult {
  success: boolean;
  createdJobs: any[];
  failedJobs: { job: any; error: string }[];
  categoryAssignments: { [woNo: string]: any };
  duplicatesSkipped?: number;
  duplicateJobs?: any[];
  rowMappings: { [woNo: string]: RowMappingResult[] };
  userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>;
  userId?: string;
  generateQRCodes?: boolean;
  stats: {
    total: number;
    successful: number;
    failed: number;
    newCategories: number;
    workflowsInitialized: number;
  };
}

export interface EnhancedJobAssignment {
  originalJob: ParsedJob;
  rowMappings: RowMappingResult[];
}

export interface PreparedJobsResult {
  enhancedJobAssignments: EnhancedJobAssignment[];
  generateQRCodes: boolean;
  stats: {
    total: number;
    successful: number;
    failed: number;
  };
  userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>;
  duplicatesSkipped?: number;
  duplicateJobs?: any[];
}

export class EnhancedJobCreator {
  private logger: ExcelImportDebugger;
  private userId: string;
  private generateQRCodes: boolean;
  private directCreator: DirectJobCreator;

  constructor(logger: ExcelImportDebugger, userId: string, generateQRCodes: boolean = true) {
    this.logger = logger;
    this.userId = userId;
    this.generateQRCodes = generateQRCodes;
    this.directCreator = new DirectJobCreator(logger, userId, generateQRCodes);
  }

  async initialize(): Promise<void> {
    this.logger.addDebugInfo('EnhancedJobCreator initialized');
  }

  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    dataRows: any[][],
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<PreparedJobsResult> {
    this.logger.addDebugInfo(`Preparing ${jobs.length} jobs with Excel data`);

    const enhancedJobAssignments: EnhancedJobAssignment[] = jobs.map(job => {
      const rowMappings: RowMappingResult[] = [];
      
      // Extract mappings from job specifications
      if (job.printing_specifications) {
        Object.entries(job.printing_specifications).forEach(([key, spec]: [string, any]) => {
          if (spec.mappedStageId) {
            rowMappings.push({
              excelRowIndex: job._originalRowIndex || 0,
              excelData: job._originalExcelRow || [],
              groupName: key,
              description: spec.description || '',
              qty: spec.qty || job.qty,
              woQty: spec.wo_qty || job.qty,
              mappedStageId: spec.mappedStageId,
              mappedStageName: spec.mappedStageName || '',
              mappedStageSpecId: spec.mappedStageSpecId || null,
              mappedStageSpecName: spec.mappedStageSpecName || null,
              confidence: 100,
              category: 'printing' as const,
              isUnmapped: false
            });
          }
        });
      }

      // Add other specification types
      ['finishing_specifications', 'prepress_specifications', 'delivery_specifications'].forEach(specType => {
        const specs = (job as any)[specType];
        if (specs) {
          Object.entries(specs).forEach(([key, spec]: [string, any]) => {
            if (spec.mappedStageId) {
              rowMappings.push({
                excelRowIndex: job._originalRowIndex || 0,
                excelData: job._originalExcelRow || [],
                groupName: key,
                description: spec.description || '',
                qty: spec.qty || job.qty,
                woQty: spec.wo_qty || job.qty,
                mappedStageId: spec.mappedStageId,
                mappedStageName: spec.mappedStageName || '',
                mappedStageSpecId: spec.mappedStageSpecId || null,
                mappedStageSpecName: spec.mappedStageSpecName || null,
                confidence: 100,
                category: specType.replace('_specifications', '') as any,
                isUnmapped: false
              });
            }
          });
        }
      });

      return {
        originalJob: job,
        rowMappings
      };
    });

    return {
      enhancedJobAssignments,
      generateQRCodes: this.generateQRCodes,
      stats: {
        total: jobs.length,
        successful: 0,
        failed: 0
      }
    };
  }

  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    dataRows: any[][],
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<PreparedJobsResult> {
    return this.prepareEnhancedJobsWithExcelData(jobs, headers, dataRows, userApprovedStageMappings);
  }

  async finalizeJobs(
    preparedResult: PreparedJobsResult,
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<EnhancedJobCreationResult> {
    return this.finalizeEnhancedJobs(preparedResult, userApprovedStageMappings);
  }

  async finalizeEnhancedJobs(
    preparedResult: PreparedJobsResult,
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo('Finalizing enhanced jobs using DirectJobCreator');
    
    const directResult = await this.directCreator.createJobsFromMappings(preparedResult);
    
    // Convert DirectJobResult to EnhancedJobCreationResult
    const enhancedResult: EnhancedJobCreationResult = {
      success: directResult.success,
      createdJobs: directResult.createdJobs,
      failedJobs: directResult.failedJobs,
      categoryAssignments: {},
      duplicatesSkipped: 0,
      duplicateJobs: [],
      rowMappings: {},
      userApprovedStageMappings,
      userId: this.userId,
      generateQRCodes: this.generateQRCodes,
      stats: {
        total: directResult.stats.total,
        successful: directResult.stats.successful,
        failed: directResult.stats.failed,
        newCategories: 0,
        workflowsInitialized: 0
      }
    };

    // Build rowMappings from prepared result
    preparedResult.enhancedJobAssignments.forEach(assignment => {
      enhancedResult.rowMappings[assignment.originalJob.wo_no] = assignment.rowMappings;
    });

    return enhancedResult;
  }
}