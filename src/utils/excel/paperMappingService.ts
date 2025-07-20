
import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from './debugger';

interface PaperMappingResult {
  cleanSpecification: string;
  confidence: number;
  mappingSource: 'exact' | 'partial' | 'pattern' | 'fallback';
}

export class PaperMappingService {
  private printSpecifications: any[] = [];
  private excelMappings: any[] = [];
  private logger: ExcelImportDebugger;

  constructor(logger: ExcelImportDebugger) {
    this.logger = logger;
  }

  async initialize() {
    // Load print specifications
    const { data: specsData } = await supabase
      .from('print_specifications')
      .select('id, name, display_name, category')
      .eq('is_active', true)
      .in('category', ['paper_type', 'paper_weight']);
    
    this.printSpecifications = specsData || [];

    // Load excel mappings for paper
    const { data: mappingsData } = await supabase
      .from('excel_import_mappings')
      .select('*')
      .eq('mapping_type', 'paper_specification');
    
    this.excelMappings = mappingsData || [];
    
    this.logger.addDebugInfo(`🗂️ PaperMappingService initialized with ${this.printSpecifications.length} specs and ${this.excelMappings.length} mappings`);
  }

  /**
   * Map raw Excel paper description to clean database specification
   */
  async mapPaperSpecification(rawDescription: string): Promise<string> {
    if (!rawDescription) return '';

    this.logger.addDebugInfo(`🔍 PAPER MAPPING: "${rawDescription}"`);

    // 1. Try exact Excel mapping first
    const exactMapping = this.excelMappings.find(mapping => 
      mapping.excel_text.toLowerCase().trim() === rawDescription.toLowerCase().trim()
    );

    if (exactMapping) {
      const result = await this.buildCleanSpecFromMapping(exactMapping);
      if (result) {
        this.logger.addDebugInfo(`💯 EXACT MAPPING: "${rawDescription}" -> "${result}"`);
        return result;
      }
    }

    // 2. Try partial Excel mapping
    const partialMapping = this.excelMappings.find(mapping => 
      rawDescription.toLowerCase().includes(mapping.excel_text.toLowerCase()) ||
      mapping.excel_text.toLowerCase().includes(rawDescription.toLowerCase())
    );

    if (partialMapping) {
      const result = await this.buildCleanSpecFromMapping(partialMapping);
      if (result) {
        this.logger.addDebugInfo(`🔄 PARTIAL MAPPING: "${rawDescription}" -> "${result}"`);
        return result;
      }
    }

    // 3. Try pattern matching
    const patternResult = this.matchByPatterns(rawDescription);
    if (patternResult) {
      this.logger.addDebugInfo(`🔍 PATTERN MATCH: "${rawDescription}" -> "${patternResult}"`);
      return patternResult;
    }

    // 4. Fallback to raw description
    this.logger.addDebugInfo(`⚠️ NO MAPPING FOUND: "${rawDescription}" - using raw`);
    return rawDescription;
  }

  private async buildCleanSpecFromMapping(mapping: any): Promise<string | null> {
    let typeSpec = '';
    let weightSpec = '';

    // Get paper type if mapped
    if (mapping.paper_type_specification_id || mapping.print_specification_id) {
      const typeId = mapping.paper_type_specification_id || mapping.print_specification_id;
      const type = this.printSpecifications.find(spec => 
        spec.id === typeId && spec.category === 'paper_type'
      );
      if (type) {
        typeSpec = type.display_name;
      }
    }

    // Get paper weight if mapped
    if (mapping.paper_weight_specification_id || mapping.print_specification_id) {
      const weightId = mapping.paper_weight_specification_id || mapping.print_specification_id;
      const weight = this.printSpecifications.find(spec => 
        spec.id === weightId && spec.category === 'paper_weight'
      );
      if (weight) {
        weightSpec = weight.display_name;
      }
    }

    // Build clean specification
    if (typeSpec && weightSpec) {
      return `${typeSpec} ${weightSpec}`;
    } else if (typeSpec) {
      return typeSpec;
    } else if (weightSpec) {
      return weightSpec;
    }

    return null;
  }

  private matchByPatterns(rawDescription: string): string | null {
    const lowerDesc = rawDescription.toLowerCase();
    let matchedType = '';
    let matchedWeight = '';

    // Find paper type by pattern matching
    for (const spec of this.printSpecifications.filter(s => s.category === 'paper_type')) {
      if (lowerDesc.includes(spec.name.toLowerCase()) || 
          lowerDesc.includes(spec.display_name.toLowerCase())) {
        matchedType = spec.display_name;
        break;
      }
    }

    // Find paper weight by pattern matching
    for (const spec of this.printSpecifications.filter(s => s.category === 'paper_weight')) {
      const weightValue = spec.name.replace(/gsm|mic/gi, '');
      if (lowerDesc.includes(weightValue) || 
          lowerDesc.includes(spec.display_name.toLowerCase())) {
        matchedWeight = spec.display_name;
        break;
      }
    }

    // Build result
    if (matchedType && matchedWeight) {
      return `${matchedType} ${matchedWeight}`;
    } else if (matchedType) {
      return matchedType;
    } else if (matchedWeight) {
      return matchedWeight;
    }

    return null;
  }
}
