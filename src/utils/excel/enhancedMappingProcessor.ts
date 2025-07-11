import type { ExcelImportDebugger } from './debugger';
import { PaperSpecificationParser, PaperMappingMatcher } from './paperSpecificationParser';
import type { ParsedJob } from './types';

export interface EnhancedMappingResult {
  jobs: ParsedJob[];
  paperMappings: any[];
  deliveryMappings: any[];
  unmappedPaperSpecs: string[];
  unmappedDeliverySpecs: string[];
  stats: {
    totalJobs: number;
    paperSpecsMapped: number;
    deliverySpecsMapped: number;
    averageConfidence: number;
  };
}

export class EnhancedMappingProcessor {
  private paperParser: PaperSpecificationParser;
  private paperMatcher: PaperMappingMatcher;

  constructor(
    private logger: ExcelImportDebugger,
    private availableSpecs: any[] = []
  ) {
    this.paperParser = new PaperSpecificationParser(logger);
    this.paperMatcher = new PaperMappingMatcher(logger);
  }

  /**
   * Process jobs with enhanced mapping for paper and delivery specifications
   */
  async processJobsWithEnhancedMapping(
    jobs: ParsedJob[],
    paperColumnIndex: number = -1,
    deliveryColumnIndex: number = -1,
    rawExcelData?: any[][]
  ): Promise<EnhancedMappingResult> {
    this.logger.addDebugInfo(`Starting enhanced mapping for ${jobs.length} jobs`);

    const result: EnhancedMappingResult = {
      jobs: [...jobs],
      paperMappings: [],
      deliveryMappings: [],
      unmappedPaperSpecs: [],
      unmappedDeliverySpecs: [],
      stats: {
        totalJobs: jobs.length,
        paperSpecsMapped: 0,
        deliverySpecsMapped: 0,
        averageConfidence: 0
      }
    };

    let totalConfidence = 0;
    let mappingCount = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      
      // Process paper specifications
      if (paperColumnIndex !== -1 && rawExcelData && rawExcelData[i + 1]) {
        const paperText = rawExcelData[i + 1][paperColumnIndex];
        await this.processPaperSpecification(job, paperText, result);
      }

      // Process delivery specifications  
      if (deliveryColumnIndex !== -1 && rawExcelData && rawExcelData[i + 1]) {
        const deliveryText = rawExcelData[i + 1][deliveryColumnIndex];
        await this.processDeliverySpecification(job, deliveryText, result);
      }

      // Process existing paper fields if available
      if (job.paper_type || job.paper_weight) {
        const combinedText = `${job.paper_type || ''} ${job.paper_weight || ''}`.trim();
        if (combinedText) {
          await this.processPaperSpecification(job, combinedText, result);
        }
      }
    }

    // Calculate average confidence
    if (mappingCount > 0) {
      result.stats.averageConfidence = totalConfidence / mappingCount;
    }

    this.logger.addDebugInfo(`Enhanced mapping completed: ${result.stats.paperSpecsMapped} paper specs, ${result.stats.deliverySpecsMapped} delivery specs`);

    return result;
  }

  private async processPaperSpecification(
    job: ParsedJob,
    paperText: string,
    result: EnhancedMappingResult
  ): Promise<void> {
    if (!paperText) return;

    const paperSpec = this.paperParser.parsePaperSpecification(paperText);
    if (!paperSpec) {
      result.unmappedPaperSpecs.push(paperText);
      return;
    }

    // Try to find matching specifications in the system
    const paperMapping = await this.paperMatcher.findBestPaperMatch(
      paperSpec,
      this.availableSpecs
    );

    if (paperMapping) {
      // Update job with enhanced paper specifications
      if (!job.paper_specifications) {
        job.paper_specifications = {};
      }

      job.paper_specifications.parsed_paper = {
        type: paperMapping.paperType,
        weight: paperMapping.paperWeight,
        confidence: paperMapping.confidence,
        original_text: paperText,
        color: paperSpec.color,
        size: paperSpec.size,
        finish: paperSpec.finish
      };

      // Also update legacy fields for compatibility
      job.paper_type = paperMapping.paperType;
      job.paper_weight = paperMapping.paperWeight;

      result.paperMappings.push({
        woNo: job.wo_no,
        originalText: paperText,
        mapping: paperMapping,
        confidence: paperMapping.confidence
      });

      result.stats.paperSpecsMapped++;
    } else {
      result.unmappedPaperSpecs.push(paperText);
    }
  }

  private async processDeliverySpecification(
    job: ParsedJob,
    deliveryText: string,
    result: EnhancedMappingResult
  ): Promise<void> {
    if (!deliveryText) return;

    const deliverySpec = this.paperParser.parseDeliverySpecification(deliveryText);
    if (!deliverySpec) {
      result.unmappedDeliverySpecs.push(deliveryText);
      return;
    }

    // Update job with delivery specifications
    if (!job.delivery_specifications) {
      job.delivery_specifications = {};
    }

    job.delivery_specifications.parsed_delivery = {
      method: deliverySpec.method,
      address: deliverySpec.address,
      contact: deliverySpec.contact,
      notes: deliverySpec.notes,
      confidence: deliverySpec.confidence,
      original_text: deliveryText
    };

    result.deliveryMappings.push({
      woNo: job.wo_no,
      originalText: deliveryText,
      mapping: deliverySpec,
      confidence: deliverySpec.confidence
    });

    result.stats.deliverySpecsMapped++;
  }

  /**
   * Extract unique paper types and weights for bulk specification creation
   */
  extractUniquePaperSpecs(jobs: ParsedJob[]): {
    paperTypes: Set<string>;
    paperWeights: Set<string>;
    combinations: Array<{ type: string; weight: string; frequency: number }>;
  } {
    const paperTypes = new Set<string>();
    const paperWeights = new Set<string>();
    const combinationMap = new Map<string, number>();

    for (const job of jobs) {
      const paperSpecs = job.paper_specifications?.parsed_paper;
      if (paperSpecs) {
        if (paperSpecs.type) {
          paperTypes.add(paperSpecs.type);
        }
        if (paperSpecs.weight) {
          paperWeights.add(paperSpecs.weight);
        }
        
        if (paperSpecs.type && paperSpecs.weight) {
          const combo = `${paperSpecs.type}|${paperSpecs.weight}`;
          combinationMap.set(combo, (combinationMap.get(combo) || 0) + 1);
        }
      }
    }

    const combinations = Array.from(combinationMap.entries()).map(([combo, frequency]) => {
      const [type, weight] = combo.split('|');
      return { type, weight, frequency };
    }).sort((a, b) => b.frequency - a.frequency);

    return { paperTypes, paperWeights, combinations };
  }
}