// Import and re-export the BatchStatus type from the shared location
import { BatchStatus, LaminationType } from "./BatchTypes";

export type FlyerSize = "A5" | "A4" | "DL" | "A3";
export type PaperType = "Matt" | "Gloss";

export interface FlyerBatch {
  id: string;
  name: string;
  status: BatchStatus; // Using the shared BatchStatus type
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null;
  due_date: string;
  created_at: string;
  lamination_type: LaminationType;
}
