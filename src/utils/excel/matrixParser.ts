
import * as XLSX from "xlsx";
import type { MatrixExcelData, GroupSpecifications, OperationQuantities, ParsedJob, CoverTextDetection, CoverTextComponent } from './types';
import type { ExcelImportDebugger } from './debugger';
import { formatExcelDate } from './dateFormatter';
import { formatWONumber } from './woNumberFormatter';

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

export const parseMatrixDataToJobs = (
  matrixData: MatrixExcelData,
  columnMapping: any,
  logger: ExcelImportDebugger
): ParsedJob[] => {
  logger.addDebugInfo("Starting matrix data to jobs conversion...");
  
  const jobs: ParsedJob[] = [];
  const jobMap = new Map<string, ParsedJob>();
  
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
    
    jobs.push(job);
  }
  
  logger.addDebugInfo(`Matrix parsing completed. Generated ${jobs.length} jobs.`);
  return jobs;
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
  
  return {
    wo_no: woNo,
    status: 'Pre-Press',
    date: formatExcelDate(safeGet(columnMapping.date || -1), logger),
    rep: safeGet(columnMapping.rep || -1),
    category: safeGet(columnMapping.category || -1),
    customer: safeGet(columnMapping.customer || -1),
    reference: safeGet(columnMapping.reference || -1),
    qty: parseInt(String(safeGet(columnMapping.qty || matrixData.woQtyColumn || -1)).replace(/[^0-9]/g, '')) || 0,
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
  
  rows.forEach((row, index) => {
    const groupValue = row[matrixData.groupColumn!];
    if (!groupValue) return;
    
    const group = String(groupValue).trim();
    const description = matrixData.descriptionColumn !== -1 ? row[matrixData.descriptionColumn] : '';
    const qty = matrixData.qtyColumn !== -1 ? parseInt(String(row[matrixData.qtyColumn] || '0').replace(/[^0-9]/g, '')) || 0 : 0;
    const woQty = matrixData.woQtyColumn !== -1 ? parseInt(String(row[matrixData.woQtyColumn] || '0').replace(/[^0-9]/g, '')) || 0 : 0;
    
    // Categorize group
    const category = categorizeGroup(group);
    
    // Collect printing and paper data for cover/text detection
    if (category === 'printing') {
      printingRows.push({
        description: String(description || '').trim(),
        qty,
        wo_qty: woQty,
        rawRow: row,
        rowIndex: index
      });
    }
    
    if (category === 'paper') {
      paperRows.push({
        description: String(description || '').trim(),
        qty,
        wo_qty: woQty,
        rawRow: row,
        rowIndex: index
      });
    }
    
    const specData = {
      description: String(description || '').trim(),
      qty,
      wo_qty: woQty,
      specifications: group
    };
    
    if (category) {
      // Use description as key if available and not empty, otherwise use group
      const specKey = description && description.trim() ? description.trim() : group;
      specs[category][specKey] = specData;
      
      // Also add to operations with quantity information
      if (qty > 0) {
        specs.operations[specKey] = {
          operation_qty: qty,
          total_wo_qty: woQty
        };
      }
    }
    
    const specKey = description && description.trim() ? description.trim() : group;
    logger.addDebugInfo(`Extracted spec - Group: ${group}, Category: ${category}, Key: ${specKey}, Desc: ${description}, Qty: ${qty}, WO_Qty: ${woQty}`);
  });
  
  // Detect cover/text scenario if multiple printing rows exist
  const coverTextDetection = detectCoverTextScenario(printingRows, paperRows, logger);
  
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
  
  logger.addDebugInfo(`Multiple printing rows detected (${printingRows.length}) - analyzing for cover/text scenario`);
  
  // Sort printing rows by quantity (ascending) - cover will have lower quantity
  const sortedPrintingRows = [...printingRows].sort((a, b) => a.qty - b.qty);
  
  // Identify cover (smallest quantity) and text (larger quantity)
  const coverPrinting = sortedPrintingRows[0];
  const textPrinting = sortedPrintingRows[sortedPrintingRows.length - 1];
  
  if (coverPrinting.qty >= textPrinting.qty) {
    logger.addDebugInfo("Quantities are not different enough to determine cover/text split");
    return null;
  }
  
  logger.addDebugInfo(`Cover detected: ${coverPrinting.description} (qty: ${coverPrinting.qty}, wo_qty: ${coverPrinting.wo_qty})`);
  logger.addDebugInfo(`Text detected: ${textPrinting.description} (qty: ${textPrinting.qty}, wo_qty: ${textPrinting.wo_qty})`);
  
  // Match paper to printing by quantity logic
  const sortedPaperRows = [...paperRows].sort((a, b) => a.qty - b.qty);
  
  // Find paper that matches cover quantity (for cover paper)
  const coverPaper = sortedPaperRows.find(paper => paper.qty === coverPrinting.qty) || sortedPaperRows[0];
  
  // Find paper that matches text quantity (for text paper) 
  const textPaper = sortedPaperRows.find(paper => paper.qty === textPrinting.qty) || 
                   sortedPaperRows.find(paper => paper !== coverPaper) || 
                   sortedPaperRows[sortedPaperRows.length - 1];
  
  const components: CoverTextComponent[] = [
    {
      type: 'cover',
      printing: {
        description: coverPrinting.description,
        qty: coverPrinting.qty, // Use printing row quantity for printing operations
        wo_qty: coverPrinting.wo_qty,
        row: coverPrinting.rawRow
      },
      paper: coverPaper ? {
        description: coverPaper.description,
        qty: coverPaper.qty, // Keep paper quantity separate
        wo_qty: coverPaper.wo_qty,
        row: coverPaper.rawRow
      } : undefined
    },
    {
      type: 'text',
      printing: {
        description: textPrinting.description,
        qty: textPrinting.qty, // Use printing row quantity for printing operations
        wo_qty: textPrinting.wo_qty,
        row: textPrinting.rawRow
      },
      paper: textPaper ? {
        description: textPaper.description,
        qty: textPaper.qty, // Keep paper quantity separate
        wo_qty: textPaper.wo_qty,
        row: textPaper.rawRow
      } : undefined
    }
  ];
  
  // Generate dependency group ID for synchronization points
  const dependencyGroupId = `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  logger.addDebugInfo(`Book job detected with dependency group: ${dependencyGroupId}`);
  logger.addDebugInfo(`Cover printing qty: ${coverPrinting.qty}, Cover paper qty: ${coverPaper?.qty || 'N/A'}`);
  logger.addDebugInfo(`Text printing qty: ${textPrinting.qty}, Text paper qty: ${textPaper?.qty || 'N/A'}`);
  
  return {
    isBookJob: true,
    components,
    dependencyGroupId
  };
};
