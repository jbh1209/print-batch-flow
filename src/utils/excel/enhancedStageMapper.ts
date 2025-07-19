
import type { ParsedJob, RowMappingResult } from './types';
import type { ExcelImportDebugger } from './debugger';

interface StageSpecification {
  id: string;
  name: string;
  production_stage_id: string;
}

interface ProductionStage {
  id: string;
  name: string;
  category: string;
  stage_specifications?: StageSpecification[];
}

export interface EnhancedStageMapping {
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

export class EnhancedStageMapper {
  private productionStages: ProductionStage[] = [];
  private logger: ExcelImportDebugger;
  
  constructor(logger: ExcelImportDebugger) {
    this.logger = logger;
  }
  
  async initialize() {
    // Initialize with production stages from database
    // This would typically load from Supabase
    this.logger.addDebugInfo("EnhancedStageMapper initialized");
  }
  
  async mapJobToStages(job: ParsedJob, excelHeaders: string[], excelRows: any[][]): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo(`🎯 ENHANCED STAGE MAPPING for WO: ${job.wo_no}`);
    
    const rowMappings: RowMappingResult[] = [];
    
    // Map printing specifications with FIXED quantity extraction
    if (job.printing_specifications) {
      this.logger.addDebugInfo(`📝 PROCESSING PRINTING SPECS:`);
      Object.entries(job.printing_specifications).forEach(([key, spec]) => {
        this.logger.addDebugInfo(`   - Spec "${key}": qty=${spec.qty}, wo_qty=${spec.wo_qty}, desc="${spec.description}"`);
        
        // CRITICAL FIX: Use the quantities from the spec, with proper fallbacks
        const actualQty = spec.qty || spec.wo_qty || 0;
        const actualWoQty = spec.wo_qty || spec.qty || 0;
        
        this.logger.addDebugInfo(`   ✅ QUANTITIES RESOLVED: actualQty=${actualQty}, actualWoQty=${actualWoQty}`);
        
        const mapping: RowMappingResult = {
          excelRowIndex: this.findRowIndexInExcel(spec.description || key, excelRows),
          excelData: this.findRowDataInExcel(spec.description || key, excelRows),
          groupName: key,
          description: spec.description || key,
          qty: actualQty, // FIXED: Use resolved quantity
          woQty: actualWoQty, // FIXED: Use resolved WO quantity
          mappedStageId: null,
          mappedStageName: null,
          mappedStageSpecId: null,
          mappedStageSpecName: null,
          confidence: 0,
          category: 'printing',
          isUnmapped: true,
          instanceId: `printing-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };
        
        this.logger.addDebugInfo(`🎯 CREATED ROW MAPPING: "${mapping.description}" with qty=${mapping.qty}, woQty=${mapping.woQty}`);
        rowMappings.push(mapping);
      });
    }
    
    // Map other specifications (finishing, prepress, etc.) with same fix
    const specCategories = [
      { specs: job.finishing_specifications, category: 'finishing' as const },
      { specs: job.prepress_specifications, category: 'prepress' as const },
      { specs: job.delivery_specifications, category: 'delivery' as const },
      { specs: job.packaging_specifications, category: 'packaging' as const }
    ];
    
    specCategories.forEach(({ specs, category }) => {
      if (specs) {
        Object.entries(specs).forEach(([key, spec]) => {
          // CRITICAL FIX: Apply same quantity resolution logic
          const actualQty = spec.qty || spec.wo_qty || 0;
          const actualWoQty = spec.wo_qty || spec.qty || 0;
          
          const mapping: RowMappingResult = {
            excelRowIndex: this.findRowIndexInExcel(spec.description || key, excelRows),
            excelData: this.findRowDataInExcel(spec.description || key, excelRows),
            groupName: key,
            description: spec.description || key,
            qty: actualQty, // FIXED: Use resolved quantity
            woQty: actualWoQty, // FIXED: Use resolved WO quantity
            mappedStageId: null,
            mappedStageName: null,
            mappedStageSpecId: null,
            mappedStageSpecName: null,
            confidence: 0,
            category,
            isUnmapped: true,
            instanceId: `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
          };
          
          rowMappings.push(mapping);
        });
      }
    });
    
    this.logger.addDebugInfo(`🏁 ENHANCED STAGE MAPPING COMPLETE: ${rowMappings.length} row mappings created`);
    rowMappings.forEach((mapping, i) => {
      this.logger.addDebugInfo(`   ${i + 1}. "${mapping.description}" [${mapping.category}] - Qty: ${mapping.qty}, WO_Qty: ${mapping.woQty}`);
    });
    
    return rowMappings;
  }
  
  private findRowIndexInExcel(description: string, excelRows: any[][]): number {
    // Find the row index in Excel data that matches this description
    for (let i = 0; i < excelRows.length; i++) {
      const rowText = excelRows[i].join(' ').toLowerCase();
      if (rowText.includes(description.toLowerCase())) {
        return i;
      }
    }
    return -1;
  }
  
  private findRowDataInExcel(description: string, excelRows: any[][]): any[] {
    const rowIndex = this.findRowIndexInExcel(description, excelRows);
    return rowIndex !== -1 ? excelRows[rowIndex] : [];
  }
}
