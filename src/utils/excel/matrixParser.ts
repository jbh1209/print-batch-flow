
import * as XLSX from "xlsx";
import type { MatrixExcelData, GroupSpecifications, OperationQuantities, ParsedJob, CoverTextDetection, CoverTextComponent } from './types';
import type { ExcelImportDebugger } from './debugger';
import { formatExcelDate } from './dateFormatter';
import { formatWONumber } from './woNumberFormatter';
import { checkParsedJobsForDuplicates } from '../jobDeduplication';

// Known group categories we're looking for
const GROUP_CATEGORIES = {
  PAPER: ['Paper', 'PAPER', 'paper'],
  DELIVERY: ['Delivery', 'DELIVERY', 'delivery'],
  FINISHING: ['Finishing', 'FINISHING', 'finishing', 'Finish', 'FINISH', 'finish'],
  PREPRESS: ['Pre-press', 'PRE-PRESS', 'pre-press', 'Prepress', 'PREPRESS', 'prepress', 'DTP', 'dtp'],
  PRINTING: ['Printing', 'PRINTING', 'printing', 'Print', 'PRINT', 'print'],
  PACKAGING: ['Packaging', 'PACKAGING', 'packaging', 'Package', 'PACKAGE', 'package']
};

export const parseMatrixExcelFile = async (file: File, logger: ExcelImportDebugger): Promise<MatrixExcelData> => {
  logger.addDebugInfo(`Starting matrix parsing for file: ${file.name}`);
  
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  
  if (jsonData.length < 2) {
    throw new Error("Excel file appears to be empty or has no data rows");
  }

  const headers = jsonData[0] as string[];
  const rows = jsonData.slice(1) as any[][];
  
  logger.addDebugInfo(`Matrix headers: ${JSON.stringify(headers)}`);
  
  // Detect key columns
  const matrixData = detectMatrixStructure(headers, rows, logger);
  
  return matrixData;
};

const detectMatrixStructure = (headers: string[], rows: any[][], logger: ExcelImportDebugger): MatrixExcelData => {
  logger.addDebugInfo("Detecting matrix structure...");
  
  // Find key columns by header names
  const groupColumn = findColumnByNames(headers, ['Groups', 'GROUP', 'group', 'Category', 'CATEGORY', 'category']);
  const workOrderColumn = findColumnByNames(headers, ['WO', 'Work Order', 'WorkOrder', 'wo_no', 'WO_NO']);
  const descriptionColumn = findColumnByNames(headers, ['Description', 'DESCRIPTION', 'description', 'Desc', 'DESC']);
  const qtyColumn = findColumnByNames(headers, ['Qty', 'QTY', 'qty', 'Quantity', 'QUANTITY']);
  const woQtyColumn = findColumnByNames(headers, ['Wo_Qty', 'WO_QTY', 'wo_qty', 'WO Qty', 'Total Qty']);
  
  logger.addDebugInfo(`Detected columns - Group: ${groupColumn}, WO: ${workOrderColumn}, Desc: ${descriptionColumn}, Qty: ${qtyColumn}, WO_Qty: ${woQtyColumn}`);
  
  // Detect groups present in the data
  const detectedGroups = detectGroups(rows, groupColumn, logger);
  
  return {
    headers,
    rows,
    groupColumn,
    workOrderColumn,
    descriptionColumn,
    qtyColumn,
    woQtyColumn,
    detectedGroups
  };
};

const findColumnByNames = (headers: string[], possibleNames: string[]): number => {
  for (const name of possibleNames) {
    const index = headers.findIndex(header => 
      header && header.toLowerCase().includes(name.toLowerCase())
    );
    if (index !== -1) return index;
  }
  return -1;
};

const detectGroups = (rows: any[][], groupColumn: number, logger: ExcelImportDebugger): string[] => {
  if (groupColumn === -1) return [];
  
  const uniqueGroups = new Set<string>();
  
  rows.forEach(row => {
    const groupValue = row[groupColumn];
    if (groupValue && typeof groupValue === 'string') {
      uniqueGroups.add(groupValue.trim());
    }
  });
  
  const groups = Array.from(uniqueGroups);
  logger.addDebugInfo(`Detected groups: ${JSON.stringify(groups)}`);
  
  return groups;
};

