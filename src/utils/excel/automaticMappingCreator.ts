import type { ExcelImportDebugger } from './debugger';
import type { EnhancedMappingResult } from './enhancedMappingProcessor';
import { supabase } from '@/integrations/supabase/client';

export interface AutoMappingResult {
  mappingsCreated: number;
  papersCreated: number;
  deliveriesCreated: number;
  conflicts: Array<{
    excelText: string;
    conflictType: 'paper' | 'delivery' | 'general';
    message: string;
  }>;
  errors: string[];
}

export class AutomaticMappingCreator {
  constructor(private logger: ExcelImportDebugger) {}

  /**
   * Automatically create Excel import mappings from enhanced parsing results
   */
  async createMappingsFromResults(
    enhancedResult: EnhancedMappingResult,
    minConfidenceThreshold: number = 80
  ): Promise<AutoMappingResult> {
    const result: AutoMappingResult = {
      mappingsCreated: 0,
      papersCreated: 0,
      deliveriesCreated: 0,
      conflicts: [],
      errors: []
    };

    this.logger.addDebugInfo(`Starting automatic mapping creation with ${enhancedResult.jobs.length} jobs`);

    // Process paper specification mappings
    await this.createPaperMappings(enhancedResult, minConfidenceThreshold, result);

    // Process delivery specification mappings
    await this.createDeliveryMappings(enhancedResult, minConfidenceThreshold, result);

    // Process enhanced delivery mappings
    await this.createEnhancedDeliveryMappings(enhancedResult, minConfidenceThreshold, result);

    this.logger.addDebugInfo(`Mapping creation completed: ${result.mappingsCreated} mappings, ${result.conflicts.length} conflicts`);
    
    return result;
  }

  private async createPaperMappings(
    enhancedResult: EnhancedMappingResult,
    minConfidence: number,
    result: AutoMappingResult
  ): Promise<void> {
    for (const paperMapping of enhancedResult.paperMappings) {
      if (paperMapping.confidence < minConfidence) {
        this.logger.addDebugInfo(`Skipping paper mapping '${paperMapping.originalText}' - confidence too low: ${paperMapping.confidence}`);
        continue;
      }

      try {
        // Find matching paper specification
        const { data: specifications } = await supabase
          .from('print_specifications')
          .select('id')
          .eq('category', 'paper')
          .ilike('name', `%${paperMapping.mapping.paperType}%`)
          .limit(1);

        const specificationId = specifications?.[0]?.id;

        // Create or update mapping using the upsert function
        const { data, error } = await supabase.rpc('upsert_excel_mapping', {
          p_excel_text: paperMapping.originalText,
          p_production_stage_id: await this.findPrintStageId(),
          p_stage_specification_id: specificationId,
          p_confidence_score: paperMapping.confidence
        });

        if (error) {
          result.errors.push(`Failed to create paper mapping: ${error.message}`);
          continue;
        }

        if (data?.[0]?.action_taken === 'created') {
          result.papersCreated++;
        }
        result.mappingsCreated++;

        if (data?.[0]?.conflict_detected) {
          result.conflicts.push({
            excelText: paperMapping.originalText,
            conflictType: 'paper',
            message: `Paper specification conflicts with existing mapping`
          });
        }

      } catch (error: any) {
        result.errors.push(`Error processing paper mapping: ${error.message}`);
      }
    }
  }

