
import type { ExcelImportDebugger } from './debugger';
import type { RowMappingResult } from './types';

export interface EnhancedStageMapping {
  stageId: string;
  stageName: string;
  confidence: number;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper';
  specifications?: string;
}

export interface MappingStats {
  totalMappings: number;
  highConfidenceMappings: number;
  lowConfidenceMappings: number;
  unmappedRows: number;
}

export class EnhancedStageMapper {
  private productionStages: any[] = [];
  private stageSpecifications: any[] = [];

  constructor(private logger: ExcelImportDebugger) {}

  async initialize(availableSpecs: any[] = []): Promise<void> {
    this.logger.addDebugInfo('Initializing Enhanced Stage Mapper');
    // Mock initialization for now
    this.productionStages = [
      { id: 'printing-stage-id', name: 'Printing', category: 'printing' },
      { id: 'finishing-stage-id', name: 'Finishing', category: 'finishing' }
    ];
    this.stageSpecifications = availableSpecs;
  }

  async mapRowsToStages(
    excelRows: any[][],
    headers: string[],
    groupColumnIndex: number,
    descriptionColumnIndex: number,
    qtyColumnIndex: number,
    woQtyColumnIndex: number,
    woNo: string
  ): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo(`Mapping rows to stages for job: ${woNo}`);
    
    const mappings: RowMappingResult[] = [];
    
    for (let i = 0; i < excelRows.length; i++) {
      const row = excelRows[i];
      const groupName = String(row[groupColumnIndex] || '').trim();
      const description = String(row[descriptionColumnIndex] || '').trim();
      const qty = parseInt(String(row[qtyColumnIndex] || '0')) || 0;
      const woQty = parseInt(String(row[woQtyColumnIndex] || '0')) || 0;
      
      if (!groupName && !description) continue;
      
      const stageMapping = this.findBestStageMatch(groupName, description);
      
      mappings.push({
        groupName: groupName || description,
        description: description || groupName,
        qty,
        woQty,
        mappedStageId: stageMapping.stageId,
        mappedStageName: stageMapping.stageName,
        confidence: stageMapping.confidence,
        category: stageMapping.category,
        isUnmapped: stageMapping.confidence < 50,
        excelRowIndex: i,
        excelData: row,
        customRowId: `${woNo}_${i}`,
        instanceId: `${woNo}_${i}_${Date.now()}`,
        isCustomRow: false
      });
    }
    
    return mappings;
  }

  private findBestStageMatch(groupName: string, description: string): EnhancedStageMapping {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Simple pattern matching for now
    if (searchText.includes('print') || searchText.includes('hp') || searchText.includes('inkjet')) {
      return {
        stageId: 'printing-stage-id',
        stageName: 'Printing',
        confidence: 90,
        category: 'printing'
      };
    }
    
    if (searchText.includes('finish') || searchText.includes('cut') || searchText.includes('fold')) {
      return {
        stageId: 'finishing-stage-id',
        stageName: 'Finishing',
        confidence: 85,
        category: 'finishing'
      };
    }
    
    // Default fallback
    return {
      stageId: 'printing-stage-id',
      stageName: 'General Processing',
      confidence: 30,
      category: 'printing'
    };
  }

  getMappingStats(mappings: RowMappingResult[]): MappingStats {
    return {
      totalMappings: mappings.length,
      highConfidenceMappings: mappings.filter(m => m.confidence >= 70).length,
      lowConfidenceMappings: mappings.filter(m => m.confidence < 70 && m.confidence >= 50).length,
      unmappedRows: mappings.filter(m => m.isUnmapped).length
    };
  }
}

// Legacy functions for backward compatibility
export const mapDescriptionToStage = (description: string, availableStages: any[]): EnhancedStageMapping => {
  const searchText = description.toLowerCase();
  
  if (searchText.includes('print') || searchText.includes('hp') || searchText.includes('inkjet')) {
    return {
      stageId: 'printing-stage-id',
      stageName: 'Printing',
      confidence: 90,
      category: 'printing'
    };
  }
  
  return {
    stageId: 'printing-stage-id',
    stageName: 'General Processing',
    confidence: 30,
    category: 'printing'
  };
};

export const enhanceStageMapping = (
  mapping: EnhancedStageMapping,
  context: {
    jobCustomer?: string;
    jobReference?: string;
    rowData?: any[];
  }
): EnhancedStageMapping => {
  // Enhanced mapping logic here
  return {
    ...mapping,
    confidence: Math.min(mapping.confidence + 10, 100)
  };
};

// Fix for type errors - ensure arrays are joined to strings
export const formatArrayField = (field: any): string => {
  if (Array.isArray(field)) {
    return field.join(' ');
  }
  return String(field || '');
};
