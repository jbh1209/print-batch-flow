
import { supabase } from "@/integrations/supabase/client";

export interface WorkflowDiagnostic {
  job_id: string;
  job_wo_no: string;
  job_table_name: string;
  category_id: string | null;
  category_name: string | null;
  has_custom_workflow: boolean;
  expected_stages: number;
  actual_stages: number;
  missing_stages: Array<{
    stage_id: string;
    stage_name: string;
    stage_order: number;
    supports_parts: boolean;
    expected_parts?: string[];
  }>;
  orphaned_stages: Array<{
    stage_id: string;
    stage_name: string;
    reason: string;
  }>;
  current_stage_info?: {
    stage_id: string;
    stage_name: string;
    status: string;
    started_by?: string;
  };
  workflow_progress: {
    total_stages: number;
    completed_stages: number;
    active_stages: number;
    pending_stages: number;
  };
  issue_severity: 'critical' | 'high' | 'moderate' | 'minor';
  recommendations: string[];
}

export interface DiagnosticSummary {
  total_jobs_analyzed: number;
  jobs_with_issues: number;
  jobs_without_category: number;
  jobs_with_custom_workflows: number;
  jobs_with_missing_stages: number;
  jobs_with_orphaned_stages: number;
  most_affected_categories: Array<{
    category_name: string;
    affected_jobs: number;
    common_issues: string[];
  }>;
  stage_issue_frequency: Record<string, number>;
  repair_candidates: {
    auto_repairable: number;
    manual_intervention_needed: number;
    category_assignment_needed: number;
  };
  system_health_score: number;
}

export const runComprehensiveWorkflowDiagnostics = async (): Promise<{
  diagnostics: WorkflowDiagnostic[];
  summary: DiagnosticSummary;
}> => {
  console.log('🔍 Starting comprehensive workflow diagnostics v2.0...');

  try {
    // Step 1: Get all production jobs with their current workflow state
    const { data: allJobs, error: jobsError } = await supabase
      .from('production_jobs')
      .select(`
        id,
        wo_no,
        category_id,
        has_custom_workflow,
        status,
        created_at,
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
              supports_parts
            )
          )
        )
      `);

    if (jobsError) throw jobsError;

    // Step 2: Get all existing job stage instances
    const { data: allStageInstances, error: stagesError } = await supabase
      .from('job_stage_instances')
      .select(`
        job_id,
        job_table_name,
        production_stage_id,
        stage_order,
        status,
        part_name,
        category_id,
        production_stages (
          id,
          name,
          supports_parts
        )
      `)
      .eq('job_table_name', 'production_jobs');

    if (stagesError) throw stagesError;

    const diagnostics: WorkflowDiagnostic[] = [];
    const categoryIssues: Record<string, Set<string>> = {};
    const stageIssueFrequency: Record<string, number> = {};

    // Step 3: Analyze each job comprehensively
    for (const job of allJobs || []) {
      const jobStages = allStageInstances?.filter(stage => stage.job_id === job.id) || [];
      const diagnostic = analyzeJobWorkflow(job, jobStages);
      
      if (diagnostic.issue_severity !== 'minor' || diagnostic.missing_stages.length > 0 || diagnostic.orphaned_stages.length > 0) {
        diagnostics.push(diagnostic);
        
        // Track category issues
        const categoryKey = diagnostic.category_name || 'No Category';
        if (!categoryIssues[categoryKey]) {
          categoryIssues[categoryKey] = new Set();
        }
        
        diagnostic.missing_stages.forEach(stage => {
          categoryIssues[categoryKey].add(`Missing: ${stage.stage_name}`);
          stageIssueFrequency[stage.stage_name] = (stageIssueFrequency[stage.stage_name] || 0) + 1;
        });
        
        diagnostic.orphaned_stages.forEach(stage => {
          categoryIssues[categoryKey].add(`Orphaned: ${stage.stage_name}`);
        });
      }
    }

    // Step 4: Generate comprehensive summary
    const summary = generateDiagnosticSummary(allJobs || [], diagnostics, categoryIssues, stageIssueFrequency);

    console.log('✅ Comprehensive diagnostic analysis complete:', {
      totalJobs: summary.total_jobs_analyzed,
      jobsWithIssues: summary.jobs_with_issues,
      systemHealthScore: summary.system_health_score
    });

    return { diagnostics, summary };

  } catch (error) {
    console.error('❌ Comprehensive diagnostic analysis failed:', error);
    throw error;
  }
};

