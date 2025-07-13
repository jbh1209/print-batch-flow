import { ExcelImportDebugger } from "../debugger";
import { GroupSpecifications, ParsedJob } from "../types";
import { SimpleStageDetector } from "./SimpleStageDetector";
import { StageInstanceBuilder } from "./StageInstanceBuilder";
import { PaperSpecHandler } from "./PaperSpecHandler";
import { MappingRepository } from "./MappingRepository";
import { supabase } from "@/integrations/supabase/client";

export interface SimplifiedJobResult {
  woNo: string;
  jobData: ParsedJob;
  stageInstances: any[];
  errors: string[];
  success: boolean;
}

export interface SimplifiedImportResult {
  jobs: SimplifiedJobResult[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    totalStages: number;
    printingStages: number;
    finishingStages: number;
    prepressStages: number;
  };
  errors: string[];
  debugInfo: string[];
}

export class ExcelImportOrchestrator {
  private logger: ExcelImportDebugger;
  private mappingRepo: MappingRepository;
  private stageDetector: SimpleStageDetector;
  private stageBuilder: StageInstanceBuilder;
  private paperHandler: PaperSpecHandler;

  constructor(logger: ExcelImportDebugger) {
    this.logger = logger;
    this.mappingRepo = new MappingRepository(logger);
    this.paperHandler = new PaperSpecHandler(logger);
    this.stageDetector = new SimpleStageDetector(this.mappingRepo, logger);
    this.stageBuilder = new StageInstanceBuilder(this.mappingRepo, this.paperHandler, logger);
  }

