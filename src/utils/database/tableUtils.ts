
import { ValidTableName, isExistingTable } from './tableValidation';
import { ExistingTableName } from '@/config/productTypes';

// Re-export the validation function and types from tableValidation
export { isExistingTable };
export type { ValidTableName };  // Use "export type" for re-exporting types

// This file is now simplified to just export the re-exports
// and delegate to the main tableValidation.ts file for actual validation
