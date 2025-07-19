
import type { ParsedJob, RowMappingResult } from './types';
import type { ExcelImportDebugger } from './debugger';
import { supabase } from '@/integrations/supabase/client';
import { generateQRCodeData, generateQRCodeImage } from '@/utils/qrCodeGenerator';

export interface EnhancedJobCreationResult {
  mappedStages: RowMappingResult[];
  requiresCustomWorkflow: boolean;
  confidence: number;
  rowMappings: { [woNo: string]: RowMappingResult[] };
  categoryAssignments?: any[];
  stats: {
    totalRows: number;
    processedRows: number;
    skippedRows: number;
    invalidWONumbers: number;
    invalidDates: number;
    invalidTimingData: number;
    invalidSpecifications: number;
    total: number;
    successful: number;
    failed: number;
    workflowsInitialized: number;
    newCategories: number;
  };
  userApprovedStageMappings?: any[];
  createdJobs?: any[];
  failedJobs?: any[];
}

export class EnhancedJobCreator {
  constructor(
    private logger: ExcelImportDebugger, 
    private userId: string, 
    private generateQRCodes: boolean
  ) {}

  async initialize() {
    this.logger.addDebugInfo("EnhancedJobCreator initialized");
  }

  async finalizeJobs(preparedResult: EnhancedJobCreationResult, userApprovedMappings?: any[]): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Finalizing ${preparedResult.createdJobs?.length || 0} jobs to database`);
    
    if (!preparedResult.createdJobs || preparedResult.createdJobs.length === 0) {
      return {
        ...preparedResult,
        stats: {
          ...preparedResult.stats,
          successful: 0,
          failed: 0
        }
      };
    }

    const jobsWithUserId = [];
    const failedJobs = [];

    for (const job of preparedResult.createdJobs) {
      try {
        const jobData = {
          ...job,
          user_id: this.userId,
          // Convert null dates to undefined for database insertion
          date: job.date || undefined,
          due_date: job.due_date || undefined
        };

        // Generate QR code if enabled
        if (this.generateQRCodes) {
          try {
            const qrData = generateQRCodeData({
              wo_no: job.wo_no,
              job_id: `temp-${job.wo_no}`,
              customer: job.customer,
              due_date: job.due_date
            });
            
            const qrUrl = await generateQRCodeImage(qrData);
            
            jobData.qr_code_data = qrData;
            jobData.qr_code_url = qrUrl;
          } catch (qrError) {
            this.logger.addDebugInfo(`Failed to generate QR code for ${job.wo_no}: ${qrError}`);
          }
        }

        jobsWithUserId.push(jobData);
      } catch (error) {
        this.logger.addDebugInfo(`Failed to prepare job ${job.wo_no}: ${error}`);
        failedJobs.push(job);
      }
    }

    try {
      const { data, error } = await supabase
        .from('production_jobs')
        .upsert(jobsWithUserId, { 
          onConflict: 'wo_no,user_id',
          ignoreDuplicates: true 
        })
        .select();

      if (error) {
        this.logger.addDebugInfo(`Database error: ${JSON.stringify(error)}`);
        throw new Error(`Database error: ${error.message}`);
      }

      const successfulCount = data?.length || 0;
      this.logger.addDebugInfo(`Successfully created ${successfulCount} jobs in database`);

      // Update QR codes with actual job IDs if QR generation was enabled
      if (this.generateQRCodes && data) {
        for (const insertedJob of data) {
          if (insertedJob.qr_code_data) {
            try {
              const updatedQrData = generateQRCodeData({
                wo_no: insertedJob.wo_no,
                job_id: insertedJob.id,
                customer: insertedJob.customer,
                due_date: insertedJob.due_date
              });
              
              const updatedQrUrl = await generateQRCodeImage(updatedQrData);
              
              await supabase
                .from('production_jobs')
                .update({
                  qr_code_data: updatedQrData,
                  qr_code_url: updatedQrUrl
                })
                .eq('id', insertedJob.id);
            } catch (qrError) {
              this.logger.addDebugInfo(`Failed to update QR code for job ${insertedJob.id}: ${qrError}`);
            }
          }
        }
      }

      return {
        ...preparedResult,
        createdJobs: data || [],
        failedJobs,
        stats: {
          ...preparedResult.stats,
          successful: successfulCount,
          failed: failedJobs.length
        }
      };
    } catch (error) {
      this.logger.addDebugInfo(`Database operation failed: ${error}`);
      return {
        ...preparedResult,
        createdJobs: [],
        failedJobs: preparedResult.createdJobs,
        stats: {
          ...preparedResult.stats,
          successful: 0,
          failed: preparedResult.createdJobs.length
        }
      };
    }
  }

  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers?: any, 
    dataRows?: any, 
    userApprovedStageMappings?: any[]
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Preparing ${jobs.length} jobs with enhanced Excel data processing`);
    
    const allRowMappings: RowMappingResult[] = [];
    const groupedRowMappings: { [woNo: string]: RowMappingResult[] } = {};
    
    for (const job of jobs) {
      // Create row mappings for each job
      if (job._originalExcelRow && job._originalRowIndex !== undefined) {
        const mapping = mapRowToStage(
          job,
          job._originalExcelRow,
          job._originalRowIndex,
          'Default Group',
          job.specifications || '',
          userApprovedStageMappings || [],
          this.logger
        );
        allRowMappings.push(mapping);
        
        // Group by work order number
        if (!groupedRowMappings[job.wo_no]) {
          groupedRowMappings[job.wo_no] = [];
        }
        groupedRowMappings[job.wo_no].push(mapping);
      }
    }

    return {
      mappedStages: allRowMappings,
      rowMappings: groupedRowMappings,
      requiresCustomWorkflow: false,
      confidence: 0.8,
      userApprovedStageMappings,
      createdJobs: jobs,
      failedJobs: [],
      stats: {
        totalRows: jobs.length,
        processedRows: jobs.length,
        skippedRows: 0,
        invalidWONumbers: 0,
        invalidDates: 0,
        invalidTimingData: 0,
        invalidSpecifications: 0,
        total: jobs.length,
        successful: jobs.length,
        failed: 0,
        workflowsInitialized: 0,
        newCategories: 0
      }
    };
  }

  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers?: any, 
    userApprovedStageMappings?: any[]
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Creating enhanced jobs with Excel data for ${jobs.length} jobs`);
    
    const preparedResult = await this.prepareEnhancedJobsWithExcelData(
      jobs, 
      headers, 
      undefined, 
      userApprovedStageMappings
    );
    
    return preparedResult;
  }
}

export const mapRowToStage = (
  job: ParsedJob,
  row: any[],
  rowIndex: number,
  groupName: string,
  description: string,
  stageMappings: any[],
  logger: ExcelImportDebugger
): RowMappingResult => {
  logger.addDebugInfo(`Attempting to map row ${rowIndex} - Group: ${groupName}, Description: ${description}`);
  
  let mappedStageId: string | null = null;
  let mappedStageName: string | null = null;
  let mappedStageSpecId: string | null = null;
  let mappedStageSpecName: string | null = null;
  let confidence = 0;
  let category: RowMappingResult['category'] = 'unknown';
  let isUnmapped = false;
  let instanceId: string | undefined = undefined;
  let paperSpecification: string | undefined = undefined;
  let partType: string | undefined = undefined;
  
  // Try to find a matching stage mapping
  const matchingStage = findMatchingStage(description, groupName, stageMappings, logger);
  
  if (matchingStage) {
    mappedStageId = matchingStage.stageId;
    mappedStageName = matchingStage.stageName;
    mappedStageSpecId = matchingStage.stageSpecId || null;
    mappedStageSpecName = matchingStage.stageSpecName || null;
    confidence = matchingStage.confidence;
    category = matchingStage.category;
    instanceId = matchingStage.instanceId;
    paperSpecification = matchingStage.paperSpecification;
    partType = matchingStage.specifications[0];
    
    logger.addDebugInfo(`Matched stage: ${mappedStageName} (ID: ${mappedStageId}, Confidence: ${confidence})`);
  } else {
    isUnmapped = true;
    logger.addDebugInfo(`No matching stage found - marking as unmapped`);
  }
  
  const qty = extractQuantityFromJobSpecs(job, groupName, logger);
  const woQty = job.qty;
  
  return {
    excelRowIndex: rowIndex,
    excelData: row,
    groupName,
    description,
    qty,
    woQty,
    mappedStageId,
    mappedStageName,
    mappedStageSpecId,
    mappedStageSpecName,
    confidence,
    category,
    isUnmapped,
    instanceId,
    paperSpecification,
    partType
  };
};

const findMatchingStage = (
  description: string,
  groupName: string,
  stageMappings: any[],
  logger: ExcelImportDebugger
): any | null => {
  
  // Try to find a mapping based on description first
  let matchingStage = stageMappings.find(mapping => {
    const descriptionMatch = description && mapping.specifications.some((spec: string) =>
      spec && description.toLowerCase().includes(spec.toLowerCase())
    );
    return descriptionMatch;
  });
  
  if (matchingStage) {
    logger.addDebugInfo(`Matched stage by description: ${matchingStage.stageName}`);
    return matchingStage;
  }
  
  // If no match on description, try to find a mapping based on group name
  matchingStage = stageMappings.find(mapping => {
    const groupMatch = groupName && mapping.specifications.some((spec: string) =>
      spec && groupName.toLowerCase().includes(spec.toLowerCase())
    );
    return groupMatch;
  });
  
  if (matchingStage) {
    logger.addDebugInfo(`Matched stage by group name: ${matchingStage.stageName}`);
    return matchingStage;
  }
  
  return null;
};

const extractQuantityFromJobSpecs = (
  job: ParsedJob, 
  groupName: string, 
  logger: ExcelImportDebugger
): number => {
  logger.addDebugInfo(`Extracting quantity for group: ${groupName}`);
  
  // Priority 1: Use cover_text_detection data for book jobs
  if (job.cover_text_detection?.isBookJob && job.cover_text_detection.components) {
    logger.addDebugInfo(`Book job detected - checking cover/text components`);
    
    // Check if this is a cover printing stage
    if (groupName.toLowerCase().includes('cover') || 
        groupName.toLowerCase().includes('hp 12000') ||
        groupName.toLowerCase().includes('b2 4 process')) {
      
      const coverComponent = job.cover_text_detection.components.find(c => c.type === 'cover');
      if (coverComponent?.printing) {
        logger.addDebugInfo(`Using cover printing quantity: ${coverComponent.printing.qty}`);
        return coverComponent.printing.qty;
      }
    }
    
    // Check if this is a text printing stage
    if (groupName.toLowerCase().includes('text') || 
        groupName.toLowerCase().includes('inkjet') ||
        groupName.toLowerCase().includes('b1 4 process')) {
      
      const textComponent = job.cover_text_detection.components.find(c => c.type === 'text');
      if (textComponent?.printing) {
        logger.addDebugInfo(`Using text printing quantity: ${textComponent.printing.qty}`);
        return textComponent.printing.qty;
      }
    }
  }
  
  // Priority 2: Search in printing specifications (existing logic)
  if (job.printing_specifications) {
    // Try exact match first
    if (job.printing_specifications[groupName]) {
      const qty = job.printing_specifications[groupName].qty || 0;
      logger.addDebugInfo(`Found exact match in printing specs: ${qty}`);
      return qty;
    }
    
    // Try partial match for similar names
    for (const [key, spec] of Object.entries(job.printing_specifications)) {
      if (key.toLowerCase().includes(groupName.toLowerCase()) || 
          groupName.toLowerCase().includes(key.toLowerCase())) {
        const qty = spec.qty || 0;
        logger.addDebugInfo(`Found partial match "${key}" in printing specs: ${qty}`);
        return qty;
      }
    }
  }
  
  // Priority 3: Search in other specification types
  const specTypes = [
    'finishing_specifications',
    'prepress_specifications', 
    'delivery_specifications',
    'packaging_specifications'
  ] as const;
  
  for (const specType of specTypes) {
    if (job[specType]) {
      if (job[specType]![groupName]) {
        const qty = job[specType]![groupName].qty || 0;
        logger.addDebugInfo(`Found in ${specType}: ${qty}`);
        return qty;
      }
    }
  }
  
  // Priority 4: Use operation quantities
  if (job.operation_quantities?.[groupName]) {
    const qty = job.operation_quantities[groupName].operation_qty;
    logger.addDebugInfo(`Found in operation quantities: ${qty}`);
    return qty;
  }
  
  // Final fallback: use job quantity
  logger.addDebugInfo(`Using job quantity fallback: ${job.qty}`);
  return job.qty;
};
