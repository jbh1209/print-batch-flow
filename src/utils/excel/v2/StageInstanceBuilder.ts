import { ExcelImportDebugger } from "../debugger";
import { DetectedOperation } from "./SimpleStageDetector";
import { MappingRepository } from "./MappingRepository";
import { PaperSpecHandler } from "./PaperSpecHandler";
import { SafeObjectUtils, ExcelErrorHandler, ExcelDataValidator } from "./SafeObjectUtils";

export interface StageInstance {
  stageId: string;
  stageName: string;
  stageSpecId?: string;
  stageSpecName?: string;
  category: string;
  quantity: number;
  partName?: string;
  partType?: string;
  paperSpecification?: string;
  excelRowIndex: number;
  confidence: number;
  isValid: boolean;
  errorReason?: string;
}

export class StageInstanceBuilder {
  private mappingRepo: MappingRepository;
  private paperHandler: PaperSpecHandler;
  private logger: ExcelImportDebugger;

  constructor(mappingRepo: MappingRepository, paperHandler: PaperSpecHandler, logger: ExcelImportDebugger) {
    this.mappingRepo = mappingRepo;
    this.paperHandler = paperHandler;
    this.logger = logger;
  }

  /**
   * Build stage instances from detected operations with comprehensive null safety
   */
  async buildStageInstances(operations: DetectedOperation[]): Promise<StageInstance[]> {
    this.logger.addDebugInfo("=== BUILDING STAGE INSTANCES ===");
    
    if (!Array.isArray(operations)) {
      this.logger.addDebugInfo("⚠️ No operations provided or invalid operations array");
      return [];
    }
    
    const instances: StageInstance[] = [];

    for (const operation of operations) {
      if (!operation || typeof operation !== 'object') {
        this.logger.addDebugInfo("⚠️ Skipping invalid operation");
        continue;
      }

      const groupName = String(operation.groupName || 'Unknown');
      const category = operation.category || 'printing';
      
      this.logger.addDebugInfo(`Building instance for: ${groupName} (${category})`);
      
      try {
        // Find exact mapping in database with null safety
        const mapping = this.mappingRepo.findExactMapping(groupName);
        
        if (!mapping || !mapping.production_stage_id) {
          this.logger.addDebugInfo(`  ❌ No stage mapping found for "${groupName}"`);
          
          instances.push({
            stageId: '',
            stageName: `UNMAPPED: ${groupName}`,
            category: category,
            quantity: Number(operation.qty) || 0,
            partType: operation.partType || undefined,
            excelRowIndex: Number(operation.excelRowIndex) || 0,
            confidence: 0,
            isValid: false,
            errorReason: 'No stage mapping found'
          });
          continue;
        }

        // Get stage details with null safety
        const stage = this.mappingRepo.getStage(mapping.production_stage_id);
        if (!stage || !stage.id) {
          this.logger.addDebugInfo(`  ❌ Stage not found: ${mapping.production_stage_id}`);
          
          instances.push({
            stageId: '',
            stageName: `INVALID STAGE: ${groupName}`,
            category: category,
            quantity: Number(operation.qty) || 0,
            partType: operation.partType || undefined,
            excelRowIndex: Number(operation.excelRowIndex) || 0,
            confidence: 0,
            isValid: false,
            errorReason: 'Stage not found in database'
          });
          continue;
        }

        // Get stage specification if available with null safety
        let stageSpec = null;
        if (mapping.stage_specification_id) {
          try {
            stageSpec = this.mappingRepo.getSpecification(mapping.stage_specification_id);
          } catch (specError) {
            this.logger.addDebugInfo(`  ⚠️ Error getting specification: ${specError}`);
          }
        }

        // Generate part name for printing stages with null safety
        let partName: string | undefined;
        if (category === 'printing' && operation.partType) {
          const partTypeName = operation.partType === 'text' ? 'Text' : 'Cover';
          partName = `${stage.name || 'Unknown Stage'} (${partTypeName})`;
        }

        // Get paper specification with null safety
        let paperSpec: string | undefined;
        try {
          paperSpec = this.paperHandler.getPaperSpecification(groupName) || undefined;
        } catch (paperError) {
          this.logger.addDebugInfo(`  ⚠️ Error getting paper specification: ${paperError}`);
        }

        const instance: StageInstance = {
          stageId: stage.id,
          stageName: stage.name || 'Unknown Stage',
          stageSpecId: stageSpec?.id || undefined,
          stageSpecName: stageSpec?.name || undefined,
          category: category,
          quantity: Number(operation.qty) || 0,
          partName,
          partType: operation.partType || undefined,
          paperSpecification: paperSpec,
          excelRowIndex: Number(operation.excelRowIndex) || 0,
          confidence: Number(mapping.confidence_score) || 0,
          isValid: true
        };

        instances.push(instance);
        
        this.logger.addDebugInfo(`  ✅ Created instance: ${stage.name}${partName ? ` (${operation.partType})` : ''} - qty: ${operation.qty}`);
        
      } catch (operationError) {
        this.logger.addDebugInfo(`  ❌ Error processing operation for "${groupName}": ${operationError}`);
        
        instances.push({
          stageId: '',
          stageName: `ERROR: ${groupName}`,
          category: category,
          quantity: Number(operation.qty) || 0,
          partType: operation.partType || undefined,
          excelRowIndex: Number(operation.excelRowIndex) || 0,
          confidence: 0,
          isValid: false,
          errorReason: `Processing error: ${operationError instanceof Error ? operationError.message : 'Unknown error'}`
        });
      }
    }

    const validInstances = instances.filter(i => i.isValid);
    const invalidInstances = instances.filter(i => !i.isValid);
    
    this.logger.addDebugInfo(`=== BUILD COMPLETE: ${validInstances.length} valid, ${invalidInstances.length} invalid ===`);
    
    return instances;
  }

  /**
   * Get instances grouped by category with null safety
   */
  getInstancesByCategory(instances: StageInstance[]): Record<string, StageInstance[]> {
    if (!Array.isArray(instances)) {
      this.logger.addDebugInfo("⚠️ getInstancesByCategory called with invalid instances array");
      return {};
    }
    
    const grouped: Record<string, StageInstance[]> = {};
    
    for (const instance of instances) {
      if (!instance || typeof instance !== 'object' || !instance.category) {
        this.logger.addDebugInfo("⚠️ Skipping invalid instance in getInstancesByCategory");
        continue;
      }
      
      const category = String(instance.category);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(instance);
    }
    
    return grouped;
  }

  /**
   * Get only valid instances with null safety
   */
  getValidInstances(instances: StageInstance[]): StageInstance[] {
    if (!Array.isArray(instances)) {
      this.logger.addDebugInfo("⚠️ getValidInstances called with invalid instances array");
      return [];
    }
    return instances.filter(instance => instance && typeof instance === 'object' && instance.isValid);
  }

  /**
   * Get only invalid instances for error reporting with null safety
   */
  getInvalidInstances(instances: StageInstance[]): StageInstance[] {
    if (!Array.isArray(instances)) {
      this.logger.addDebugInfo("⚠️ getInvalidInstances called with invalid instances array");
      return [];
    }
    return instances.filter(instance => instance && typeof instance === 'object' && !instance.isValid);
  }
}