
import { supabase } from "@/integrations/supabase/client";

export interface WorkflowDiagnostic {
  job_id: string;
  job_wo_no: string;
  category_id: string;
  category_name: string;
  expected_stages: number;
  actual_stages: number;
  missing_stages: Array<{
    stage_id: string;
    stage_name: string;
    stage_order: number;
  }>;
  current_active_stage?: string;
  issue_severity: 'critical' | 'moderate' | 'minor';
}

export interface DiagnosticSummary {
  total_jobs_analyzed: number;
  jobs_with_missing_stages: number;
  most_affected_categories: Array<{
    category_name: string;
    affected_jobs: number;
    missing_stage_patterns: string[];
  }>;
  missing_stage_frequency: Record<string, number>;
  repair_recommendations: string[];
}

export const runWorkflowDiagnostics = async (): Promise<{
  diagnostics: WorkflowDiagnostic[];
  summary: DiagnosticSummary;
}> => {
  console.log('🔍 Starting comprehensive workflow diagnostics...');

  try {
    // Step 1: Get all jobs with categories and their expected vs actual stages
    const { data: jobsWithCategories, error: jobsError } = await supabase
      .from('production_jobs')
      .select(`
        id,
        wo_no,
        category_id,
        categories (
          id,
          name,
          category_production_stages (
            production_stage_id,
            stage_order,
            production_stages (
              id,
              name,
              is_active
            )
          )
        )
      `)
      .not('category_id', 'is', null);

    if (jobsError) throw jobsError;

    // Step 2: Get all existing job stage instances
    const { data: existingStages, error: stagesError } = await supabase
      .from('job_stage_instances')
      .select(`
        job_id,
        production_stage_id,
        stage_order,
        status,
        production_stages (
          id,
          name
        )
      `)
      .eq('job_table_name', 'production_jobs');

    if (stagesError) throw stagesError;

    const diagnostics: WorkflowDiagnostic[] = [];
    const categoryIssues: Record<string, { count: number; missingStages: string[] }> = {};
    const stageFrequency: Record<string, number> = {};

    // Step 3: Analyze each job for missing stages
    for (const job of jobsWithCategories || []) {
      if (!job.categories) continue;

      const expectedStages = job.categories.category_production_stages
        .filter(cps => cps.production_stages?.is_active)
        .sort((a, b) => a.stage_order - b.stage_order);

      const jobStages = existingStages?.filter(stage => stage.job_id === job.id) || [];
      const existingStageIds = new Set(jobStages.map(stage => stage.production_stage_id));

      const missingStages = expectedStages.filter(
        stage => !existingStageIds.has(stage.production_stage_id)
      );

      if (missingStages.length > 0) {
        const activeStage = jobStages.find(stage => stage.status === 'active');
        
        const diagnostic: WorkflowDiagnostic = {
          job_id: job.id,
          job_wo_no: job.wo_no,
          category_id: job.category_id,
          category_name: job.categories.name,
          expected_stages: expectedStages.length,
          actual_stages: jobStages.length,
          missing_stages: missingStages.map(stage => ({
            stage_id: stage.production_stage_id,
            stage_name: stage.production_stages?.name || 'Unknown',
            stage_order: stage.stage_order
          })),
          current_active_stage: activeStage?.production_stages?.name,
          issue_severity: missingStages.length > expectedStages.length / 2 ? 'critical' : 
                         missingStages.length > 2 ? 'moderate' : 'minor'
        };

        diagnostics.push(diagnostic);

        // Track category issues
        const categoryKey = job.categories.name;
        if (!categoryIssues[categoryKey]) {
          categoryIssues[categoryKey] = { count: 0, missingStages: [] };
        }
        categoryIssues[categoryKey].count++;

        // Track missing stage frequency
        missingStages.forEach(stage => {
          const stageName = stage.production_stages?.name || 'Unknown';
          stageFrequency[stageName] = (stageFrequency[stageName] || 0) + 1;
          if (!categoryIssues[categoryKey].missingStages.includes(stageName)) {
            categoryIssues[categoryKey].missingStages.push(stageName);
          }
        });
      }
    }

    // Step 4: Generate summary and recommendations
    const mostAffectedCategories = Object.entries(categoryIssues)
      .map(([name, data]) => ({
        category_name: name,
        affected_jobs: data.count,
        missing_stage_patterns: data.missingStages
      }))
      .sort((a, b) => b.affected_jobs - a.affected_jobs);

    const recommendations = generateRepairRecommendations(diagnostics, stageFrequency);

    const summary: DiagnosticSummary = {
      total_jobs_analyzed: jobsWithCategories?.length || 0,
      jobs_with_missing_stages: diagnostics.length,
      most_affected_categories: mostAffectedCategories,
      missing_stage_frequency: stageFrequency,
      repair_recommendations: recommendations
    };

    console.log('✅ Diagnostic analysis complete:', {
      totalJobs: summary.total_jobs_analyzed,
      jobsWithIssues: summary.jobs_with_missing_stages,
      criticalIssues: diagnostics.filter(d => d.issue_severity === 'critical').length
    });

    return { diagnostics, summary };

  } catch (error) {
    console.error('❌ Diagnostic analysis failed:', error);
    throw error;
  }
};

