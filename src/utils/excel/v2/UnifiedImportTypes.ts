/**
 * Phase 2: Interface Standardization & Clean Conversion
 * Unified type definitions that both v2 and legacy systems use
 */

// Core stage instance definition with complete type safety
export interface UnifiedStageInstance {
  stageId: string;
  stageName: string;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery';
  quantity: number;
  partName?: string;
  partType?: 'text' | 'cover';
  stageSpecId?: string;
  stageSpecName?: string;
  paperSpec?: string;
  isValid: boolean;
  errorReason?: string;
}

// Job result with complete null safety
export interface UnifiedJobResult {
  woNo: string;
  jobData: {
    wo_no: string;
    customer?: string;
    reference?: string;
    date?: string;
    due_date?: string;
    rep?: string;
    category?: string;
    location?: string;
    qty?: number;
    status?: string;
    [key: string]: any;
  };
  stageInstances: UnifiedStageInstance[];
  errors: string[];
  success: boolean;
  processingContext: {
    architecture: 'v2' | 'legacy';
    timestamp: string;
    version: string;
  };
}

// Import result with comprehensive stats
export interface UnifiedImportResult {
  jobs: UnifiedJobResult[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    totalStages: number;
    printingStages: number;
    finishingStages: number;
    prepressStages: number;
    deliveryStages: number;
  };
  errors: string[];
  debugInfo: string[];
  metadata: {
    processingTime: number;
    excelFileName?: string;
    totalRows: number;
    architecture: 'v2' | 'legacy';
  };
}

// Row mapping for dialog compatibility
export interface UnifiedRowMapping {
  excelRowIndex: number;
  excelData: any[];
  groupName: string;
  description: string;
  qty: number;
  woQty: number;
  mappedStageId: string | null;
  mappedStageName: string | null;
  mappedStageSpecId?: string | null;
  mappedStageSpecName?: string | null;
  confidence: number;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery';
  manualOverride: boolean;
  isUnmapped: boolean;
  instanceId: string;
  paperSpecification?: string | null;
  partType?: 'text' | 'cover' | null;
}

// Category assignment for workflow management
export interface UnifiedCategoryAssignment {
  categoryId: string | null;
  categoryName: string | null;
  confidence: number;
  isManual: boolean;
  mappedStages: {
    stageName: string;
    stageId: string;
    confidence: number;
  }[];
  requiresCustomWorkflow: boolean;
}

// Complete enhanced job creation result for dialog
export interface UnifiedEnhancedJobCreationResult {
  success: boolean;
  createdJobs: UnifiedJobResult[];
  failedJobs: UnifiedJobResult[];
  categoryAssignments: { [woNo: string]: UnifiedCategoryAssignment };
  rowMappings: { [woNo: string]: UnifiedRowMapping[] };
  stats: {
    total: number;
    successful: number;
    failed: number;
    newCategories: number;
    workflowsInitialized: number;
  };
}

// Conversion helpers for legacy compatibility
export class UnifiedTypeConverter {
  /**
   * Convert v2 SimplifiedImportResult to UnifiedImportResult
   */
  static fromV2Result(v2Result: any): UnifiedImportResult {
    if (!v2Result || typeof v2Result !== 'object') {
      return this.createEmptyResult('v2');
    }

    const jobs: UnifiedJobResult[] = [];
    const safeJobs = Array.isArray(v2Result.jobs) ? v2Result.jobs : [];

    for (const job of safeJobs) {
      if (!job || typeof job !== 'object') continue;

      const stageInstances: UnifiedStageInstance[] = [];
      const safeStages = Array.isArray(job.stageInstances) ? job.stageInstances : [];

      for (const stage of safeStages) {
        if (!stage || typeof stage !== 'object') continue;

        stageInstances.push({
          stageId: String(stage.stageId || ''),
          stageName: String(stage.stageName || 'Unknown Stage'),
          category: this.validateCategory(stage.category) ? stage.category : 'printing',
          quantity: Number(stage.quantity) || 0,
          partName: stage.partName ? String(stage.partName) : undefined,
          partType: this.validatePartType(stage.partType) ? stage.partType : undefined,
          stageSpecId: stage.stageSpecId ? String(stage.stageSpecId) : undefined,
          stageSpecName: stage.stageSpecName ? String(stage.stageSpecName) : undefined,
          paperSpec: stage.paperSpec ? String(stage.paperSpec) : undefined,
          isValid: Boolean(stage.isValid),
          errorReason: stage.errorReason ? String(stage.errorReason) : undefined
        });
      }

      jobs.push({
        woNo: String(job.woNo || job.jobData?.wo_no || 'Unknown'),
        jobData: this.sanitizeJobData(job.jobData),
        stageInstances,
        errors: Array.isArray(job.errors) ? job.errors.map(String) : [],
        success: Boolean(job.success),
        processingContext: {
          architecture: 'v2',
          timestamp: new Date().toISOString(),
          version: '2.0'
        }
      });
    }

    const stats = v2Result.stats || {};
    return {
      jobs,
      stats: {
        total: Number(stats.total) || 0,
        successful: Number(stats.successful) || 0,
        failed: Number(stats.failed) || 0,
        totalStages: Number(stats.totalStages) || 0,
        printingStages: Number(stats.printingStages) || 0,
        finishingStages: Number(stats.finishingStages) || 0,
        prepressStages: Number(stats.prepressStages) || 0,
        deliveryStages: Number(stats.deliveryStages) || 0
      },
      errors: Array.isArray(v2Result.errors) ? v2Result.errors.map(String) : [],
      debugInfo: Array.isArray(v2Result.debugInfo) ? v2Result.debugInfo.map(String) : [],
      metadata: {
        processingTime: Date.now(),
        totalRows: Number(stats.total) || 0,
        architecture: 'v2'
      }
    };
  }