const analyzeJobWorkflow = (job: any, jobStages: any[]): WorkflowDiagnostic => {
  const diagnostic: WorkflowDiagnostic = {
    job_id: job.id,
    job_wo_no: job.wo_no,
    job_table_name: 'production_jobs',
    category_id: job.category_id,
    category_name: job.categories?.name || null,
    has_custom_workflow: job.has_custom_workflow || false,
    expected_stages: 0,
    actual_stages: jobStages.length,
    missing_stages: [],
    orphaned_stages: [],
    workflow_progress: {
      total_stages: jobStages.length,
      completed_stages: jobStages.filter(s => s.status === 'completed').length,
      active_stages: jobStages.filter(s => s.status === 'active').length,
      pending_stages: jobStages.filter(s => s.status === 'pending').length
    },
    issue_severity: 'minor',
    recommendations: []
  };

  // Handle jobs without categories
  if (!job.category_id && !job.has_custom_workflow) {
    diagnostic.issue_severity = 'high';
    diagnostic.recommendations.push('Assign a category to establish proper workflow');
    return diagnostic;
  }

  // Handle custom workflow jobs
  if (job.has_custom_workflow) {
    return analyzeCustomWorkflowJob(diagnostic, jobStages);
  }

  // Handle category-based workflow jobs
  if (job.categories) {
    return analyzeCategoryWorkflowJob(diagnostic, job, jobStages);
  }

  return diagnostic;
};

const analyzeCustomWorkflowJob = (diagnostic: WorkflowDiagnostic, jobStages: any[]): WorkflowDiagnostic => {
  // For custom workflows, we mainly check for workflow integrity
  if (jobStages.length === 0) {
    diagnostic.issue_severity = 'critical';
    diagnostic.recommendations.push('Custom workflow has no stages - needs manual workflow setup');
    return diagnostic;
  }

  // Check for active stage consistency
  const activeStages = jobStages.filter(s => s.status === 'active');
  if (activeStages.length > 1) {
    diagnostic.issue_severity = 'moderate';
    diagnostic.recommendations.push('Multiple active stages detected - workflow state inconsistent');
  }

  // Check for orphaned stages (stages not in any category)
  jobStages.forEach(stage => {
    if (!stage.category_id && !stage.production_stages) {
      diagnostic.orphaned_stages.push({
        stage_id: stage.production_stage_id,
        stage_name: 'Unknown Stage',
        reason: 'Stage reference is broken'
      });
    }
  });

  if (diagnostic.orphaned_stages.length > 0) {
    diagnostic.issue_severity = 'high';
    diagnostic.recommendations.push('Remove or fix orphaned stage references');
  }

  return diagnostic;
};