  /**
   * Process a single job with simplified architecture
   */
  async processJob(
    jobData: ParsedJob,
    excelRows: any[][],
    headers: string[]
  ): Promise<SimplifiedJobResult> {
    this.logger.addDebugInfo(`\n==================== PROCESSING JOB: ${jobData.wo_no} ====================`);
    
    try {
      // Initialize repository if not already done
      await this.mappingRepo.initialize();

      // Process paper specifications
      this.paperHandler.processPaperSpecs(jobData.paper_specifications);

      // Detect operations from Excel specifications
      const operations = await this.stageDetector.detectOperations(
        jobData.printing_specifications,
        jobData.finishing_specifications,
        jobData.prepress_specifications,
        excelRows,
        headers
      );

      if (operations.length === 0) {
        return {
          woNo: jobData.wo_no,
          jobData,
          stageInstances: [],
          errors: ['No operations detected from Excel specifications'],
          success: false
        };
      }

      // Build stage instances
      const stageInstances = await this.stageBuilder.buildStageInstances(operations);
      const validInstances = this.stageBuilder.getValidInstances(stageInstances) || [];
      const invalidInstances = this.stageBuilder.getInvalidInstances(stageInstances) || [];

      // Log results with null safety
      try {
        const instancesByCategory = this.stageBuilder.getInstancesByCategory(validInstances) || {};
        this.logger.addDebugInfo(`Stage instances created:`);
        
        if (instancesByCategory && typeof instancesByCategory === 'object') {
          for (const [category, instances] of Object.entries(instancesByCategory)) {
            if (Array.isArray(instances)) {
              this.logger.addDebugInfo(`  ${category}: ${instances.length} stages`);
              for (const instance of instances) {
                if (instance && typeof instance === 'object') {
                  this.logger.addDebugInfo(`    - ${instance.stageName || 'Unknown'}${instance.partType ? ` (${instance.partType})` : ''}`);
                }
              }
            }
          }
        }
      } catch (categoryError) {
        this.logger.addDebugInfo(`Error processing categories: ${categoryError}`);
      }

      const errors = invalidInstances.map(instance => 
        `${instance.stageName}: ${instance.errorReason || 'Unknown error'}`
      );

      return {
        woNo: jobData.wo_no,
        jobData,
        stageInstances: validInstances,
        errors,
        success: validInstances.length > 0
      };

    } catch (error) {
      this.logger.addDebugInfo(`Error processing job ${jobData.wo_no}: ${error}`);
      return {
        woNo: jobData.wo_no,
        jobData,
        stageInstances: [],
        errors: [`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        success: false
      };
    }
  }

  /**
   * Process multiple jobs
   */
  async processJobs(
    jobs: ParsedJob[],
    excelRows: any[][],
    headers: string[]
  ): Promise<SimplifiedImportResult> {
    this.logger.addDebugInfo(`\n🚀 STARTING SIMPLIFIED EXCEL IMPORT - ${jobs.length} jobs`);
    
    const results: SimplifiedJobResult[] = [];
    const globalErrors: string[] = [];
    
    try {
      // Initialize repository once for all jobs
      await this.mappingRepo.initialize();

      // Process each job
      for (const job of jobs) {
        const result = await this.processJob(job, excelRows, headers);
        results.push(result);
      }

      // Calculate statistics
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      let totalStages = 0;
      let printingStages = 0;
      let finishingStages = 0;
      let prepressStages = 0;

      for (const result of successful) {
        totalStages += result.stageInstances.length;
        for (const instance of result.stageInstances) {
          switch (instance.category) {
            case 'printing':
              printingStages++;
              break;
            case 'finishing':
              finishingStages++;
              break;
            case 'prepress':
              prepressStages++;
              break;
          }
        }
      }

      const stats = {
        total: jobs.length,
        successful: successful.length,
        failed: failed.length,
        totalStages,
        printingStages,
        finishingStages,
        prepressStages
      };

      this.logger.addDebugInfo(`\n✅ IMPORT COMPLETE - Stats: ${JSON.stringify(stats, null, 2)}`);

      return {
        jobs: results,
        stats,
        errors: globalErrors,
        debugInfo: this.logger.getDebugInfo()
      };

    } catch (error) {
      this.logger.addDebugInfo(`Fatal error in processJobs: ${error}`);
      globalErrors.push(`Fatal processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        jobs: results,
        stats: {
          total: jobs.length,
          successful: 0,
          failed: jobs.length,
          totalStages: 0,
          printingStages: 0,
          finishingStages: 0,
          prepressStages: 0
        },
        errors: globalErrors,
        debugInfo: this.logger.getDebugInfo()
      };
    }
  }

  /**
   * Save jobs and stage instances to database
   */
  async saveToDatabase(
    result: SimplifiedImportResult,
    userId: string
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    this.logger.addDebugInfo(`\n💾 SAVING TO DATABASE - ${result.jobs.length} jobs`);
    
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const jobResult of result.jobs) {
      if (!jobResult.success) {
        failed++;
        continue;
      }

      try {
        // Insert production job
        const { data: insertedJob, error: jobError } = await supabase
          .from('production_jobs')
          .insert({
            ...jobResult.jobData,
            user_id: userId
          })
          .select()
          .single();

        if (jobError) {
          throw jobError;
        }

        // Insert stage instances
        const stageInstancesToInsert = jobResult.stageInstances.map((instance, index) => ({
          job_id: insertedJob.id,
          job_table_name: 'production_jobs',
          production_stage_id: instance.stageId,
          stage_specification_id: instance.stageSpecId || null,
          stage_order: index + 1,
          status: index === 0 ? 'active' : 'pending',
          quantity: instance.quantity,
          part_name: instance.partName || null,
          part_type: instance.partType || null,
          started_at: index === 0 ? new Date().toISOString() : null,
          started_by: index === 0 ? userId : null
        }));

        const { error: stagesError } = await supabase
          .from('job_stage_instances')
          .insert(stageInstancesToInsert);

        if (stagesError) {
          throw stagesError;
        }

        this.logger.addDebugInfo(`✅ Saved job ${jobResult.woNo} with ${jobResult.stageInstances.length} stages`);
        successful++;

      } catch (error) {
        this.logger.addDebugInfo(`❌ Failed to save job ${jobResult.woNo}: ${error}`);
        errors.push(`Failed to save ${jobResult.woNo}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failed++;
      }
    }

    this.logger.addDebugInfo(`\n💾 SAVE COMPLETE - ${successful} successful, ${failed} failed`);
    
    return { successful, failed, errors };
  }
}