const generateRepairRecommendations = (
  diagnostics: WorkflowDiagnostic[],
  stageFrequency: Record<string, number>
): string[] => {
  const recommendations: string[] = [];

  const criticalJobs = diagnostics.filter(d => d.issue_severity === 'critical').length;
  const moderateJobs = diagnostics.filter(d => d.issue_severity === 'moderate').length;

  if (criticalJobs > 0) {
    recommendations.push(`🚨 ${criticalJobs} jobs have critical missing stage issues (>50% stages missing)`);
  }

  if (moderateJobs > 0) {
    recommendations.push(`⚠️ ${moderateJobs} jobs have moderate missing stage issues`);
  }

  const topMissingStages = Object.entries(stageFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  if (topMissingStages.length > 0) {
    recommendations.push(`📊 Most frequently missing stages: ${topMissingStages.map(([stage, count]) => `${stage} (${count} jobs)`).join(', ')}`);
  }

  recommendations.push('🔧 Recommend immediate batch repair for all affected jobs');
  recommendations.push('🛡️ Implement workflow validation to prevent future issues');
  recommendations.push('📈 Set up monitoring for early detection of missing stages');

  return recommendations;
};

export const repairJobWorkflows = async (
  jobIds: string[],
  options: {
    batchSize?: number;
    logChanges?: boolean;
    validateBeforeCommit?: boolean;
  } = {}
): Promise<{
  success: boolean;
  repairedJobs: string[];
  errors: Array<{ jobId: string; error: string }>;
  changeLog: Array<{ jobId: string; action: string; details: any }>;
}> => {
  const { batchSize = 10, logChanges = true, validateBeforeCommit = true } = options;
  
  console.log('🔧 Starting batch workflow repair...', { 
    totalJobs: jobIds.length, 
    batchSize 
  });

  const repairedJobs: string[] = [];
  const errors: Array<{ jobId: string; error: string }> = [];
  const changeLog: Array<{ jobId: string; action: string; details: any }> = [];

  // Process in batches to avoid database locks
  for (let i = 0; i < jobIds.length; i += batchSize) {
    const batch = jobIds.slice(i, i + batchSize);
    console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(jobIds.length / batchSize)}`);

    for (const jobId of batch) {
      try {
        const result = await repairSingleJobWorkflow(jobId, { logChanges, validateBeforeCommit });
        
        if (result.success) {
          repairedJobs.push(jobId);
          if (logChanges && result.changes) {
            changeLog.push(...result.changes);
          }
        } else {
          errors.push({ jobId, error: result.error || 'Unknown repair error' });
        }

      } catch (error) {
        console.error(`❌ Failed to repair job ${jobId}:`, error);
        errors.push({ 
          jobId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // Small delay between batches to reduce database load
    if (i + batchSize < jobIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('✅ Batch repair complete:', {
    totalJobs: jobIds.length,
    repaired: repairedJobs.length,
    errors: errors.length
  });

  return {
    success: errors.length === 0,
    repairedJobs,
    errors,
    changeLog
  };
};

const repairSingleJobWorkflow = async (
  jobId: string,
  options: { logChanges: boolean; validateBeforeCommit: boolean }
): Promise<{
  success: boolean;
  error?: string;
  changes?: Array<{ jobId: string; action: string; details: any }>;
}> => {
  const changes: Array<{ jobId: string; action: string; details: any }> = [];

  try {
    // Get job details and category workflow
    const { data: job, error: jobError } = await supabase
      .from('production_jobs')
      .select(`
        id,
        wo_no,
        category_id,
        categories (
          id,
          name,
          category_production_stages (
            production_stage_id,
            stage_order,
            production_stages (
              id,
              name,
              is_active,
              is_multi_part,
              part_definitions
            )
          )
        )
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job?.categories) {
      return { success: false, error: 'Job or category not found' };
    }

    // Use the existing repair function
    const { error: repairError } = await supabase.rpc('initialize_job_stages_auto', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_category_id: job.category_id
    });

    if (repairError) {
      return { success: false, error: repairError.message };
    }

    if (options.logChanges) {
      changes.push({
        jobId,
        action: 'workflow_repaired',
        details: {
          wo_no: job.wo_no,
          category: job.categories.name,
          expected_stages: job.categories.category_production_stages.length
        }
      });
    }

    return { success: true, changes: options.logChanges ? changes : undefined };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};
