
import { BaseJob, ProductConfig, LaminationType } from '@/config/productTypes';

/**
 * Simplified job properties for batch creation
 */
export interface BatchJobInfo {
  id: string;
  name: string;
  pdf_url: string;
  file_name?: string;
  quantity: number;
  double_sided?: boolean;
}

/**
 * Required information for PDF generation
 */
export interface PdfPageInfo {
  jobId: string;
  fileName: string;
  pdfUrl: string;
  pages: number;
}

/**
 * Configuration object for batch creation
 * Extends ProductConfig but makes slaTargetDays required
 */
export interface BatchCreationConfig extends Omit<ProductConfig, 'slaTargetDays'> {
  dueDate?: string;
  userId: string;
  laminationType?: LaminationType;
  paperType?: string;
  paperWeight?: string;
  printerType?: string;
  sheetSize?: string;
  slaTargetDays: number; // Made required to match ProductConfig
}

/**
 * Result of batch creation process
 */
export interface BatchCreationResult {
  success: boolean;
  batchId?: string;
  batchName?: string;
  jobCount?: number;
  message?: string;
  error?: Error | string;
}

/**
 * Batch item with job and status information
 */
export interface BatchItem {
  job: BaseJob;
  status: 'queued' | 'processing' | 'placed' | 'error';
  error?: string;
}
