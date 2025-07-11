import type { ExcelImportDebugger } from './debugger';
import type { DeliverySpecification } from './types';

export interface DeliveryMethodMapping {
  method: string;
  specificationId: string;
  specificationName: string;
  confidence: number;
  detectedFeatures: string[];
}

export class DeliverySpecificationMatcher {
  constructor(
    private logger: ExcelImportDebugger,
    private availableDeliverySpecs: any[] = []
  ) {}

  /**
   * Enhanced delivery method detection with specification mapping
   */
  enhanceDeliveryDetection(
    deliverySpec: DeliverySpecification,
    originalText: string
  ): DeliveryMethodMapping | null {
    if (!deliverySpec || !originalText) return null;

    const text = originalText.toLowerCase();
    this.logger.addDebugInfo(`Enhanced delivery detection for: "${originalText}"`);

    // Collection detection with enhanced patterns
    if (deliverySpec.method === 'collection') {
      return this.detectCollectionMethod(text, deliverySpec);
    }

    // Delivery detection with method classification
    if (deliverySpec.method === 'delivery') {
      return this.detectDeliveryMethod(text, deliverySpec);
    }

    return null;
  }

  private detectCollectionMethod(
    text: string,
    deliverySpec: DeliverySpecification
  ): DeliveryMethodMapping | null {
    const collectionSpec = this.availableDeliverySpecs.find(spec => 
      spec.name === 'collection' && spec.category === 'delivery_method'
    );

    if (!collectionSpec) {
      this.logger.addDebugInfo('Collection specification not found in system');
      return null;
    }

    const features = [];
    let confidence = deliverySpec.confidence;

    // Enhanced collection detection patterns
    const collectionPatterns = [
      { pattern: /collect|collection|pickup|pick.?up/i, feature: 'collection_keyword', boost: 20 },
      { pattern: /ready for collection/i, feature: 'ready_notification', boost: 15 },
      { pattern: /call when ready/i, feature: 'notification_required', boost: 15 },
      { pattern: /premises|workshop|office/i, feature: 'location_specified', boost: 10 }
    ];

    for (const { pattern, feature, boost } of collectionPatterns) {
      if (pattern.test(text)) {
        features.push(feature);
        confidence += boost;
      }
    }

    return {
      method: 'collection',
      specificationId: collectionSpec.id,
      specificationName: collectionSpec.display_name,
      confidence: Math.min(confidence, 100),
      detectedFeatures: features
    };
  }

  private detectDeliveryMethod(
    text: string,
    deliverySpec: DeliverySpecification
  ): DeliveryMethodMapping | null {
    let bestMatch: DeliveryMethodMapping | null = null;
    let highestScore = 0;

    // Define delivery method detection patterns
    const deliveryMethods = [
      {
        name: 'urgent_delivery',
        patterns: [
          { pattern: /urgent|express|same.?day|asap|rush/i, score: 30 },
          { pattern: /immediate|emergency|priority/i, score: 25 }
        ]
      },
      {
        name: 'courier_delivery',
        patterns: [
          { pattern: /courier|dpd|ups|fedex|hermes|yodel/i, score: 25 },
          { pattern: /tracked|signed.?for|special.?delivery/i, score: 20 }
        ]
      },
      {
        name: 'postal_delivery',
        patterns: [
          { pattern: /post|royal.?mail|1st.?class|2nd.?class/i, score: 25 },
          { pattern: /stamp|postage|mail/i, score: 15 }
        ]
      },
      {
        name: 'local_delivery',
        patterns: [
          { pattern: /local|within \d+\s*(km|miles?)|nearby/i, score: 20 },
          { pattern: /van delivery|own delivery/i, score: 25 }
        ]
      }
    ];

    for (const method of deliveryMethods) {
      let methodScore = deliverySpec.confidence;
      const features = [];

      for (const { pattern, score } of method.patterns) {
        if (pattern.test(text)) {
          methodScore += score;
          features.push(pattern.source);
        }
      }

      if (methodScore > highestScore) {
        const spec = this.availableDeliverySpecs.find(s => 
          s.name === method.name && s.category === 'delivery_method'
        );

        if (spec) {
          highestScore = methodScore;
          bestMatch = {
            method: method.name,
            specificationId: spec.id,
            specificationName: spec.display_name,
            confidence: Math.min(methodScore, 100),
            detectedFeatures: features
          };
        }
      }
    }

    // Fallback to generic local delivery if no specific method detected
    if (!bestMatch && deliverySpec.method === 'delivery') {
      const localSpec = this.availableDeliverySpecs.find(spec => 
        spec.name === 'local_delivery' && spec.category === 'delivery_method'
      );

      if (localSpec) {
        bestMatch = {
          method: 'local_delivery',
          specificationId: localSpec.id,
          specificationName: localSpec.display_name,
          confidence: deliverySpec.confidence,
          detectedFeatures: ['default_delivery']
        };
      }
    }

    if (bestMatch) {
      this.logger.addDebugInfo(
        `Delivery method detected: ${bestMatch.specificationName} (confidence: ${bestMatch.confidence}%)`
      );
    }

    return bestMatch;
  }

  /**
   * Extract address details for delivery jobs
   */
  parseAddressDetails(text: string): {
    fullAddress?: string;
    postcode?: string;
    city?: string;
    isLocalArea?: boolean;
  } {
    const result: any = {};

    // Extract postcode
    const postcodeMatch = text.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})/i);
    if (postcodeMatch) {
      result.postcode = postcodeMatch[1].toUpperCase();
    }

    // Extract city/town
    const cityMatch = text.match(/,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:,|\d|$)/);
    if (cityMatch) {
      result.city = cityMatch[1];
    }

    // Try to extract full address
    const addressPatterns = [
      /\d+[\w\s,.-]*?(?:[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})/i,
      /[A-Z][\w\s,.-]*?(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|way|close|crescent|cres)[\w\s,.-]*?(?:[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})?/i
    ];

    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.fullAddress = match[0].trim();
        break;
      }
    }

    // Determine if it's local area (basic heuristic)
    const localKeywords = ['local', 'nearby', 'same town', 'within'];
    result.isLocalArea = localKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );

    return result;
  }
}