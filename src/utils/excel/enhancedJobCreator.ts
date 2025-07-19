import { supabase } from "@/integrations/supabase/client";
import type { ParsedJob, RowMappingResult } from './types';
import type { ExcelImportDebugger } from './debugger';

export interface EnhancedJobCreationResult {
  jobs: any[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    workflowsInitialized?: number;
    newCategories?: number;
  };
  generateQRCodes?: boolean;
  rowMappings?: { [woNo: string]: RowMappingResult[] };
  categoryAssignments?: any[];
  createdJobs?: any[];
  failedJobs?: any[];
}

export class EnhancedJobCreator {
  private logger: ExcelImportDebugger;
  private userId: string;
  private generateQRCodes: boolean;
  private availableCategories: any[] = [];

  constructor(logger: ExcelImportDebugger, userId: string, generateQRCodes: boolean = true) {
    this.logger = logger;
    this.userId = userId;
    this.generateQRCodes = generateQRCodes;
  }

  async initialize() {
    this.logger.addDebugInfo('🏗️ Initializing Enhanced Job Creator...');
    
    // Load available categories for job creation
    const { data: categories } = await supabase
      .from('categories')
      .select('*');
    
    this.availableCategories = categories || [];
    this.logger.addDebugInfo(`📂 Loaded ${this.availableCategories.length} active categories`);
  }

  private async findOrCreateCategory(categoryName: string) {
    if (!categoryName) {
      this.logger.addDebugInfo(`⚠️ Category name is empty - using default "General"`);
      return { id: 'default-category-id', name: 'General' };
    }
    
    // Check if category exists in loaded categories (case-insensitive)
    const existingCategory = this.availableCategories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
    if (existingCategory) {
      this.logger.addDebugInfo(`✅ Using existing category: ${existingCategory.name} (${existingCategory.id})`);
      return existingCategory;
    }

    // Attempt to find in database (case-insensitive)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .ilike('name', categoryName)
      .single();

    if (error) {
      console.error('❌ Error fetching category:', error);
    }

    if (data) {
      this.logger.addDebugInfo(`✅ Found existing category in DB: ${data.name} (${data.id})`);
      return data;
    }

    // If not found, create a new category
    this.logger.addDebugInfo(`✨ Creating new category: ${categoryName}`);
    const { data: newCategory, error: newCategoryError } = await supabase
      .from('categories')
      .insert([{ name: categoryName }])
      .select('*')
      .single();

    if (newCategoryError) {
      console.error('❌ Error creating category:', newCategoryError);
      throw new Error(`Failed to create category: ${categoryName}`);
    }

    this.availableCategories.push(newCategory);
    this.logger.addDebugInfo(`✅ Created new category: ${newCategory.name} (${newCategory.id})`);
    return newCategory;
  }

