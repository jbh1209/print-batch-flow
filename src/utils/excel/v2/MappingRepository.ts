import { supabase } from "@/integrations/supabase/client";
import { ExcelImportDebugger } from "../debugger";

export interface DatabaseMapping {
  id: string;
  excel_text: string;
  production_stage_id: string | null;
  stage_specification_id: string | null;
  print_specification_id: string | null;
  mapping_type: string;
  confidence_score: number;
}

export interface ProductionStage {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  color: string | null;
}

export interface StageSpecification {
  id: string;
  name: string;
  description: string | null;
  production_stage_id: string;
}

export class MappingRepository {
  private mappingsCache: Map<string, DatabaseMapping[]> = new Map();
  private stagesCache: Map<string, ProductionStage> = new Map();
  private specificationsCache: Map<string, StageSpecification> = new Map();
  private logger: ExcelImportDebugger;
  private isInitialized = false;

  constructor(logger: ExcelImportDebugger) {
    this.logger = logger;
  }

  /**
   * Initialize the repository by loading all mappings and stages
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.logger.addDebugInfo("Initializing MappingRepository...");
    
    try {
      // Load all Excel import mappings
      const { data: mappings, error: mappingsError } = await supabase
        .from('excel_import_mappings')
        .select('*');

      if (mappingsError) throw mappingsError;

      // Index mappings by excel_text for fast lookup
      for (const mapping of mappings || []) {
        const normalizedText = this.normalizeText(mapping.excel_text);
        if (!this.mappingsCache.has(normalizedText)) {
          this.mappingsCache.set(normalizedText, []);
        }
        this.mappingsCache.get(normalizedText)!.push(mapping);
      }

      // Load all production stages
      const { data: stages, error: stagesError } = await supabase
        .from('production_stages')
        .select('*')
        .eq('is_active', true);

      if (stagesError) throw stagesError;

      for (const stage of stages || []) {
        this.stagesCache.set(stage.id, stage);
      }

      // Load all stage specifications
      const { data: specifications, error: specificationsError } = await supabase
        .from('stage_specifications')
        .select('*')
        .eq('is_active', true);

      if (specificationsError) throw specificationsError;

      for (const spec of specifications || []) {
        this.specificationsCache.set(spec.id, spec);
      }

      this.isInitialized = true;
      this.logger.addDebugInfo(`Repository initialized: ${mappings?.length || 0} mappings, ${stages?.length || 0} stages, ${specifications?.length || 0} specifications`);
    } catch (error) {
      this.logger.addDebugInfo(`Repository initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Find exact mapping for Excel text
   */
  findExactMapping(excelText: string): DatabaseMapping | null {
    const normalizedText = this.normalizeText(excelText);
    const mappings = this.mappingsCache.get(normalizedText);
    
    if (!mappings || mappings.length === 0) {
      this.logger.addDebugInfo(`No mapping found for: "${excelText}"`);
      return null;
    }

    // Return the mapping with highest confidence
    const bestMapping = mappings.reduce((best, current) => 
      current.confidence_score > best.confidence_score ? current : best
    );

    this.logger.addDebugInfo(`Found mapping for "${excelText}": stage=${bestMapping.production_stage_id}, confidence=${bestMapping.confidence_score}`);
    return bestMapping;
  }

  /**
   * Get production stage by ID
   */
  getStage(stageId: string): ProductionStage | null {
    return this.stagesCache.get(stageId) || null;
  }

  /**
   * Get stage specification by ID
   */
  getSpecification(specId: string): StageSpecification | null {
    return this.specificationsCache.get(specId) || null;
  }

  /**
   * Get all available stages
   */
  getAllStages(): ProductionStage[] {
    return Array.from(this.stagesCache.values());
  }

  /**
   * Get specifications for a stage
   */
  getSpecificationsForStage(stageId: string): StageSpecification[] {
    return Array.from(this.specificationsCache.values())
      .filter(spec => spec.production_stage_id === stageId);
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
  }
}