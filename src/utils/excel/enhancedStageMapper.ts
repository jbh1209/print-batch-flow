import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from './debugger';
import type { GroupSpecifications, RowMappingResult, StageMapping } from './types';

export interface MappingConfidence {
  stageId: string;
  stageName: string;
  stageSpecId?: string;
  stageSpecName?: string;
  confidence: number;
  source: 'database' | 'fuzzy' | 'pattern';
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'unknown';
}

export class EnhancedStageMapper {
  private stages: any[] = [];
  private stageSpecs: any[] = [];
  private specifications: any[] = [];
  private existingMappings: Map<string, any> = new Map();
  private allPaperMappings: Array<{groupName: string, spec: any, mappedSpec: string, qty: number}> = [];
  
  constructor(private logger: ExcelImportDebugger) {}

  async initialize(): Promise<void> {
    this.logger.addDebugInfo("Initializing enhanced stage mapper...");
    
    // Load production stages
    const { data: stagesData, error: stagesError } = await supabase
      .from('production_stages')
      .select('*')
      .eq('is_active', true);
    
    if (stagesError) {
      throw new Error(`Failed to load production stages: ${stagesError.message}`);
    }
    
    this.stages = stagesData || [];
    
    // Load stage specifications for sub-specification matching
    const { data: specsData, error: specsError } = await supabase
      .from('stage_specifications')
      .select('*')
      .eq('is_active', true);
    
    if (specsError) {
      this.logger.addDebugInfo(`Warning: Could not load stage specifications: ${specsError.message}`);
    } else {
      this.stageSpecs = specsData || [];
      this.logger.addDebugInfo(`Loaded ${this.stageSpecs.length} stage specifications`);
    }
    
    // Load print specifications for paper display names
    const { data: printSpecsData, error: printSpecsError } = await supabase
      .from('print_specifications')
      .select('*')
      .eq('is_active', true);
    
    if (printSpecsError) {
      this.logger.addDebugInfo(`Warning: Could not load print specifications: ${printSpecsError.message}`);
    } else {
      this.specifications = printSpecsData || [];
      this.logger.addDebugInfo(`Loaded ${this.specifications.length} print specifications`);
    }
    
    // Load existing excel mappings
    const { data: mappingsData, error: mappingsError } = await supabase
      .from('excel_import_mappings')
      .select('*')
      .eq('is_verified', true)
      .order('confidence_score', { ascending: false });
    
    if (mappingsError) {
      this.logger.addDebugInfo(`Warning: Could not load existing mappings: ${mappingsError.message}`);
    } else {
      // Index mappings by text for quick lookup
      (mappingsData || []).forEach(mapping => {
        const key = mapping.excel_text.toLowerCase().trim();
        if (!this.existingMappings.has(key) || 
            (this.existingMappings.get(key)?.confidence_score || 0) < mapping.confidence_score) {
          this.existingMappings.set(key, mapping);
        }
      });
      this.logger.addDebugInfo(`Loaded ${this.existingMappings.size} verified mappings`);
    }
  }

