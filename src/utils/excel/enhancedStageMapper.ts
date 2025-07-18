
import type { ExcelImportDebugger } from './debugger';
import type { ParsedJob } from './types';

export interface StageMapping {
  stageId: string;
  stageName: string;
  stageSpecId?: string;
  stageSpecName?: string;
  confidence: number;
  specifications: string[];
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging';
  instanceId?: string;
  quantity?: number;
  paperSpecification?: string;
}

export interface RowMappingResult {
  excelRowIndex: number;
  excelData: any[];
  groupName: string;
  description: string;
  qty: number;
  woQty: number;
  mappedStageId: string | null;
  mappedStageName: string | null;
  mappedStageSpecId: string | null;
  mappedStageSpecName: string | null;
  confidence: number;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper' | 'unknown';
  manualOverride?: boolean;
  isUnmapped: boolean;
  instanceId?: string;
  paperSpecification?: string;
  isManualMapping?: boolean;
}

export interface PrintingOperation {
  rowIndex: number;
  groupName: string;
  spec: {
    description: string;
    qty: number;
    wo_qty: number;
  };
  sourceJobId?: string;
}

export interface EnhancedStageMapperResult {
  mappedRows: RowMappingResult[];
  unmappedRows: RowMappingResult[];
  printingOperations: RowMappingResult[];
  stats: {
    totalRows: number;
    mappedRows: number;
    printingOperations: number;
    unmappedRows: number;
  };
}

export class EnhancedStageMapper {
  constructor(
    private logger: ExcelImportDebugger,
    private availableStages: any[] = [],
    private userApprovedMappings: StageMapping[] = []
  ) {}

  async initialize(): Promise<void> {
    this.logger.addDebugInfo(`🎯 EnhancedStageMapper initialized with ${this.availableStages.length} stages and ${this.userApprovedMappings.length} user mappings`);
  }

  /**
   * SIMPLIFIED: Map jobs directly to stages using job quantities
   */
  async mapJobsToStages(
    jobs: ParsedJob[],
    headers: string[],
    excelRows: any[][],
    startRowIndex: number = 0
  ): Promise<EnhancedStageMapperResult> {
    this.logger.addDebugInfo(`🎯 SIMPLIFIED MAPPING: Processing ${jobs.length} jobs`);
    
    const mappedRows: RowMappingResult[] = [];
    const unmappedRows: RowMappingResult[] = [];
    const printingOperations: RowMappingResult[] = [];

    // Process each job and map to stages
    jobs.forEach((job, index) => {
      const rowIndex = startRowIndex + index;
      
      this.logger.addDebugInfo(`🎯 Processing job ${index}: WO ${job.wo_no}, Qty: ${job.qty}`);
      
      // Create basic row mapping using job data directly
      const baseMapping: RowMappingResult = {
        excelRowIndex: rowIndex,
        excelData: excelRows[rowIndex] || [],
        groupName: job.wo_no || 'Unknown',
        description: job.reference || job.customer || '',
        qty: job.qty || 0, // Use job quantity directly - NO Excel re-extraction
        woQty: job.qty || 0,
        mappedStageId: null,
        mappedStageName: null,
        mappedStageSpecId: null,
        mappedStageSpecName: null,
        confidence: 0,
        category: 'unknown',
        isUnmapped: true
      };

      // Check for user-approved stage mappings
      const userMapping = this.userApprovedMappings.find(mapping => 
        mapping.category === 'prepress'
      );

      if (userMapping) {
        baseMapping.mappedStageId = userMapping.stageId;
        baseMapping.mappedStageName = userMapping.stageName;
        baseMapping.category = userMapping.category as any;
        baseMapping.confidence = 1.0;
        baseMapping.isUnmapped = false;
        baseMapping.isManualMapping = true;
        
        this.logger.addDebugInfo(`🎯 Applied user mapping for ${job.wo_no}: ${userMapping.stageName}`);
        mappedRows.push(baseMapping);
      } else {
        // Auto-detect stage based on job properties
        const autoMapping = this.detectStageFromJob(job);
        if (autoMapping) {
          baseMapping.mappedStageId = autoMapping.stageId;
          baseMapping.mappedStageName = autoMapping.stageName;
          baseMapping.category = autoMapping.category;
          baseMapping.confidence = autoMapping.confidence;
          baseMapping.isUnmapped = false;
          
          this.logger.addDebugInfo(`🎯 Auto-mapped ${job.wo_no} to: ${autoMapping.stageName}`);
          mappedRows.push(baseMapping);
        } else {
          this.logger.addDebugInfo(`🎯 No mapping found for ${job.wo_no}`);
          unmappedRows.push(baseMapping);
        }
      }

      // Handle printing operations - look for print specifications
      if (job.paper_type || job.specifications) {
        const printingMapping: RowMappingResult = {
          ...baseMapping,
          groupName: `${job.wo_no}_printing`,
          description: `Printing: ${job.paper_type || job.specifications || 'Standard'}`,
          category: 'printing'
        };

        // Try to map to printing stage
        const printingStageMapping = this.detectPrintingStage(job);
        if (printingStageMapping) {
          printingMapping.mappedStageId = printingStageMapping.stageId;
          printingMapping.mappedStageName = printingStageMapping.stageName;
          printingMapping.category = printingStageMapping.category;
          printingMapping.confidence = printingStageMapping.confidence;
          printingMapping.isUnmapped = false;
          
          this.logger.addDebugInfo(`🎯 Mapped printing operation for ${job.wo_no}: ${printingStageMapping.stageName}, Qty: ${printingMapping.qty}`);
          printingOperations.push(printingMapping);
        }
      }
    });

    const stats = {
      totalRows: jobs.length,
      mappedRows: mappedRows.length,
      printingOperations: printingOperations.length,
      unmappedRows: unmappedRows.length
    };

    this.logger.addDebugInfo(`🎯 SIMPLIFIED MAPPING COMPLETE: ${stats.mappedRows} mapped, ${stats.printingOperations} printing ops, ${stats.unmappedRows} unmapped`);

    return {
      mappedRows,
      unmappedRows,
      printingOperations,
      stats
    };
  }