export const parseMatrixDataToJobs = async (
  matrixData: MatrixExcelData,
  columnMapping: any,
  logger: ExcelImportDebugger
): Promise<{ jobs: ParsedJob[]; duplicatesSkipped: number; duplicateJobs: ParsedJob[] }> => {
  logger.addDebugInfo("Starting matrix data to jobs conversion...");
  
  const allJobs: ParsedJob[] = [];
  
  // Group rows by work order
  const workOrderGroups = groupRowsByWorkOrder(matrixData, logger);
  
  for (const [woNo, woRows] of workOrderGroups.entries()) {
    logger.addDebugInfo(`Processing work order: ${woNo} with ${woRows.length} rows`);
    
    // Create base job from first row
    const baseJob = createBaseJob(woRows[0], matrixData, columnMapping, logger);
    if (!baseJob) continue;
    
    // Extract group-based specifications
    const groupSpecs = extractGroupSpecifications(woRows, matrixData, logger);
    
    // Merge specifications into job
    const job: ParsedJob = {
      ...baseJob,
      paper_specifications: groupSpecs.paper,
      delivery_specifications: groupSpecs.delivery,
      finishing_specifications: groupSpecs.finishing,
      prepress_specifications: groupSpecs.prepress,
      printing_specifications: groupSpecs.printing,
      packaging_specifications: groupSpecs.packaging,
      operation_quantities: groupSpecs.operations,
      cover_text_detection: groupSpecs.coverTextDetection
    };
    
    allJobs.push(job);
  }
  
  logger.addDebugInfo(`Matrix parsing completed. Generated ${allJobs.length} jobs. Checking for duplicates...`);
  
  // Check for duplicates against existing database entries
  const duplicateCheck = await checkParsedJobsForDuplicates(allJobs);
  
  logger.addWarning(`Duplicate check complete: ${duplicateCheck.newJobs.length} new jobs, ${duplicateCheck.duplicates.length} duplicates skipped`);
  
  if (duplicateCheck.duplicates.length > 0) {
    const duplicateWONumbers = duplicateCheck.duplicates.map(job => job.wo_no).join(', ');
    logger.addWarning(`Skipped duplicate WO numbers: ${duplicateWONumbers}`);
  }
  
  return {
    jobs: duplicateCheck.newJobs as ParsedJob[],
    duplicatesSkipped: duplicateCheck.duplicates.length,
    duplicateJobs: duplicateCheck.duplicates as ParsedJob[]
  };
};

const groupRowsByWorkOrder = (matrixData: MatrixExcelData, logger: ExcelImportDebugger): Map<string, any[]> => {
  const groups = new Map<string, any[]>();
  
  if (matrixData.workOrderColumn === -1) {
    logger.addDebugInfo("No work order column detected, treating as single job");
    groups.set("UNKNOWN", matrixData.rows);
    return groups;
  }
  
  matrixData.rows.forEach(row => {
    const woValue = row[matrixData.workOrderColumn!];
    const woNo = formatWONumber(woValue, logger);
    
    if (woNo) {
      if (!groups.has(woNo)) {
        groups.set(woNo, []);
      }
      groups.get(woNo)!.push(row);
    }
  });
  
  return groups;
};

const createBaseJob = (
  row: any[],
  matrixData: MatrixExcelData,
  columnMapping: any,
  logger: ExcelImportDebugger
): ParsedJob | null => {
  
  const woNo = matrixData.workOrderColumn !== -1 
    ? formatWONumber(row[matrixData.workOrderColumn], logger)
    : "MATRIX_JOB_" + Date.now();
    
  if (!woNo) {
    logger.addDebugInfo("Skipping row: No work order number");
    return null;
  }
  
  // Extract basic fields using column mapping (fallback to matrix detection)
  const safeGet = (index: number) => index !== -1 && row[index] ? String(row[index]).trim() : '';
  
  // LOGGING: Track WO quantity extraction
  const woQtyRaw = safeGet(columnMapping.qty || matrixData.woQtyColumn || -1);
  const woQtyParsed = parseInt(String(woQtyRaw).replace(/[^0-9]/g, '')) || 0;
  logger.addDebugInfo(`[QUANTITY LOG] createBaseJob - WO: ${woNo}, Raw WO Qty: "${woQtyRaw}", Parsed WO Qty: ${woQtyParsed}`);
  
  return {
    wo_no: woNo,
    status: 'Pre-Press',
    date: formatExcelDate(safeGet(columnMapping.date || -1), logger),
    rep: safeGet(columnMapping.rep || -1),
    category: safeGet(columnMapping.category || -1),
    customer: safeGet(columnMapping.customer || -1),
    reference: safeGet(columnMapping.reference || -1),
    qty: woQtyParsed,
    due_date: formatExcelDate(safeGet(columnMapping.dueDate || -1), logger),
    location: safeGet(columnMapping.location || -1),
    size: safeGet(columnMapping.size || -1) || null,
    specification: safeGet(columnMapping.specification || -1) || null,
    contact: safeGet(columnMapping.contact || -1) || null
  };
};

