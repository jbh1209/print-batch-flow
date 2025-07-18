import type { ExcelImportDebugger } from './debugger';
import type { ParsedJob, EnhancedJobCreationResult } from './types';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { EnhancedMappingProcessor } from './enhancedMappingProcessor';

export class EnhancedJobCreator {
  private workflowCache: { [key: string]: any } = {};
  private stageCache: { [key: string]: any } = {};

  constructor(
    private logger: ExcelImportDebugger,
    private userId: string,
    private generateQRCodes: boolean = true
  ) {}

  async initialize(): Promise<void> {
    this.logger.addDebugInfo(`🎯 EnhancedJobCreator initialized for user ${this.userId} with QR code generation ${this.generateQRCodes ? 'enabled' : 'disabled'}`);
  }

  private async getStages(): Promise<any[]> {
    if (this.stageCache['all']) {
      return this.stageCache['all'];
    }

    const stages = [
      { id: 'prepress', name: 'Pre-Press' },
      { id: 'printing', name: 'Printing' },
      { id: 'finishing', name: 'Finishing' },
      { id: 'packaging', name: 'Packaging' },
      { id: 'delivery', name: 'Delivery' }
    ];

    this.stageCache['all'] = stages;
    return stages;
  }

  private async createWorkflowForJob(job: ParsedJob): Promise<any> {
    const workflowId = `workflow_${job.wo_no}`;

    if (this.workflowCache[workflowId]) {
      return this.workflowCache[workflowId];
    }

    const stages = await this.getStages();
    const workflowStages = stages.map(stage => ({
      id: uuidv4(),
      stageId: stage.id,
      name: stage.name,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const workflow = {
      id: workflowId,
      name: `Workflow for ${job.wo_no}`,
      stages: workflowStages,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workflowCache[workflowId] = workflow;
    return workflow;
  }

  private async createJobInstanceWithWorkflow(job: ParsedJob, workflow: any): Promise<any> {
    const jobId = uuidv4();
    const now = new Date();

    let qrCodeUrl: string | null = null;
    if (this.generateQRCodes) {
      try {
        qrCodeUrl = await QRCode.toDataURL(job.wo_no);
        this.logger.addDebugInfo(`✅ Generated QR code for job ${job.wo_no}`);
      } catch (qrError) {
        this.logger.addDebugInfo(`❌ Failed to generate QR code for job ${job.wo_no}: ${qrError}`);
        qrCodeUrl = null;
      }
    }

    const jobInstance = {
      id: jobId,
      wo_number: job.wo_no,
      customer: job.customer,
      reference: job.reference,
      quantity: job.qty,
      status: job.status,
      date: job.date,
      due_date: job.due_date,
      location: job.location,
      category: job.category,
      rep: job.rep,
      estimated_hours: job.estimated_hours,
      setup_time_minutes: job.setup_time_minutes,
      running_speed: job.running_speed,
      speed_unit: job.speed_unit,
      specifications: job.specifications,
      paper_weight: job.paper_weight,
      paper_type: job.paper_type,
      lamination: job.lamination,
      workflowId: workflow.id,
      qrCodeUrl: qrCodeUrl,
      createdAt: now,
      updatedAt: now,
      createdBy: this.userId,
      updatedBy: this.userId
    };

    return jobInstance;
  }

  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    excelRows: any[][],
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`🎯 PREPARING ${jobs.length} enhanced jobs with Excel data`);
    
    // Create enhanced mapping processor to get stage mappings
    const enhancedProcessor = new EnhancedMappingProcessor(this.logger, []);
    await enhancedProcessor.initialize();
    
    // Process jobs to get stage mappings (this will call the stage mapper)
    const enhancedResult = await enhancedProcessor.processJobsWithEnhancedMapping(
      jobs,
      -1, // no paper column for preparation
      -1, // no delivery column for preparation
      excelRows
    );
    
    this.logger.addDebugInfo(`🎯 Enhanced processing complete - stage mapping result available: ${!!enhancedResult.stageMappingResult}`);
    
    // Create workflows and job instances for each job
    const preparedJobs: any[] = [];
    const stats = {
      total: jobs.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const job of jobs) {
      try {
        // Create workflow with stages
        const workflow = await this.createWorkflowForJob(job);
        
        // Create job instance with workflow
        const jobInstance = await this.createJobInstanceWithWorkflow(job, workflow);
        
        // Include Excel data and stage mappings
        const preparedJob = {
          ...jobInstance,
          _originalExcelRow: job._originalExcelRow,
          _originalRowIndex: job._originalRowIndex,
          _stageMappings: enhancedResult.stageMappingResult?.mappedRows?.filter(
            row => row.groupName === job.wo_no
          ) || []
        };
        
        preparedJobs.push(preparedJob);
        stats.successful++;
        
        this.logger.addDebugInfo(`✅ Prepared job ${job.wo_no} with ${preparedJob._stageMappings.length} stage mappings`);
      } catch (error) {
        const errorMsg = `Failed to prepare job ${job.wo_no}: ${error}`;
        this.logger.addDebugInfo(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    return {
      preparedJobs,
      stats,
      generateQRCodes: this.generateQRCodes,
      headers,
      excelRows,
      userApprovedStageMappings,
      stageMappingResult: enhancedResult.stageMappingResult // Pass through stage mapping result
    };
  }

  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    excelRows: any[][]
  ): Promise<any> {
    this.logger.addDebugInfo(`🎯 CREATING ${jobs.length} enhanced jobs with Excel data`);

    const createdJobs: any[] = [];
    const stats = {
      total: jobs.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const job of jobs) {
      try {
        // Create workflow with stages
        const workflow = await this.createWorkflowForJob(job);

        // Create job instance with workflow
        const jobInstance = await this.createJobInstanceWithWorkflow(job, workflow);

        // Simulate saving to database
        createdJobs.push(jobInstance);
        stats.successful++;

        this.logger.addDebugInfo(`✅ Created job ${job.wo_no}`);
      } catch (error) {
        const errorMsg = `Failed to create job ${job.wo_no}: ${error}`;
        this.logger.addDebugInfo(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    return {
      createdJobs,
      stats,
      generateQRCodes: this.generateQRCodes,
      headers,
      excelRows
    };
  }

  async finalizeJobs(preparedResult: any, userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>): Promise<any> {
    this.logger.addDebugInfo(`🎯 FINALIZING ${preparedResult.preparedJobs.length} jobs`);

    const savedJobs: any[] = [];
    const stats = {
      total: preparedResult.preparedJobs.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const job of preparedResult.preparedJobs) {
      try {
        // Simulate saving the job to the database
        savedJobs.push(job);
        stats.successful++;

        this.logger.addDebugInfo(`✅ Saved job ${job.wo_number}`);
      } catch (error) {
        const errorMsg = `Failed to save job ${job.wo_number}: ${error}`;
        this.logger.addDebugInfo(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    return {
      savedJobs,
      stats,
      generateQRCodes: preparedResult.generateQRCodes,
      headers: preparedResult.headers,
      excelRows: preparedResult.excelRows,
      userApprovedMappings: userApprovedMappings || [],
      stageMappingResult: preparedResult.stageMappingResult
    };
  }
}
