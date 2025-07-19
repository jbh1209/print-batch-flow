import { parse } from 'date-fns';
import { isValid } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { ExcelImportDebugger } from './debugger';
import { ColumnMapping, ParsedJob } from './types';
import { formatDate } from './dateFormatter';
import { formatWoNumber } from './woNumberFormatter';

const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;

  const formats = [
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'MM-dd-yyyy',
    'dd/MM/yyyy',
    'dd-MM-yyyy',
    'yyyy/MM/dd',
    'MMMM d, yyyy',
    'MMM d, yyyy',
    'M/d/yy',
    'd/M/yy',
  ];

  for (const format of formats) {
    const parsedDate = parse(dateString, format, new Date(), { locale: enUS });
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }

  return null;
};

export const parseExcelRow = (row: any[], columnMap: ColumnMapping, logger?: ExcelImportDebugger): ParsedJob => {
  const getColumnValue = (columnIndex: number): string => {
    if (columnIndex === -1 || !row[columnIndex]) return '';
    return String(row[columnIndex]).trim();
  };

  const parseNumber = (value: string): number => {
    if (!value) return 0;
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Use qty column first, fall back to woQty if qty is not available
  const qtyValue = getColumnValue(columnMap.qty) || getColumnValue(columnMap.woQty);
  const woQtyValue = getColumnValue(columnMap.woQty);

  const job: ParsedJob = {
    woNo: getColumnValue(columnMap.woNo),
    customer: getColumnValue(columnMap.customer),
    status: getColumnValue(columnMap.status),
    date: getColumnValue(columnMap.date),
    rep: getColumnValue(columnMap.rep),
    category: getColumnValue(columnMap.category),
    reference: getColumnValue(columnMap.reference),
    qty: parseNumber(qtyValue), // Use individual quantity
    woQty: parseNumber(woQtyValue), // Store work order quantity separately
    dueDate: getColumnValue(columnMap.dueDate),
    location: getColumnValue(columnMap.location),
    estimatedHours: parseNumber(getColumnValue(columnMap.estimatedHours)),
    setupTime: parseNumber(getColumnValue(columnMap.setupTime)),
    runningSpeed: parseNumber(getColumnValue(columnMap.runningSpeed)),
    speedUnit: getColumnValue(columnMap.speedUnit),
    specifications: getColumnValue(columnMap.specifications),
    paperWeight: parseNumber(getColumnValue(columnMap.paperWeight)),
    paperType: getColumnValue(columnMap.paperType),
    lamination: getColumnValue(columnMap.lamination)
  };

  if (logger) {
    logger.addDebugInfo(`Parsed job: WO=${job.woNo}, Customer=${job.customer}, Qty=${job.qty}, WO_Qty=${job.woQty}`);
  }

  return job;
};
