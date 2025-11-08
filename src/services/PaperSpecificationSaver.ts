import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from '@/utils/excel/debugger';

export class PaperSpecificationSaver {
  constructor(private logger?: ExcelImportDebugger) {}

  private log(message: string) {
    if (this.logger) {
      this.logger.addDebugInfo(message);
    } else {
      console.log(message);
    }
  }

  /**
   * Save paper specifications to job_print_specifications table
   */
  async savePaperSpecifications(
    jobId: string,
    jobTableName: string,
    paperType?: string,
    paperWeight?: string
  ): Promise<boolean> {
    try {
      this.log(`📝 Saving paper specs for job ${jobId}: type="${paperType}", weight="${paperWeight}"`);

      // Clear existing paper specs for this job
      const { error: deleteError } = await supabase
        .from('job_print_specifications')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .in('specification_category', ['paper_type', 'paper_weight']);

      if (deleteError) {
        this.log(`❌ Error clearing old paper specs: ${deleteError.message}`);
        throw deleteError;
      }

      const specsToInsert: Array<{
        job_id: string;
        job_table_name: string;
        specification_category: string;
        specification_id: string;
      }> = [];

      // Resolve paper type
      if (paperType) {
        const typeId = await this.resolvePaperTypeId(paperType);
        if (typeId) {
          specsToInsert.push({
            job_id: jobId,
            job_table_name: jobTableName,
            specification_category: 'paper_type',
            specification_id: typeId
          });
          this.log(`✅ Resolved paper type "${paperType}" -> ${typeId}`);
        } else {
          this.log(`⚠️ Could not resolve paper type: "${paperType}"`);
        }
      }

      // Resolve paper weight
      if (paperWeight) {
        const weightId = await this.resolvePaperWeightId(paperWeight);
        if (weightId) {
          specsToInsert.push({
            job_id: jobId,
            job_table_name: jobTableName,
            specification_category: 'paper_weight',
            specification_id: weightId
          });
          this.log(`✅ Resolved paper weight "${paperWeight}" -> ${weightId}`);
        } else {
          this.log(`⚠️ Could not resolve paper weight: "${paperWeight}"`);
        }
      }

      // Insert resolved specifications
      if (specsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('job_print_specifications')
          .insert(specsToInsert);

        if (insertError) {
          this.log(`❌ Error inserting paper specs: ${insertError.message}`);
          throw insertError;
        }

        this.log(`✅ Successfully saved ${specsToInsert.length} paper specification(s)`);
        return true;
      } else {
        this.log(`⚠️ No paper specifications to save`);
        return false;
      }
    } catch (error) {
      this.log(`❌ Error saving paper specifications: ${error}`);
      console.error('Paper specification save error:', error);
      return false;
    }
  }

  /**
   * Resolve paper type name to specification ID
   */
  private async resolvePaperTypeId(paperType: string): Promise<string | null> {
    if (!paperType) return null;

    try {
      // Normalize the paper type
      const normalized = this.normalizePaperType(paperType);

      // Try exact match first
      let { data, error } = await supabase
        .from('print_specifications')
        .select('id, name, display_name')
        .eq('category', 'paper_type')
        .eq('is_active', true)
        .or(`name.ilike.%${normalized}%,display_name.ilike.%${normalized}%`)
        .limit(1)
        .maybeSingle();

      if (error) {
        this.log(`Error querying paper_type: ${error.message}`);
        return null;
      }

      if (data) {
        return data.id;
      }

      // Try fuzzy match with common variations
      const variations = this.getPaperTypeVariations(paperType);
      for (const variation of variations) {
        const { data: varData } = await supabase
          .from('print_specifications')
          .select('id')
          .eq('category', 'paper_type')
          .eq('is_active', true)
          .or(`name.ilike.%${variation}%,display_name.ilike.%${variation}%`)
          .limit(1)
          .maybeSingle();

        if (varData) {
          return varData.id;
        }
      }

      return null;
    } catch (error) {
      this.log(`Exception resolving paper type: ${error}`);
      return null;
    }
  }

  /**
   * Resolve paper weight to specification ID
   */
  private async resolvePaperWeightId(paperWeight: string): Promise<string | null> {
    if (!paperWeight) return null;

    try {
      // Normalize the weight (e.g., "300gsm" -> "300")
      const normalized = this.normalizePaperWeight(paperWeight);

      // Try exact match first
      let { data, error } = await supabase
        .from('print_specifications')
        .select('id, name, display_name')
        .eq('category', 'paper_weight')
        .eq('is_active', true)
        .or(`name.ilike.%${normalized}%,display_name.ilike.%${normalized}%`)
        .limit(1)
        .maybeSingle();

      if (error) {
        this.log(`Error querying paper_weight: ${error.message}`);
        return null;
      }

      if (data) {
        return data.id;
      }

      // Try with common variations
      const variations = this.getPaperWeightVariations(paperWeight);
      for (const variation of variations) {
        const { data: varData } = await supabase
          .from('print_specifications')
          .select('id')
          .eq('category', 'paper_weight')
          .eq('is_active', true)
          .or(`name.ilike.%${variation}%,display_name.ilike.%${variation}%`)
          .limit(1)
          .maybeSingle();

        if (varData) {
          return varData.id;
        }
      }

      return null;
    } catch (error) {
      this.log(`Exception resolving paper weight: ${error}`);
      return null;
    }
  }

  /**
   * Normalize paper type for matching
   */
  private normalizePaperType(paperType: string): string {
    return paperType
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Generate variations of paper type for fuzzy matching
   */
  private getPaperTypeVariations(paperType: string): string[] {
    const normalized = paperType.toLowerCase().trim();
    const variations = [
      normalized,
      normalized.replace(/\s+/g, ''),
      normalized.replace(/[^a-z]/g, '')
    ];

    // Common aliases
    const aliases: Record<string, string[]> = {
      'gloss': ['glossy', 'gloss art'],
      'matt': ['matte', 'mat', 'matt art'],
      'silk': ['satin', 'silk art'],
      'bond': ['copy', 'offset'],
      'uncoated': ['offset', 'bond']
    };

    const normalizedLower = normalized.toLowerCase();
    for (const [key, values] of Object.entries(aliases)) {
      if (normalizedLower.includes(key)) {
        variations.push(...values);
      }
    }

    return [...new Set(variations)];
  }

  /**
   * Normalize paper weight for matching
   */
  private normalizePaperWeight(paperWeight: string): string {
    // Extract numeric value (e.g., "300gsm" -> "300", "170 gsm" -> "170")
    const match = paperWeight.match(/(\d+)/);
    return match ? match[1] : paperWeight.toLowerCase().trim();
  }

  /**
   * Generate variations of paper weight for fuzzy matching
   */
  private getPaperWeightVariations(paperWeight: string): string[] {
    const numeric = this.normalizePaperWeight(paperWeight);
    return [
      numeric,
      `${numeric}gsm`,
      `${numeric} gsm`,
      `${numeric}g`,
      `${numeric} g`
    ];
  }
}
