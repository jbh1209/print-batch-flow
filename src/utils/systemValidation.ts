import { debugService } from '@/services/DebugService';
import { specificationUnificationService } from '@/services/SpecificationUnificationService';

interface ValidationResult {
  component: string;
  test: string;
  passed: boolean;
  message: string;
  data?: any;
}

class SystemValidation {
  async runSpecificationTests(jobId: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      // Test 1: Unified specification fetch
      const unifiedResult = await specificationUnificationService.getUnifiedSpecifications(jobId, 'production_jobs');
      
      results.push({
        component: 'SpecificationUnificationService',
        test: 'fetch_unified_specs',
        passed: !unifiedResult.error && unifiedResult.specifications.length >= 0,
        message: unifiedResult.error || `Successfully fetched ${unifiedResult.specifications.length} specifications`,
        data: { 
          paperDisplay: unifiedResult.paperDisplay,
          specsCount: unifiedResult.specifications.length,
          hasError: !!unifiedResult.error 
        }
      });

      // Test 2: Paper display format
      results.push({
        component: 'PaperDisplay',
        test: 'paper_display_format',
        passed: !!unifiedResult.paperDisplay && unifiedResult.paperDisplay !== 'N/A',
        message: unifiedResult.paperDisplay ? `Paper display: ${unifiedResult.paperDisplay}` : 'No paper display available',
        data: { paperDisplay: unifiedResult.paperDisplay }
      });

      // Test 3: Specification categories
      const expectedCategories = ['paper_type', 'paper_weight', 'size', 'lamination_type'];
      const availableCategories = unifiedResult.specifications.map(s => s.category);
      const missingCategories = expectedCategories.filter(cat => !availableCategories.includes(cat));
      
      results.push({
        component: 'SpecificationCategories',
        test: 'category_completeness',
        passed: missingCategories.length === 0,
        message: missingCategories.length === 0 
          ? 'All expected specification categories present' 
          : `Missing categories: ${missingCategories.join(', ')}`,
        data: { availableCategories, missingCategories }
      });

    } catch (error) {
      results.push({
        component: 'SpecificationUnificationService',
        test: 'fetch_unified_specs',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error: error?.toString() }
      });
    }

    return results;
  }

  async runParallelStageTests(jobId: string, jobStages: any[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      // Test 1: Stage data structure
      const jobSpecificStages = jobStages.filter(stage => stage.job_id === jobId);
      
      results.push({
        component: 'ParallelStages',
        test: 'stage_data_structure',
        passed: jobSpecificStages.length > 0,
        message: `Found ${jobSpecificStages.length} stages for job ${jobId}`,
        data: { 
          stageCount: jobSpecificStages.length,
          stageDetails: jobSpecificStages.map(s => ({
            stage_name: s.stage_name,
            status: s.status,
            stage_order: s.stage_order,
            part_assignment: s.part_assignment
          }))
        }
      });

      // Test 2: Stage progression logic
      const completedStages = jobSpecificStages.filter(s => s.status === 'completed');
      const activeStages = jobSpecificStages.filter(s => s.status === 'active');
      const pendingStages = jobSpecificStages.filter(s => s.status === 'pending');

      results.push({
        component: 'ParallelStages',
        test: 'stage_progression',
        passed: true, // This is informational
        message: `Stages: ${completedStages.length} completed, ${activeStages.length} active, ${pendingStages.length} pending`,
        data: {
          completed: completedStages.map(s => ({ name: s.stage_name, part: s.part_assignment })),
          active: activeStages.map(s => ({ name: s.stage_name, part: s.part_assignment })),
          pending: pendingStages.map(s => ({ name: s.stage_name, part: s.part_assignment }))
        }
      });

      // Test 3: Part assignment logic
      const hasPartAssignments = jobSpecificStages.some(s => s.part_assignment && s.part_assignment !== 'both');
      
      results.push({
        component: 'ParallelStages',
        test: 'part_assignment_logic',
        passed: true, // This is informational
        message: hasPartAssignments ? 'Job has part-specific assignments' : 'Job uses standard workflow',
        data: { 
          hasPartAssignments,
          partAssignments: [...new Set(jobSpecificStages.map(s => s.part_assignment).filter(Boolean))]
        }
      });

    } catch (error) {
      results.push({
        component: 'ParallelStages',
        test: 'stage_analysis',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error: error?.toString() }
      });
    }

    return results;
  }

  async runQuantityValidationTest(jobData: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      results.push({
        component: 'QuantityDisplay',
        test: 'quantity_field_validation',
        passed: typeof jobData.qty === 'number' && jobData.qty > 0,
        message: `Quantity: ${jobData.qty} (type: ${typeof jobData.qty})`,
        data: { 
          displayedQty: jobData.qty,
          qtyType: typeof jobData.qty,
          hasQty: !!jobData.qty
        }
      });

    } catch (error) {
      results.push({
        component: 'QuantityDisplay',
        test: 'quantity_field_validation',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error: error?.toString() }
      });
    }

    return results;
  }

  async runComprehensiveTest(jobId: string, jobStages: any[], jobData: any): Promise<ValidationResult[]> {
    debugService.log('SystemValidation', 'comprehensive_test_start', { jobId });

    const allResults: ValidationResult[] = [];
    
    // Run all test suites
    const specResults = await this.runSpecificationTests(jobId);
    const stageResults = await this.runParallelStageTests(jobId, jobStages);
    const qtyResults = await this.runQuantityValidationTest(jobData);

    allResults.push(...specResults, ...stageResults, ...qtyResults);

    // Log summary
    const passedTests = allResults.filter(r => r.passed).length;
    const totalTests = allResults.length;
    
    debugService.log('SystemValidation', 'comprehensive_test_complete', {
      jobId,
      passedTests,
      totalTests,
      successRate: `${Math.round((passedTests / totalTests) * 100)}%`
    });

    return allResults;
  }
}

export const systemValidation = new SystemValidation();