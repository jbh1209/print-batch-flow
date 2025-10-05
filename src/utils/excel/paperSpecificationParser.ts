import type { ExcelImportDebugger } from './debugger';

export interface PaperSpecification {
  type: string;
  weight: string;
  finish?: string;
  color?: string;
  size?: string;
  fullMatch: string;
  confidence: number;
}

export interface DeliverySpecification {
  method: 'delivery' | 'collection';
  address?: string;
  contact?: string;
  notes?: string;
  confidence: number;
}

// Paper type patterns for common variations
const PAPER_TYPE_PATTERNS = [
  { pattern: /matt?/i, type: 'Matt', variations: ['matt', 'matte', 'mat'] },
  { pattern: /gloss/i, type: 'Gloss', variations: ['gloss', 'glossy'] },
  { pattern: /silk/i, type: 'Silk', variations: ['silk', 'satin'] },
  { pattern: /uncoated/i, type: 'Uncoated', variations: ['uncoated', 'natural'] },
  { pattern: /bond/i, type: 'Bond', variations: ['bond'] },
  { pattern: /recycled/i, type: 'Recycled', variations: ['recycled', 'eco'] }
];

// Weight patterns for common GSM values
const WEIGHT_PATTERNS = [
  { pattern: /(\d+)\s*gsm/i, extract: (match: RegExpMatchArray) => `${match[1]}gsm` },
  { pattern: /(\d+)\s*g/i, extract: (match: RegExpMatchArray) => `${match[1]}gsm` },
  { pattern: /(\d{2,3})\s*mic/i, extract: (match: RegExpMatchArray) => `${match[1]}mic` }
];

// Delivery/Collection keywords
const DELIVERY_KEYWORDS = {
  delivery: [
    'delivery', 'deliver', 'delivered', 'ship', 'shipping', 'send', 'courier',
    'postal', 'mail', 'freight', 'transport', 'address'
  ],
  collection: [
    'collection', 'collect', 'pickup', 'pick up', 'collected', 'counter',
    'walk-in', 'self collect', 'client collect'
  ]
};

export class PaperSpecificationParser {
  constructor(private logger: ExcelImportDebugger) {}

  /**
   * Parse paper specifications from Excel text
   */
  parsePaperSpecification(text: string): PaperSpecification | null {
    if (!text || typeof text !== 'string') return null;

    const cleanText = text.trim();
    this.logger.addDebugInfo(`Parsing paper specification: "${cleanText}"`);

    const result: PaperSpecification = {
      type: '',
      weight: '',
      fullMatch: cleanText,
      confidence: 0
    };

    // Extract paper type
    const typeMatch = this.extractPaperType(cleanText);
    if (typeMatch) {
      result.type = typeMatch.type;
      result.confidence += typeMatch.confidence;
    }

    // Extract weight
    const weightMatch = this.extractWeight(cleanText);
    if (weightMatch) {
      result.weight = weightMatch.weight;
      result.confidence += weightMatch.confidence;
    }

    // Extract additional properties
    result.color = this.extractColor(cleanText);
    result.size = this.extractSize(cleanText);
    result.finish = this.extractFinish(cleanText);

    // Only return if we found at least type or weight
    if (result.type || result.weight) {
      this.logger.addDebugInfo(`Paper spec parsed: Type="${result.type}", Weight="${result.weight}", Confidence=${result.confidence}`);
      return result;
    }

    return null;
  }

  /**
   * Parse delivery specifications from Excel text
   */
  parseDeliverySpecification(text: string): DeliverySpecification | null {
    if (!text || typeof text !== 'string') return null;

    const cleanText = text.toLowerCase().trim();
    this.logger.addDebugInfo(`Parsing delivery specification: "${text}"`);

    let deliveryScore = 0;
    let collectionScore = 0;

    // Check for delivery keywords
    for (const keyword of DELIVERY_KEYWORDS.delivery) {
      if (cleanText.includes(keyword)) {
        deliveryScore += keyword.length; // Longer keywords get higher scores
      }
    }

    // Check for collection keywords
    for (const keyword of DELIVERY_KEYWORDS.collection) {
      if (cleanText.includes(keyword)) {
        collectionScore += keyword.length;
      }
    }

    if (deliveryScore === 0 && collectionScore === 0) {
      return null;
    }

    const method = deliveryScore > collectionScore ? 'delivery' : 'collection';
    const confidence = Math.max(deliveryScore, collectionScore);

    const result: DeliverySpecification = {
      method,
      confidence: Math.min(confidence * 10, 100), // Scale to 0-100
      notes: text.trim()
    };

    // Extract address if it's delivery
    if (method === 'delivery') {
      result.address = this.extractAddress(text);
    }

    this.logger.addDebugInfo(`Delivery spec parsed: Method="${method}", Confidence=${result.confidence}`);
    return result;
  }