  private mapExcelRowToRowMapping(excelRow: any[], headers: string[]): RowMappingResult {
    const rowMapping: RowMappingResult = {
      excelRowIndex: -1,
      excelData: excelRow,
      groupName: '',
      description: '',
      qty: 0,
      woQty: 0,
      mappedStageId: null,
      mappedStageName: null,
      mappedStageSpecId: null,
      mappedStageSpecName: null,
      confidence: 0,
      category: 'unknown',
      isUnmapped: true,
    };
    return rowMapping;
  }

  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    dataRows: any[][],
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`Preparing ${jobs.length} enhanced jobs with Excel data...`);
    
    let successful = 0;
    let failed = 0;
    const preparedJobs = [];
    
    for (const job of jobs) {
      try {
        // Find the category for the job
        const category = await this.findOrCreateCategory(job.category);
        
        // Get the Excel row data for the job
        const excelRow = job._originalExcelRow;
        
        // Map the Excel row to a RowMappingResult
        const rowMapping = this.mapExcelRowToRowMapping(excelRow, headers);
        
        // Prepare the job data for saving
        const jobData = {
          ...job,
          category_id: category.id,
          created_by: this.userId,
          updated_by: this.userId,
          generate_qr_code: this.generateQRCodes,
          row_mapping_results: [rowMapping],
        };
        
        preparedJobs.push(jobData);
        successful++;
      } catch (error: any) {
        console.error('❌ Error preparing job:', error);
        this.logger.addDebugInfo(`❌ Failed to prepare job ${job.wo_no}: ${error.message}`);
        failed++;
      }
    }
    
    this.logger.addDebugInfo(`✅ Successfully prepared ${successful} jobs, ${failed} failed`);
    
    return {
      jobs: preparedJobs,
      stats: {
        total: jobs.length,
        successful,
        failed,
      },
      generateQRCodes: this.generateQRCodes,
    };
  }

  async createEnhancedJobsWithExcelData(jobs: ParsedJob[], headers: string[], dataRows: any[][]): Promise<any> {
    this.logger.addDebugInfo(`Creating ${jobs.length} enhanced jobs with Excel data...`);
    
    let successful = 0;
    let failed = 0;
    const jobResults = [];
    
    for (const job of jobs) {
      try {
        // Find the category for the job
        const category = await this.findOrCreateCategory(job.category);
        
        // Get the Excel row data for the job
        const excelRow = job._originalExcelRow;
        
        // Map the Excel row to a RowMappingResult
        const rowMapping = this.mapExcelRowToRowMapping(excelRow, headers);
        
        // Create the job
        const { data: newJob, error: jobError } = await supabase
          .from('production_jobs')
          .insert([{
            wo_no: job.wo_no,
            status: job.status,
            date: job.date,
            rep: job.rep,
            category_id: category.id,
            customer: job.customer,
            reference: job.reference,
            qty: job.qty,
            due_date: job.due_date,
            location: job.location,
            user_id: this.userId,
          }])
          .select('*')
          .single();
        
        if (jobError) {
          console.error('❌ Error creating job:', jobError);
          this.logger.addDebugInfo(`❌ Failed to create job ${job.wo_no}: ${jobError.message}`);
          failed++;
          continue;
        }
        
        this.logger.addDebugInfo(`✅ Created job: ${newJob.wo_no} (${newJob.id})`);
        
        // Initialize workflow stages if category exists
        if (category.id) {
          const { error: workflowError } = await supabase.rpc('initialize_job_stages_auto', {
            p_job_id: newJob.id,
            p_job_table_name: 'production_jobs',
            p_category_id: category.id
          });
          
          if (workflowError) {
            this.logger.addDebugInfo(`❌ Failed to initialize workflow for job ${newJob.wo_no}: ${workflowError.message}`);
          }
        }
        
        // Note: row_mapping_results table doesn't exist, skipping this step
        
        jobResults.push(newJob);
        successful++;
      } catch (error: any) {
        console.error('❌ Error creating job:', error);
        this.logger.addDebugInfo(`❌ Failed to create job ${job.wo_no}: ${error.message}`);
        failed++;
      }
    }
    
    this.logger.addDebugInfo(`✅ Successfully created ${successful} jobs, ${failed} failed`);
    
    return {
      jobs: jobResults,
      stats: {
        total: jobs.length,
        successful,
        failed,
      },
    };
  }

  private extractQuantityFromJobSpecs(job: ParsedJob, groupName: string, stageId: string): number {
    this.logger.addDebugInfo(`🔍 Extracting quantity for groupName: "${groupName}", stageId: ${stageId}`);
    
    // PRIORITY 1: For cover/text jobs, extract quantities directly from cover_text_detection
    if (job.cover_text_detection?.components) {
      this.logger.addDebugInfo(`📖 Cover/text job detected - extracting from components`);
      
      // For cover printing stages
      if (groupName.toLowerCase().includes('cover')) {
        const coverComponent = job.cover_text_detection.components.find(c => c.type === 'cover');
        if (coverComponent?.printing?.qty) {
          this.logger.addDebugInfo(`✅ Found cover printing qty: ${coverComponent.printing.qty}`);
          return coverComponent.printing.qty;
        }
      }
      
      // For text printing stages  
      if (groupName.toLowerCase().includes('text')) {
        const textComponent = job.cover_text_detection.components.find(c => c.type === 'text');
        if (textComponent?.printing?.qty) {
          this.logger.addDebugInfo(`✅ Found text printing qty: ${textComponent.printing.qty}`);
          return textComponent.printing.qty;
        }
      }
    }

    // PRIORITY 2: Fall back to specification-based search for non-cover/text jobs
    this.logger.addDebugInfo(`🔍 Searching in job specifications for groupName: "${groupName}"`);
    
    // Search in printing specifications
    if (job.printing_specifications) {
      for (const [key, spec] of Object.entries(job.printing_specifications)) {
        this.logger.addDebugInfo(`🔍 Checking printing spec key: "${key}"`);
        if (key.toLowerCase().includes(groupName.toLowerCase()) || 
            groupName.toLowerCase().includes(key.toLowerCase())) {
          const qty = spec.qty || spec.wo_qty;
          if (qty && qty > 0) {
            this.logger.addDebugInfo(`✅ Found printing quantity: ${qty} for key: "${key}"`);
            return qty;
          }
        }
      }
    }

    // Search in other group specifications
    const allSpecs = [
      job.finishing_specifications,
      job.prepress_specifications,
      job.delivery_specifications,
      job.packaging_specifications
    ];

    for (const specs of allSpecs) {
      if (specs) {
        for (const [key, spec] of Object.entries(specs)) {
          if (key.toLowerCase().includes(groupName.toLowerCase()) || 
              groupName.toLowerCase().includes(key.toLowerCase())) {
            const qty = spec.qty || spec.wo_qty;
            if (qty && qty > 0) {
              this.logger.addDebugInfo(`✅ Found group quantity: ${qty} for key: "${key}"`);
              return qty;
            }
          }
        }
      }
    }

    // Default fallback
    this.logger.addDebugInfo(`⚠️ No specific quantity found for "${groupName}", using job qty: ${job.qty}`);
    return job.qty || 1;
  }

  async finalizeJobs(preparedResult: any, userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>): Promise<any> {
    this.logger.addDebugInfo(`Finalizing ${preparedResult.jobs.length} prepared jobs...`);
    
    let successful = 0;
    let failed = 0;
    const finalizedJobs = [];
    
    for (const job of preparedResult.jobs) {
      try {
        // Create the job
        const { data: newJob, error: jobError } = await supabase
          .from('production_jobs')
          .insert([{
            wo_no: job.wo_no,
            status: job.status,
            date: job.date,
            rep: job.rep,
            category_id: job.category_id,
            customer: job.customer,
            reference: job.reference,
            qty: job.qty,
            due_date: job.due_date,
            location: job.location,
            user_id: this.userId,
          }])
          .select('*')
          .single();
        
        if (jobError) {
          console.error('❌ Error creating job:', jobError);
          this.logger.addDebugInfo(`❌ Failed to create job ${job.wo_no}: ${jobError.message}`);
          failed++;
          continue;
        }
        
        this.logger.addDebugInfo(`✅ Created job: ${newJob.wo_no} (${newJob.id})`);
        
        // Initialize workflow stages if category exists
        if (job.category_id) {
          const { error: workflowError } = await supabase.rpc('initialize_job_stages_auto', {
            p_job_id: newJob.id,
            p_job_table_name: 'production_jobs',
            p_category_id: job.category_id
          });
          
          if (workflowError) {
            this.logger.addDebugInfo(`❌ Failed to initialize workflow for job ${newJob.wo_no}: ${workflowError.message}`);
          }
        }
        
        finalizedJobs.push(newJob);
        successful++;
      } catch (error: any) {
        console.error('❌ Error creating job:', error);
        this.logger.addDebugInfo(`❌ Failed to create job ${job.wo_no}: ${error.message}`);
        failed++;
      }
    }
    
    this.logger.addDebugInfo(`✅ Successfully finalized ${successful} jobs, ${failed} failed`);
    
    return {
      jobs: finalizedJobs,
      stats: {
        total: preparedResult.jobs.length,
        successful,
        failed,
      },
    };
  }
}
