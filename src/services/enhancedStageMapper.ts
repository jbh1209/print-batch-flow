import { supabase } from '@/integrations/supabase/client';
import type { ParsedJob } from '@/utils/excel/types';
import type { ExcelImportDebugger } from '@/utils/excel/debugger';
import { DirectJobCreator } from './DirectJobCreator';
import { stringSimilarity } from 'string-similarity-js';

export interface StageMappingResult {
  success: boolean;
  rowMappings: any;
  categoryAssignments: any;
  unmappedRows: any[];
  stats: {
    total: number;
    successful: number;
    failed: number;
  };
}

export class EnhancedStageMapper {
  constructor(
    private logger: ExcelImportDebugger,
    private userId: string,
    private excelData: any,
    private columnMapping: any,
    private allProductionStages: any[],
    private allPaperSpecs: any[]
  ) {}

  /**
   * Map Excel rows to production stages and extract relevant data
   */
  async mapExcelDataToStages(jobs: ParsedJob[]): Promise<StageMappingResult> {
    const result: StageMappingResult = {
      success: true,
      rowMappings: {},
      categoryAssignments: {},
      unmappedRows: [],
      stats: {
        total: 0,
        successful: 0,
        failed: 0
      }
    };

    this.logger.addDebugInfo(`Starting enhanced stage mapping for ${jobs.length} jobs`);

    for (const job of jobs) {
      try {
        const jobMappings = await this.mapJobToStages(job);
        result.rowMappings[job.wo_no] = jobMappings.rowMappings;
        result.categoryAssignments[job.wo_no] = jobMappings.categoryAssignments;
        result.stats.total += jobMappings.rowMappings.length;
        result.stats.successful += jobMappings.rowMappings.length;
      } catch (error) {
        this.logger.addDebugInfo(`Failed to map stages for job ${job.wo_no}: ${error}`);
        result.success = false;
        result.stats.failed++;
        result.unmappedRows.push({ job, error: error instanceof Error ? error.message : String(error) });
      }
    }

    this.logger.addDebugInfo(`Enhanced stage mapping completed: ${result.stats.successful}/${result.stats.total} successful`);
    return result;
  }

  /**
   * Map a single job's Excel rows to production stages
   */
  private async mapJobToStages(job: ParsedJob): Promise<any> {
    const rowMappings: any[] = [];
    const categoryAssignments: any = {
      originalJob: job
    };

    this.logger.addDebugInfo(`Mapping stages for job ${job.wo_no} with qty=${job.qty}`);

    // Iterate through each row in the Excel data
    for (let i = 0; i < this.excelData.rows.length; i++) {
      const row = this.excelData.rows[i];

      // Extract stage name from the row
      const stageName = this.extractStageNameFromRow(row);
      if (!stageName) {
        this.logger.addDebugInfo(`Skipping row ${i}: No stage name found`);
        continue;
      }

      // Extract quantity from job specifications
      const qty = this.extractQuantityFromJobSpecs(job, stageName);
      this.logger.addDebugInfo(`Extracted quantity ${qty} for stage ${stageName}`);

      // Map stage name to a production stage
      const mappedStage = await this.mapStageNameToProductionStage(stageName);
      if (!mappedStage) {
        this.logger.addDebugInfo(`No production stage mapping found for ${stageName}`);
        continue;
      }

      // Create row mapping object
      const rowMapping = {
        excelRowIndex: i,
        excelRow: row,
        stageName: stageName,
        mappedStageId: mappedStage.id,
        mappedStageName: mappedStage.name,
        confidenceScore: mappedStage.confidence,
        isVerified: mappedStage.isVerified,
        qty: qty,
        paperSpecification: this.extractPaperSpecification(row)
      };

      rowMappings.push(rowMapping);
      this.logger.addDebugInfo(`Mapped stage ${stageName} to ${mappedStage.name} (ID: ${mappedStage.id})`);
    }

    return { rowMappings, categoryAssignments };
  }

  /**
   * Extract stage name from an Excel row
   */
  private extractStageNameFromRow(row: any): string | null {
    const stageColumn = this.excelData.groupColumn;
    if (stageColumn === -1) return null;

    const stageName = row[stageColumn];
    if (!stageName || typeof stageName !== 'string') return null;

    return stageName.trim();
  }

