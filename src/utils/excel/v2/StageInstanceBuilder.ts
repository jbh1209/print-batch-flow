import { ExcelImportDebugger } from "../debugger";
import { DetectedOperation } from "./SimpleStageDetector";
import { MappingRepository } from "./MappingRepository";
import { PaperSpecHandler } from "./PaperSpecHandler";

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
   * Build stage instances from detected operations
   */
  async buildStageInstances(operations: DetectedOperation[]): Promise<StageInstance[]> {
    this.logger.addDebugInfo("=== BUILDING STAGE INSTANCES ===");
    
    const instances: StageInstance[] = [];

    for (const operation of operations) {
      this.logger.addDebugInfo(`Building instance for: ${operation.groupName} (${operation.category})`);
      
      // Find exact mapping in database
      const mapping = this.mappingRepo.findExactMapping(operation.groupName);
      
      if (!mapping || !mapping.production_stage_id) {
        this.logger.addDebugInfo(`  ❌ No stage mapping found for "${operation.groupName}"`);
        
        instances.push({
          stageId: '',
          stageName: `UNMAPPED: ${operation.groupName}`,
          category: operation.category,
          quantity: operation.qty,
          partType: operation.partType,
          excelRowIndex: operation.excelRowIndex,
          confidence: 0,
          isValid: false,
          errorReason: 'No stage mapping found'
        });
        continue;
      }

      // Get stage details
      const stage = this.mappingRepo.getStage(mapping.production_stage_id);
      if (!stage) {
        this.logger.addDebugInfo(`  ❌ Stage not found: ${mapping.production_stage_id}`);
        continue;
      }

      // Get stage specification if available
      let stageSpec = null;
      if (mapping.stage_specification_id) {
        stageSpec = this.mappingRepo.getSpecification(mapping.stage_specification_id);
      }

      // Generate part name for printing stages
      let partName: string | undefined;
      if (operation.category === 'printing' && operation.partType) {
        partName = `${stage.name} (${operation.partType === 'text' ? 'Text' : 'Cover'})`;
      }

      // Get paper specification
      const paperSpec = this.paperHandler.getPaperSpecification(operation.groupName);

      const instance: StageInstance = {
        stageId: stage.id,
        stageName: stage.name,
        stageSpecId: stageSpec?.id,
        stageSpecName: stageSpec?.name,
        category: operation.category,
        quantity: operation.qty,
        partName,
        partType: operation.partType,
        paperSpecification: paperSpec,
        excelRowIndex: operation.excelRowIndex,
        confidence: mapping.confidence_score,
        isValid: true
      };

      instances.push(instance);
      
      this.logger.addDebugInfo(`  ✅ Created instance: ${stage.name}${partName ? ` (${operation.partType})` : ''} - qty: ${operation.qty}`);
    }

    const validInstances = instances.filter(i => i.isValid);
    const invalidInstances = instances.filter(i => !i.isValid);
    
    this.logger.addDebugInfo(`=== BUILD COMPLETE: ${validInstances.length} valid, ${invalidInstances.length} invalid ===`);
    
    return instances;
  }

  /**
   * Get instances grouped by category
   */
  getInstancesByCategory(instances: StageInstance[]): Record<string, StageInstance[]> {
    const grouped: Record<string, StageInstance[]> = {};
    
    for (const instance of instances) {
      if (!grouped[instance.category]) {
        grouped[instance.category] = [];
      }
      grouped[instance.category].push(instance);
    }
    
    return grouped;
  }

  /**
   * Get only valid instances
   */
  getValidInstances(instances: StageInstance[]): StageInstance[] {
    return instances.filter(instance => instance.isValid);
  }

  /**
   * Get only invalid instances for error reporting
   */
  getInvalidInstances(instances: StageInstance[]): StageInstance[] {
    return instances.filter(instance => !instance.isValid);
  }
}