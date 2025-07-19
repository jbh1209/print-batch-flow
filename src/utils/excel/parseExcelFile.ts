import { ImportStats } from './types';

// Stub function to satisfy import requirements
export const parseExcelFile = async (file: File): Promise<ImportStats> => {
  return {
    total: 0,
    successful: 0,
    failed: 0,
    errors: [],
    totalRows: 0,
    processedRows: 0,
    skippedRows: 0,
    invalidWONumbers: 0,
    invalidDates: 0,
    invalidTimingData: 0
  };
};