  /**
   * Detect stage from job properties
   */
  private detectStageFromJob(job: ParsedJob): StageMapping | null {
    // Simple stage detection based on job status or category
    if (job.status) {
      const status = job.status.toLowerCase();
      
      // Find matching stage
      const matchingStage = this.availableStages.find(stage => 
        stage.name.toLowerCase().includes(status) ||
        status.includes(stage.name.toLowerCase())
      );
      
      if (matchingStage) {
        return {
          stageId: matchingStage.id,
          stageName: matchingStage.name,
          category: 'prepress' as any,
          confidence: 0.7,
          specifications: []
        };
      }
    }
    
    return null;
  }

  /**
   * Detect printing stage from job specifications
   */
  private detectPrintingStage(job: ParsedJob): StageMapping | null {
    // Look for printing-related stages
    const printingStage = this.availableStages.find(stage => 
      stage.name.toLowerCase().includes('print') ||
      stage.name.toLowerCase().includes('digital') ||
      stage.name.toLowerCase().includes('offset')
    );
    
    if (printingStage) {
      return {
        stageId: printingStage.id,
        stageName: printingStage.name,
        category: 'printing',
        confidence: 0.8,
        specifications: []
      };
    }
    
    return null;
  }

  /**
   * INTELLIGENT MAPPING - Maps groups to stages with user-approved mappings
   */
  mapGroupsToStagesIntelligent(
    printingSpecs: any,
    finishingSpecs: any,
    prepressSpecs: any,
    userApprovedMappings?: any[],
    paperSpecs?: any,
    packagingSpecs?: any,
    deliverySpecs?: any
  ): StageMapping[] {
    this.logger.addDebugInfo(`🎯 INTELLIGENT MAPPING: Processing specifications`);
    
    const mappedStages: StageMapping[] = [];
    
    // Process each specification group and map to stages
    [printingSpecs, finishingSpecs, prepressSpecs, paperSpecs, packagingSpecs, deliverySpecs]
      .filter(specs => specs)
      .forEach((specs, index) => {
        const categories = ['printing', 'finishing', 'prepress', 'paper', 'packaging', 'delivery'];
        const category = categories[index];
        
        if (specs.groupName) {
          // Check for user-approved mapping first
          const userMapping = userApprovedMappings?.find(mapping => 
            mapping.groupName === specs.groupName
          );
          
          if (userMapping) {
            mappedStages.push({
              stageId: userMapping.mappedStageId,
              stageName: userMapping.mappedStageName,
              category: userMapping.category as any,
              confidence: 1.0,
              specifications: []
            });
          } else {
            // Auto-detect stage
            const autoMapping = this.findStageByCategory(category);
            if (autoMapping) {
              mappedStages.push(autoMapping);
            }
          }
        }
      });
    
    return mappedStages;
  }

