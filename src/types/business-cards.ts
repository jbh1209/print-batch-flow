
export interface BusinessCardJob {
  id: string;
  name: string;
  job_number: string;
  quantity: number;
  double_sided: boolean;
  lamination_type: string;
  paper_type: string;
  due_date: string;
  created_at: string;
  status: string;
  file_name?: string;
  pdf_url?: string;
  batch_id?: string | null;
}