const extractGroupSpecifications = (
  rows: any[],
  matrixData: MatrixExcelData,
  logger: ExcelImportDebugger
): {
  paper: GroupSpecifications | null;
  delivery: GroupSpecifications | null;
  finishing: GroupSpecifications | null;
  prepress: GroupSpecifications | null;
  printing: GroupSpecifications | null;
  packaging: GroupSpecifications | null;
  operations: OperationQuantities | null;
  coverTextDetection?: CoverTextDetection | null;
} => {
  
  const specs = {
    paper: {} as GroupSpecifications,
    delivery: {} as GroupSpecifications,
    finishing: {} as GroupSpecifications,
    prepress: {} as GroupSpecifications,
    printing: {} as GroupSpecifications,
    packaging: {} as GroupSpecifications,
    operations: {} as OperationQuantities
  };
  
  if (matrixData.groupColumn === -1) {
    logger.addDebugInfo("No group column detected, skipping group specifications");
    return {
      paper: null,
      delivery: null,
      finishing: null,
      prepress: null,
      printing: null,
      packaging: null,
      operations: null,
      coverTextDetection: null
    };
  }
  
  // Collect printing rows for cover/text detection
  const printingRows: Array<{
    description: string;
    qty: number;
    wo_qty: number;
    rawRow: any[];
    rowIndex: number;
  }> = [];
  
  // Collect paper rows for cover/text detection  
  const paperRows: Array<{
    description: string;
    qty: number;
    wo_qty: number;
    rawRow: any[];
    rowIndex: number;
  }> = [];
  
  // First pass: collect printing and paper rows
  rows.forEach((row, index) => {
    const groupValue = row[matrixData.groupColumn!];
    if (!groupValue) return;
    
    const group = String(groupValue).trim();
    const description = matrixData.descriptionColumn !== -1 ? row[matrixData.descriptionColumn] : '';
    
    // LOGGING: Track quantity extraction for each row
    const qtyRaw = matrixData.qtyColumn !== -1 ? row[matrixData.qtyColumn] : '';
    const woQtyRaw = matrixData.woQtyColumn !== -1 ? row[matrixData.woQtyColumn] : '';
    const qty = parseInt(String(qtyRaw || '0').replace(/[^0-9]/g, '')) || 0;
    const woQty = parseInt(String(woQtyRaw || '0').replace(/[^0-9]/g, '')) || 0;
    
    logger.addDebugInfo(`[QUANTITY LOG] Row ${index} - Group: "${group}", Desc: "${description}", Raw Qty: "${qtyRaw}", Parsed Qty: ${qty}, Raw WO_Qty: "${woQtyRaw}", Parsed WO_Qty: ${woQty}`);
    
    const category = categorizeGroup(group);
    
    // Collect printing and paper data for cover/text detection
    if (category === 'printing') {
      const printingRowData = {
        description: String(description || '').trim(),
        qty,
        wo_qty: woQty,
        rawRow: row,
        rowIndex: index
      };
      printingRows.push(printingRowData);
      logger.addDebugInfo(`[QUANTITY LOG] Added to printingRows: ${JSON.stringify({description: printingRowData.description, qty: printingRowData.qty, wo_qty: printingRowData.wo_qty})}`);
    }
    
    if (category === 'paper') {
      const paperRowData = {
        description: String(description || '').trim(),
        qty,
        wo_qty: woQty,
        rawRow: row,
        rowIndex: index
      };
      paperRows.push(paperRowData);
      logger.addDebugInfo(`[QUANTITY LOG] Added to paperRows: ${JSON.stringify({description: paperRowData.description, qty: paperRowData.qty, wo_qty: paperRowData.wo_qty})}`);
    }
  });
  
  // Detect cover/text scenario before processing specifications
  const coverTextDetection = detectCoverTextScenario(printingRows, paperRows, logger);
  
  // Create a map for unique printing specification keys
  const printingKeyMap = new Map<string, string>();
  
  if (coverTextDetection && coverTextDetection.isBookJob) {
    // For book jobs, create unique keys for cover and text printing
    const coverComponent = coverTextDetection.components.find(c => c.type === 'cover');
    const textComponent = coverTextDetection.components.find(c => c.type === 'text');
    
    if (coverComponent) {
      const coverDesc = coverComponent.printing.description;
      printingKeyMap.set(`${coverDesc}_${coverComponent.printing.qty}`, `${coverDesc}_Cover`);
      logger.addDebugInfo(`[QUANTITY LOG] Created unique key for cover printing: ${coverDesc}_Cover (qty: ${coverComponent.printing.qty})`);
    }
    
    if (textComponent) {
      const textDesc = textComponent.printing.description;
      printingKeyMap.set(`${textDesc}_${textComponent.printing.qty}`, `${textDesc}_Text`);
      logger.addDebugInfo(`[QUANTITY LOG] Created unique key for text printing: ${textDesc}_Text (qty: ${textComponent.printing.qty})`);
    }
  }
  
  // Second pass: process all specifications with unique keys
  rows.forEach((row, index) => {
    const groupValue = row[matrixData.groupColumn!];
    if (!groupValue) return;
    
    const group = String(groupValue).trim();
    const description = matrixData.descriptionColumn !== -1 ? row[matrixData.descriptionColumn] : '';
    const qty = matrixData.qtyColumn !== -1 ? parseInt(String(row[matrixData.qtyColumn] || '0').replace(/[^0-9]/g, '')) || 0 : 0;
    const woQty = matrixData.woQtyColumn !== -1 ? parseInt(String(row[matrixData.woQtyColumn] || '0').replace(/[^0-9]/g, '')) || 0 : 0;
    
    const category = categorizeGroup(group);
    
    const specData = {
      description: String(description || '').trim(),
      qty,
      wo_qty: woQty,
      specifications: group
    };
    
    // Define specKey outside the category check so it's always available for logging
    let specKey = description && description.trim() ? description.trim() : group;
    
    if (category) {
      // For printing category, use unique keys if this is a book job
      if (category === 'printing' && coverTextDetection && coverTextDetection.isBookJob) {
        const lookupKey = `${specKey}_${qty}`;
        const uniqueKey = printingKeyMap.get(lookupKey);
        if (uniqueKey) {
          specKey = uniqueKey;
          logger.addDebugInfo(`[QUANTITY LOG] Using unique printing key: ${specKey} for qty: ${qty}`);
        }
      }
      
      specs[category][specKey] = specData;
      logger.addDebugInfo(`[QUANTITY LOG] Added to specs[${category}][${specKey}]: qty=${specData.qty}, wo_qty=${specData.wo_qty}`);
      
      // Also add to operations with quantity information
      if (qty > 0) {
        specs.operations[specKey] = {
          operation_qty: qty,
          total_wo_qty: woQty
        };
        logger.addDebugInfo(`[QUANTITY LOG] Added to operations[${specKey}]: operation_qty=${qty}, total_wo_qty=${woQty}`);
      }
    }
    
    logger.addDebugInfo(`Extracted spec - Group: ${group}, Category: ${category}, Key: ${specKey}, Desc: ${description}, Qty: ${qty}, WO_Qty: ${woQty}`);
  });
  
  // LOGGING: Final specifications summary
  logger.addDebugInfo(`[QUANTITY LOG] Final printing specifications: ${JSON.stringify(Object.entries(specs.printing).map(([key, spec]) => ({key, qty: spec.qty, wo_qty: spec.wo_qty})))}`);
  logger.addDebugInfo(`[QUANTITY LOG] Final operations: ${JSON.stringify(Object.entries(specs.operations).map(([key, op]) => ({key, operation_qty: op.operation_qty, total_wo_qty: op.total_wo_qty})))}`);
  
  return {
    paper: Object.keys(specs.paper).length > 0 ? specs.paper : null,
    delivery: Object.keys(specs.delivery).length > 0 ? specs.delivery : null,
    finishing: Object.keys(specs.finishing).length > 0 ? specs.finishing : null,
    prepress: Object.keys(specs.prepress).length > 0 ? specs.prepress : null,
    printing: Object.keys(specs.printing).length > 0 ? specs.printing : null,
    packaging: Object.keys(specs.packaging).length > 0 ? specs.packaging : null,
    operations: Object.keys(specs.operations).length > 0 ? specs.operations : null,
    coverTextDetection
  };
};

