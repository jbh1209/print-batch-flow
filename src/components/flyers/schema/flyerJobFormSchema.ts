
import * as z from "zod";
import { FlyerSize, PaperType } from "@/components/batches/types/FlyerTypes";

// Schema that matches ONLY the flyer_jobs table columns (NO SIDES field)
export const flyerJobFormSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  job_number: z.string().min(1, "Job number is required"),
  size: z.enum(["A5", "A4", "DL", "A3"]),
  paper_weight: z.string().min(1, "Paper weight is required"),
  paper_type: z.enum(["Matt", "Gloss"]),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  due_date: z.date(),
  file: z.instanceof(File).optional()
});

// Create a separate schema for creating new jobs where file is required
export const flyerJobFormSchemaCreate = flyerJobFormSchema.extend({
  file: z.instanceof(File, { message: "PDF file is required" })
});

export type FlyerJobFormValues = z.infer<typeof flyerJobFormSchema>;

export const paperWeightOptions = ["115gsm", "130gsm", "170gsm", "200gsm", "250gsm"];
export const sizeOptions: FlyerSize[] = ["A5", "A4", "DL", "A3"];
export const paperTypeOptions: PaperType[] = ["Matt", "Gloss"];
