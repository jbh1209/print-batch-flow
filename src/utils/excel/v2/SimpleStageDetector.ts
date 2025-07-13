import { ExcelImportDebugger } from "../debugger";
import { GroupSpecifications } from "../types";
import { MappingRepository } from "./MappingRepository";

export interface DetectedOperation {
  groupName: string;
  description: string;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery';
  qty: number;
  woQty: number;
  excelRowIndex: number;
  partType?: 'text' | 'cover';
  paperSpecification?: string;
}

export class SimpleStageDetector {
  private mappingRepo: MappingRepository;
  private logger: ExcelImportDebugger;

  constructor(mappingRepo: MappingRepository, logger: ExcelImportDebugger) {
    this.mappingRepo = mappingRepo;
    this.logger = logger;
  }

  /**
   * Detect all operations from parsed Excel specifications
   */
  async detectOperations(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    excelRows: any[][],
    headers: string[]
  ): Promise<DetectedOperation[]> {
    this.logger.addDebugInfo("=== SIMPLE STAGE DETECTOR START ===");
    
    const operations: DetectedOperation[] = [];

    // Process printing operations
    if (printingSpecs) {
      const printingOps = await this.processSpecifications(
        printingSpecs, 
        'printing', 
        excelRows, 
        headers
      );
      operations.push(...printingOps);
      this.logger.addDebugInfo(`Detected ${printingOps.length} printing operations`);
    }

    // Process finishing operations
    if (finishingSpecs) {
      const finishingOps = await this.processSpecifications(
        finishingSpecs, 
        'finishing', 
        excelRows, 
        headers
      );
      operations.push(...finishingOps);
      this.logger.addDebugInfo(`Detected ${finishingOps.length} finishing operations`);
    }

    // Process prepress operations
    if (prepressSpecs) {
      const prepressOps = await this.processSpecifications(
        prepressSpecs, 
        'prepress', 
        excelRows, 
        headers
      );
      operations.push(...prepressOps);
      this.logger.addDebugInfo(`Detected ${prepressOps.length} prepress operations`);
    }

    this.logger.addDebugInfo(`=== TOTAL DETECTED: ${operations.length} operations ===`);
    
    return operations;
  }

  private async processSpecifications(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery',
    excelRows: any[][],
    headers: string[]
  ): Promise<DetectedOperation[]> {
    const operations: DetectedOperation[] = [];

    for (const [groupName, spec] of Object.entries(specs)) {
      this.logger.addDebugInfo(`Processing ${category}: "${groupName}"`);
      
      const description = spec.description || groupName;
      const qty = spec.qty || 0;
      const woQty = spec.wo_qty || qty;

      // Find matching Excel row for accurate row indexing
      const excelRowIndex = this.findMatchingExcelRow(groupName, excelRows, headers);
      
      // Check if this is a text/cover operation (for printing only)
      if (category === 'printing' && this.isTextCoverOperation(groupName, description)) {
        // Create separate operations for text and cover
        operations.push({
          groupName,
          description,
          category,
          qty,
          woQty,
          excelRowIndex,
          partType: 'text'
        });
        
        operations.push({
          groupName,
          description,
          category,
          qty,
          woQty,
          excelRowIndex,
          partType: 'cover'
        });
        
        this.logger.addDebugInfo(`  → Created text + cover operations for "${groupName}"`);
      } else {
        // Single operation
        operations.push({
          groupName,
          description,
          category,
          qty,
          woQty,
          excelRowIndex
        });
        
        this.logger.addDebugInfo(`  → Created single operation for "${groupName}"`);
      }
    }

    return operations;
  }

  private findMatchingExcelRow(groupName: string, excelRows: any[][], headers: string[]): number {
    // Find the Excel row that contains this group name
    for (let i = 0; i < excelRows.length; i++) {
      const row = excelRows[i];
      for (const cell of row) {
        if (cell && String(cell).trim() === groupName.trim()) {
          return i;
        }
      }
    }
    return 0; // Default to first row if not found
  }

  private isTextCoverOperation(groupName: string, description: string): boolean {
    const combined = `${groupName} ${description}`.toLowerCase();
    
    // Look for indicators that this might be a book/booklet job
    const bookIndicators = [
      'book', 'booklet', 'brochure', 'magazine', 'catalog', 'catalogue',
      'cover', 'text', 'pages', 'inside'
    ];
    
    return bookIndicators.some(indicator => combined.includes(indicator));
  }
}