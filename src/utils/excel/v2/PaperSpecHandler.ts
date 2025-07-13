import { ExcelImportDebugger } from "../debugger";
import { GroupSpecifications } from "../types";

export interface PaperSpec {
  type: string;
  weight: string;
  displayName: string;
}

export class PaperSpecHandler {
  private paperSpecs: Map<string, PaperSpec> = new Map();
  private logger: ExcelImportDebugger;

  constructor(logger: ExcelImportDebugger) {
    this.logger = logger;
  }

  /**
   * Process paper specifications from Excel
   */
  processPaperSpecs(paperSpecs: GroupSpecifications | null): void {
    if (!paperSpecs) {
      this.logger.addDebugInfo("No paper specifications found");
      return;
    }

    this.logger.addDebugInfo("=== PROCESSING PAPER SPECIFICATIONS ===");

    for (const [groupName, spec] of Object.entries(paperSpecs)) {
      const paperSpec = this.parsePaperSpec(groupName, spec.description || groupName);
      
      if (paperSpec) {
        this.paperSpecs.set(groupName, paperSpec);
        this.logger.addDebugInfo(`Mapped paper: "${groupName}" → "${paperSpec.displayName}"`);
      }
    }

    this.logger.addDebugInfo(`=== PROCESSED ${this.paperSpecs.size} PAPER SPECS ===`);
  }

  /**
   * Get paper specification for a group name
   */
  getPaperSpecification(groupName: string): string | undefined {
    const paperSpec = this.paperSpecs.get(groupName);
    return paperSpec?.displayName;
  }

  /**
   * Get all paper specifications
   */
  getAllPaperSpecs(): PaperSpec[] {
    return Array.from(this.paperSpecs.values());
  }

  private parsePaperSpec(groupName: string, description: string): PaperSpec | null {
    const combined = `${groupName} ${description}`.toLowerCase();
    
    // Extract paper type
    let type = 'Unknown';
    if (combined.includes('gloss') || combined.includes('glossy')) {
      type = 'Gloss';
    } else if (combined.includes('matt') || combined.includes('matte')) {
      type = 'Matt';
    } else if (combined.includes('silk')) {
      type = 'Silk';
    } else if (combined.includes('uncoated')) {
      type = 'Uncoated';
    } else if (combined.includes('bond') || combined.includes('offset')) {
      type = 'Bond';
    }

    // Extract weight - look for patterns like "250gsm", "300g", "80 gsm"
    const weightMatch = combined.match(/(\d+)\s*g(?:sm)?/);
    const weight = weightMatch ? `${weightMatch[1]}gsm` : 'Unknown';

    if (type === 'Unknown' && weight === 'Unknown') {
      this.logger.addDebugInfo(`Could not parse paper spec: "${groupName}" - "${description}"`);
      return null;
    }

    return {
      type,
      weight,
      displayName: weight !== 'Unknown' ? `${type} ${weight}` : type
    };
  }
}