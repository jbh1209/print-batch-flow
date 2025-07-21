import { v4 as uuidv4 } from 'uuid';
import type { ParsedJob } from './types';
import type { ExcelImportDebugger } from './debugger';
import { generateQRCodeDataURL } from '../qrcode';
import { calculateTimingsForStage } from '../calculations';

export interface JobPreparationResult {
  jobs: any[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    workflowErrors: number;
    stageErrors: number;
  };
  userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>;
  generateQRCodes: boolean;
}

export interface JobCreationResult {
  successful: number;
  failed: number;
  total: number;
}

export class EnhancedJobCreator {
  private userId: string;
  private logger: ExcelImportDebugger;
  private generateQRCodes: boolean;
  private productionStages: any[] = [];
  private workflows: any[] = [];
  private stageCategories: any[] = [];

  constructor(logger: ExcelImportDebugger, userId: string, generateQRCodes: boolean = true) {
    this.logger = logger;
    this.userId = userId;
    this.generateQRCodes = generateQRCodes;
  }

  /**
   * Helper function to extract base stage ID from unique stage key
   * Removes suffixes like -2, -3 to get the original stage ID
   */
  private extractBaseStageId(uniqueStageKey: string): string {
    // Remove suffix pattern like -2, -3, etc.
    return uniqueStageKey.replace(/-\d+$/, '');
  }