  /**
   * Extract paper specification from an Excel row
   */
  private extractPaperSpecification(row: any): string | null {
    const descriptionColumn = this.excelData.descriptionColumn;
    if (descriptionColumn === -1) return null;

    const description = row[descriptionColumn];
    if (!description || typeof description !== 'string') return null;

    return description.trim();
  }

  /**
   * Map a stage name to a production stage using fuzzy matching
   */
  private async mapStageNameToProductionStage(stageName: string): Promise<any | null> {
    let bestMatch = null;
    let bestScore = 0;

    for (const stage of this.allProductionStages) {
      const similarity = this.fuzzyMatch(stageName, stage.name);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = {
          id: stage.id,
          name: stage.name,
          confidence: similarity,
          isVerified: similarity > 0.8
        };
      }
    }

    return bestMatch;
  }

  /**
   * Extract quantity from job specifications for a given group
   * Enhanced to handle both Cover/Text AND paper specification suffixes
   */
  private extractQuantityFromJobSpecs(job: any, groupName: string): number | null {
    this.logger.addDebugInfo(`🔍 Extracting quantity for group: ${groupName}`);
    
    // Create base name by removing both Cover/Text AND paper specification suffixes
    // Updated regex to handle: "- Cover", "- Text", "- Gloss 300gsm", "- Bond 080gsm", etc.
    const baseName = groupName.replace(/\s*-\s*((Cover|Text|cover|text).*|(Gloss|Bond|Matt|Silk|Satin).*gsm.*)$/i, '').trim();
    
    this.logger.addDebugInfo(`🔍 Base name after suffix removal: "${baseName}"`);
    
    // Check all specification categories for matching keys
    const specCategories = [
      { name: 'printing', specs: job.printing_specifications },
      { name: 'finishing', specs: job.finishing_specifications },
      { name: 'prepress', specs: job.prepress_specifications },
      { name: 'delivery', specs: job.delivery_specifications },
      { name: 'packaging', specs: job.packaging_specifications }
    ];

    for (const category of specCategories) {
      if (!category.specs) continue;
      
      const availableKeys = Object.keys(category.specs);
      this.logger.addDebugInfo(`🔍 Available ${category.name} specs: ${availableKeys.join(', ')}`);
      
      // Try exact match first with original group name
      if (category.specs[groupName]) {
        const qty = category.specs[groupName].qty || null;
        this.logger.addDebugInfo(`✅ Found exact match for ${groupName} in ${category.name}`);
        this.logger.addDebugInfo(`🎨 Found ${category.name} spec for ${groupName} via key ${groupName}: qty=${qty}`);
        return qty;
      }
      
      // Try exact match with base name (after removing suffixes)
      if (category.specs[baseName]) {
        const qty = category.specs[baseName].qty || null;
        this.logger.addDebugInfo(`✅ Found exact match for ${baseName} in ${category.name}`);
        this.logger.addDebugInfo(`🎨 Found ${category.name} spec for ${groupName} via key ${baseName}: qty=${qty}`);
        return qty;
      }
      
      // Try fuzzy matching with available keys
      for (const key of availableKeys) {
        // Remove suffixes from the stored key as well for comparison
        const keyBaseName = key.replace(/\s*-\s*((Cover|Text|cover|text).*|(Gloss|Bond|Matt|Silk|Satin).*gsm.*)$/i, '').trim();
        
        if (this.fuzzyMatch(baseName, keyBaseName) || 
            this.fuzzyMatch(groupName, key) ||
            this.fuzzyMatch(baseName, key)) {
          const qty = category.specs[key].qty || null;
          this.logger.addDebugInfo(`✅ Found fuzzy match for ${groupName} -> ${key} in ${category.name}`);
          this.logger.addDebugInfo(`🎨 Found ${category.name} spec for ${groupName} via key ${key}: qty=${qty}`);
          return qty;
        }
      }
    }
    
    this.logger.addDebugInfo(`⚠️ No quantity found for group ${groupName}, using job default: ${job.qty}`);
    return null;
  }

  /**
   * Perform fuzzy matching between two strings
   */
  private fuzzyMatch(str1: string, str2: string): number {
    const cleanStr1 = str1.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const cleanStr2 = str2.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    return stringSimilarity(cleanStr1, cleanStr2);
  }
}
