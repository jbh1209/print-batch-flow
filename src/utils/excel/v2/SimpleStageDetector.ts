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
   * Detect all operations from parsed Excel specifications with null safety
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

    // Ensure excelRows and headers are valid arrays
    const safeExcelRows = Array.isArray(excelRows) ? excelRows : [];
    const safeHeaders = Array.isArray(headers) ? headers : [];

    // Process printing operations with null safety
    if (printingSpecs && typeof printingSpecs === 'object') {
      try {
        const printingOps = await this.processSpecifications(
          printingSpecs, 
          'printing', 
          safeExcelRows, 
          safeHeaders
        );
        if (Array.isArray(printingOps)) {
          operations.push(...printingOps);
          this.logger.addDebugInfo(`Detected ${printingOps.length} printing operations`);
        }
      } catch (printingError) {
        this.logger.addDebugInfo(`Error processing printing specifications: ${printingError}`);
      }
    }

    // Process finishing operations with null safety
    if (finishingSpecs && typeof finishingSpecs === 'object') {
      try {
        const finishingOps = await this.processSpecifications(
          finishingSpecs, 
          'finishing', 
          safeExcelRows, 
          safeHeaders
        );
        if (Array.isArray(finishingOps)) {
          operations.push(...finishingOps);
          this.logger.addDebugInfo(`Detected ${finishingOps.length} finishing operations`);
        }
      } catch (finishingError) {
        this.logger.addDebugInfo(`Error processing finishing specifications: ${finishingError}`);
      }
    }

    // Process prepress operations with null safety
    if (prepressSpecs && typeof prepressSpecs === 'object') {
      try {
        const prepressOps = await this.processSpecifications(
          prepressSpecs, 
          'prepress', 
          safeExcelRows, 
          safeHeaders
        );
        if (Array.isArray(prepressOps)) {
          operations.push(...prepressOps);
          this.logger.addDebugInfo(`Detected ${prepressOps.length} prepress operations`);
        }
      } catch (prepressError) {
        this.logger.addDebugInfo(`Error processing prepress specifications: ${prepressError}`);
      }
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
    if (!specs || typeof specs !== 'object') {
      this.logger.addDebugInfo(`⚠️ Invalid specifications for ${category}`);
      return [];
    }

    const operations: DetectedOperation[] = [];

    try {
      for (const [groupName, spec] of Object.entries(specs)) {
        if (!spec || typeof spec !== 'object') {
          this.logger.addDebugInfo(`⚠️ Skipping invalid spec for "${groupName}"`);
          continue;
        }

        this.logger.addDebugInfo(`Processing ${category}: "${groupName}"`);
        
        const description = String(spec.description || groupName);
        const qty = Number(spec.qty) || 0;
        const woQty = Number(spec.wo_qty) || qty;

        // Find matching Excel row for accurate row indexing with null safety
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
    } catch (processingError) {
      this.logger.addDebugInfo(`Error processing specifications for ${category}: ${processingError}`);
    }

    return operations;
  }

  private findMatchingExcelRow(groupName: string, excelRows: any[][], headers: string[]): number {
    if (!Array.isArray(excelRows) || !groupName) {
      return 0;
    }

    try {
      // Find the Excel row that contains this group name
      for (let i = 0; i < excelRows.length; i++) {
        const row = excelRows[i];
        if (!Array.isArray(row)) continue;
        
        for (const cell of row) {
          if (cell && String(cell).trim() === String(groupName).trim()) {
            return i;
          }
        }
      }
    } catch (error) {
      this.logger.addDebugInfo(`Error finding Excel row for "${groupName}": ${error}`);
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