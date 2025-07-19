
import type { ExcelImportDebugger } from './debugger';

export interface ProductionStageMapping {
  stageId: string;
  stageName: string;
  confidence: number;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper';
  specifications?: string;
}

export class ProductionStageMapper {
  private stages: any[] = [];
  
  constructor(private logger: ExcelImportDebugger) {}

  async initialize(availableStages: any[] = []): Promise<void> {
    this.logger.addDebugInfo('ProductionStageMapper: Initializing with available stages');
    this.stages = availableStages;
  }

  mapTextToStage(text: string, context?: any): ProductionStageMapping {
    const searchText = text.toLowerCase().trim();
    
    // Enhanced pattern matching
    if (searchText.includes('print') || searchText.includes('printing')) {
      return {
        stageId: 'printing-stage-id',
        stageName: 'Printing',
        confidence: 95,
        category: 'printing'
      };
    }
    
    if (searchText.includes('finish') || searchText.includes('cutting') || searchText.includes('folding')) {
      return {
        stageId: 'finishing-stage-id', 
        stageName: 'Finishing',
        confidence: 90,
        category: 'finishing'
      };
    }
    
    if (searchText.includes('prepress') || searchText.includes('design') || searchText.includes('setup')) {
      return {
        stageId: 'prepress-stage-id',
        stageName: 'Pre-Press',
        confidence: 85,
        category: 'prepress'
      };
    }
    
    if (searchText.includes('deliver') || searchText.includes('shipping') || searchText.includes('dispatch')) {
      return {
        stageId: 'delivery-stage-id',
        stageName: 'Delivery',
        confidence: 88,
        category: 'delivery'
      };
    }
    
    if (searchText.includes('pack') || searchText.includes('boxing')) {
      return {
        stageId: 'packaging-stage-id',
        stageName: 'Packaging', 
        confidence: 82,
        category: 'packaging'
      };
    }
    
    if (searchText.includes('paper') || searchText.includes('material')) {
      return {
        stageId: 'paper-stage-id',
        stageName: 'Paper Selection',
        confidence: 80,
        category: 'paper'
      };
    }
    
    // Default fallback - changed from 'unknown' to 'printing'
    return {
      stageId: 'general-stage-id',
      stageName: 'General Processing',
      confidence: 25,
      category: 'printing' // Fixed: removed 'unknown' category
    };
  }

  findSimilarStages(text: string, threshold: number = 70): ProductionStageMapping[] {
    const results: ProductionStageMapping[] = [];
    const searchText = text.toLowerCase();
    
    // Simple similarity check
    const keywords = ['print', 'finish', 'cut', 'fold', 'deliver', 'pack'];
    
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        const mapping = this.mapTextToStage(keyword);
        if (mapping.confidence >= threshold) {
          results.push(mapping);
        }
      }
    }
    
    return results;
  }

  // Fix for array to string conversion
  private formatField(field: any): string {
    if (Array.isArray(field)) {
      return field.join(' ');
    }
    return String(field || '');
  }
}

// Utility functions
export const createStageMapping = (
  stageId: string,
  stageName: string,
  confidence: number,
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper'
): ProductionStageMapping => {
  return {
    stageId,
    stageName,
    confidence,
    category
  };
};

export const validateStageMapping = (mapping: ProductionStageMapping): boolean => {
  return (
    mapping.stageId.length > 0 &&
    mapping.stageName.length > 0 &&
    mapping.confidence >= 0 &&
    mapping.confidence <= 100 &&
    ['printing', 'finishing', 'prepress', 'delivery', 'packaging', 'paper'].includes(mapping.category)
  );
};

// Category assignment result for enhanced job creation
export interface CategoryAssignmentResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
  stageMappings: ProductionStageMapping[];
}