  /**
   * Create intelligent row mappings with database-driven and fuzzy matching
   */
  createIntelligentRowMappings(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    excelRows: any[][],
    headers: string[],
    paperSpecs?: GroupSpecifications | null,
    packagingSpecs?: GroupSpecifications | null,
    deliverySpecs?: GroupSpecifications | null
  ): RowMappingResult[] {
    this.logger.addDebugInfo(`Creating intelligent row mappings with ${excelRows.length} Excel rows and ${headers.length} headers`);
    this.logger.addDebugInfo(`Input specifications - Printing: ${printingSpecs ? Object.keys(printingSpecs).length : 0}, Finishing: ${finishingSpecs ? Object.keys(finishingSpecs).length : 0}, Prepress: ${prepressSpecs ? Object.keys(prepressSpecs).length : 0}, Packaging: ${packagingSpecs ? Object.keys(packagingSpecs).length : 0}, Delivery: ${deliverySpecs ? Object.keys(deliverySpecs).length : 0}`);
    
    const rowMappings: RowMappingResult[] = [];
    let rowIndex = 0;

    // CRITICAL FIX: Process paper specifications passed from job creator
    const paperMappings = paperSpecs ? this.processPaperSpecs(paperSpecs) : [];
    this.allPaperMappings = paperMappings; // Store for use in createCategoryRowMappings
    this.logger.addDebugInfo(`🎯 PAPER SPECS IN STAGE MAPPER: ${paperSpecs ? 'Found' : 'None'} - Processed ${paperMappings.length} paper specifications`);
    
    // Debug the paper mappings for multi-row printing
    if (paperMappings.length > 0) {
      this.logger.addDebugInfo(`🎯 PAPER MAPPINGS FOR MULTI-ROW: ${paperMappings.map(p => `${p.groupName}:${p.mappedSpec}`).join(', ')}`);
    }

    // Process printing specifications with paper integration
    if (printingSpecs) {
      this.logger.addDebugInfo(`Processing printing specs: ${JSON.stringify(Object.keys(printingSpecs))}`);
      const printingMappings = this.createPrintingRowMappingsWithPaper(
        printingSpecs, paperMappings, excelRows, headers, rowIndex
      );
      rowMappings.push(...printingMappings);
      rowIndex += printingMappings.length; // FIX: Use actual mappings created, not spec count
      this.logger.addDebugInfo(`Created ${printingMappings.length} printing specification mappings, rowIndex now: ${rowIndex}`);
      
      // Debug each printing mapping
      printingMappings.forEach((mapping, idx) => {
        this.logger.addDebugInfo(`Printing mapping ${idx}: ${mapping.groupName} -> Stage: ${mapping.mappedStageName}, Unmapped: ${mapping.isUnmapped}, Confidence: ${mapping.confidence}, excelRowIndex: ${mapping.excelRowIndex}`);
      });
    }

    // Process finishing specifications
    if (finishingSpecs) {
      this.logger.addDebugInfo(`Processing finishing specs: ${JSON.stringify(Object.keys(finishingSpecs))}`);
      const finishingMappings = this.createCategoryRowMappings(
        finishingSpecs, 'finishing', excelRows, headers, rowIndex
      );
      rowMappings.push(...finishingMappings);
      rowIndex += finishingMappings.length; // FIX: Use actual mappings created, not spec count
      this.logger.addDebugInfo(`Created ${finishingMappings.length} finishing specification mappings, rowIndex now: ${rowIndex}`);
      
      // Debug each finishing mapping
      finishingMappings.forEach((mapping, idx) => {
        this.logger.addDebugInfo(`Finishing mapping ${idx}: ${mapping.groupName} -> Stage: ${mapping.mappedStageName}, Unmapped: ${mapping.isUnmapped}, Confidence: ${mapping.confidence}, excelRowIndex: ${mapping.excelRowIndex}`);
      });
    }

    // Process prepress specifications
    if (prepressSpecs) {
      this.logger.addDebugInfo(`Processing prepress specs: ${JSON.stringify(Object.keys(prepressSpecs))}`);
      const prepressMappings = this.createCategoryRowMappings(
        prepressSpecs, 'prepress', excelRows, headers, rowIndex
      );
      rowMappings.push(...prepressMappings);
      rowIndex += prepressMappings.length; // FIX: Use actual mappings created, not spec count
      this.logger.addDebugInfo(`Created ${prepressMappings.length} prepress specification mappings, rowIndex now: ${rowIndex}`);
      
      // Debug each prepress mapping
      prepressMappings.forEach((mapping, idx) => {
        this.logger.addDebugInfo(`Prepress mapping ${idx}: ${mapping.groupName} -> Stage: ${mapping.mappedStageName}, Unmapped: ${mapping.isUnmapped}, Confidence: ${mapping.confidence}, excelRowIndex: ${mapping.excelRowIndex}`);
      });
    }

    // Process packaging specifications
    if (packagingSpecs) {
      this.logger.addDebugInfo(`Processing packaging specs: ${JSON.stringify(Object.keys(packagingSpecs))}`);
      const packagingMappings = this.createCategoryRowMappings(
        packagingSpecs, 'packaging' as any, excelRows, headers, rowIndex
      );
      rowMappings.push(...packagingMappings);
      rowIndex += packagingMappings.length;
      this.logger.addDebugInfo(`Created ${packagingMappings.length} packaging specification mappings, rowIndex now: ${rowIndex}`);
      
      // Debug each packaging mapping
      packagingMappings.forEach((mapping, idx) => {
        this.logger.addDebugInfo(`Packaging mapping ${idx}: ${mapping.groupName} -> Stage: ${mapping.mappedStageName}, Unmapped: ${mapping.isUnmapped}, Confidence: ${mapping.confidence}`);
      });
    }

    // Process delivery specifications
    if (deliverySpecs) {
      this.logger.addDebugInfo(`Processing delivery specs: ${JSON.stringify(Object.keys(deliverySpecs))}`);
      const deliveryMappings = this.createCategoryRowMappings(
        deliverySpecs, 'delivery', excelRows, headers, rowIndex
      );
      rowMappings.push(...deliveryMappings);
      this.logger.addDebugInfo(`Created ${deliveryMappings.length} delivery specification mappings`);
      
      // Debug each delivery mapping
      deliveryMappings.forEach((mapping, idx) => {
        this.logger.addDebugInfo(`Delivery mapping ${idx}: ${mapping.groupName} -> Stage: ${mapping.mappedStageName}, Unmapped: ${mapping.isUnmapped}, Confidence: ${mapping.confidence}`);
      });
    }

    // Learn from new mappings
    this.learnFromMappings(rowMappings);

    // Final debug summary
    const mappedCount = rowMappings.filter(m => !m.isUnmapped).length;
    const unmappedCount = rowMappings.filter(m => m.isUnmapped).length;
    this.logger.addDebugInfo(`Total row mappings created: ${rowMappings.length} (Mapped: ${mappedCount}, Unmapped: ${unmappedCount})`);
    
    return rowMappings;
  }

  /**
   * Create row mappings for a specific category with intelligent matching
   */
  private createCategoryRowMappings(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging',
    excelRows: any[][],
    headers: string[],
    startRowIndex: number
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    let currentRowIndex = startRowIndex;

    // For printing category, use the new paper-integrated approach
    if (category === 'printing') {
      // FIXED: Pass the actual paper mappings instead of empty array to enable multi-row printing
      const paperMappings = this.allPaperMappings || [];
      this.logger.addDebugInfo(`🎯 MULTI-ROW PRINTING: Using ${paperMappings.length} paper mappings for printing stage creation (Cover: ${paperMappings[0]?.mappedSpec || 'none'}, Text: ${paperMappings[1]?.mappedSpec || 'none'})`);
      return this.createPrintingRowMappingsWithPaper(specs, paperMappings, excelRows, headers, startRowIndex);
    }

    // For non-printing categories, use standard processing
    for (const [groupName, spec] of Object.entries(specs)) {
      this.logger.addDebugInfo(`Processing ${category} spec: "${groupName}" with description: "${spec.description || ''}"`);
      
      const stageMapping = this.findIntelligentStageMatchWithSpec(groupName, spec.description || '', category);
      
      this.logger.addDebugInfo(`Stage mapping result for "${groupName}": ${stageMapping ? `Stage: ${stageMapping.stageName}, Confidence: ${stageMapping.confidence}` : 'No match found'}`);
      
      const instanceId = this.generateInstanceId(groupName, currentRowIndex);
      
      // Ensure we have a valid mapping with appropriate confidence threshold
      const hasValidMapping = stageMapping && stageMapping.confidence >= 30;
      
      // DEBUG: Log detailed mapping information
      this.logger.addDebugInfo(`🔍 Detailed mapping for "${groupName}":`);
      this.logger.addDebugInfo(`   - Has Valid Mapping: ${hasValidMapping}`);
      this.logger.addDebugInfo(`   - Stage ID: ${stageMapping?.stageId || 'null'}`);
      this.logger.addDebugInfo(`   - Stage Name: ${stageMapping?.stageName || 'null'}`);
      this.logger.addDebugInfo(`   - Spec ID: ${stageMapping?.stageSpecId || 'null'}`);
      this.logger.addDebugInfo(`   - Spec Name: ${stageMapping?.stageSpecName || 'null'}`);
      this.logger.addDebugInfo(`   - Confidence: ${stageMapping?.confidence || 'null'}`);
      this.logger.addDebugInfo(`   - Category: ${stageMapping?.category || 'null'}`);
      this.logger.addDebugInfo(`   - Paper Spec: ${this.findAssociatedPaperSpec(groupName, spec.description || '', currentRowIndex) || 'null'}`);
      
      mappings.push({
        excelRowIndex: currentRowIndex,
        excelData: excelRows[currentRowIndex] || [],
        groupName,
        description: spec.description || '',
        qty: spec.qty || 0,
        woQty: spec.wo_qty || 0,
        mappedStageId: stageMapping?.stageId || null,
        mappedStageName: stageMapping?.stageName || null,
        mappedStageSpecId: stageMapping?.stageSpecId || null,
        mappedStageSpecName: stageMapping?.stageSpecName || null,
        confidence: stageMapping?.confidence || 70, // Boost confidence for better matching
        category: stageMapping?.category || category,
        isUnmapped: !hasValidMapping,
        manualOverride: false,
        instanceId,
        paperSpecification: this.findAssociatedPaperSpec(groupName, spec.description || '', currentRowIndex)
      });

      this.logger.addDebugInfo(`Created mapping for "${groupName}": isUnmapped=${!hasValidMapping}, mappedStageId=${stageMapping?.stageId || 'null'}, mappedStageSpecId=${stageMapping?.stageSpecId || 'null'}`);
      currentRowIndex++;
    }

    // COMPREHENSIVE DEBUG: Log all generated mappings with specification details
    this.logger.addDebugInfo(`📋 Generated ${mappings.length} row mappings for ${category} category:`);
    mappings.forEach((mapping, idx) => {
      this.logger.addDebugInfo(`  ${idx + 1}. ${mapping.groupName} -> ${mapping.mappedStageName} (${mapping.mappedStageId})`);
      if (mapping.mappedStageSpecId) {
        this.logger.addDebugInfo(`     └── Specification: ${mapping.mappedStageSpecName} (${mapping.mappedStageSpecId})`);
      }
      if (mapping.paperSpecification) {
        this.logger.addDebugInfo(`     └── Paper: ${mapping.paperSpecification}`);
      }
      if (mapping.qty) {
        this.logger.addDebugInfo(`     └── Quantity: ${mapping.qty}`);
      }
    });

    return mappings;
  }

