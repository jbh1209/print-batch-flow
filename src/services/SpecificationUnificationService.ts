import { supabase } from '@/integrations/supabase/client';
import { debugService } from './DebugService';

interface JobSpecification {
  category: string;
  specification_id: string;
  name: string;
  display_name: string;
  properties: any;
}

interface UnifiedSpecificationResult {
  // Part-specific paper specs (the only ones needed)
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

  // 2. Fetch paper specifications from job stage instances notes
      if (jobTableName === 'production_jobs') {
        const { data: stageData, error: stageError } = await supabase
          .from('job_stage_instances')
          .select('notes, part_assignment, production_stages!inner(name)')
          .eq('job_id', jobId)
          .eq('job_table_name', jobTableName)
          .in('part_assignment', ['text', 'cover'])
          .not('notes', 'is', null);

        if (stageError) {
          console.warn('Error fetching stage notes:', stageError);
        } else if (stageData && stageData.length > 0) {
          const { textPaper, coverPaper } = this.parsePartSpecificPapersFromNotes(stageData);
          result.textPaperDisplay = textPaper;
          result.coverPaperDisplay = coverPaper;
        }
      }
      
      result.isLoading = false;

      // Cache the result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

      console.log(`✅ Unified specifications ready for ${cacheKey}:`, {
        normalizedCount: specifications.length,
        textPaper: result.textPaperDisplay,
        coverPaper: result.coverPaperDisplay
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

  private parsePartSpecificPapersFromNotes(stageData: any[]): { textPaper?: string; coverPaper?: string } {
    const result: { textPaper?: string; coverPaper?: string } = {};

    stageData.forEach(stage => {
      if (stage.notes && stage.part_assignment) {
        const { parsePaperSpecsFromNotes } = require('@/utils/paperSpecUtils');
        const parsedSpecs = parsePaperSpecsFromNotes(stage.notes);
        
        if (parsedSpecs.fullPaperSpec) {
          if (stage.part_assignment === 'text') {
            result.textPaper = parsedSpecs.fullPaperSpec;
          } else if (stage.part_assignment === 'cover') {
            result.coverPaper = parsedSpecs.fullPaperSpec;
          }
        }
      }
    });

    console.log(`📝 Parsed paper specifications from notes:`, { 
      textPaper: result.textPaper, 
      coverPaper: result.coverPaper,
      stagesProcessed: stageData.length
    });

    return result;
  }

  getPartSpecificPaper(result: UnifiedSpecificationResult, partAssignment?: string): string {
    if (partAssignment?.toLowerCase() === 'text' && result.textPaperDisplay) {
      return result.textPaperDisplay;
    }
    
    if (partAssignment?.toLowerCase() === 'cover' && result.coverPaperDisplay) {
      return result.coverPaperDisplay;
    }
    
    return 'N/A';
  }

  getSpecificationValue(result: UnifiedSpecificationResult, category: string, defaultValue: string = 'N/A'): string {
    const spec = result.specifications.find(s => s.category === category);
    return spec?.display_name || defaultValue;
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