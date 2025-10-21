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
    deliverySpecs?: GroupSpecifications | null,
    job?: any // Add job parameter to access cover_text_detection
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
        printingSpecs, paperMappings, excelRows, headers, rowIndex, job
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
      return this.createPrintingRowMappingsWithPaper(specs, paperMappings, excelRows, headers, startRowIndex, undefined);
    }

    // For non-printing categories, use standard processing
    for (const [groupName, spec] of Object.entries(specs)) {
      this.logger.addDebugInfo(`Processing ${category} spec: "${groupName}" with description: "${spec.description || ''}"`);
      
      const stageMapping = this.findIntelligentStageMatchWithSpec(groupName, spec.description || '', category);
      
      this.logger.addDebugInfo(`Stage mapping result for "${groupName}": ${stageMapping ? `Stage: ${stageMapping.stageName}, Confidence: ${stageMapping.confidence}` : 'No match found'}`);
      
      const instanceId = this.generateInstanceId(groupName, currentRowIndex);
      
      // Ensure we have a valid mapping with appropriate confidence threshold
      // RAISED: Prefer Unknown over Wrong - require 65+ confidence globally, 80+ for finishing
      const minConfidence = category === 'finishing' ? 80 : 65;
      const hasValidMapping = stageMapping && stageMapping.confidence >= minConfidence;
      
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
    startRowIndex: number,
    job?: any // Add job parameter to access cover_text_detection
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
    
    // Check for cover/text detection from matrixParser
    const hasCoverTextDetection = job?.cover_text_detection?.isBookJob;
    const coverComponent = job?.cover_text_detection?.components?.find((c: any) => c.type === 'cover');
    const textComponent = job?.cover_text_detection?.components?.find((c: any) => c.type === 'text');
    
    this.logger.addDebugInfo(`🎯 COVER/TEXT DETECTION: hasCoverTextDetection=${hasCoverTextDetection}, coverComponent=${coverComponent ? 'found' : 'none'}, textComponent=${textComponent ? 'found' : 'none'}`);

    // If we have cover/text detection from matrixParser OR multiple papers - CREATE EXACTLY 2 PRINTING STAGES
    if (printingOps.length >= 2 && (paperMappings.length >= 2 || (hasCoverTextDetection && coverComponent && textComponent))) {
      // Determine paper specs - prefer from cover_text_detection, fallback to paperMappings
      let coverPaperSpec = 'Cover';
      let textPaperSpec = 'Text';
      
      if (paperMappings.length >= 2) {
        // Sort papers by quantity to identify Cover (smallest) and Text (largest)
        const sortedPapers = [...paperMappings].sort((a, b) => a.qty - b.qty);
        coverPaperSpec = sortedPapers[0].mappedSpec;
        textPaperSpec = sortedPapers[sortedPapers.length - 1].mappedSpec;
        this.logger.addDebugInfo(`Using paper mappings: Cover=${coverPaperSpec}, Text=${textPaperSpec}`);
      } else if (coverComponent?.paper && textComponent?.paper) {
        // Use paper from cover_text_detection
        coverPaperSpec = coverComponent.paper.description || 'Cover';
        textPaperSpec = textComponent.paper.description || 'Text';
        this.logger.addDebugInfo(`Using cover_text_detection paper: Cover=${coverPaperSpec}, Text=${textPaperSpec}`);
      }
      
      // Match printing operations by quantity - use cover_text_detection if available
      const sortedPrintingOps = [...printingOps].sort((a, b) => (a.spec.qty || 0) - (b.spec.qty || 0));
      
      // Match by quantity from cover_text_detection if available
      let coverPrintingOp = sortedPrintingOps[0];
      let textPrintingOp = sortedPrintingOps.length > 1 ? sortedPrintingOps[sortedPrintingOps.length - 1] : sortedPrintingOps[0];
      
      if (hasCoverTextDetection && coverComponent && textComponent) {
        // Match by exact quantity from cover_text_detection
        coverPrintingOp = printingOps.find(op => op.spec.qty === coverComponent.printing.qty) || sortedPrintingOps[0];
        textPrintingOp = printingOps.find(op => op.spec.qty === textComponent.printing.qty) || sortedPrintingOps[sortedPrintingOps.length - 1];
        this.logger.addDebugInfo(`Matched printing ops by cover_text_detection qty: Cover=${coverPrintingOp.spec.qty}, Text=${textPrintingOp.spec.qty}`);
      }
      
      this.logger.addDebugInfo(`Creating 2 printing stages: Cover=${coverPaperSpec} (qty: ${coverPrintingOp.spec.qty}), Text=${textPaperSpec} (qty: ${textPrintingOp.spec.qty})`);
      
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
        groupName: `${coverPrintingOp.groupName} - ${coverPaperSpec}`,
        description: `${coverPrintingOp.spec.description || ''} (Cover: ${coverPaperSpec})`,
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
        paperSpecification: coverPaperSpec,
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
        groupName: `${textPrintingOp.groupName} - ${textPaperSpec}`,
        description: `${textPrintingOp.spec.description || ''} (Text: ${textPaperSpec})`,
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
        paperSpecification: textPaperSpec,
        partType: 'Text'
      });

      this.logger.addDebugInfo(`Created 2 printing mappings with partType set: Cover (qty: ${coverPrintingOp.spec.qty}) and Text (qty: ${textPrintingOp.spec.qty})`);
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
   * Intelligent stage matching using multiple strategies
   * UPDATED: Added exact stage name matching and anchor-token guards
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
    this.logger.addDebugInfo(`Searching for stage match: "${searchText}" in category: ${category}`);
    
    // Strategy 1: Database mapping lookup (highest confidence, with anchor-token guard)
    const dbMapping = this.findDatabaseMapping(searchText, category);
    if (dbMapping) {
      let stage = null;
      let specificationName = null;

      // Check if mapping uses production_stage_id
      if (dbMapping.production_stage_id) {
        stage = this.stages.find(s => s.id === dbMapping.production_stage_id);
      }
      // If no stage found and mapping uses stage_specification_id, look up the specification
      else if (dbMapping.stage_specification_id) {
        const specification = this.stageSpecs?.find(s => s.id === dbMapping.stage_specification_id);
        if (specification) {
          // Find the parent stage for this specification
          stage = this.stages.find(s => s.id === specification.production_stage_id);
          specificationName = specification.name;
          
          // EXTEND ANCHOR GUARD: Also apply token guard when resolving via stage_specification_id
          const normalizedSearch = this.normalizeText(searchText);
          const criticalTokens = ['perfect', 'wire', 'saddle', 'case', 'spiral', 'comb', 'wiro'];
          const searchTokens = criticalTokens.filter(token => normalizedSearch.includes(token));
          
          if (searchTokens.length > 0 && stage) {
            const stageName = this.normalizeText(stage.name);
            const hasMatchingToken = searchTokens.some(token => stageName.includes(token));
            if (!hasMatchingToken) {
              this.logger.addDebugInfo(`🚫 Blocked DB spec mapping: "${searchText}" -> "${stage.name}" via spec "${specificationName}" (missing anchor token: ${searchTokens.join(', ')})`);
              stage = null; // Nullify to skip this mapping
            }
          }
        }
      }

      if (stage) {
        this.logger.addDebugInfo(`✅ [DB exact] "${searchText}" -> "${stage.name}"${specificationName ? ` (${specificationName})` : ''} (confidence: ${dbMapping.confidence_score})`);
        return {
          stageId: stage.id,
          stageName: stage.name,
          confidence: Math.min(dbMapping.confidence_score + 10, 100), // Boost verified mappings
          source: 'database',
          category: this.inferStageCategory(stage.name),
          stageSpecId: dbMapping.stage_specification_id,
          stageSpecName: specificationName
        };
      }
    }

    // Strategy 2: Exact stage name match (100% confidence for exact matches)
    const exactMatch = this.findExactStageNameMatch(searchText, category);
    if (exactMatch) {
      this.logger.addDebugInfo(`✅ [Stage exact] "${searchText}" -> "${exactMatch.stageName}" (confidence: ${exactMatch.confidence})`);
      return exactMatch;
    }

    // Strategy 3: Fuzzy string matching (medium confidence, with anchor guards)
    const fuzzyMatch = this.findFuzzyMatch(searchText, category);
    if (fuzzyMatch) {
      this.logger.addDebugInfo(`✅ [Fuzzy anchored] "${searchText}" -> "${fuzzyMatch.stageName}" (confidence: ${fuzzyMatch.confidence})`);
      return fuzzyMatch;
    }

    // Strategy 4: Pattern-based matching (lower confidence, explicit only)
    const patternMatch = this.findPatternMatch(groupName, description, category);
    if (patternMatch) {
      this.logger.addDebugInfo(`✅ [Pattern explicit] "${searchText}" -> "${patternMatch.stageName}" (confidence: ${patternMatch.confidence})`);
      return patternMatch;
    }

    this.logger.addDebugInfo(`❌ [Unknown] No match found for: "${searchText}" in category: ${category}`);
    return null;
  }

  /**
   * Find mapping in existing database with improved exact matching
   * UPDATED: Added anchor-token guard to prevent verified-but-wrong hits
   */
  private findDatabaseMapping(searchText: string, category: string): any | null {
    const normalizedSearch = this.normalizeText(searchText);
    
    // Define critical binding tokens that must match between search and stage
    const criticalTokens = ['perfect', 'wire', 'saddle', 'case', 'spiral', 'comb', 'wiro'];
    const searchTokens = criticalTokens.filter(token => normalizedSearch.includes(token));
    
    // Strategy 1: Case-insensitive exact match
    for (const [mappedText, mapping] of this.existingMappings.entries()) {
      const normalizedMapped = this.normalizeText(mappedText);
      
      if (normalizedSearch === normalizedMapped) {
        // Apply anchor-token guard: if search has critical token, stage must have same token
        if (searchTokens.length > 0) {
          const stage = this.stages.find(s => s.id === mapping.production_stage_id);
          if (stage) {
            const stageName = this.normalizeText(stage.name);
            const hasMatchingToken = searchTokens.some(token => stageName.includes(token));
            if (!hasMatchingToken) {
              this.logger.addDebugInfo(`🚫 Blocked DB mapping: "${searchText}" -> "${stage.name}" (missing anchor token: ${searchTokens.join(', ')})`);
              continue; // Skip this mapping
            }
          }
        }
        
        this.logger.addDebugInfo(`Found exact match: "${searchText}" -> "${mappedText}"`);
        return {
          ...mapping,
          confidence_score: Math.min(mapping.confidence_score + 10, 100) // Boost exact matches
        };
      }
    }

    // Strategy 2: Partial match with higher confidence scoring
    let bestMatch: any = null;
    let bestScore = 0;
    
    for (const [mappedText, mapping] of this.existingMappings.entries()) {
      const normalizedMapped = this.normalizeText(mappedText);
      
      // Calculate similarity for partial matches
      if (normalizedSearch.includes(normalizedMapped) || normalizedMapped.includes(normalizedSearch)) {
        // Apply anchor-token guard for partial matches too
        if (searchTokens.length > 0) {
          const stage = this.stages.find(s => s.id === mapping.production_stage_id);
          if (stage) {
            const stageName = this.normalizeText(stage.name);
            const hasMatchingToken = searchTokens.some(token => stageName.includes(token));
            if (!hasMatchingToken) {
              this.logger.addDebugInfo(`🚫 Blocked DB partial match: "${searchText}" -> "${stage.name}" (missing anchor token: ${searchTokens.join(', ')})`);
              continue; // Skip this mapping
            }
          }
        }
        
        const similarity = this.calculateSimilarity(normalizedSearch, normalizedMapped);
        const score = similarity * mapping.confidence_score;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            ...mapping,
            confidence_score: Math.max(Math.round(score * 0.8), 30) // Reduce confidence for partial matches
          };
        }
      }
    }

    if (bestMatch) {
      this.logger.addDebugInfo(`Found partial match: "${searchText}" -> "${bestMatch.excel_text}" (score: ${bestMatch.confidence_score})`);
    }

    return bestMatch;
  }

  /**
   * Find exact stage name match (case-insensitive, punctuation-insensitive)
   * NEW: Provides 100% confidence for perfect stage name matches
   */
  private findExactStageNameMatch(searchText: string, category: string): MappingConfidence | null {
    const normalizedSearch = this.normalizeText(searchText);
    
    // Filter stages by category
    const categoryStages = this.stages.filter(stage => 
      this.inferStageCategory(stage.name) === category
    );
    
    // Look for exact match
    for (const stage of categoryStages) {
      const normalizedStageName = this.normalizeText(stage.name);
      
      if (normalizedSearch === normalizedStageName) {
        this.logger.addDebugInfo(`Found exact stage name match: "${searchText}" -> "${stage.name}"`);
        return {
          stageId: stage.id,
          stageName: stage.name,
          confidence: 100, // Perfect confidence for exact matches
          source: 'database', // Treat as database-level confidence
          category: this.inferStageCategory(stage.name)
        };
      }
    }
    
    return null;
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
   * Fuzzy string matching against stage names
   * UPDATED: Tightened thresholds per category and added anchor-token guards
   */
  private findFuzzyMatch(searchText: string, category: string): MappingConfidence | null {
    const categoryStages = this.stages.filter(stage => 
      this.inferStageCategory(stage.name) === category
    );

    // Define per-category minimum similarity thresholds
    const categoryThresholds: Record<string, number> = {
      'finishing': 0.72,  // Strictest for binding-type stages
      'printing': 0.65,
      'prepress': 0.65,
      'delivery': 0.70,
      'packaging': 0.70
    };
    const minThreshold = categoryThresholds[category] || 0.65;
    
    // Define critical binding tokens for anchor matching
    const criticalTokens = ['perfect', 'wire', 'saddle', 'case', 'spiral', 'comb', 'wiro'];
    const searchTokens = criticalTokens.filter(token => searchText.includes(token));
    
    let bestMatch: MappingConfidence | null = null;
    let bestScore = 0;

    for (const stage of categoryStages) {
      const stageName = stage.name.toLowerCase();
      
      // Apply anchor-token guard: if search has critical token, stage must have same token
      if (searchTokens.length > 0) {
        const normalizedStageName = this.normalizeText(stageName);
        const hasMatchingToken = searchTokens.some(token => normalizedStageName.includes(token));
        if (!hasMatchingToken) {
          this.logger.addDebugInfo(`🚫 Blocked fuzzy match: "${searchText}" -> "${stage.name}" (missing anchor token: ${searchTokens.join(', ')})`);
          continue; // Skip this stage
        }
      }
      
      const score = this.calculateSimilarity(searchText, stageName);
      
      if (score > bestScore && score >= minThreshold) {
        bestScore = score;
        bestMatch = {
          stageId: stage.id,
          stageName: stage.name,
          confidence: Math.round(score * 80), // Max 80% confidence for fuzzy matches
          source: 'fuzzy',
          category: this.inferStageCategory(stage.name)
        };
      }
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
   * UPDATED: Removed generic binding patterns, kept only explicit variants
   */
  private findPatternMatch(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging'
  ): MappingConfidence | null {
    const searchText = `${groupName} ${description}`.toLowerCase();
    
    // Enhanced pattern matching with EXPLICIT patterns only (no generic "bind/binding")
    const enhancedPatterns = {
      printing: [
        { patterns: ['hp 12000', 'hp12000', '12000'], stageName: 'Printing - HP 12000', confidence: 70 },
        { patterns: ['t250', 'xerox t250', 't-250'], stageName: 'Printing - Xerox T250', confidence: 70 },
        { patterns: ['7900', 'hp 7900', 'hp7900'], stageName: 'Printing - HP 7900', confidence: 70 },
        { patterns: ['c8000', 'xerox c8000'], stageName: 'Printing - Xerox C8000', confidence: 70 },
        { patterns: ['digital print', 'digital'], stageName: 'Digital Printing', confidence: 60 },
        { patterns: ['large format', 'wide format'], stageName: 'Large Format Printing', confidence: 65 }
      ],
      finishing: [
        { patterns: ['laminat'], stageName: 'Laminating', confidence: 70 },
        { patterns: ['envelope print'], stageName: 'Envelope Printing', confidence: 70 },
        { patterns: ['cut', 'guillotine'], stageName: 'Cutting', confidence: 65 },
        { patterns: ['fold'], stageName: 'Folding', confidence: 65 },
        // CRITICAL: Removed generic ['bind', 'binding'] pattern
        { patterns: ['perfect bind'], stageName: 'Perfect Binding', confidence: 70 },
        { patterns: ['wire bind', 'wiro'], stageName: 'Wire Binding', confidence: 70 },
        { patterns: ['saddle stitch'], stageName: 'Saddle Stitching', confidence: 70 }
      ],
      prepress: [
        { patterns: ['dtp', 'desktop'], stageName: 'DTP', confidence: 70 },
        { patterns: ['proof'], stageName: 'Proofing', confidence: 65 },
        { patterns: ['plate'], stageName: 'Plate Making', confidence: 65 },
        { patterns: ['rip', 'ripping'], stageName: 'RIP Processing', confidence: 65 }
      ],
      packaging: [
        { patterns: ['packag', 'box', 'boxing'], stageName: 'Packaging', confidence: 70 },
        { patterns: ['wrap', 'wrapping'], stageName: 'Wrapping', confidence: 70 },
        { patterns: ['ship', 'shipping'], stageName: 'Shipping', confidence: 65 },
        { patterns: ['mail', 'mailing'], stageName: 'Mailing', confidence: 65 }
      ],
      delivery: [
        { patterns: ['collect', 'collection', 'pickup', 'customer collect'], stageName: 'Shipping', confidence: 70 },
        { patterns: ['local delivery', 'delivery', 'local'], stageName: 'Shipping', confidence: 70 },
        { patterns: ['courier', 'post', 'mail'], stageName: 'Shipping', confidence: 70 },
        { patterns: ['dispatch', 'ship'], stageName: 'Shipping', confidence: 70 },
        { patterns: ['hand deliver'], stageName: 'Shipping', confidence: 65 }
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
   * UPDATED: Raised threshold from 70 to 95 to prevent learning from guesses
   */
  private async learnFromMappings(mappings: RowMappingResult[]): Promise<void> {
    try {
      const newMappings = mappings
        // RAISED: Only learn from highly confident (exact/DB-boosted) matches, not fuzzy/pattern guesses
        .filter(m => !m.isUnmapped && m.confidence >= 95 && !m.manualOverride)
        .map(m => ({
          excel_text: `${m.groupName} ${m.description}`.toLowerCase().trim(),
          production_stage_id: m.mappedStageId,
          confidence_score: m.confidence,
          mapping_type: 'production_stage' as const,
          is_verified: m.confidence >= 95 // Only exact matches are verified
        }));

      if (newMappings.length > 0) {
        // Use upsert to avoid conflicts
        await supabase
          .from('excel_import_mappings')
          .upsert(newMappings, { 
            onConflict: 'excel_text,production_stage_id',
            ignoreDuplicates: false 
          });
        
        this.logger.addDebugInfo(`Learned ${newMappings.length} new mappings (confidence >= 95 only)`);
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
   * UPDATED: Prioritize stage-level exact/DB matches before attempting stage+spec fuzzy
   */
  private findIntelligentStageMatchWithSpec(
    groupName: string,
    description: string,
    category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging'
  ): MappingConfidence | null {
    const searchText = `${groupName} ${description}`.toLowerCase().trim();
    
    // Strategy 1: Try stage-level matching first (DB, exact, fuzzy, pattern)
    const stageMatch = this.findIntelligentStageMatch(groupName, description, category);
    
    // If we got a high-confidence stage match (exact or DB-backed), return immediately
    // This prevents stage+spec fuzzy from overriding with cross-binding guesses
    if (stageMatch && stageMatch.confidence >= 95) {
      this.logger.addDebugInfo(`✅ [Stage high-conf] "${searchText}" -> "${stageMatch.stageName}" (${stageMatch.confidence}) - skipping spec matching`);
      return stageMatch;
    }
    
    // Strategy 2: If no high-confidence stage match, try stage + specification matching with strict guards
    const stageSpecMatch = this.findStageSpecificationMatch(searchText, category);
    if (stageSpecMatch) {
      this.logger.addDebugInfo(`✅ [Stage+Spec] "${searchText}" -> "${stageSpecMatch.stageName}" / "${stageSpecMatch.stageSpecName}" (${stageSpecMatch.confidence})`);
      return stageSpecMatch;
    }
    
    // Strategy 3: Fall back to lower-confidence stage match if we have one
    if (stageMatch) {
      this.logger.addDebugInfo(`✅ [Stage fallback] "${searchText}" -> "${stageMatch.stageName}" (${stageMatch.confidence})`);
      return stageMatch;
    }
    
    return null;
  }

  /**
   * Find matching stage and specification combination
   * UPDATED: Added strict anchor-token guards and raised threshold to prevent cross-binding matches
   */
  private findStageSpecificationMatch(searchText: string, category: string): MappingConfidence | null {
    const normalized = this.normalizeText(searchText);
    
    // Define critical binding tokens that must match
    const criticalTokens = ['perfect', 'wire', 'wiro', 'saddle', 'case', 'spiral', 'comb'];
    const searchTokens = criticalTokens.filter(token => normalized.includes(token));
    
    let bestMatch: MappingConfidence | null = null;
    let bestScore = 0;

    // Look for stage + specification combinations
    for (const spec of this.stageSpecs) {
      const stage = this.stages.find(s => s.id === spec.production_stage_id);
      if (!stage || this.inferStageCategory(stage.name) !== category) continue;

      const specName = spec.name.toLowerCase();
      const stageName = stage.name.toLowerCase();
      
      // ANCHOR-TOKEN GUARD: If search has critical token, require stage or spec to have same token
      if (searchTokens.length > 0) {
        const normalizedStageName = this.normalizeText(stageName);
        const normalizedSpecName = this.normalizeText(specName);
        const hasMatchingToken = searchTokens.some(token => 
          normalizedStageName.includes(token) || normalizedSpecName.includes(token)
        );
        if (!hasMatchingToken) {
          this.logger.addDebugInfo(`🚫 Blocked stage+spec: "${searchText}" -> "${stage.name}/${spec.name}" (missing anchor token: ${searchTokens.join(', ')})`);
          continue; // Skip this stage/spec combo
        }
      }
      
      // Check if the search text matches both stage and specification
      const stageScore = this.calculateSimilarity(searchText, stageName);
      const specScore = this.calculateSimilarity(searchText, specName);
      const combinedScore = this.calculateSimilarity(searchText, `${stageName} ${specName}`);
      
      const maxScore = Math.max(stageScore, specScore, combinedScore);
      
      // RAISED THRESHOLD: From 0.6 to 0.8, capped confidence at 85
      if (maxScore > bestScore && maxScore > 0.8) {
        bestScore = maxScore;
        bestMatch = {
          stageId: stage.id,
          stageName: stage.name,
          stageSpecId: spec.id,
          stageSpecName: spec.name,
          confidence: Math.min(Math.round(maxScore * 85), 85), // Cap at 85, below exact/DB
          source: 'fuzzy',
          category: this.inferStageCategory(stage.name)
        };
      }
    }

    return bestMatch;
  }
}