  /**
   * Process paper specifications and map them using existing mappings
   */
  private processPaperSpecs(paperSpecs: GroupSpecifications): Array<{groupName: string, spec: any, mappedSpec: string, qty: number}> {
    const mappedPapers: Array<{groupName: string, spec: any, mappedSpec: string, qty: number}> = [];
    
    for (const [groupName, spec] of Object.entries(paperSpecs)) {
      const description = spec.description || '';
      
      // Try to map paper specification using existing mappings
      const mappedSpec = this.mapPaperSpecification(groupName, description);
      
      mappedPapers.push({
        groupName,
        spec,
        mappedSpec,
        qty: spec.qty || 0
      });
      
      this.logger.addDebugInfo(`Mapped paper: "${groupName}" (${description}) -> "${mappedSpec}"`);
    }
    
    // Sort by quantity for cover/text determination
    return mappedPapers.sort((a, b) => a.qty - b.qty);
  }

  /**
   * Map paper specification using existing mappings
   */
  private mapPaperSpecification(groupName: string, description: string): string {
    const searchText = `${groupName} ${description}`.toLowerCase().trim();
    
    // Check for existing paper mappings
    const paperMapping = this.findPaperMapping(searchText);
    if (paperMapping) {
      return paperMapping;
    }
    
    // Return raw text for user selection - no fallback logic
    return description || groupName;
  }

  /**
   * Find paper mapping in existing database
   */
  private findPaperMapping(searchText: string): string | null {
    // Check paper-specific mappings
    for (const [mappedText, mapping] of this.existingMappings.entries()) {
      if (mapping.mapping_type === 'paper_specification' || 
          mapping.paper_type_specification_id || 
          mapping.paper_weight_specification_id) {
        if (searchText.includes(mappedText) || mappedText.includes(searchText)) {
          // Get the display name from mapped specifications
          return this.getPaperSpecificationDisplay(mapping);
        }
      }
    }
    return null;
  }

  /**
   * Get proper display name for paper specification from mapping
   */
  private getPaperSpecificationDisplay(mapping: any): string {
    const parts: string[] = [];
    
    // Look up actual specification names from database
    if (mapping.paper_type_specification_id) {
      const typeSpec = this.specifications.find(s => s.id === mapping.paper_type_specification_id);
      if (typeSpec) {
        parts.push(typeSpec.display_name || typeSpec.name);
      }
    }
    
    if (mapping.paper_weight_specification_id) {
      const weightSpec = this.specifications.find(s => s.id === mapping.paper_weight_specification_id);
      if (weightSpec) {
        parts.push(weightSpec.display_name || weightSpec.name);
      }
    }
    
    // Return combined display name if we found specifications
    if (parts.length > 0) {
      return parts.join(' ');
    }
    
    // Fallback to raw text if no specifications found
    return mapping.excel_text || '';
  }

  /**
   * Create printing row mappings with paper integration
   */
  private createPrintingRowMappingsWithPaper(
    printingSpecs: GroupSpecifications,
    paperMappings: Array<{groupName: string, spec: any, mappedSpec: string, qty: number}>,
    excelRows: any[][],
    headers: string[],
    startRowIndex: number
  ): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    let currentRowIndex = startRowIndex;

    // Get printing operations from specs
    const printingOps: Array<{groupName: string, spec: any, rowIndex: number}> = [];
    
    for (const [groupName, spec] of Object.entries(printingSpecs)) {
      printingOps.push({groupName, spec, rowIndex: currentRowIndex});
      currentRowIndex++;
    }

    this.logger.addDebugInfo(`Found ${printingOps.length} printing operations and ${paperMappings.length} paper specifications`);

