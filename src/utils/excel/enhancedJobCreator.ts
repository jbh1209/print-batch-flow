import { v4 as uuidv4 } from 'uuid';
import { findWorkflowForJob } from '@/services/WorkflowFinder';
import { createJob, updateJob } from '@/services/JobService';
import { createStage, updateStage } from '@/services/StageService';
import { createJobStage, updateJobStage } from '@/services/JobStageService';
import { createSpecification, updateSpecification } from '@/services/SpecificationService';
import { createStageSpecification, updateStageSpecification } from '@/services/StageSpecificationService';
import { generateQRCodeDataURL } from '@/utils/qrcode';
import type { ExcelImportDebugger } from './debugger';
import type { ParsedJob } from './types';

export class EnhancedJobCreator {
  private logger: ExcelImportDebugger;
  private userId: string;
  private generateQRCodes: boolean;
  private workflows: any[] = [];
  private specifications: any = {};
  private stages: any = {};
  private jobDefaults: any = {};

  constructor(logger: ExcelImportDebugger, userId: string, generateQRCodes: boolean = true) {
    this.logger = logger;
    this.userId = userId;
    this.generateQRCodes = generateQRCodes;
  }

  async initialize() {
    try {
      // Load workflows, specifications, and stages from environment variables
      this.workflows = JSON.parse(process.env.NEXT_PUBLIC_WORKFLOWS || '[]');
      this.specifications = JSON.parse(process.env.NEXT_PUBLIC_SPECIFICATIONS || '{}');
      this.stages = JSON.parse(process.env.NEXT_PUBLIC_STAGES || '{}');
      this.jobDefaults = JSON.parse(process.env.NEXT_PUBLIC_JOB_DEFAULTS || '{}');
      
      this.logger.addDebugInfo(`Loaded ${this.workflows.length} workflows, ${Object.keys(this.specifications).length} specifications, ${Object.keys(this.stages).length} stages, and job defaults`);
    } catch (error: any) {
      this.logger.addDebugInfo(`Error initializing EnhancedJobCreator: ${error.message}`);
      throw error;
    }
  }