const analyzeCategoryWorkflowJob = (diagnostic: WorkflowDiagnostic, job: any, jobStages: any[]): WorkflowDiagnostic => {
  const expectedStages = job.categories.category_production_stages
    .filter((cps: any) => cps.production_stages?.is_active)
    .sort((a: any, b: any) => a.stage_order - b.stage_order);

  diagnostic.expected_stages = expectedStages.length;

  if (expectedStages.length === 0) {
    diagnostic.issue_severity = 'high';
    diagnostic.recommendations.push('Category has no active stages configured');
    return diagnostic;
  }

  // Check for missing stages
  const existingStageIds = new Set(jobStages.map(stage => stage.production_stage_id));
  
  expectedStages.forEach((expectedStage: any) => {
    if (!existingStageIds.has(expectedStage.production_stage_id)) {
      const stage = expectedStage.production_stages;
      diagnostic.missing_stages.push({
        stage_id: expectedStage.production_stage_id,
        stage_name: stage.name,
        stage_order: expectedStage.stage_order,
        supports_parts: stage.supports_parts,
        expected_parts: stage.supports_parts ? [] : undefined
      });
    }
  });

  // Check for orphaned stages (stages that shouldn't be there)
  const expectedStageIds = new Set(expectedStages.map((es: any) => es.production_stage_id));
  
  jobStages.forEach(stage => {
    if (!expectedStageIds.has(stage.production_stage_id)) {
      diagnostic.orphaned_stages.push({
        stage_id: stage.production_stage_id,
        stage_name: stage.production_stages?.name || 'Unknown',
        reason: 'Stage not in category workflow definition'
      });
    }
  });

  // Set current stage info
  const activeStage = jobStages.find(s => s.status === 'active');
  if (activeStage) {
    diagnostic.current_stage_info = {
      stage_id: activeStage.production_stage_id,
      stage_name: activeStage.production_stages?.name || 'Unknown',
      status: activeStage.status,
      started_by: activeStage.started_by
    };
  }

  // Determine severity and recommendations
  const missingCount = diagnostic.missing_stages.length;
  const orphanedCount = diagnostic.orphaned_stages.length;
  const totalIssues = missingCount + orphanedCount;

  if (totalIssues === 0) {
    diagnostic.issue_severity = 'minor';
  } else if (missingCount > expectedStages.length / 2) {
    diagnostic.issue_severity = 'critical';
    diagnostic.recommendations.push('Most workflow stages are missing - complete workflow repair needed');
  } else if (totalIssues > 2) {
    diagnostic.issue_severity = 'high';
    diagnostic.recommendations.push('Multiple workflow issues detected - comprehensive repair recommended');
  } else {
    diagnostic.issue_severity = 'moderate';
    diagnostic.recommendations.push('Minor workflow inconsistencies - targeted repair recommended');
  }

  if (missingCount > 0) {
    diagnostic.recommendations.push(`Add ${missingCount} missing workflow stage${missingCount > 1 ? 's' : ''}`);
  }
  
  if (orphanedCount > 0) {
    diagnostic.recommendations.push(`Remove ${orphanedCount} orphaned stage${orphanedCount > 1 ? 's' : ''}`);
  }

  return diagnostic;
};

const generateDiagnosticSummary = (
  allJobs: any[],
  diagnostics: WorkflowDiagnostic[],
  categoryIssues: Record<string, Set<string>>,
  stageIssueFrequency: Record<string, number>
): DiagnosticSummary => {
  const customWorkflowJobs = allJobs.filter(job => job.has_custom_workflow).length;
  const jobsWithoutCategory = allJobs.filter(job => !job.category_id).length;
  
  const repairCandidates = {
    auto_repairable: diagnostics.filter(d => 
      d.issue_severity === 'moderate' && 
      d.missing_stages.length > 0 && 
      d.orphaned_stages.length === 0 &&
      d.category_id
    ).length,
    manual_intervention_needed: diagnostics.filter(d => 
      d.issue_severity === 'critical' || 
      d.orphaned_stages.length > 0 ||
      d.has_custom_workflow
    ).length,
    category_assignment_needed: diagnostics.filter(d => !d.category_id && !d.has_custom_workflow).length
  };

  const mostAffectedCategories = Object.entries(categoryIssues)
    .map(([categoryName, issues]) => ({
      category_name: categoryName,
      affected_jobs: diagnostics.filter(d => d.category_name === categoryName || (!d.category_name && categoryName === 'No Category')).length,
      common_issues: Array.from(issues)
    }))
    .sort((a, b) => b.affected_jobs - a.affected_jobs);

  const systemHealthScore = Math.max(0, Math.round(
    ((allJobs.length - diagnostics.length) / Math.max(allJobs.length, 1)) * 100
  ));

  return {
    total_jobs_analyzed: allJobs.length,
    jobs_with_issues: diagnostics.length,
    jobs_without_category: jobsWithoutCategory,
    jobs_with_custom_workflows: customWorkflowJobs,
    jobs_with_missing_stages: diagnostics.filter(d => d.missing_stages.length > 0).length,
    jobs_with_orphaned_stages: diagnostics.filter(d => d.orphaned_stages.length > 0).length,
    most_affected_categories: mostAffectedCategories,
    stage_issue_frequency: stageIssueFrequency,
    repair_candidates: repairCandidates,
    system_health_score: systemHealthScore
  };
};