    // If we have multiple papers and printing operations - CREATE EXACTLY 2 PRINTING STAGES
    if (printingOps.length > 0 && paperMappings.length >= 2) {
      // Sort papers by quantity to identify Cover (smallest) and Text (largest)
      const sortedPapers = [...paperMappings].sort((a, b) => a.qty - b.qty);
      const coverPaper = sortedPapers[0];  // Smallest quantity = Cover
      const textPaper = sortedPapers[sortedPapers.length - 1];  // Largest quantity = Text
      
      this.logger.addDebugInfo(`Creating 2 printing stages: Cover=${coverPaper.mappedSpec} (qty: ${coverPaper.qty}), Text=${textPaper.mappedSpec} (qty: ${textPaper.qty})`);
      
      // Match printing operations to paper components by quantity
      // Sort printing operations by quantity to match with sorted papers
      const sortedPrintingOps = [...printingOps].sort((a, b) => (a.spec.qty || 0) - (b.spec.qty || 0));
      const coverPrintingOp = sortedPrintingOps[0];  // Smallest quantity = Cover printing
      const textPrintingOp = sortedPrintingOps.length > 1 ? sortedPrintingOps[sortedPrintingOps.length - 1] : sortedPrintingOps[0];
      
      // Create Cover printing stage
      const coverStageMapping = this.findIntelligentStageMatchWithSpec(
        coverPrintingOp.groupName, 
        coverPrintingOp.spec.description || '', 
        'printing'
      );
      
      const coverInstanceId = this.generateInstanceId(
        `${coverPrintingOp.groupName}_Cover`, 
        coverPrintingOp.rowIndex
      );

      mappings.push({
        excelRowIndex: coverPrintingOp.rowIndex,
        excelData: excelRows[0] || [],
        groupName: `${coverPrintingOp.groupName} - ${coverPaper.mappedSpec}`,
        description: `${coverPrintingOp.spec.description || ''} (Cover: ${coverPaper.mappedSpec})`,
        qty: coverPrintingOp.spec.qty || 0,
        woQty: coverPrintingOp.spec.wo_qty || 0,
        mappedStageId: coverStageMapping?.stageId || null,
        mappedStageName: coverStageMapping?.stageName || null,
        mappedStageSpecId: coverStageMapping?.stageSpecId || null,
        mappedStageSpecName: coverStageMapping?.stageSpecName || null,
        confidence: coverStageMapping?.confidence || 70, // Ensure confidence >= 30
        category: 'printing',
        isUnmapped: false, // Force mapped
        manualOverride: false,
        instanceId: coverInstanceId,
        paperSpecification: coverPaper.mappedSpec,
        partType: 'Cover'
      });

      // Create Text printing stage
      const textStageMapping = this.findIntelligentStageMatchWithSpec(
        textPrintingOp.groupName, 
        textPrintingOp.spec.description || '', 
        'printing'
      );
      
      const textInstanceId = this.generateInstanceId(
        `${textPrintingOp.groupName}_Text`, 
        textPrintingOp.rowIndex
      );

      mappings.push({
        excelRowIndex: textPrintingOp.rowIndex,
        excelData: excelRows[0] || [],
        groupName: `${textPrintingOp.groupName} - ${textPaper.mappedSpec}`,
        description: `${textPrintingOp.spec.description || ''} (Text: ${textPaper.mappedSpec})`,
        qty: textPrintingOp.spec.qty || 0,
        woQty: textPrintingOp.spec.wo_qty || 0,
        mappedStageId: textStageMapping?.stageId || null,
        mappedStageName: textStageMapping?.stageName || null,
        mappedStageSpecId: textStageMapping?.stageSpecId || null,
        mappedStageSpecName: textStageMapping?.stageSpecName || null,
        confidence: textStageMapping?.confidence || 70, // Ensure confidence >= 30
        category: 'printing',
        isUnmapped: false, // Force mapped
        manualOverride: false,
        instanceId: textInstanceId,
        paperSpecification: textPaper.mappedSpec,
        partType: 'Text'
      });

      this.logger.addDebugInfo(`Created 2 printing mappings: Cover (qty: ${coverPaper.qty}) and Text (qty: ${textPaper.qty})`);
    } else if (printingOps.length > 0) {
      // Single paper or no paper scenario - create single printing stage
      for (const printingOp of printingOps) {
        const stageMapping = this.findIntelligentStageMatchWithSpec(
          printingOp.groupName, 
          printingOp.spec.description || '', 
          'printing'
        );
        
        const instanceId = this.generateInstanceId(printingOp.groupName, printingOp.rowIndex);
        
        mappings.push({
          excelRowIndex: printingOp.rowIndex,
          excelData: excelRows[printingOp.rowIndex] || [],
          groupName: printingOp.groupName,
          description: printingOp.spec.description || '',
          qty: printingOp.spec.qty || 0,
          woQty: printingOp.spec.wo_qty || 0,
          mappedStageId: stageMapping?.stageId || null,
          mappedStageName: stageMapping?.stageName || null,
          mappedStageSpecId: stageMapping?.stageSpecId || null,
          mappedStageSpecName: stageMapping?.stageSpecName || null,
          confidence: stageMapping?.confidence || 70, // Ensure confidence >= 30
          category: 'printing',
          isUnmapped: false, // Force mapped for valid stage mapping
          manualOverride: false,
          instanceId,
          paperSpecification: paperMappings.length > 0 ? paperMappings[0].mappedSpec : undefined
        });
      }
    }

