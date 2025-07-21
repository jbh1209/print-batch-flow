import type { GroupSpecifications, ParsedJob } from './types';
import type { ExcelImportDebugger } from './debugger';
import { formatExcelDate } from './dateFormatter';
import { formatWONumber } from './woNumberFormatter';

export class EnhancedJobCreator {
  constructor(
    private logger: ExcelImportDebugger
  ) {}

  /**
   * Create a base job with enhanced logic, extracting data from various specifications
   */
  createBaseJobEnhanced(
    woNo: string,
    columnMapping: any,
    matrixData: any,
    row: any[],
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    paperSpecs: GroupSpecifications | null,
    packagingSpecs: GroupSpecifications | null,
    deliverySpecs: GroupSpecifications | null
  ): ParsedJob {
    this.logger.addDebugInfo(`[ENHANCED JOB CREATION] Creating base job for WO: ${woNo}`);

    // Helper function to safely get values from column mapping or matrix data
    const safeGet = (index: number) => index !== -1 && row[index] ? String(row[index]).trim() : '';

    // Extract common fields using column mapping (fallback to matrix detection)
    const date = formatExcelDate(safeGet(columnMapping.date || -1), this.logger);
    const rep = safeGet(columnMapping.rep || -1);
    const category = safeGet(columnMapping.category || -1);
    const customer = safeGet(columnMapping.customer || -1);
    const reference = safeGet(columnMapping.reference || -1);
    const dueDate = formatExcelDate(safeGet(columnMapping.dueDate || -1), this.logger);
    const location = safeGet(columnMapping.location || -1);
    const size = safeGet(columnMapping.size || -1) || null;
    const specification = safeGet(columnMapping.specification || -1) || null;
    const contact = safeGet(columnMapping.contact || -1) || null;

    // Extract quantity from printing specifications
    let qty = this.extractQuantityFromJobSpecs(
      woNo,
      printingSpecs,
      finishingSpecs,
      prepressSpecs,
      paperSpecs,
      packagingSpecs,
      deliverySpecs
    );

    // If quantity is zero, try to get it from the column mapping or matrix data
    if (qty === 0) {
      const woQtyRaw = safeGet(columnMapping.qty || matrixData.woQtyColumn || -1);
      qty = parseInt(String(woQtyRaw).replace(/[^0-9]/g, '')) || 0;
      this.logger.addDebugInfo(`[ENHANCED JOB CREATION] Quantity from WO Qty Column: ${qty}`);
    }

    this.logger.addDebugInfo(`[ENHANCED JOB CREATION] Final Quantity: ${qty}`);

    return {
      wo_no: woNo,
      status: 'Pre-Press',
      date,
      rep,
      category,
      customer,
      reference,
      qty,
      due_date: dueDate,
      location,
      size,
      specification,
      contact
    };
  }

  /**
   * Extract quantity for a specific group from job specifications with enhanced matching
   */
  private extractQuantityFromJobSpecs(
    groupName: string,
    printingSpecs: GroupSpecifications | null,
    finishingSpecs: GroupSpecifications | null,
    prepressSpecs: GroupSpecifications | null,
    paperSpecs: GroupSpecifications | null,
    packagingSpecs: GroupSpecifications | null,
    deliverySpecs: GroupSpecifications | null
  ): number {
    this.logger.addDebugInfo(`[QUANTITY EXTRACTION] Searching for quantity for group: "${groupName}"`);
    
    const allSpecs = [
      { name: 'printing', specs: printingSpecs },
      { name: 'finishing', specs: finishingSpecs },
      { name: 'prepress', specs: prepressSpecs },
      { name: 'paper', specs: paperSpecs },
      { name: 'packaging', specs: packagingSpecs },
      { name: 'delivery', specs: deliverySpecs }
    ];

    // Clean the group name by removing paper suffixes (everything after " - ")
    const cleanedGroupName = groupName.includes(' - ') 
      ? groupName.split(' - ')[0].trim()
      : groupName;
    
    this.logger.addDebugInfo(`[QUANTITY EXTRACTION] Original: "${groupName}", Cleaned: "${cleanedGroupName}"`);

    for (const { name, specs } of allSpecs) {
      if (!specs) continue;
      
      this.logger.addDebugInfo(`[QUANTITY EXTRACTION] Searching in ${name} specs...`);
      
      // Strategy 1: Try exact match with original group name
      if (specs[groupName]) {
        const qty = specs[groupName].qty || 0;
        this.logger.addDebugInfo(`[QUANTITY EXTRACTION] ✓ Exact match found in ${name}: "${groupName}" -> qty: ${qty}`);
        return qty;
      }
      
      // Strategy 2: Try exact match with cleaned group name (paper suffix removed)
      if (cleanedGroupName !== groupName && specs[cleanedGroupName]) {
        const qty = specs[cleanedGroupName].qty || 0;
        this.logger.addDebugInfo(`[QUANTITY EXTRACTION] ✓ Cleaned match found in ${name}: "${cleanedGroupName}" -> qty: ${qty}`);
        return qty;
      }
      
      // Strategy 3: Try fuzzy matching on all keys in the spec
      for (const [specKey, specValue] of Object.entries(specs)) {
        // Check if the spec key contains the cleaned group name or vice versa
        const similarity1 = this.calculateStringSimilarity(cleanedGroupName.toLowerCase(), specKey.toLowerCase());
        const similarity2 = this.calculateStringSimilarity(groupName.toLowerCase(), specKey.toLowerCase());
        const maxSimilarity = Math.max(similarity1, similarity2);
        
        this.logger.addDebugInfo(`[QUANTITY EXTRACTION] Fuzzy match attempt in ${name}: "${specKey}" vs "${groupName}" (similarity: ${maxSimilarity.toFixed(2)})`);
        
        if (maxSimilarity > 0.8) { // 80% similarity threshold
          const qty = specValue.qty || 0;
          this.logger.addDebugInfo(`[QUANTITY EXTRACTION] ✓ Fuzzy match found in ${name}: "${specKey}" -> qty: ${qty} (similarity: ${maxSimilarity.toFixed(2)})`);
          return qty;
        }
      }
    }
    
    this.logger.addDebugInfo(`[QUANTITY EXTRACTION] ✗ No match found for "${groupName}", defaulting to 0`);
    return 0;
  }

  /**
   * Calculate string similarity using a simple algorithm
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;
    
    // Check if one string contains the other
    if (str1.includes(str2) || str2.includes(str1)) return 0.9;
    
    // Simple character-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    return matches / longer.length;
  }
}
