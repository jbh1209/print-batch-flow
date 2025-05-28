
import * as z from "zod";

// Flyer-specific types that match the database exactly
export type FlyerSize = "A5" | "A4" | "DL" | "A3";
export type FlyerPaperType = "Matt" | "Gloss";

// Base schema for flyer jobs - matches flyer_jobs table exactly (NO SIDES FIELD)
export const flyerJobBaseSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  job_number: z.string().min(1, "Job number is required"),
  size: z.enum(["A5", "A4", "DL", "A3"]),
  paper_weight: z.string().min(1, "Paper weight is required"),
  paper_type: z.enum(["Matt", "Gloss"]),
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

// Form options that match database constraints
export const flyerPaperWeightOptions = ["115gsm", "130gsm", "170gsm", "200gsm", "250gsm"];
export const flyerSizeOptions: FlyerSize[] = ["A5", "A4", "DL", "A3"];
export const flyerPaperTypeOptions: FlyerPaperType[] = ["Matt", "Gloss"];
