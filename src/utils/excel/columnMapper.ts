
import type { ExcelImportDebugger } from './debugger';

export const findColumnIndex = (headers: string[], possibleNames: string[], logger: ExcelImportDebugger): number => {
  const headerLower = headers.map(h => String(h || '').toLowerCase().trim());
  
  for (const name of possibleNames) {
    const index = headerLower.findIndex(h => h.includes(name.toLowerCase()));
    if (index !== -1) {
      logger.addDebugInfo(`Found column "${name}" at index ${index} (header: "${headers[index]}")`);
      return index;
    }
  }
  
  logger.addDebugInfo(`Column not found for: ${possibleNames.join(', ')}`);
  return -1;
};

export const createColumnMap = (headers: string[], logger: ExcelImportDebugger) => {
  return {
    woNo: findColumnIndex(headers, ['wo no', 'work order', 'wo number'], logger),
    status: findColumnIndex(headers, ['status'], logger),
    date: findColumnIndex(headers, ['date', 'creation date', 'created'], logger),
    rep: findColumnIndex(headers, ['rep', 'representative'], logger),
    category: findColumnIndex(headers, ['category', 'type'], logger),
    customer: findColumnIndex(headers, ['customer', 'client'], logger),
    reference: findColumnIndex(headers, ['reference', 'ref'], logger),
    qty: findColumnIndex(headers, ['qty', 'quantity'], logger),
    dueDate: findColumnIndex(headers, ['due date', 'due'], logger),
    location: findColumnIndex(headers, ['location', 'dept', 'department'], logger),
    // New timing and specification columns
    estimatedHours: findColumnIndex(headers, ['estimated hours', 'est hours', 'duration hours'], logger),
    setupTime: findColumnIndex(headers, ['setup time', 'make ready', 'setup minutes'], logger),
    runningSpeed: findColumnIndex(headers, ['running speed', 'speed', 'rate'], logger),
    speedUnit: findColumnIndex(headers, ['speed unit', 'unit', 'rate unit'], logger),
    specifications: findColumnIndex(headers, ['specifications', 'specs', 'notes'], logger),
    paperWeight: findColumnIndex(headers, ['paper weight', 'weight', 'gsm'], logger),
    paperType: findColumnIndex(headers, ['paper type', 'paper', 'stock'], logger),
    lamination: findColumnIndex(headers, ['lamination', 'finish', 'coating'], logger)
  };
};