  /**
   * Phase 4: Prepare enhanced jobs with Excel data for review (no database saves)
   */
  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    dataRows: any[][],
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`Preparing ${jobs.length} enhanced jobs with Excel data for review`);
    
    const preparedJobs: any[] = [];
    let successful = 0;
    let failed = 0;
    
    for (const job of jobs) {
      try {
        // Step 1: Find workflow for the job
        const workflow = findWorkflowForJob(job, this.workflows, this.logger);
        if (!workflow) {
          this.logger.addDebugInfo(`❌ No workflow found for job ${job.wo_no}`);
          failed++;
          continue;
        }
        
        this.logger.addDebugInfo(`✅ Found workflow "${workflow.name}" for job ${job.wo_no}`);
        
        // Step 2: Prepare job data with workflow and Excel data
        const jobData = {
          ...this.jobDefaults,
          ...job,
          workflow_id: workflow.id,
          current_stage_id: workflow.stages[0].id,
          created_by: this.userId,
          updated_by: this.userId,
          stages: []
        };
        
        // Step 3: Prepare stages with specifications and Excel data
        for (const stage of workflow.stages) {
          const stageData = {
            ...stage,
            created_by: this.userId,
            updated_by: this.userId,
            specifications: []
          };
          
          // Step 4: Prepare specifications with Excel data
          for (const spec of stage.specifications) {
            const specData = {
              ...spec,
              created_by: this.userId,
              updated_by: this.userId
            };
            stageData.specifications.push(specData);
          }
          
          jobData.stages.push(stageData);
        }
        
        preparedJobs.push(jobData);
        successful++;
      } catch (error: any) {
        this.logger.addDebugInfo(`❌ Error preparing job ${job.wo_no}: ${error.message}`);
        failed++;
      }
    }
    
    const result = {
      jobs: preparedJobs,
      headers,
      dataRows,
      generateQRCodes: this.generateQRCodes,
      stats: {
        total: jobs.length,
        successful,
        failed
      }
    };
    
    this.logger.addDebugInfo(`Preparation completed: ${successful}/${jobs.length} jobs prepared for review`);
    return result;
  }

  /**
   * Phase 4: Create enhanced jobs with Excel data and workflows
   */
  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    dataRows: any[][]
  ): Promise<any> {
    this.logger.addDebugInfo(`Creating ${jobs.length} enhanced jobs with Excel data and workflows`);
    
    let successful = 0;
    let failed = 0;
    const jobResults: any[] = [];
    
    for (const job of jobs) {
      try {
        // Step 1: Find workflow for the job
        const workflow = findWorkflowForJob(job, this.workflows, this.logger);
        if (!workflow) {
          this.logger.addDebugInfo(`❌ No workflow found for job ${job.wo_no}`);
          failed++;
          continue;
        }
        
        this.logger.addDebugInfo(`✅ Found workflow "${workflow.name}" for job ${job.wo_no}`);
        
        // Step 2: Create job
        const jobData = {
          ...this.jobDefaults,
          ...job,
          workflow_id: workflow.id,
          current_stage_id: workflow.stages[0].id,
          created_by: this.userId,
          updated_by: this.userId
        };
        
        const newJob = await createJob(jobData);
        this.logger.addDebugInfo(`✅ Created job ${newJob.wo_no} (ID: ${newJob.id})`);
        
        // Step 3: Generate QR code
        if (this.generateQRCodes) {
          const qrCodeDataURL = await generateQRCodeDataURL(newJob.id);
          newJob.qr_code = qrCodeDataURL;
          await updateJob(newJob.id, { qr_code: qrCodeDataURL });
          this.logger.addDebugInfo(`✅ Generated QR code for job ${newJob.wo_no}`);
        }
        
        // Step 4: Create stages
        for (const stage of workflow.stages) {
          const stageData = {
            ...stage,
            job_id: newJob.id,
            created_by: this.userId,
            updated_by: this.userId
          };
          
          const newStage = await createStage(stageData);
          this.logger.addDebugInfo(`✅ Created stage ${newStage.name} (ID: ${newStage.id}) for job ${newJob.wo_no}`);
          
          const jobStageData = {
            job_id: newJob.id,
            stage_id: newStage.id,
            created_by: this.userId,
            updated_by: this.userId
          };
          
          await createJobStage(jobStageData);
          this.logger.addDebugInfo(`✅ Created job stage for job ${newJob.wo_no} and stage ${newStage.name}`);
          
          // Step 5: Create specifications
          for (const spec of stage.specifications) {
            const specData = {
              ...spec,
              created_by: this.userId,
              updated_by: this.userId
            };
            
            const newSpecification = await createSpecification(specData);
            this.logger.addDebugInfo(`✅ Created specification ${newSpecification.name} (ID: ${newSpecification.id}) for job ${newJob.wo_no}`);
            
            const stageSpecificationData = {
              stage_id: newStage.id,
              specification_id: newSpecification.id,
              created_by: this.userId,
              updated_by: this.userId
            };
            
            await createStageSpecification(stageSpecificationData);
            this.logger.addDebugInfo(`✅ Created stage specification for stage ${newStage.name} and specification ${newSpecification.name}`);
          }
        }
        
        jobResults.push(newJob);
        successful++;
      } catch (error: any) {
        this.logger.addDebugInfo(`❌ Error creating job ${job.wo_no}: ${error.message}`);
        failed++;
      }
    }
    
    const result = {
      jobs: jobResults,
      headers,
      dataRows,
      stats: {
        total: jobs.length,
        successful,
        failed
      }
    };
    
    this.logger.addDebugInfo(`Creation completed: ${successful}/${jobs.length} jobs created`);
    return result;
  }

  /**
   * Finalize production-ready jobs by saving them to the database
   */
  async finalizeJobs(
    preparedResult: any,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`Finalizing ${preparedResult.jobs.length} prepared jobs`);
    
    let successful = 0;
    let failed = 0;
    const jobResults: any[] = [];
    
    for (const preparedJob of preparedResult.jobs) {
      try {
        // Step 1: Create job
        const newJob = await createJob(preparedJob);
        this.logger.addDebugInfo(`✅ Created job ${newJob.wo_no} (ID: ${newJob.id})`);
        
        // Step 2: Generate QR code
        if (this.generateQRCodes) {
          const qrCodeDataURL = await generateQRCodeDataURL(newJob.id);
          newJob.qr_code = qrCodeDataURL;
          await updateJob(newJob.id, { qr_code: qrCodeDataURL });
          this.logger.addDebugInfo(`✅ Generated QR code for job ${newJob.wo_no}`);
        }
        
        // Step 3: Create stages
        for (const preparedStage of preparedJob.stages) {
          const stageData = {
            ...preparedStage,
            job_id: newJob.id
          };
          
          const newStage = await createStage(stageData);
          this.logger.addDebugInfo(`✅ Created stage ${newStage.name} (ID: ${newStage.id}) for job ${newJob.wo_no}`);
          
          const jobStageData = {
            job_id: newJob.id,
            stage_id: newStage.id
          };
          
          await createJobStage(jobStageData);
          this.logger.addDebugInfo(`✅ Created job stage for job ${newJob.wo_no} and stage ${newStage.name}`);
          
          // Step 4: Create specifications
          for (const preparedSpec of preparedStage.specifications) {
            const specData = {
              ...preparedSpec
            };
            
            const newSpecification = await createSpecification(specData);
            this.logger.addDebugInfo(`✅ Created specification ${newSpecification.name} (ID: ${newSpecification.id}) for job ${newJob.wo_no}`);
            
            const stageSpecificationData = {
              stage_id: newStage.id,
              specification_id: newSpecification.id
            };
            
            await createStageSpecification(stageSpecificationData);
            this.logger.addDebugInfo(`✅ Created stage specification for stage ${newStage.name} and specification ${newSpecification.name}`);
          }
        }
        
        jobResults.push(newJob);
        successful++;
      } catch (error: any) {
        this.logger.addDebugInfo(`❌ Error creating job ${preparedJob.wo_no}: ${error.message}`);
        failed++;
      }
    }
    
    const result = {
      jobs: jobResults,
      stats: {
        total: preparedResult.jobs.length,
        successful,
        failed
      }
    };
    
    this.logger.addDebugInfo(`Finalization completed: ${successful}/${preparedResult.jobs.length} jobs saved`);
    return result;
  }

  /**
   * [QUANTITY FIX] Helper function to extract quantity from group name
   *
   * @param {string} groupName - The name of the group (e.g., "HP 12000 - Cover - Gloss 250gsm")
   * @param {object} specifications - The specifications object (e.g., { "HP 12000 - Cover": { ... }, "HP 12000 - Text": { ... } })
   * @returns {number} - The extracted quantity, or null if not found
  */
  extractQuantityFromGroupName(groupName: string, specifications: any): number | null {
    // 1. Normalize the group name
    const normalizedGroupName = groupName.trim();
    
    // 2. Extract base name from composite group names (e.g., "HP 12000 - Cover" -> "HP 12000")
    const baseName = groupName.replace(/\s*-\s*[^_]+$/i, '').trim();
    console.log(`[Excel Import] [QUANTITY FIX] Group: "${groupName}" -> Base: "${baseName}"`);
    
    // 3. Look for keys that start with the base name
    for (const [key, spec] of Object.entries(specifications)) {
      if (key.startsWith(baseName)) {
        console.log(`[Excel Import] [QUANTITY FIX] Found matching spec: "${key}"`);
        return spec.qty || null;
      }
    }
    
    // 4. If no match is found, return null
    console.log(`[Excel Import] [QUANTITY FIX] No matching spec found for group: "${groupName}"`);
    return null;
  }
}
