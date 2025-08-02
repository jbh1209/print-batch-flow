import { supabase } from '@/integrations/supabase/client';
import { parseUnifiedSpecifications, formatPaperDisplay, type LegacySpecifications, type NormalizedSpecification } from '@/utils/specificationParser';
import { debugService } from './DebugService';

interface JobSpecification {
  category: string;
  specification_id: string;
  name: string;
  display_name: string;
  properties: any;
}

interface UnifiedSpecificationResult {
  paperType?: string;
  paperWeight?: string;
  paperSize?: string;
  finishingSpec?: string;
  fullPaperSpec?: string;
  paperDisplay?: string;
  // Part-specific paper specs
  textPaperDisplay?: string;
  coverPaperDisplay?: string;
  specifications: JobSpecification[];
  isLoading: boolean;
  error?: string;
}

class SpecificationUnificationService {
  private cache = new Map<string, { data: UnifiedSpecificationResult; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  private getCacheKey(jobId: string, jobTableName: string): string {
    return `${jobId}-${jobTableName}`;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  async getUnifiedSpecifications(jobId: string, jobTableName: string): Promise<UnifiedSpecificationResult> {
    const cacheKey = this.getCacheKey(jobId, jobTableName);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`📋 Using cached specifications for ${cacheKey}`);
      return cached.data;
    }

    console.log(`🔄 Fetching fresh specifications for ${cacheKey}`);
    
    try {
      const result: UnifiedSpecificationResult = {
        specifications: [],
        isLoading: true
      };

      // 1. Fetch normalized specifications first (highest priority)
      const { data: normalizedData, error: normalizedError } = await supabase
        .rpc('get_job_specifications', {
          p_job_id: jobId,
          p_job_table_name: jobTableName
        });

      if (normalizedError) {
        console.warn('Error fetching normalized specifications:', normalizedError);
      }

      const specifications = normalizedData || [];
      result.specifications = specifications;

      // 2. Fetch legacy specifications (fallback)
      let legacySpecs: LegacySpecifications | null = null;
      if (jobTableName === 'production_jobs') {
        const { data: legacyData, error: legacyError } = await supabase
          .from('production_jobs')
          .select('paper_specifications, printing_specifications, finishing_specifications, delivery_specifications')
          .eq('id', jobId)
          .single();

        if (legacyError && legacyError.code !== 'PGRST116') {
          console.warn('Error fetching legacy specifications:', legacyError);
        } else if (legacyData) {
          legacySpecs = {
            paper_specifications: legacyData.paper_specifications as Record<string, any> || {},
            printing_specifications: legacyData.printing_specifications as Record<string, any> || {},
            finishing_specifications: legacyData.finishing_specifications as Record<string, any> || {},
            delivery_specifications: legacyData.delivery_specifications as Record<string, any> || {}
          };
        }
      }

      // 3. Parse unified specifications using hierarchy
      const normalizedSpecs: NormalizedSpecification[] = specifications.map(spec => ({
        category: spec.category,
        specification_id: spec.specification_id,
        name: spec.name,
        display_name: spec.display_name,
        properties: spec.properties
      }));

      const unifiedSpecs = parseUnifiedSpecifications(legacySpecs, normalizedSpecs);

      // 4. Build final result with all needed properties
      result.paperType = unifiedSpecs.paperType;
      result.paperWeight = unifiedSpecs.paperWeight;
      result.paperSize = unifiedSpecs.paperSize;
      result.finishingSpec = unifiedSpecs.finishingSpec;
      result.fullPaperSpec = unifiedSpecs.fullPaperSpec;
      result.paperDisplay = formatPaperDisplay(unifiedSpecs);
      
      // 5. Parse part-specific paper specifications from legacy data
      if (legacySpecs?.paper_specifications) {
        const { textPaper, coverPaper } = this.parsePartSpecificPapers(legacySpecs.paper_specifications);
        result.textPaperDisplay = textPaper;
        result.coverPaperDisplay = coverPaper;
      }
      
      result.isLoading = false;

      // Cache the result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

      console.log(`✅ Unified specifications ready for ${cacheKey}:`, {
        normalizedCount: specifications.length,
        hasLegacy: !!legacySpecs,
        paperDisplay: result.paperDisplay
      });

      debugService.logSpecificationFetch(jobId, 'unified', result);

      return result;

    } catch (error) {
      console.error('Error in SpecificationUnificationService:', error);
      const errorResult: UnifiedSpecificationResult = {
        specifications: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load specifications'
      };
      return errorResult;
    }
  }

  private parsePartSpecificPapers(paperSpecs: Record<string, any>): { textPaper?: string; coverPaper?: string } {
    const entries = Object.entries(paperSpecs);
    
    if (entries.length === 0) return {};
    
    // Extract paper display from key: "Sappi Laser Pre Print , 70gsm, White, 1000x445" -> "Sappi Laser Pre Print 70gsm"
    const extractPaperDisplay = (key: string): string => {
      const match = key.match(/^([^,]+),\s*(\d+gsm)/);
      return match ? `${match[1].trim()} ${match[2]}` : key;
    };
    
    // Sort by quantity to identify text (higher qty) vs cover (lower qty)
    const sortedByQty = entries
      .filter(([, spec]) => spec && typeof spec === 'object' && spec.qty)
      .sort(([, a], [, b]) => (b.qty || 0) - (a.qty || 0));
    
    const textPaper = sortedByQty[0] ? extractPaperDisplay(sortedByQty[0][0]) : undefined;
    const coverPaper = sortedByQty[1] ? extractPaperDisplay(sortedByQty[1][0]) : undefined;
    
    console.log(`📝 Parsed part-specific papers:`, { 
      textPaper, 
      coverPaper, 
      entriesProcessed: entries.length,
      sortedEntries: sortedByQty.map(([key, spec]) => ({ key, qty: spec.qty }))
    });
    
    return { textPaper, coverPaper };
  }

  getPartSpecificPaper(result: UnifiedSpecificationResult, partAssignment?: string): string {
    if (!partAssignment || partAssignment === 'both') {
      return result.paperDisplay || 'N/A';
    }
    
    if (partAssignment.toLowerCase() === 'text' && result.textPaperDisplay) {
      return result.textPaperDisplay;
    }
    
    if (partAssignment.toLowerCase() === 'cover' && result.coverPaperDisplay) {
      return result.coverPaperDisplay;
    }
    
    // Fallback to general paper display
    return result.paperDisplay || 'N/A';
  }

  getSpecificationValue(result: UnifiedSpecificationResult, category: string, defaultValue: string = 'N/A'): string {
    // Try normalized specifications first
    const spec = result.specifications.find(s => s.category === category);
    if (spec?.display_name) {
      return spec.display_name;
    }

    // Fallback to unified parsed values
    switch (category) {
      case 'paper_type':
        return result.paperType || defaultValue;
      case 'paper_weight':
        return result.paperWeight || defaultValue;
      case 'size':
        return result.paperSize || defaultValue;
      case 'lamination_type':
        return result.finishingSpec || defaultValue;
      default:
        return defaultValue;
    }
  }

  clearCache(jobId?: string, jobTableName?: string): void {
    if (jobId && jobTableName) {
      const key = this.getCacheKey(jobId, jobTableName);
      this.cache.delete(key);
      console.log(`🗑️ Cleared cache for ${key}`);
    } else {
      this.cache.clear();
      console.log('🗑️ Cleared all specification cache');
    }
  }
}

// Export singleton instance
export const specificationUnificationService = new SpecificationUnificationService();