import * as XLSX from "xlsx";
import type { MatrixExcelData, GroupSpecifications, OperationQuantities, ParsedJob } from './types';
import type { ExcelImportDebugger } from './debugger';
import { formatExcelDate } from './dateFormatter';
import { formatWONumber } from './woNumberFormatter';

// Known group categories we're looking for
const GROUP_CATEGORIES = {
  PAPER: ['Paper', 'PAPER', 'paper'],
  DELIVERY: ['Delivery', 'DELIVERY', 'delivery'],
  FINISHING: ['Finishing', 'FINISHING', 'finishing', 'Finish', 'FINISH', 'finish'],
  PREPRESS: ['Pre-press', 'PRE-PRESS', 'pre-press', 'Prepress', 'PREPRESS', 'prepress', 'DTP', 'dtp'],
  PRINTING: ['Printing', 'PRINTING', 'printing', 'Print', 'PRINT', 'print']
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
      operation_quantities: groupSpecs.operations
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
    qty: parseInt(safeGet(columnMapping.qty || matrixData.woQtyColumn || -1)) || 0,
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
  operations: OperationQuantities | null;
} => {
  
  const specs = {
    paper: {} as GroupSpecifications,
    delivery: {} as GroupSpecifications,
    finishing: {} as GroupSpecifications,
    prepress: {} as GroupSpecifications,
    printing: {} as GroupSpecifications,
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
      operations: null
    };
  }
  
  rows.forEach(row => {
    const groupValue = row[matrixData.groupColumn!];
    if (!groupValue) return;
    
    const group = String(groupValue).trim();
    const description = matrixData.descriptionColumn !== -1 ? row[matrixData.descriptionColumn] : '';
    const qty = matrixData.qtyColumn !== -1 ? parseInt(row[matrixData.qtyColumn]) || 0 : 0;
    const woQty = matrixData.woQtyColumn !== -1 ? parseInt(row[matrixData.woQtyColumn]) || 0 : 0;
    
    // Categorize group
    const category = categorizeGroup(group);
    
    const specData = {
      description: String(description || '').trim(),
      qty,
      wo_qty: woQty,
      specifications: group
    };
    
    if (category) {
      specs[category][group] = specData;
      
      // Also add to operations
      if (qty > 0) {
        specs.operations[group] = {
          operation_qty: qty,
          total_wo_qty: woQty
        };
      }
    }
    
    logger.addDebugInfo(`Extracted spec - Group: ${group}, Category: ${category}, Desc: ${description}, Qty: ${qty}, WO_Qty: ${woQty}`);
  });
  
  return {
    paper: Object.keys(specs.paper).length > 0 ? specs.paper : null,
    delivery: Object.keys(specs.delivery).length > 0 ? specs.delivery : null,
    finishing: Object.keys(specs.finishing).length > 0 ? specs.finishing : null,
    prepress: Object.keys(specs.prepress).length > 0 ? specs.prepress : null,
    printing: Object.keys(specs.printing).length > 0 ? specs.printing : null,
    operations: Object.keys(specs.operations).length > 0 ? specs.operations : null
  };
};

const categorizeGroup = (group: string): keyof typeof GROUP_CATEGORIES | null => {
  const groupLower = group.toLowerCase();
  
  for (const [category, variations] of Object.entries(GROUP_CATEGORIES)) {
    if (variations.some(variation => groupLower.includes(variation.toLowerCase()))) {
      return category.toLowerCase() as keyof typeof GROUP_CATEGORIES;
    }
  }
  
  return null;
};