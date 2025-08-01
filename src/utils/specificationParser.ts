// Enhanced specification parsing utilities for both legacy and new systems

export interface ParsedSpecification {
  paperType?: string;
  paperWeight?: string;
  paperSize?: string;
  fullPaperSpec?: string;
  printingSpec?: string;
  finishingSpec?: string;
  deliverySpec?: string;
}

export interface LegacySpecifications {
  paper_specifications?: Record<string, any>;
  printing_specifications?: Record<string, any>;
  finishing_specifications?: Record<string, any>;
  prepress_specifications?: Record<string, any>;
  delivery_specifications?: Record<string, any>;
}

export interface NormalizedSpecification {
  category: string;
  specification_id: string;
  name: string;
  display_name: string;
  properties: any;
}

// Parse legacy job specification columns
export const parseLegacySpecifications = (legacySpecs: LegacySpecifications): ParsedSpecification => {
  const result: ParsedSpecification = {};

  // Parse paper specifications
  if (legacySpecs.paper_specifications) {
    const paperKeys = Object.keys(legacySpecs.paper_specifications);
    if (paperKeys.length > 0) {
      const firstPaperKey = paperKeys[0];
      const paperMatch = firstPaperKey.match(/^(.+?),\s*(\d+gsm)(?:,\s*(.+?),\s*(.+))?$/);
      
      if (paperMatch) {
        result.paperType = paperMatch[1]?.trim();
        result.paperWeight = paperMatch[2];
        result.paperSize = paperMatch[4]?.trim();
        result.fullPaperSpec = `${result.paperWeight} ${result.paperType}`;
      } else {
        // Fallback - try to extract type and weight from the key
        const fallbackMatch = firstPaperKey.match(/(.+?)\s*,\s*(\d+gsm)/);
        if (fallbackMatch) {
          result.paperType = fallbackMatch[1]?.trim();
          result.paperWeight = fallbackMatch[2];
          result.fullPaperSpec = `${result.paperWeight} ${result.paperType}`;
        } else {
          result.fullPaperSpec = firstPaperKey;
        }
      }
    }
  }

  // Parse printing specifications
  if (legacySpecs.printing_specifications) {
    const printingKeys = Object.keys(legacySpecs.printing_specifications);
    if (printingKeys.length > 0) {
      result.printingSpec = printingKeys[0];
    }
  }

  // Parse finishing specifications
  if (legacySpecs.finishing_specifications) {
    const finishingKeys = Object.keys(legacySpecs.finishing_specifications);
    if (finishingKeys.length > 0) {
      result.finishingSpec = finishingKeys.join(', ');
    }
  }

  // Parse delivery specifications
  if (legacySpecs.delivery_specifications) {
    const deliveryKeys = Object.keys(legacySpecs.delivery_specifications);
    if (deliveryKeys.length > 0) {
      result.deliverySpec = deliveryKeys.join(', ');
    }
  }

  return result;
};

// Parse normalized specifications from the new system
export const parseNormalizedSpecifications = (normalizedSpecs: NormalizedSpecification[]): ParsedSpecification => {
  const result: ParsedSpecification = {};

  normalizedSpecs.forEach(spec => {
    switch (spec.category) {
      case 'paper_type':
        result.paperType = spec.display_name;
        break;
      case 'paper_weight':
        result.paperWeight = spec.display_name;
        break;
      case 'printing_method':
      case 'printer_type':
        result.printingSpec = spec.display_name;
        break;
      case 'finishing':
      case 'lamination_type':
        result.finishingSpec = result.finishingSpec 
          ? `${result.finishingSpec}, ${spec.display_name}`
          : spec.display_name;
        break;
      case 'delivery_method':
        result.deliverySpec = spec.display_name;
        break;
    }
  });

  // Combine paper type and weight if both exist
  if (result.paperType && result.paperWeight) {
    result.fullPaperSpec = `${result.paperWeight} ${result.paperType}`;
  } else if (result.paperType || result.paperWeight) {
    result.fullPaperSpec = result.paperType || result.paperWeight;
  }

  return result;
};

// Unified specification parser that tries both systems
export const parseUnifiedSpecifications = (
  legacySpecs?: LegacySpecifications,
  normalizedSpecs?: NormalizedSpecification[]
): ParsedSpecification => {
  let result: ParsedSpecification = {};

  // First try normalized specs (new system)
  if (normalizedSpecs && normalizedSpecs.length > 0) {
    result = parseNormalizedSpecifications(normalizedSpecs);
  }

  // Fallback to legacy specs if normalized specs are incomplete
  if (legacySpecs && (!result.fullPaperSpec || !result.printingSpec)) {
    const legacyResult = parseLegacySpecifications(legacySpecs);
    
    // Use legacy values where normalized values are missing
    result.paperType = result.paperType || legacyResult.paperType;
    result.paperWeight = result.paperWeight || legacyResult.paperWeight;
    result.paperSize = result.paperSize || legacyResult.paperSize;
    result.fullPaperSpec = result.fullPaperSpec || legacyResult.fullPaperSpec;
    result.printingSpec = result.printingSpec || legacyResult.printingSpec;
    result.finishingSpec = result.finishingSpec || legacyResult.finishingSpec;
    result.deliverySpec = result.deliverySpec || legacyResult.deliverySpec;
  }

  return result;
};

// Format paper display consistently
export const formatPaperDisplay = (specs: ParsedSpecification): string | undefined => {
  if (specs.fullPaperSpec) {
    return specs.fullPaperSpec;
  }
  
  if (specs.paperWeight && specs.paperType) {
    return `${specs.paperWeight} ${specs.paperType}`;
  }
  
  return specs.paperType || specs.paperWeight;
};