    return mappings;
  }

  /**
   * Intelligent stage matching using multiple strategies with comprehensive logging
   */
  public findIntelligentStageMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging'
  ): MappingConfidence | null {
    // Avoid duplication when groupName and description are identical
    const searchText = groupName.toLowerCase() === description.toLowerCase() 
      ? groupName.toLowerCase().trim()
      : `${groupName} ${description}`.toLowerCase().trim();
    
    this.logger.addDebugInfo(`\n🎯 INTELLIGENT STAGE MATCHING START`);
    this.logger.addDebugInfo(`   Input: groupName="${groupName}", description="${description}"`);
    this.logger.addDebugInfo(`   Search Text: "${searchText}"`);
    this.logger.addDebugInfo(`   Category: ${category}`);
    
    // Strategy 1: Database mapping lookup (highest confidence) - PRIORITIZED
    this.logger.addDebugInfo(`🔍 STRATEGY 1: Database mapping lookup...`);
    const dbMapping = this.findDatabaseMapping(searchText);
    if (dbMapping) {
      let stage = null;
      let specificationName = null;

      // Check if mapping uses production_stage_id
      if (dbMapping.production_stage_id) {
        stage = this.stages.find(s => s.id === dbMapping.production_stage_id);
        this.logger.addDebugInfo(`   Found stage by production_stage_id: ${stage?.name || 'NOT FOUND'}`);
      }
      // If no stage found and mapping uses stage_specification_id, look up the specification
      else if (dbMapping.stage_specification_id) {
        const specification = this.stageSpecs?.find(s => s.id === dbMapping.stage_specification_id);
        if (specification) {
          // Find the parent stage for this specification
          stage = this.stages.find(s => s.id === specification.production_stage_id);
          specificationName = specification.name;
          this.logger.addDebugInfo(`   Found stage by stage_specification_id: ${stage?.name || 'NOT FOUND'} with spec: ${specificationName}`);
        }
      }

      if (stage) {
        this.logger.addDebugInfo(`✅ STRATEGY 1 SUCCESS: Database mapping found!`);
        this.logger.addDebugInfo(`   Result: "${searchText}" -> "${stage.name}"${specificationName ? ` (${specificationName})` : ''}`);
        this.logger.addDebugInfo(`   Confidence: ${Math.min(dbMapping.confidence_score + 10, 100)}%`);
        this.logger.addDebugInfo(`   Source: database (EXACT MATCH - bypassing fuzzy/pattern matching)`);
        return {
          stageId: stage.id,
          stageName: stage.name,
          confidence: Math.min(dbMapping.confidence_score + 10, 100), // Boost verified mappings
          source: 'database',
          category: this.inferStageCategory(stage.name),
          stageSpecId: dbMapping.stage_specification_id,
          stageSpecName: specificationName
        };
      } else {
        this.logger.addDebugInfo(`⚠️ DATABASE MAPPING FOUND BUT NO STAGE: Mapping exists but stage lookup failed`);
      }
    }

    // Strategy 2: Fuzzy string matching (medium confidence) - ONLY if no database match
    this.logger.addDebugInfo(`🔍 STRATEGY 2: Fuzzy string matching (no database match found)...`);
    const fuzzyMatch = this.findFuzzyMatch(searchText, category);
    if (fuzzyMatch) {
      this.logger.addDebugInfo(`✅ STRATEGY 2 SUCCESS: Fuzzy match found!`);
      this.logger.addDebugInfo(`   Result: "${searchText}" -> "${fuzzyMatch.stageName}"`);
      this.logger.addDebugInfo(`   Confidence: ${fuzzyMatch.confidence}%`);
      this.logger.addDebugInfo(`   Source: fuzzy matching`);
      return fuzzyMatch;
    }

    // Strategy 3: Pattern-based matching (lower confidence) - ONLY if no other matches
    this.logger.addDebugInfo(`🔍 STRATEGY 3: Pattern-based matching (no database or fuzzy match found)...`);
    const patternMatch = this.findPatternMatch(groupName, description, category);
    if (patternMatch) {
      this.logger.addDebugInfo(`✅ STRATEGY 3 SUCCESS: Pattern match found!`);
      this.logger.addDebugInfo(`   Result: "${searchText}" -> "${patternMatch.stageName}"`);
      this.logger.addDebugInfo(`   Confidence: ${patternMatch.confidence}%`);
      this.logger.addDebugInfo(`   Source: pattern matching`);
      return patternMatch;
    }

    // No match found
    this.logger.addDebugInfo(`❌ ALL STRATEGIES FAILED: No match found for "${searchText}" in category ${category}`);
    this.logger.addDebugInfo(`🎯 INTELLIGENT STAGE MATCHING END\n`);
    return null;
  }

  /**
   * Find mapping in existing database with improved exact matching
   */
  private findDatabaseMapping(searchText: string): any | null {
    const normalizedSearch = this.normalizeText(searchText);
    this.logger.addDebugInfo(`🔍 DATABASE LOOKUP: Searching for "${searchText}" (normalized: "${normalizedSearch}")`);
    
    // Strategy 1: Case-insensitive exact match
    for (const [mappedText, mapping] of this.existingMappings.entries()) {
      const normalizedMapped = this.normalizeText(mappedText);
      
      if (normalizedSearch === normalizedMapped) {
        this.logger.addDebugInfo(`✅ EXACT DATABASE MATCH FOUND: "${searchText}" -> "${mappedText}" (confidence: ${mapping.confidence_score})`);
        return {
          ...mapping,
          confidence_score: Math.min(mapping.confidence_score + 10, 100) // Boost exact matches
        };
      }
    }

    // Strategy 2: High-similarity partial match (only for very close matches)
    let bestMatch: any = null;
    let bestScore = 0;
    
    for (const [mappedText, mapping] of this.existingMappings.entries()) {
      const normalizedMapped = this.normalizeText(mappedText);
      
      // Only consider partial matches with high similarity (75%+)
      const similarity = this.calculateSimilarity(normalizedSearch, normalizedMapped);
      if (similarity >= 0.75) {
        const score = similarity * mapping.confidence_score;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            ...mapping,
            confidence_score: Math.max(Math.round(score * 0.9), 50) // Higher confidence for good partial matches
          };
        }
      }
    }

    if (bestMatch) {
      this.logger.addDebugInfo(`⚠️ HIGH-SIMILARITY PARTIAL MATCH: "${searchText}" -> "${bestMatch.excel_text}" (similarity: ${Math.round(bestScore/bestMatch.confidence_score*100)}%, score: ${bestMatch.confidence_score})`);
    } else {
      this.logger.addDebugInfo(`❌ NO DATABASE MATCH: No exact or high-similarity match found for "${searchText}"`);
    }

    return bestMatch;
  }

  /**
   * Normalize text for consistent matching
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
      .replace(/[^\w\s&-]/g, '')      // Remove special characters except &, -, and spaces
      .replace(/\s*&\s*/g, ' & ')     // Normalize ampersands
      .replace(/\s*-\s*/g, ' - ');    // Normalize dashes
  }

  /**
   * Check for conflicting keywords that should prevent fuzzy matching
   */
  private hasConflictingKeywords(searchText: string, stageName: string): boolean {
    const conflicts = [
      // Perfect binding vs Wire binding
      { search: ['perfect'], stage: ['wire'], description: 'perfect binding vs wire binding' },
      { search: ['wire'], stage: ['perfect'], description: 'wire binding vs perfect binding' },
      // Saddle stitch vs other binding types
      { search: ['saddle'], stage: ['perfect', 'wire', 'comb'], description: 'saddle vs other binding' },
      // Digital vs offset printing
      { search: ['digital'], stage: ['offset', 'litho'], description: 'digital vs offset printing' },
      { search: ['offset', 'litho'], stage: ['digital'], description: 'offset vs digital printing' },
      // HP vs Xerox printers
      { search: ['hp'], stage: ['xerox'], description: 'HP vs Xerox printers' },
      { search: ['xerox'], stage: ['hp'], description: 'Xerox vs HP printers' }
    ];

    for (const conflict of conflicts) {
      const hasSearchKeyword = conflict.search.some(keyword => searchText.includes(keyword));
      const hasStageKeyword = conflict.stage.some(keyword => stageName.includes(keyword));
      
      if (hasSearchKeyword && hasStageKeyword) {
        this.logger.addDebugInfo(`🚫 CONFLICT DETECTED: ${conflict.description} - "${searchText}" vs "${stageName}"`);
        return true;
      }
    }

    return false;
  }

  /**
   * Fuzzy string matching against stage names (CONSERVATIVE - only high-confidence matches)
   */
  private findFuzzyMatch(searchText: string, category: string): MappingConfidence | null {
    this.logger.addDebugInfo(`🔍 FUZZY MATCHING: Searching "${searchText}" in ${category} stages`);
    
    const categoryStages = this.stages.filter(stage => 
      this.inferStageCategory(stage.name) === category
    );

    let bestMatch: MappingConfidence | null = null;
    let bestScore = 0;

    for (const stage of categoryStages) {
      const stageName = stage.name.toLowerCase();
      const score = this.calculateSimilarity(searchText, stageName);
      
      // INCREASED THRESHOLD: Only accept 60%+ similarity to prevent weak matches
      if (score > bestScore && score > 0.6) {
        // Check for conflicting keywords to prevent wrong suggestions
        if (this.hasConflictingKeywords(searchText, stageName)) {
          this.logger.addDebugInfo(`⚠️ CONFLICTING KEYWORDS: Skipping "${stageName}" due to conflicting terms with "${searchText}"`);
          continue;
        }
        
        bestScore = score;
        bestMatch = {
          stageId: stage.id,
          stageName: stage.name,
          confidence: Math.round(score * 70), // Reduced max confidence for fuzzy matches
          source: 'fuzzy',
          category: this.inferStageCategory(stage.name)
        };
      }
    }

    if (bestMatch) {
      this.logger.addDebugInfo(`✅ FUZZY MATCH FOUND: "${searchText}" -> "${bestMatch.stageName}" (similarity: ${Math.round(bestScore*100)}%, confidence: ${bestMatch.confidence})`);
    } else {
      this.logger.addDebugInfo(`❌ NO FUZZY MATCH: No high-confidence (60%+) match found for "${searchText}"`);
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return 1 - (distance / maxLen);
  }

  /**
   * Pattern-based matching (fallback)
   */
  private findPatternMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging'
  ): MappingConfidence | null {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Enhanced pattern matching with more specific patterns
    const enhancedPatterns = {
      printing: [
        { patterns: ['hp 12000', 'hp12000', '12000'], stageName: 'Printing - HP 12000', confidence: 85 },
        { patterns: ['t250', 'xerox t250', 't-250'], stageName: 'Printing - Xerox T250', confidence: 85 },
        { patterns: ['7900', 'hp 7900', 'hp7900'], stageName: 'Printing - HP 7900', confidence: 85 },
        { patterns: ['c8000', 'xerox c8000'], stageName: 'Printing - Xerox C8000', confidence: 85 },
        { patterns: ['digital print', 'digital'], stageName: 'Digital Printing', confidence: 70 },
        { patterns: ['large format', 'wide format'], stageName: 'Large Format Printing', confidence: 75 }
      ],
      finishing: [
        { patterns: ['laminat'], stageName: 'Laminating', confidence: 80 },
        { patterns: ['envelope print'], stageName: 'Envelope Printing', confidence: 85 },
        { patterns: ['cut', 'guillotine'], stageName: 'Cutting', confidence: 75 },
        { patterns: ['fold'], stageName: 'Folding', confidence: 75 },
        { patterns: ['bind', 'binding'], stageName: 'Binding', confidence: 75 },
        { patterns: ['perfect bind'], stageName: 'Perfect Binding', confidence: 80 },
        { patterns: ['saddle stitch'], stageName: 'Saddle Stitching', confidence: 80 }
      ],
      prepress: [
        { patterns: ['dtp', 'desktop'], stageName: 'DTP', confidence: 80 },
        { patterns: ['proof'], stageName: 'Proofing', confidence: 75 },
        { patterns: ['plate'], stageName: 'Plate Making', confidence: 75 },
        { patterns: ['rip', 'ripping'], stageName: 'RIP Processing', confidence: 75 }
      ],
      packaging: [
        { patterns: ['packag', 'box', 'boxing'], stageName: 'Packaging', confidence: 85 },
        { patterns: ['wrap', 'wrapping'], stageName: 'Wrapping', confidence: 80 },
        { patterns: ['ship', 'shipping'], stageName: 'Shipping', confidence: 75 },
        { patterns: ['mail', 'mailing'], stageName: 'Mailing', confidence: 75 }
      ],
      delivery: [
        { patterns: ['collect', 'collection', 'pickup', 'customer collect'], stageName: 'Shipping', confidence: 85 },
        { patterns: ['local delivery', 'delivery', 'local'], stageName: 'Shipping', confidence: 85 },
        { patterns: ['courier', 'post', 'mail'], stageName: 'Shipping', confidence: 80 },
        { patterns: ['dispatch', 'ship'], stageName: 'Shipping', confidence: 80 },
        { patterns: ['hand deliver'], stageName: 'Shipping', confidence: 75 }
      ]
    };

    const categoryPatterns = enhancedPatterns[category] || [];
    
    for (const patternGroup of categoryPatterns) {
      for (const pattern of patternGroup.patterns) {
        if (searchText.includes(pattern)) {
          // Find actual stage that matches this pattern
          const stage = this.stages.find(s => 
            s.name.toLowerCase().includes(pattern) || 
            s.name.toLowerCase().includes(patternGroup.stageName.toLowerCase())
          );
          
          if (stage) {
            return {
              stageId: stage.id,
              stageName: stage.name,
              confidence: patternGroup.confidence,
              source: 'pattern',
              category: this.inferStageCategory(stage.name)
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Infer stage category from stage name
   */
  private inferStageCategory(stageName: string): 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'unknown' {
    const name = stageName.toLowerCase();
    
    if (name.includes('print') || name.includes('hp') || name.includes('xerox') || name.includes('digital')) {
      return 'printing';
    }
    if (name.includes('finish') || name.includes('laminat') || name.includes('cut') || 
        name.includes('fold') || name.includes('bind') || name.includes('envelope')) {
      return 'finishing';
    }
    if (name.includes('prepress') || name.includes('dtp') || name.includes('proof') || 
        name.includes('plate') || name.includes('rip')) {
      return 'prepress';
    }
    if (name.includes('deliver') || name.includes('dispatch') || name.includes('ship') || 
        name.includes('collect') || name.includes('courier') || name.includes('post') || name.includes('mail')) {
      return 'delivery';
    }
    if (name.includes('packag') || name.includes('box') || name.includes('wrap')) {
      return 'packaging';
    }
    
    return 'unknown';
  }

  /**
   * Learn from successful mappings to improve future accuracy
   */
  private async learnFromMappings(mappings: RowMappingResult[]): Promise<void> {
    try {
      const newMappings = mappings
        .filter(m => !m.isUnmapped && m.confidence >= 70 && !m.manualOverride)
        .map(m => ({
          excel_text: `${m.groupName} ${m.description}`.toLowerCase().trim(),
          production_stage_id: m.mappedStageId,
          confidence_score: m.confidence,
          mapping_type: 'production_stage' as const,
          is_verified: m.confidence >= 85
        }));

      if (newMappings.length > 0) {
        // Use upsert to avoid conflicts
        await supabase
          .from('excel_import_mappings')
          .upsert(newMappings, { 
            onConflict: 'excel_text,production_stage_id',
            ignoreDuplicates: false 
          });
        
        this.logger.addDebugInfo(`Learned ${newMappings.length} new mappings`);
      }
    } catch (error) {
      this.logger.addDebugInfo(`Failed to learn from mappings: ${error}`);
    }
  }

  /**
   * Map groups to stages using intelligent mapping with user-approved mappings
   * STRENGTHENED: Always prioritize user mappings and provide comprehensive debugging
   */
  mapGroupsToStagesIntelligent(
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, mappedStageSpecId?: string, mappedStageSpecName?: string, category: string}>,
    paperSpecs?: GroupSpecifications | null,  // Add optional paper specs parameter
    packagingSpecs?: GroupSpecifications | null,  // Add optional packaging specs parameter
    deliverySpecs?: GroupSpecifications | null  // Add optional delivery specs parameter
  ): StageMapping[] {
    const mappedStages: StageMapping[] = [];
    
    // COMPREHENSIVE DEBUGGING: Log user mappings at entry point
    this.logger.addDebugInfo(`🔍 STAGE MAPPING: Starting with ${userApprovedMappings?.length || 0} user-approved mappings`);
    userApprovedMappings?.forEach((mapping, idx) => {
      this.logger.addDebugInfo(`  User Mapping ${idx + 1}: ${mapping.groupName} -> ${mapping.mappedStageName} (${mapping.mappedStageId}) [${mapping.category}]`);
    });
    
    // Map printing specifications
    if (printingSpecs) {
      this.logger.addDebugInfo(`🖨️  Processing ${Object.keys(printingSpecs).length} printing specifications`);
      const printingMappings = this.mapSpecificationsToStagesIntelligent(printingSpecs, 'printing', userApprovedMappings);
      mappedStages.push(...printingMappings);
      this.logger.addDebugInfo(`✅ Created ${printingMappings.length} printing stage mappings`);
    }
    
    // Map finishing specifications
    if (finishingSpecs) {
      this.logger.addDebugInfo(`🔧 Processing ${Object.keys(finishingSpecs).length} finishing specifications`);
      const finishingMappings = this.mapSpecificationsToStagesIntelligent(finishingSpecs, 'finishing', userApprovedMappings);
      mappedStages.push(...finishingMappings);
      this.logger.addDebugInfo(`✅ Created ${finishingMappings.length} finishing stage mappings`);
    }
    
    // Map prepress specifications
    if (prepressSpecs) {
      this.logger.addDebugInfo(`📐 Processing ${Object.keys(prepressSpecs).length} prepress specifications`);
      const prepressMappings = this.mapSpecificationsToStagesIntelligent(prepressSpecs, 'prepress', userApprovedMappings);
      mappedStages.push(...prepressMappings);
      this.logger.addDebugInfo(`✅ Created ${prepressMappings.length} prepress stage mappings`);
    }
    
    // Map packaging specifications
    if (packagingSpecs) {
      this.logger.addDebugInfo(`📦 Processing ${Object.keys(packagingSpecs).length} packaging specifications`);
      const packagingMappings = this.mapSpecificationsToStagesIntelligent(packagingSpecs, 'packaging' as any, userApprovedMappings);
      mappedStages.push(...packagingMappings);
      this.logger.addDebugInfo(`✅ Created ${packagingMappings.length} packaging stage mappings`);
    }
    
    // Map delivery specifications
    if (deliverySpecs) {
      this.logger.addDebugInfo(`🚚 Processing ${Object.keys(deliverySpecs).length} delivery specifications`);
      const deliveryMappings = this.mapSpecificationsToStagesIntelligent(deliverySpecs, 'delivery', userApprovedMappings);
      mappedStages.push(...deliveryMappings);
      this.logger.addDebugInfo(`✅ Created ${deliveryMappings.length} delivery stage mappings`);
    }
    
    // Apply DTP/PROOF deduplication logic
    const deduplicatedStages = this.applyDTPProofDeduplication(mappedStages);
    
    this.logger.addDebugInfo(`🎯 FINAL RESULT: ${deduplicatedStages.length} total stages (${mappedStages.length - deduplicatedStages.length} duplicates removed)`);
    deduplicatedStages.forEach((stage, idx) => {
      this.logger.addDebugInfo(`  Final Stage ${idx + 1}: ${stage.stageName} (${stage.stageId}) - Confidence: ${stage.confidence}%`);
    });
    
    return deduplicatedStages;
  }

  /**
   * Map specifications to stages using intelligent matching with user-approved mappings
   * STRENGTHENED: Always prioritize user mappings and disable fallbacks when user mappings exist
   */
  private mapSpecificationsToStagesIntelligent(
    specs: GroupSpecifications,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging',
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, mappedStageSpecId?: string, mappedStageSpecName?: string, category: string}>
  ): StageMapping[] {
    const mappings: StageMapping[] = [];
    
    // Count user mappings for this category
    const userMappingsForCategory = userApprovedMappings?.filter(m => m.category === category) || [];
    const hasUserMappings = userMappingsForCategory.length > 0;
    
    this.logger.addDebugInfo(`🔍 Processing ${Object.keys(specs).length} ${category} specs with ${userMappingsForCategory.length} user mappings`);
    
    for (const [groupName, spec] of Object.entries(specs)) {
      this.logger.addDebugInfo(`  📋 Processing spec: "${groupName}" (${spec.description || 'no description'})`);
      
      // HIGHEST PRIORITY: Check for user-approved mapping
      const userMapping = userApprovedMappings?.find(m => 
        m.groupName === groupName && m.category === category
      );
      
      if (userMapping) {
        this.logger.addDebugInfo(`  ✅ USING USER-APPROVED MAPPING: ${groupName} -> ${userMapping.mappedStageName} (${userMapping.mappedStageId})${userMapping.mappedStageSpecId ? ` with spec: ${userMapping.mappedStageSpecName}` : ''}`);
        mappings.push({
          stageId: userMapping.mappedStageId,
          stageName: userMapping.mappedStageName,
          stageSpecId: userMapping.mappedStageSpecId, // ✅ FIXED: Include specification ID from user mapping
          stageSpecName: userMapping.mappedStageSpecName, // ✅ FIXED: Include specification name from user mapping
          confidence: 100, // User-approved mappings have highest confidence
          category: userMapping.category as 'printing' | 'finishing' | 'prepress' | 'delivery',
          specifications: [groupName, spec.description || ''].filter(Boolean)
        });
      } else if (hasUserMappings) {
        // If user has provided explicit mappings for this category, DON'T use text-pattern fallback
        // This prevents mixing user intent with system guesses
        this.logger.addDebugInfo(`  ⚠️  SKIPPING text-pattern detection for "${groupName}" - user has provided explicit mappings for ${category} category`);
        this.logger.addDebugInfo(`  🎯 This ensures all stages come from user-approved mappings only (no mixing)`);
      } else {
        // Only use text-pattern matching if user has NOT provided any mappings for this category
        this.logger.addDebugInfo(`  🤖 No user mappings for ${category} category - using text-pattern detection for "${groupName}"`);
        const stageMapping = this.findIntelligentStageMatch(groupName, spec.description || '', category);
        if (stageMapping) {
          this.logger.addDebugInfo(`  ✅ TEXT-PATTERN MAPPING: ${groupName} -> ${stageMapping.stageName} (confidence: ${stageMapping.confidence}%)`);
          mappings.push({
            stageId: stageMapping.stageId,
            stageName: stageMapping.stageName,
            confidence: stageMapping.confidence,
            category: stageMapping.category === 'unknown' ? category : stageMapping.category,
            specifications: [groupName, spec.description || ''].filter(Boolean)
          });
        } else {
          this.logger.addDebugInfo(`  ❌ NO MATCH FOUND for "${groupName}" in text-pattern detection`);
        }
      }
    }
    
    this.logger.addDebugInfo(`🎯 Category ${category} result: ${mappings.length} mappings created from ${Object.keys(specs).length} specifications`);
    return mappings;
  }

  /**
   * Apply DTP/PROOF deduplication logic - only keep one instance of each
   */
  private applyDTPProofDeduplication(stages: StageMapping[]): StageMapping[] {
    const seenStages = new Set<string>();
    const deduplicated: StageMapping[] = [];
    
    for (const stage of stages) {
      const stageName = stage.stageName.toLowerCase();
      
      // For DTP and PROOF stages, only keep the first occurrence
      if (stageName.includes('dtp') || stageName.includes('proof')) {
        const stageKey = stageName.includes('dtp') ? 'dtp' : 'proof';
        
        if (seenStages.has(stageKey)) {
          this.logger.addDebugInfo(`Dropping duplicate ${stageKey.toUpperCase()} stage: ${stage.stageName}`);
          continue; // Skip this duplicate
        }
        
        seenStages.add(stageKey);
        this.logger.addDebugInfo(`Keeping first occurrence of ${stageKey.toUpperCase()} stage: ${stage.stageName}`);
      }
      
      deduplicated.push(stage);
    }
    
    return deduplicated;
  }

  /**
   * Generate unique instance ID for multi-instance stages
   */
  private generateInstanceId(groupName: string, rowIndex: number): string {
    return `${groupName.toLowerCase().replace(/\s+/g, '_')}_${rowIndex}`;
  }

  /**
   * Find associated paper specification for printing stages
   */
  private findAssociatedPaperSpec(groupName: string, description: string, rowIndex: number): string | undefined {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Look for paper type mentions in the description
    const paperTypes = ['quality', 'performance', 'offset', 'digital', 'coated', 'uncoated', 'gloss', 'matt'];
    for (const paperType of paperTypes) {
      if (searchText.includes(paperType)) {
        return paperType.charAt(0).toUpperCase() + paperType.slice(1);
      }
    }
    
    return undefined;
  }

  /**
   * Enhanced stage matching with sub-specification support
   */
  private findIntelligentStageMatchWithSpec(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging'
  ): MappingConfidence | null {
    const searchText = `${groupName} ${description}`.toLowerCase().trim();
    
    // Strategy 1: Direct stage + specification matching
    const stageSpecMatch = this.findStageSpecificationMatch(searchText, category);
    if (stageSpecMatch) {
      return stageSpecMatch;
    }
    
    // Fallback to original matching logic
    return this.findIntelligentStageMatch(groupName, description, category);
  }

  /**
   * Find matching stage and specification combination
   */
  private findStageSpecificationMatch(searchText: string, category: string): MappingConfidence | null {
    let bestMatch: MappingConfidence | null = null;
    let bestScore = 0;

    // Look for stage + specification combinations
    for (const spec of this.stageSpecs) {
      const stage = this.stages.find(s => s.id === spec.production_stage_id);
      if (!stage || this.inferStageCategory(stage.name) !== category) continue;

      const specName = spec.name.toLowerCase();
      const stageName = stage.name.toLowerCase();
      
      // Check if the search text matches both stage and specification
      const stageScore = this.calculateSimilarity(searchText, stageName);
      const specScore = this.calculateSimilarity(searchText, specName);
      const combinedScore = this.calculateSimilarity(searchText, `${stageName} ${specName}`);
      
      const maxScore = Math.max(stageScore, specScore, combinedScore);
      
      if (maxScore > bestScore && maxScore > 0.6) { // Higher threshold for stage+spec matching
        bestScore = maxScore;
        bestMatch = {
          stageId: stage.id,
          stageName: stage.name,
          stageSpecId: spec.id,
          stageSpecName: spec.name,
          confidence: Math.round(maxScore * 90), // Higher confidence for precise matches
          source: 'fuzzy',
          category: this.inferStageCategory(stage.name)
        };
      }
    }

    return bestMatch;
  }
}