export const executeComprehensiveWorkflowRepair = async (
  diagnostics: WorkflowDiagnostic[],
  options: {
    repairMissingStages?: boolean;
    removeOrphanedStages?: boolean;
    batchSize?: number;
    dryRun?: boolean;
  } = {}
): Promise<{
  success: boolean;
  results: {
    repaired_jobs: string[];
    failed_repairs: Array<{ job_id: string; error: string }>;
    skipped_jobs: Array<{ job_id: string; reason: string }>;
  };
  summary: {
    total_processed: number;
    successful_repairs: number;
    failed_repairs: number;
    skipped_repairs: number;
  };
}> => {
  const { 
    repairMissingStages = true, 
    removeOrphanedStages = false, 
    batchSize = 10,
    dryRun = false 
  } = options;

  console.log('🔧 Starting comprehensive workflow repair...', { 
    totalJobs: diagnostics.length, 
    repairMissingStages,
    removeOrphanedStages,
    dryRun
  });

  const results = {
    repaired_jobs: [] as string[],
    failed_repairs: [] as Array<{ job_id: string; error: string }>,
    skipped_jobs: [] as Array<{ job_id: string; reason: string }>
  };

  // Process diagnostics in batches
  for (let i = 0; i < diagnostics.length; i += batchSize) {
    const batch = diagnostics.slice(i, i + batchSize);
    console.log(`🔄 Processing repair batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(diagnostics.length / batchSize)}`);

    for (const diagnostic of batch) {
      try {
        const repairResult = await repairJobWorkflow(diagnostic, {
          repairMissingStages,
          removeOrphanedStages,
          dryRun
        });

        if (repairResult.success) {
          results.repaired_jobs.push(diagnostic.job_id);
        } else if (repairResult.skipped) {
          results.skipped_jobs.push({
            job_id: diagnostic.job_id,
            reason: repairResult.reason || 'Unknown reason'
          });
        } else {
          results.failed_repairs.push({
            job_id: diagnostic.job_id,
            error: repairResult.error || 'Unknown error'
          });
        }

      } catch (error) {
        console.error(`❌ Failed to repair job ${diagnostic.job_wo_no}:`, error);
        results.failed_repairs.push({
          job_id: diagnostic.job_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Small delay between batches to reduce database load
    if (i + batchSize < diagnostics.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const summary = {
    total_processed: diagnostics.length,
    successful_repairs: results.repaired_jobs.length,
    failed_repairs: results.failed_repairs.length,
    skipped_repairs: results.skipped_jobs.length
  };

  console.log('✅ Comprehensive repair complete:', summary);

  return {
    success: results.failed_repairs.length === 0,
    results,
    summary
  };
};

const repairJobWorkflow = async (
  diagnostic: WorkflowDiagnostic,
  options: {
    repairMissingStages: boolean;
    removeOrphanedStages: boolean;
    dryRun: boolean;
  }
): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}> => {
  // Skip jobs that need manual intervention
  if (diagnostic.issue_severity === 'critical' && diagnostic.has_custom_workflow) {
    return { success: false, skipped: true, reason: 'Custom workflow needs manual review' };
  }

  if (!diagnostic.category_id && !diagnostic.has_custom_workflow) {
    return { success: false, skipped: true, reason: 'Job needs category assignment first' };
  }

  if (options.dryRun) {
    console.log(`🔍 DRY RUN: Would repair job ${diagnostic.job_wo_no}`);
    return { success: true };
  }

  try {
    // For category-based workflows, use the standard repair function
    if (diagnostic.category_id && options.repairMissingStages) {
      const { error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: diagnostic.job_id,
        p_job_table_name: diagnostic.job_table_name,
        p_category_id: diagnostic.category_id
      });

      if (error) {
        return { success: false, error: error.message };
      }
    }

    // Remove orphaned stages if requested
    if (options.removeOrphanedStages && diagnostic.orphaned_stages.length > 0) {
      const orphanedStageIds = diagnostic.orphaned_stages.map(s => s.stage_id);
      
      const { error } = await supabase
        .from('job_stage_instances')
        .delete()
        .eq('job_id', diagnostic.job_id)
        .eq('job_table_name', diagnostic.job_table_name)
        .in('production_stage_id', orphanedStageIds);

      if (error) {
        console.warn(`⚠️ Failed to remove orphaned stages for job ${diagnostic.job_wo_no}:`, error);
      }
    }

    return { success: true };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown repair error' 
    };
  }
};