const categorizeGroup = (group: string): string | null => {
  const groupLower = group.toLowerCase();
  
  for (const [category, variations] of Object.entries(GROUP_CATEGORIES)) {
    if (variations.some(variation => groupLower.includes(variation.toLowerCase()))) {
      // Return lowercase to match the specs object keys (paper, delivery, finishing, etc.)
      return category.toLowerCase();
    }
  }
  
  return null;
};

const detectCoverTextScenario = (
  printingRows: Array<{
    description: string;
    qty: number;
    wo_qty: number;
    rawRow: any[];
    rowIndex: number;
  }>,
  paperRows: Array<{
    description: string;
    qty: number;
    wo_qty: number;
    rawRow: any[];
    rowIndex: number;
  }>,
  logger: ExcelImportDebugger
): CoverTextDetection | null => {
  
  // Need at least 2 printing rows to be a book job
  if (printingRows.length < 2) {
    logger.addDebugInfo("Single printing row detected - not a book job");
    return null;
  }
  
  logger.addDebugInfo(`[QUANTITY LOG] Multiple printing rows detected (${printingRows.length}) - analyzing for cover/text scenario`);
  logger.addDebugInfo(`[QUANTITY LOG] Printing rows before sorting: ${JSON.stringify(printingRows.map(r => ({desc: r.description, qty: r.qty, wo_qty: r.wo_qty})))}`);
  
  // Sort printing rows by quantity (ascending) - cover will have lower quantity
  const sortedPrintingRows = [...printingRows].sort((a, b) => a.qty - b.qty);
  logger.addDebugInfo(`[QUANTITY LOG] Printing rows after sorting by qty: ${JSON.stringify(sortedPrintingRows.map(r => ({desc: r.description, qty: r.qty, wo_qty: r.wo_qty})))}`);
  
  // Identify cover (smallest quantity) and text (larger quantity)
  const coverPrinting = sortedPrintingRows[0];
  const textPrinting = sortedPrintingRows[sortedPrintingRows.length - 1];
  
  if (coverPrinting.qty >= textPrinting.qty) {
    logger.addDebugInfo("Quantities are not different enough to determine cover/text split");
    return null;
  }
  
  logger.addDebugInfo(`[QUANTITY LOG] Cover detected: ${coverPrinting.description} (qty: ${coverPrinting.qty}, wo_qty: ${coverPrinting.wo_qty})`);
  logger.addDebugInfo(`[QUANTITY LOG] Text detected: ${textPrinting.description} (qty: ${textPrinting.qty}, wo_qty: ${textPrinting.wo_qty})`);
  
  // Match paper to printing by quantity logic
  const sortedPaperRows = [...paperRows].sort((a, b) => a.qty - b.qty);
  
  const components: CoverTextComponent[] = [
    {
      type: 'cover',
      printing: {
        description: coverPrinting.description,
        qty: coverPrinting.qty,
        wo_qty: coverPrinting.wo_qty,
        row: coverPrinting.rawRow
      },
      paper: sortedPaperRows.length > 0 ? {
        description: sortedPaperRows[0].description,
        qty: sortedPaperRows[0].qty,
        wo_qty: sortedPaperRows[0].wo_qty,
        row: sortedPaperRows[0].rawRow
      } : undefined
    },
    {
      type: 'text',
      printing: {
        description: textPrinting.description,
        qty: textPrinting.qty,
        wo_qty: textPrinting.wo_qty,
        row: textPrinting.rawRow
      },
      paper: sortedPaperRows.length > 1 ? {
        description: sortedPaperRows[sortedPaperRows.length - 1].description,
        qty: sortedPaperRows[sortedPaperRows.length - 1].qty,
        wo_qty: sortedPaperRows[sortedPaperRows.length - 1].wo_qty,
        row: sortedPaperRows[sortedPaperRows.length - 1].rawRow
      } : undefined
    }
  ];
  
  // Generate dependency group ID for synchronization points
  const dependencyGroupId = `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  logger.addDebugInfo(`[QUANTITY LOG] Book job detected with dependency group: ${dependencyGroupId}`);
  logger.addDebugInfo(`[QUANTITY LOG] Final components: ${JSON.stringify(components.map(c => ({type: c.type, printing_qty: c.printing.qty, printing_wo_qty: c.printing.wo_qty, paper_qty: c.paper?.qty, paper_wo_qty: c.paper?.wo_qty})))}`);
  
  return {
    isBookJob: true,
    components,
    dependencyGroupId
  };
};
