
import { LaminationType } from "@/config/types/productConfigTypes";
import { BaseJob, ProductConfig } from "@/config/productTypes";

/**
 * Result of a batch creation operation
 */
export interface BatchCreationResult {
  success: boolean;
  batchId: string | null;
  error?: string;
  jobsUpdated: number;
}

/**
 * Properties to configure a new batch
 */
export interface BatchProperties {
  paperType?: string;
  paperWeight?: string;
  laminationType?: LaminationType;
  printerType?: string;
  sheetSize?: string;
  slaTargetDays?: number;
}

/**
 * Configuration for creating a batch
 * Instead of extending ProductConfig, we'll create a new type that includes all required fields
 */
export interface BatchCreationConfig {
  productType: string;
  tableName: string;
  jobNumberPrefix: string;
  slaTargetDays: number; // Changed from optional to required to match ProductConfig
  laminationType?: LaminationType;
  paperType?: string;
  paperWeight?: string;
  // Include other optional properties from ProductConfig that might be needed
  availablePaperTypes?: string[];
  availablePaperWeights?: string[];
  availableSizes?: string[];
  availableLaminationTypes?: LaminationType[];
  hasLamination?: boolean;
  hasPaperType?: boolean;
  hasPaperWeight?: boolean;
}

/**
 * Batch data to be inserted into the database
 */
export interface BatchData {
  name: string;
  sheets_required: number;
  due_date: string;
  lamination_type: LaminationType;
  paper_type?: string;
  status: 'pending';
  created_by: string;
  sla_target_days: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
}