  /**
   * INTELLIGENT ROW MAPPINGS - Creates detailed row mappings for UI
   */
  createIntelligentRowMappings(
    printingSpecs: any,
    finishingSpecs: any,
    prepressSpecs: any,
    excelRows?: any[][],
    headers?: string[],
    paperSpecs?: any,
    packagingSpecs?: any,
    deliverySpecs?: any
  ): RowMappingResult[] {
    this.logger.addDebugInfo(`🎯 CREATING INTELLIGENT ROW MAPPINGS`);
    
    const rowMappings: RowMappingResult[] = [];
    
    // Process each specification and create row mapping
    [printingSpecs, finishingSpecs, prepressSpecs, paperSpecs, packagingSpecs, deliverySpecs]
      .filter(specs => specs)
      .forEach((specs, index) => {
        const categories = ['printing', 'finishing', 'prepress', 'paper', 'packaging', 'delivery'];
        const category = categories[index];
        
        if (specs.groupName) {
          const mapping: RowMappingResult = {
            excelRowIndex: 0,
            excelData: excelRows?.[0] || [],
            groupName: specs.groupName,
            description: specs.description || '',
            qty: specs.qty || 0,
            woQty: specs.qty || 0,
            mappedStageId: null,
            mappedStageName: null,
            mappedStageSpecId: null,
            mappedStageSpecName: null,
            confidence: 0,
            category: category as any,
            isUnmapped: true
          };
          
          // Try to find matching stage
          const stageMapping = this.findStageByCategory(category);
          if (stageMapping) {
            mapping.mappedStageId = stageMapping.stageId;
            mapping.mappedStageName = stageMapping.stageName;
            mapping.confidence = stageMapping.confidence;
            mapping.isUnmapped = false;
          }
          
          rowMappings.push(mapping);
        }
      });
    
    return rowMappings;
  }

  /**
   * Find stage by category
   */
  private findStageByCategory(category: string): StageMapping | null {
    const matchingStage = this.availableStages.find(stage => 
      stage.name.toLowerCase().includes(category) ||
      category.includes(stage.name.toLowerCase())
    );
    
    if (matchingStage) {
      return {
        stageId: matchingStage.id,
        stageName: matchingStage.name,
        category: category as any,
        confidence: 0.8,
        specifications: []
      };
    }
    
    return null;
  }

  /**
   * LEGACY METHOD - kept for compatibility but simplified
   */
  async processSpecificationGroups(
    consolidatedSpecs: any[],
    headers: string[],
    excelRows: any[][],
    startRowIndex: number
  ): Promise<EnhancedStageMapperResult> {
    this.logger.addDebugInfo(`🎯 LEGACY processSpecificationGroups called - redirecting to simplified mapping`);
    
    // Convert consolidated specs to ParsedJob format
    const jobs: ParsedJob[] = consolidatedSpecs.map((spec, index) => ({
      wo_no: spec.wo_no || spec.groupName || `JOB_${index}`,
      customer: spec.customer || '',
      reference: spec.description || '',
      qty: spec.qty || 0, // Use spec quantity directly
      status: 'Pre-Press',
      date: null,
      due_date: null,
      rep: '',
      category: '',
      location: '',
      estimated_hours: null,
      setup_time_minutes: null,
      running_speed: null,
      speed_unit: null,
      specifications: spec.description,
      paper_weight: null,
      paper_type: null,
      lamination: null
    }));
    
    return this.mapJobsToStages(jobs, headers, excelRows, startRowIndex);
  }
}
