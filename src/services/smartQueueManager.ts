import { supabase } from "@/integrations/supabase/client";
import { AccessibleJobWithMasterQueue } from "@/types/masterQueue";

export interface QueuedJob extends AccessibleJobWithMasterQueue {
  priority_score: number;
  batch_compatibility_score: number;
  urgency_factor: number;
  material_group: string;
}

export interface SmartQueue {
  id: string;
  name: string;
  stage_id: string;
  jobs: QueuedJob[];
  total_capacity: number;
  current_load: number;
  estimated_completion_hours: number;
  bottleneck_risk: 'low' | 'medium' | 'high';
}

export interface BatchOptimizationSuggestion {
  suggested_jobs: QueuedJob[];
  efficiency_score: number;
  material_savings: number;
  time_savings_hours: number;
  priority_alignment: number;
  lamination_type?: string;
  reasoning: string[];
}

interface ProductionJobBase {
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date: string;
  reference: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export class SmartQueueManager {
  
  /**
   * Get intelligent queues organized by production stage
   */
  static async getSmartQueues(): Promise<SmartQueue[]> {
    try {
      console.log('🔄 Fetching smart queues...');
      
      // Get all production jobs with their current stage instances
      const { data: jobs, error } = await supabase
        .from('production_jobs')
        .select(`
          id,
          wo_no,
          customer,
          status,
          due_date,
          reference,
          category_id,
          categories:category_id (name, color)
        `)
        .neq('status', 'completed');

      if (error) throw error;

      // Get current stage for each job
      const jobsWithStages = await Promise.all((jobs || []).map(async (job: any) => {
        const { data: currentStage } = await supabase
          .from('job_stage_instances')
          .select(`
            production_stage_id,
            status,
            production_stages:production_stage_id (id, name, color)
          `)
          .eq('job_id', job.id)
          .eq('job_table_name', 'production_jobs')
          .eq('status', 'active')
          .single();

        return {
          ...job,
          current_stage: currentStage
        };
      }));

      // Convert to AccessibleJobWithMasterQueue format
      const formattedJobs = jobsWithStages.map((job: any) => ({
        job_id: job.id,
        wo_no: job.wo_no,
        customer: job.customer,
        status: job.status,
        due_date: job.due_date,
        reference: job.reference || '',
        category_id: job.category_id || '',
        category_name: job.categories?.name || 'Production',
        category_color: job.categories?.color || '#3B82F6',
        current_stage_id: job.current_stage?.production_stages?.id || 'pre-press',
        current_stage_name: job.current_stage?.production_stages?.name || 'Pre-Press',
        current_stage_color: job.current_stage?.production_stages?.color || '#3B82F6',
        current_stage_status: job.current_stage?.status || 'pending',
        user_can_view: true,
        user_can_edit: true,
        user_can_work: true,
        user_can_manage: true,
        workflow_progress: 1,
        total_stages: 5,
        completed_stages: 0,
        master_queue_id: job.category_id || '',
        display_stage_name: job.current_stage?.production_stages?.name || 'Pre-Press'
      })) as AccessibleJobWithMasterQueue[];

      const stageGroups = this.groupJobsByStage(formattedJobs);
      const smartQueues: SmartQueue[] = [];

      for (const [stageId, stageJobs] of Object.entries(stageGroups)) {
        const queue = await this.createSmartQueue(stageId, stageJobs);
        smartQueues.push(queue);
      }

      console.log('✅ Smart queues created:', smartQueues.length);
      return smartQueues.sort((a, b) => b.bottleneck_risk === 'high' ? 1 : -1);
      
    } catch (error) {
      console.error('❌ Error creating smart queues:', error);
      throw error;
    }
  }

  /**
   * Get batch optimization suggestions for a specific queue
   */
  static async getBatchSuggestions(
    queueId: string, 
    maxBatchSize: number = 10
  ): Promise<BatchOptimizationSuggestion[]> {
    try {
      console.log('🔄 Generating batch suggestions for queue:', queueId);
      
      const queues = await this.getSmartQueues();
      const targetQueue = queues.find(q => q.id === queueId);
      
      if (!targetQueue || targetQueue.jobs.length < 2) {
        return [];
      }

      const suggestions = this.optimizeBatches(targetQueue.jobs, maxBatchSize);
      
      console.log('✅ Generated batch suggestions:', suggestions.length);
      return suggestions;
      
    } catch (error) {
      console.error('❌ Error generating batch suggestions:', error);
      throw error;
    }
  }

  /**
   * Get lamination-specific queues
   */
  static async getLaminationQueues(): Promise<Record<string, QueuedJob[]>> {
    try {
      console.log('🔄 Fetching lamination queues...');
      
      // Get production jobs
      const { data: jobs, error } = await supabase
        .from('production_jobs')
        .select(`
          id,
          wo_no,
          customer,
          status,
          due_date,
          reference,
          category_id
        `)
        .neq('status', 'completed');

      if (error) throw error;

      const laminationQueues: Record<string, QueuedJob[]> = {
        'gloss': [],
        'matt': [],
        'soft_touch': [],
        'none': []
      };

      // Organize jobs by lamination type
      for (const job of jobs || []) {
        const formattedJob: AccessibleJobWithMasterQueue = {
          job_id: job.id,
          wo_no: job.wo_no,
          customer: job.customer,
          status: job.status,
          due_date: job.due_date,
          reference: job.reference || '',
          category_id: job.category_id || '',
          category_name: 'Production',
          category_color: '#10B981',
          current_stage_id: 'lamination',
          current_stage_name: 'Lamination',
          current_stage_color: '#10B981',
          current_stage_status: 'active',
          user_can_view: true,
          user_can_edit: true,
          user_can_work: true,
          user_can_manage: true,
          workflow_progress: 3,
          total_stages: 5,
          completed_stages: 2,
          master_queue_id: job.category_id || '',
          display_stage_name: 'Lamination'
        };

        const scoredJob = this.calculateJobScores(formattedJob);
        const laminationType = await this.getLaminationType(formattedJob.job_id);
        
        if (laminationQueues[laminationType]) {
          laminationQueues[laminationType].push(scoredJob);
        } else {
          laminationQueues['none'].push(scoredJob);
        }
      }

      // Sort each queue by priority
      Object.keys(laminationQueues).forEach(type => {
        laminationQueues[type].sort((a, b) => b.priority_score - a.priority_score);
      });

      console.log('✅ Lamination queues organized');
      return laminationQueues;
      
    } catch (error) {
      console.error('❌ Error organizing lamination queues:', error);
      throw error;
    }
  }

  private static groupJobsByStage(jobs: AccessibleJobWithMasterQueue[]): Record<string, AccessibleJobWithMasterQueue[]> {
    return jobs.reduce((groups, job) => {
      const stageId = job.current_stage_id;
      if (!groups[stageId]) {
        groups[stageId] = [];
      }
      groups[stageId].push(job);
      return groups;
    }, {} as Record<string, AccessibleJobWithMasterQueue[]>);
  }

  private static async createSmartQueue(stageId: string, jobs: AccessibleJobWithMasterQueue[]): Promise<SmartQueue> {
    const scoredJobs = jobs.map(job => this.calculateJobScores(job));
    const sortedJobs = scoredJobs.sort((a, b) => b.priority_score - a.priority_score);
    
    const totalEstimatedHours = sortedJobs.reduce((sum, job) => sum + (job.workflow_progress * 8), 0);
    const bottleneckRisk = this.calculateBottleneckRisk(sortedJobs.length, totalEstimatedHours);
    
    return {
      id: stageId,
      name: jobs[0]?.current_stage_name || 'Unknown Stage',
      stage_id: stageId,
      jobs: sortedJobs,
      total_capacity: 40, // 8 hours * 5 days default capacity
      current_load: totalEstimatedHours,
      estimated_completion_hours: totalEstimatedHours,
      bottleneck_risk: bottleneckRisk
    };
  }

  private static calculateJobScores(job: AccessibleJobWithMasterQueue): QueuedJob {
    const now = new Date();
    const dueDate = new Date(job.due_date);
    const daysUntilDue = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate urgency factor (higher score = more urgent)
    const urgency_factor = daysUntilDue <= 1 ? 100 : 
                          daysUntilDue <= 3 ? 80 : 
                          daysUntilDue <= 7 ? 60 : 40;
    
    // Calculate priority score based on multiple factors
    const workflow_bonus = (job.workflow_progress / job.total_stages) * 20;
    const priority_score = urgency_factor + workflow_bonus;
    
    // Batch compatibility score (jobs with similar characteristics batch better)
    const batch_compatibility_score = this.calculateBatchCompatibility(job);
    
    return {
      ...job,
      priority_score,
      batch_compatibility_score,
      urgency_factor,
      material_group: this.determineMaterialGroup(job)
    };
  }

  private static calculateBatchCompatibility(job: AccessibleJobWithMasterQueue): number {
    // Base score - all jobs have some batching potential
    let score = 50;
    
    // Boost for common categories
    if (job.category_name.toLowerCase().includes('business card')) score += 30;
    if (job.category_name.toLowerCase().includes('flyer')) score += 25;
    if (job.category_name.toLowerCase().includes('postcard')) score += 25;
    
    return Math.min(100, score);
  }

  private static determineMaterialGroup(job: AccessibleJobWithMasterQueue): string {
    const category = job.category_name.toLowerCase();
    
    if (category.includes('business card')) return 'business_cards';
    if (category.includes('flyer')) return 'flyers';
    if (category.includes('postcard')) return 'postcards';
    if (category.includes('poster')) return 'large_format';
    
    return 'general';
  }

  private static calculateBottleneckRisk(jobCount: number, totalHours: number): 'low' | 'medium' | 'high' {
    if (jobCount > 15 || totalHours > 60) return 'high';
    if (jobCount > 8 || totalHours > 30) return 'medium';
    return 'low';
  }

  private static optimizeBatches(jobs: QueuedJob[], maxBatchSize: number): BatchOptimizationSuggestion[] {
    const suggestions: BatchOptimizationSuggestion[] = [];
    
    // Group by material type for better batching
    const materialGroups = this.groupJobsByMaterial(jobs);
    
    Object.entries(materialGroups).forEach(([materialType, materialJobs]) => {
      if (materialJobs.length >= 2) {
        const batches = this.createOptimalBatches(materialJobs, maxBatchSize);
        suggestions.push(...batches);
      }
    });
    
    return suggestions.sort((a, b) => b.efficiency_score - a.efficiency_score);
  }

  private static groupJobsByMaterial(jobs: QueuedJob[]): Record<string, QueuedJob[]> {
    return jobs.reduce((groups, job) => {
      const material = job.material_group;
      if (!groups[material]) {
        groups[material] = [];
      }
      groups[material].push(job);
      return groups;
    }, {} as Record<string, QueuedJob[]>);
  }

  private static createOptimalBatches(jobs: QueuedJob[], maxBatchSize: number): BatchOptimizationSuggestion[] {
    const suggestions: BatchOptimizationSuggestion[] = [];
    
    // Sort by urgency and compatibility
    const sortedJobs = [...jobs].sort((a, b) => 
      (b.urgency_factor + b.batch_compatibility_score) - (a.urgency_factor + a.batch_compatibility_score)
    );
    
    for (let i = 0; i < sortedJobs.length; i += maxBatchSize) {
      const batchJobs = sortedJobs.slice(i, i + maxBatchSize);
      
      if (batchJobs.length >= 2) {
        const suggestion = this.createBatchSuggestion(batchJobs);
        suggestions.push(suggestion);
      }
    }
    
    return suggestions;
  }

  private static createBatchSuggestion(jobs: QueuedJob[]): BatchOptimizationSuggestion {
    const avgUrgency = jobs.reduce((sum, job) => sum + job.urgency_factor, 0) / jobs.length;
    const avgCompatibility = jobs.reduce((sum, job) => sum + job.batch_compatibility_score, 0) / jobs.length;
    
    const efficiency_score = (avgUrgency + avgCompatibility) / 2;
    const material_savings = jobs.length * 0.15; // 15% material savings per job in batch
    const time_savings_hours = jobs.length * 0.5; // 30 minutes setup time savings per job
    
    const reasoning = [
      `Batch of ${jobs.length} similar jobs`,
      `Average urgency: ${Math.round(avgUrgency)}%`,
      `Material group: ${jobs[0].material_group}`,
      `Estimated ${Math.round(material_savings * 100)}% material savings`,
      `Setup time reduction: ${time_savings_hours} hours`
    ];
    
    return {
      suggested_jobs: jobs,
      efficiency_score: Math.round(efficiency_score),
      material_savings: Math.round(material_savings * 100),
      time_savings_hours: Math.round(time_savings_hours * 10) / 10,
      priority_alignment: Math.round(avgUrgency),
      reasoning
    };
  }

  private static async getLaminationType(jobId: string): Promise<string> {
    try {
      // Check job specifications for lamination type
      const { data: specs } = await supabase
        .from('job_print_specifications')
        .select('specification_id, print_specifications(name)')
        .eq('job_id', jobId)
        .eq('specification_category', 'finishing');
      
      if (specs && specs.length > 0) {
        const laminationSpec = specs.find(spec => 
          spec.print_specifications?.name?.toLowerCase().includes('lamination')
        );
        
        if (laminationSpec?.print_specifications?.name) {
          const name = laminationSpec.print_specifications.name.toLowerCase();
          if (name.includes('gloss')) return 'gloss';
          if (name.includes('matt')) return 'matt';
          if (name.includes('soft')) return 'soft_touch';
        }
      }
      
      return 'none';
    } catch (error) {
      console.error('Error getting lamination type:', error);
      return 'none';
    }
  }
}