  private async createDeliveryMappings(
    enhancedResult: EnhancedMappingResult,
    minConfidence: number,
    result: AutoMappingResult
  ): Promise<void> {
    for (const deliveryMapping of enhancedResult.deliveryMappings) {
      if (deliveryMapping.confidence < minConfidence) {
        this.logger.addDebugInfo(`Skipping delivery mapping '${deliveryMapping.originalText}' - confidence too low: ${deliveryMapping.confidence}`);
        continue;
      }

      try {
        // Find matching delivery specification
        const { data: specifications } = await supabase
          .from('print_specifications')
          .select('id')
          .eq('category', 'delivery')
          .ilike('name', `%${deliveryMapping.mapping.method}%`)
          .limit(1);

        const specificationId = specifications?.[0]?.id;

        // Create or update mapping
        const { data, error } = await supabase.rpc('upsert_excel_mapping', {
          p_excel_text: deliveryMapping.originalText,
          p_production_stage_id: await this.findDeliveryStageId(),
          p_stage_specification_id: specificationId,
          p_confidence_score: deliveryMapping.confidence
        });

        if (error) {
          result.errors.push(`Failed to create delivery mapping: ${error.message}`);
          continue;
        }

        if (data?.[0]?.action_taken === 'created') {
          result.deliveriesCreated++;
        }
        result.mappingsCreated++;

        if (data?.[0]?.conflict_detected) {
          result.conflicts.push({
            excelText: deliveryMapping.originalText,
            conflictType: 'delivery',
            message: `Delivery method conflicts with existing mapping`
          });
        }

      } catch (error: any) {
        result.errors.push(`Error processing delivery mapping: ${error.message}`);
      }
    }
  }

  private async createEnhancedDeliveryMappings(
    enhancedResult: EnhancedMappingResult,
    minConfidence: number,
    result: AutoMappingResult
  ): Promise<void> {
    for (const enhancedMapping of enhancedResult.enhancedDeliveryMappings) {
      if (enhancedMapping.confidence < minConfidence) {
        this.logger.addDebugInfo(`Skipping enhanced delivery mapping '${enhancedMapping.originalText}' - confidence too low: ${enhancedMapping.confidence}`);
        continue;
      }

      try {
        // Create or update mapping with enhanced delivery specification
        const { data, error } = await supabase.rpc('upsert_excel_mapping', {
          p_excel_text: enhancedMapping.originalText,
          p_production_stage_id: await this.findDeliveryStageId(),
          p_stage_specification_id: enhancedMapping.mapping.specificationId,
          p_confidence_score: enhancedMapping.confidence
        });

        if (error) {
          result.errors.push(`Failed to create enhanced delivery mapping: ${error.message}`);
          continue;
        }

        if (data?.[0]?.action_taken === 'created') {
          result.deliveriesCreated++;
        }
        result.mappingsCreated++;

      } catch (error: any) {
        result.errors.push(`Error processing enhanced delivery mapping: ${error.message}`);
      }
    }
  }

  private async findPrintStageId(): Promise<string> {
    const { data } = await supabase
      .from('production_stages')
      .select('id')
      .ilike('name', '%print%')
      .limit(1);
    
    return data?.[0]?.id || '00000000-0000-0000-0000-000000000000';
  }

  private async findDeliveryStageId(): Promise<string> {
    const { data } = await supabase
      .from('production_stages')
      .select('id')
      .ilike('name', '%delivery%')
      .limit(1);
    
    return data?.[0]?.id || '00000000-0000-0000-0000-000000000000';
  }

  /**
   * Batch create specifications from unique paper combinations
   */
  async createSpecificationsFromUniquePapers(
    paperCombinations: Array<{ type: string; weight: string; frequency: number }>,
    minFrequency: number = 2
  ): Promise<{ created: number; errors: string[] }> {
    const result = { created: 0, errors: [] };

    for (const combo of paperCombinations) {
      if (combo.frequency < minFrequency) continue;

      try {
        const specName = `${combo.type}_${combo.weight}`.toLowerCase().replace(/\s+/g, '_');
        const displayName = `${combo.type} ${combo.weight}`;

        const { error } = await supabase
          .from('print_specifications')
          .insert({
            name: specName,
            display_name: displayName,
            category: 'paper',
            description: `Auto-created from Excel import data (${combo.frequency} occurrences)`,
            properties: {
              paper_type: combo.type,
              paper_weight: combo.weight,
              auto_created: true,
              frequency: combo.frequency
            }
          });

        if (error && !error.message.includes('duplicate key')) {
          result.errors.push(`Failed to create ${displayName}: ${error.message}`);
        } else if (!error) {
          result.created++;
        }

      } catch (error: any) {
        result.errors.push(`Error creating specification: ${error.message}`);
      }
    }

    return result;
  }
}