  /**
   * Convert UnifiedImportResult to EnhancedJobCreationResult for dialog
   */
  static toEnhancedJobCreationResult(unifiedResult: UnifiedImportResult): UnifiedEnhancedJobCreationResult {
    const successfulJobs = unifiedResult.jobs.filter(job => job.success);
    const failedJobs = unifiedResult.jobs.filter(job => !job.success);

    // Create category assignments
    const categoryAssignments: { [woNo: string]: UnifiedCategoryAssignment } = {};
    for (const job of successfulJobs) {
      categoryAssignments[job.woNo] = {
        categoryId: job.jobData.category || 'general',
        categoryName: job.jobData.category || 'General Production',
        confidence: 100,
        isManual: false,
        mappedStages: job.stageInstances.map(stage => ({
          stageName: stage.stageName,
          stageId: stage.stageId,
          confidence: stage.isValid ? 100 : 50
        })),
        requiresCustomWorkflow: false
      };
    }

    // Create row mappings
    const rowMappings: { [woNo: string]: UnifiedRowMapping[] } = {};
    for (const job of successfulJobs) {
      rowMappings[job.woNo] = job.stageInstances.map((stage, index) => ({
        excelRowIndex: index,
        excelData: [],
        groupName: stage.partType || 'Main',
        description: stage.stageName,
        qty: stage.quantity,
        woQty: stage.quantity,
        mappedStageId: stage.stageId,
        mappedStageName: stage.stageName,
        mappedStageSpecId: stage.stageSpecId || null,
        mappedStageSpecName: stage.stageSpecName || null,
        confidence: stage.isValid ? 100 : 50,
        category: stage.category,
        manualOverride: false,
        isUnmapped: !stage.isValid,
        instanceId: `${job.woNo}-${index}`,
        paperSpecification: stage.paperSpec || null,
        partType: stage.partType || null
      }));
    }

    return {
      success: unifiedResult.stats.successful > 0,
      createdJobs: successfulJobs,
      failedJobs: failedJobs,
      categoryAssignments,
      rowMappings,
      stats: {
        total: unifiedResult.stats.total,
        successful: unifiedResult.stats.successful,
        failed: unifiedResult.stats.failed,
        newCategories: 0,
        workflowsInitialized: unifiedResult.stats.successful
      }
    };
  }

  private static createEmptyResult(architecture: 'v2' | 'legacy'): UnifiedImportResult {
    return {
      jobs: [],
      stats: {
        total: 0,
        successful: 0,
        failed: 0,
        totalStages: 0,
        printingStages: 0,
        finishingStages: 0,
        prepressStages: 0,
        deliveryStages: 0
      },
      errors: ['Invalid or empty result data'],
      debugInfo: [],
      metadata: {
        processingTime: Date.now(),
        totalRows: 0,
        architecture
      }
    };
  }

  private static sanitizeJobData(jobData: any): any {
    if (!jobData || typeof jobData !== 'object') {
      return { wo_no: 'Unknown' };
    }

    return {
      wo_no: String(jobData.wo_no || 'Unknown'),
      customer: jobData.customer ? String(jobData.customer) : undefined,
      reference: jobData.reference ? String(jobData.reference) : undefined,
      date: jobData.date ? String(jobData.date) : undefined,
      due_date: jobData.due_date ? String(jobData.due_date) : undefined,
      rep: jobData.rep ? String(jobData.rep) : undefined,
      category: jobData.category ? String(jobData.category) : undefined,
      location: jobData.location ? String(jobData.location) : undefined,
      qty: jobData.qty ? Number(jobData.qty) : undefined,
      status: jobData.status ? String(jobData.status) : undefined,
      ...jobData
    };
  }

  private static validateCategory(category: any): category is 'printing' | 'finishing' | 'prepress' | 'delivery' {
    return typeof category === 'string' && 
           ['printing', 'finishing', 'prepress', 'delivery'].includes(category);
  }

  private static validatePartType(partType: any): partType is 'text' | 'cover' {
    return typeof partType === 'string' && 
           ['text', 'cover'].includes(partType);
  }
}