  async initialize() {
    try {
      // Dynamically import the database module
      const { db } = await import('@/utils/db');

      // Load production stages
      this.productionStages = await db.production_stages.findMany({
        orderBy: [
          {
            category_id: 'asc',
          },
          {
            order: 'asc',
          },
        ],
      });

      // Load workflows
      this.workflows = await db.workflows.findMany();

      // Load stage categories
      this.stageCategories = await db.stage_categories.findMany();

      this.logger.addDebugInfo(`Loaded ${this.productionStages.length} production stages, ${this.workflows.length} workflows, ${this.stageCategories.length} stage categories`);
    } catch (error: any) {
      this.logger.addDebugInfo(`Error initializing EnhancedJobCreator: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract quantity for a specific stage instance from job specifications
   */
  private extractQuantityFromJobSpecs(
    job: ParsedJob,
    stageInstance: any,
    quantityMap: Record<string, number>,
    logger: ExcelImportDebugger
  ): number {
    logger.addDebugInfo(`🔍 Extracting quantity for stage: ${stageInstance.unique_stage_key}`);
    
    // Try exact unique stage key first (for multi-row stages with suffixes)
    if (quantityMap[stageInstance.unique_stage_key] !== undefined) {
      const exactQuantity = quantityMap[stageInstance.unique_stage_key];
      logger.addDebugInfo(`✅ Found exact quantity for ${stageInstance.unique_stage_key}: ${exactQuantity}`);
      return exactQuantity;
    }
    
    // Fallback: Try base stage ID (remove suffix like -2, -3)
    const baseStageId = this.extractBaseStageId(stageInstance.unique_stage_key);
    if (quantityMap[baseStageId] !== undefined) {
      const baseQuantity = quantityMap[baseStageId];
      logger.addDebugInfo(`✅ Found base quantity for ${baseStageId} (from ${stageInstance.unique_stage_key}): ${baseQuantity}`);
      return baseQuantity;
    }
    
    // Final fallback: Use work order quantity
    logger.addDebugInfo(`⚠️ No specific quantity found for ${stageInstance.unique_stage_key}, using WO quantity: ${job.qty}`);
    return job.qty;
  }

  /**
   * Prepare enhanced jobs with Excel data for review (no database saves)
   */
  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    dataRows: any[][],
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<JobPreparationResult> {
    this.logger.addDebugInfo(`Preparing ${jobs.length} enhanced jobs with Excel data`);

    let successful = 0;
    let failed = 0;
    let workflowErrors = 0;
    let stageErrors = 0;
    const preparedJobs = [];

    for (const job of jobs) {
      try {
        // 1. Find the appropriate workflow
        const workflow = this.workflows.find((wf) => {
          const customerMatches = !wf.customer || wf.customer.toLowerCase() === job.customer.toLowerCase();
          const categoryMatches = !wf.category || wf.category.toLowerCase() === job.category.toLowerCase();
          return customerMatches && categoryMatches;
        });

        if (!workflow) {
          this.logger.addDebugInfo(`No workflow found for customer "${job.customer}" and category "${job.category}"`);
          workflowErrors++;
          failed++;
          continue;
        }

        this.logger.addDebugInfo(`Found workflow "${workflow.name}" for customer "${job.customer}" and category "${job.category}"`);

        // 2. Map Excel columns to stage quantities
        const quantityMap: Record<string, number> = {};
        if (job._originalExcelRow) {
          headers.forEach((header, index) => {
            if (header.toLowerCase().startsWith('qty')) {
              const stageName = header.substring(3).trim();
              const stage = this.productionStages.find((s) =>
                s.name.toLowerCase() === stageName.toLowerCase()
              );
              if (stage) {
                const quantity = parseInt(String(job._originalExcelRow[index] || '0').replace(/[^0-9]/g, '')) || 0;
                quantityMap[stage.id] = quantity;
                this.logger.addDebugInfo(`Mapped quantity ${quantity} from column "${header}" to stage "${stage.name}" (${stage.id})`);
              }
            }
          });
        }

        // 3. Create stage instances based on the workflow
        const stageInstances = workflow.stages.map((stage, index) => {
          const stageData = this.productionStages.find((s) => s.id === stage.stage_id);

          if (!stageData) {
            this.logger.addDebugInfo(`Stage data not found for stage ID ${stage.stage_id}`);
            stageErrors++;
            failed++;
            return null;
          }

          const category = this.stageCategories.find((cat) => cat.id === stageData.category_id);
          const categoryName = category ? category.name : 'Unknown Category';

          // Generate a unique key for this stage instance
          const uniqueStageKey = `${stageData.id}${index > 0 ? `-${index + 1}` : ''}`;

          return {
            id: uuidv4(),
            stage_id: stage.stage_id,
            stage_name: stageData.name,
            category: categoryName,
            order: stage.order,
            estimated_hours: stageData.default_hours,
            completed: false,
            job_id: null, // Job ID will be assigned later
            unique_stage_key: uniqueStageKey, // Assign the unique key
          };
        }).filter(Boolean);

        if (stageInstances.length !== workflow.stages.length) {
          this.logger.addDebugInfo(`Number of stage instances (${stageInstances.length}) does not match workflow stages (${workflow.stages.length})`);
          stageErrors++;
          failed++;
          continue;
        }

        // 4. Calculate timings and quantities for each stage instance
        stageInstances.forEach((stageInstance) => {
          const quantity = this.extractQuantityFromJobSpecs(job, stageInstance, quantityMap, this.logger);
          const { estimatedHours, startDate, endDate } = calculateTimingsForStage(
            job,
            stageInstance.estimated_hours,
            quantity
          );

          stageInstance.quantity = quantity;
          stageInstance.estimated_hours = estimatedHours;
          stageInstance.start_date = startDate;
          stageInstance.end_date = endDate;
        });

        // 5. Generate QR code if enabled
        let qrCodeDataURL = null;
        if (this.generateQRCodes) {
          qrCodeDataURL = await generateQRCodeDataURL(job.wo_no);
          this.logger.addDebugInfo(`Generated QR code for WO ${job.wo_no}`);
        }

        // 6. Construct the final job object
        const preparedJob = {
          ...job,
          id: uuidv4(),
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          stages: stageInstances,
          qr_code: qrCodeDataURL,
          created_by: this.userId,
          created_at: new Date(),
          updated_by: this.userId,
          updated_at: new Date(),
        };

        preparedJobs.push(preparedJob);
        successful++;
        this.logger.addDebugInfo(`Prepared job ${job.wo_no} with workflow ${workflow.name}`);
      } catch (error: any) {
        this.logger.addDebugInfo(`Error preparing job ${job.wo_no}: ${error.message}`);
        failed++;
      }
    }

    const stats = {
      total: jobs.length,
      successful,
      failed,
      workflowErrors,
      stageErrors,
    };

    this.logger.addDebugInfo(`Job preparation completed: ${successful} successful, ${failed} failed`);

    return { jobs: preparedJobs, stats, generateQRCodes: this.generateQRCodes, userApprovedStageMappings };
  }

  /**
   * Create enhanced jobs with Excel data and save to the database
   */
  async createEnhancedJobsWithExcelData(jobs: ParsedJob[], headers: string[], dataRows: any[]): Promise<any> {
    this.logger.addDebugInfo(`Creating ${jobs.length} enhanced jobs with Excel data`);

    let successful = 0;
    let failed = 0;

    // Dynamically import the database module
    const { db } = await import('@/utils/db');

    for (const job of jobs) {
      try {
        // 1. Find the appropriate workflow
        const workflow = this.workflows.find((wf) => {
          const customerMatches = !wf.customer || wf.customer.toLowerCase() === job.customer.toLowerCase();
          const categoryMatches = !wf.category || wf.category.toLowerCase() === job.category.toLowerCase();
          return customerMatches && categoryMatches;
        });

        if (!workflow) {
          this.logger.addDebugInfo(`No workflow found for customer "${job.customer}" and category "${job.category}"`);
          failed++;
          continue;
        }

        this.logger.addDebugInfo(`Found workflow "${workflow.name}" for customer "${job.customer}" and category "${job.category}"`);

        // 2. Map Excel columns to stage quantities
        const quantityMap: Record<string, number> = {};
        if (job._originalExcelRow) {
          headers.forEach((header, index) => {
            if (header.toLowerCase().startsWith('qty')) {
              const stageName = header.substring(3).trim();
              const stage = this.productionStages.find((s) =>
                s.name.toLowerCase() === stageName.toLowerCase()
              );
              if (stage) {
                const quantity = parseInt(String(job._originalExcelRow[index] || '0').replace(/[^0-9]/g, '')) || 0;
                quantityMap[stage.id] = quantity;
                this.logger.addDebugInfo(`Mapped quantity ${quantity} from column "${header}" to stage "${stage.name}" (${stage.id})`);
              }
            }
          });
        }

        // 3. Create a new job record in the database
        const newJob = await db.jobs.create({
          data: {
            ...job,
            id: uuidv4(),
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            created_by: this.userId,
            created_at: new Date(),
            updated_by: this.userId,
            updated_at: new Date(),
          },
        });

        this.logger.addDebugInfo(`Created job ${newJob.wo_no} with workflow ${workflow.name}`);

        // 4. Create stage instances based on the workflow
        const stageInstances = workflow.stages.map((stage, index) => {
          const stageData = this.productionStages.find((s) => s.id === stage.stage_id);

          if (!stageData) {
            this.logger.addDebugInfo(`Stage data not found for stage ID ${stage.stage_id}`);
            failed++;
            return null;
          }

          const category = this.stageCategories.find((cat) => cat.id === stageData.category_id);
          const categoryName = category ? category.name : 'Unknown Category';

          // Generate a unique key for this stage instance
          const uniqueStageKey = `${stageData.id}${index > 0 ? `-${index + 1}` : ''}`;

          return {
            id: uuidv4(),
            stage_id: stage.stage_id,
            stage_name: stageData.name,
            category: categoryName,
            order: stage.order,
            estimated_hours: stageData.default_hours,
            completed: false,
            job_id: newJob.id, // Assign the new job ID
            unique_stage_key: uniqueStageKey, // Assign the unique key
          };
        }).filter(Boolean);

        if (stageInstances.length !== workflow.stages.length) {
          this.logger.addDebugInfo(`Number of stage instances (${stageInstances.length}) does not match workflow stages (${workflow.stages.length})`);
          failed++;
          continue;
        }

        // 5. Calculate timings and quantities for each stage instance
        stageInstances.forEach((stageInstance) => {
          const quantity = this.extractQuantityFromJobSpecs(job, stageInstance, quantityMap, this.logger);
          const { estimatedHours, startDate, endDate } = calculateTimingsForStage(
            job,
            stageInstance.estimated_hours,
            quantity
          );

          stageInstance.quantity = quantity;
          stageInstance.estimated_hours = estimatedHours;
          stageInstance.start_date = startDate;
          stageInstance.end_date = endDate;
        });

        // 6. Create stage instance records in the database
        await db.job_stages.createMany({
          data: stageInstances.map((stageInstance) => ({
            ...stageInstance,
            created_by: this.userId,
            created_at: new Date(),
            updated_by: this.userId,
            updated_at: new Date(),
          })),
        });

        // 7. Generate QR code if enabled
        if (this.generateQRCodes) {
          const qrCodeDataURL = await generateQRCodeDataURL(job.wo_no);
          await db.jobs.update({
            where: { id: newJob.id },
            data: { qr_code: qrCodeDataURL },
          });
          this.logger.addDebugInfo(`Generated QR code for WO ${job.wo_no}`);
        }

        successful++;
        this.logger.addDebugInfo(`Created job ${newJob.wo_no} with workflow ${workflow.name}`);
      } catch (error: any) {
        this.logger.addDebugInfo(`Error creating job ${job.wo_no}: ${error.message}`);
        failed++;
      }
    }

    const result = {
      successful,
      failed,
      total: jobs.length,
    };

    this.logger.addDebugInfo(`Job creation completed: ${successful} successful, ${failed} failed`);

    return result;
  }

  async finalizeJobs(preparedResult: any, userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>): Promise<any> {
    this.logger.addDebugInfo(`Finalizing ${preparedResult.jobs.length} prepared jobs`);

    let successful = 0;
    let failed = 0;

    // Dynamically import the database module
    const { db } = await import('@/utils/db');

    for (const preparedJob of preparedResult.jobs) {
      try {
        // 1. Create a new job record in the database
        const { _originalExcelRow, _originalRowIndex, ...jobData } = preparedJob;
        const newJob = await db.jobs.create({
          data: {
            ...jobData,
            created_by: this.userId,
            created_at: new Date(),
            updated_by: this.userId,
            updated_at: new Date(),
          },
        });

        this.logger.addDebugInfo(`Created job ${newJob.wo_no} with workflow ${newJob.workflow_name}`);

        // 2. Create stage instance records in the database
        const stageInstances = preparedJob.stages.map((stageInstance: any) => ({
          ...stageInstance,
          job_id: newJob.id,
          created_by: this.userId,
          created_at: new Date(),
          updated_by: this.userId,
          updated_at: new Date(),
        }));

        await db.job_stages.createMany({
          data: stageInstances,
        });

        successful++;
        this.logger.addDebugInfo(`Created ${stageInstances.length} stage instances for job ${newJob.wo_no}`);
      } catch (error: any) {
        this.logger.addDebugInfo(`Error creating job ${preparedJob.wo_no}: ${error.message}`);
        failed++;
      }
    }

    const result = {
      successful,
      failed,
      total: preparedResult.jobs.length,
    };

    this.logger.addDebugInfo(`Job finalization completed: ${successful} successful, ${failed} failed`);

    return result;
  }
}
