
import * as z from "zod";

// Base schema for flyer jobs - now fully flexible for dynamic specifications
export const flyerJobBaseSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  job_number: z.string().min(1, "Job number is required"),
  size: z.string().min(1, "Size is required"),
  paper_weight: z.string().min(1, "Paper weight is required"),
  paper_type: z.string().min(1, "Paper type is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  due_date: z.date(),
});

// Schema for creating new flyer jobs (file required)
export const flyerJobCreateSchema = flyerJobBaseSchema.extend({
  file: z.instanceof(File, { message: "PDF file is required" })
});

// Schema for editing flyer jobs (file optional)
export const flyerJobEditSchema = flyerJobBaseSchema.extend({
  file: z.instanceof(File).optional()
});

export type FlyerJobFormValues = z.infer<typeof flyerJobBaseSchema> & {
  file?: File;
};

// Database interface that matches the actual table structure
export interface FlyerJobData {
  name: string;
  job_number: string;
  size: string;
  paper_weight: string;
  paper_type: string;
  quantity: number;
  due_date: string;
  pdf_url: string;
  file_name: string;
  user_id: string;
  status: string;
}

// Legacy types for backward compatibility - these will be deprecated
export type FlyerSize = string;
export type PaperType = string;

// Legacy options - these are now deprecated in favor of dynamic specifications
export const flyerPaperWeightOptions = ["115gsm", "130gsm", "170gsm", "200gsm", "250gsm", "300gsm", "350gsm"];
export const flyerSizeOptions = ["A6", "A5", "A4", "DL", "A3"];
export const flyerPaperTypeOptions = ["Matt", "Gloss"];
