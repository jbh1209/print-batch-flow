
import { BaseJob, JobStatus, LaminationType } from "@/config/types/baseTypes";

export interface BusinessCardJob extends BaseJob {
  double_sided: boolean;
  uploaded_at: string;
  paper_type: string;
}

export interface BusinessCardBatch {
  id: string;
  name: string;
  status: string;
  sheets_required: number;
  lamination_type: LaminationType;
  created_at: string;
  due_date: string;
  created_by: string;
  front_pdf_url?: string | null;
  back_pdf_url?: string | null;
  overview_pdf_url?: string | null;
  paper_type?: string;
  paper_weight?: string;
  sheet_size?: string;
  printer_type?: string;
}
