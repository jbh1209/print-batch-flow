
import { BaseBatch, BatchStatus } from "@/config/types/baseTypes";

export interface BatchSummary extends BaseBatch {
  product_type: string;
  overview_pdf_url: string | null;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  created_at: string;
}

export interface BatchDetailsType extends BaseBatch {
  // Additional properties specific to batch details
}

export interface Job {
  id: string;
  name: string;
  quantity: number;
  status: string;
  pdf_url: string | null;
}