  private extractPaperType(text: string): { type: string; confidence: number } | null {
    for (const { pattern, type, variations } of PAPER_TYPE_PATTERNS) {
      if (pattern.test(text)) {
        // Calculate confidence based on exact match vs variation
        const lowerText = text.toLowerCase();
        const exactMatch = variations.some(v => lowerText.includes(v));
        return {
          type,
          confidence: exactMatch ? 50 : 30
        };
      }
    }
    return null;
  }

  private extractWeight(text: string): { weight: string; confidence: number } | null {
    for (const { pattern, extract } of WEIGHT_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return {
          weight: extract(match),
          confidence: 40
        };
      }
    }
    return null;
  }

  private extractColor(text: string): string | undefined {
    const colorPatterns = [
      /white/i,
      /cream/i,
      /ivory/i,
      /natural/i,
      /grey/i,
      /gray/i
    ];

    for (const pattern of colorPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].toLowerCase();
      }
    }
    return undefined;
  }

  private extractSize(text: string): string | undefined {
    // Look for size patterns like "640x915", "530x750", "A4", etc.
    const sizePatterns = [
      /(\d{2,4})\s*x\s*(\d{2,4})/i,
      /A[0-5]/i,
      /SRA[0-5]/i,
      /(letter|legal|tabloid)/i
    ];

    for (const pattern of sizePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return undefined;
  }

  private extractFinish(text: string): string | undefined {
    const finishPatterns = [
      /aqueous/i,
      /uv/i,
      /laminated?/i,
      /coating/i
    ];

    for (const pattern of finishPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].toLowerCase();
      }
    }
    return undefined;
  }

  private extractAddress(text: string): string | undefined {
    // Simple address extraction - look for patterns with numbers and common address words
    const addressPattern = /\d+[\w\s,.-]*(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|way|close|crescent|cres)/i;
    const match = text.match(addressPattern);
    return match ? match[0].trim() : undefined;
  }
}

/**
 * Create combined paper specification mappings
 */
export interface CombinedPaperMapping {
  paperType: string;
  paperWeight: string;
  specificationId?: string;
  confidence: number;
  excelText: string;
}

export class PaperMappingMatcher {
  constructor(private logger: ExcelImportDebugger) {}

  /**
   * Find best matching paper specification for parsed paper data
   */
  async findBestPaperMatch(
    paperSpec: PaperSpecification,
    availableSpecs: any[]
  ): Promise<CombinedPaperMapping | null> {
    if (!paperSpec.type && !paperSpec.weight) return null;

    // Find paper type specifications
    const typeSpecs = availableSpecs.filter(spec => 
      spec.category === 'paper_type' && spec.is_active
    );

    // Find paper weight specifications  
    const weightSpecs = availableSpecs.filter(spec => 
      spec.category === 'paper_weight' && spec.is_active
    );

    let bestTypeMatch = null;
    let bestWeightMatch = null;
    let totalConfidence = paperSpec.confidence;

    // Match paper type
    if (paperSpec.type) {
      bestTypeMatch = this.findBestSpecMatch(paperSpec.type, typeSpecs);
      if (bestTypeMatch) {
        totalConfidence += 30;
      }
    }

    // Match paper weight
    if (paperSpec.weight) {
      bestWeightMatch = this.findBestSpecMatch(paperSpec.weight, weightSpecs);
      if (bestWeightMatch) {
        totalConfidence += 30;
      }
    }

    if (!bestTypeMatch && !bestWeightMatch) return null;

    return {
      paperType: bestTypeMatch?.display_name || paperSpec.type,
      paperWeight: bestWeightMatch?.display_name || paperSpec.weight,
      specificationId: bestTypeMatch?.id || bestWeightMatch?.id,
      confidence: Math.min(totalConfidence, 100),
      excelText: paperSpec.fullMatch
    };
  }

  private findBestSpecMatch(searchTerm: string, specs: any[]) {
    const lowerSearch = searchTerm.toLowerCase();
    
    // Exact match on display_name
    let exact = specs.find(spec => 
      spec.display_name.toLowerCase() === lowerSearch
    );
    if (exact) return exact;

    // Exact match on name
    exact = specs.find(spec => 
      spec.name.toLowerCase() === lowerSearch
    );
    if (exact) return exact;

    // Partial match on display_name
    const partial = specs.find(spec => 
      spec.display_name.toLowerCase().includes(lowerSearch) ||
      lowerSearch.includes(spec.display_name.toLowerCase())
    );
    if (partial) return partial;

    // Partial match on name
    return specs.find(spec => 
      spec.name.toLowerCase().includes(lowerSearch) ||
      lowerSearch.includes(spec.name.toLowerCase())
    );
  }
}