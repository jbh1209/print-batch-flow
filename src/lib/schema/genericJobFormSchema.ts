
import * as z from "zod";
import { ProductConfig } from "@/config/productTypes";

export const createJobFormSchema = (config: ProductConfig) => {
  // Base schema for all job types
  const baseSchema = {
    name: z.string().min(1, "Client name is required"),
    job_number: z.string().min(1, "Job number is required"),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
    due_date: z.date({
      required_error: "Due date is required",
    }),
  };

  // Additional schema properties based on product type
  const additionalSchema: Record<string, any> = {};

  // Add paper_type if available for this product
  if (config.availablePaperTypes && config.availablePaperTypes.length > 0) {
    additionalSchema.paper_type = z.string().min(1, "Paper type is required");
  }

  // Add lamination_type if available for this product
  if (config.availableLaminationTypes && config.availableLaminationTypes.length > 0) {
    additionalSchema.lamination_type = z.enum(['none', 'matt', 'gloss', 'soft_touch'], {
      required_error: "Lamination type is required",
    }).default('none');
  }

  // Add file validation (required for new jobs, optional for edits)
  additionalSchema.file = z.instanceof(File, { message: "PDF file is required" }).optional();

  // Return the combined schema
  return z.object({
    ...baseSchema,
    ...additionalSchema
  });
};

export const getDefaultFormValues = (config: ProductConfig) => {
  // Base default values for all job types
  const baseDefaults: Record<string, any> = {
    name: "",
    job_number: `${config.jobNumberPrefix || 'JOB'}-${Date.now().toString().slice(-8)}`,
    quantity: 100,
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
  };

  // Add default paper_type if available
  if (config.availablePaperTypes && config.availablePaperTypes.length > 0) {
    baseDefaults.paper_type = config.availablePaperTypes[0];
  }

  // Add default lamination_type if available
  if (config.availableLaminationTypes && config.availableLaminationTypes.length > 0) {
    baseDefaults.lamination_type = 'none';
  }

  return baseDefaults;
};

export type GenericJobFormValues = {
  name: string;
  job_number: string;
  quantity: number;
  due_date: Date;
  paper_type?: string;
  lamination_type?: 'none' | 'matt' | 'gloss' | 'soft_touch';
  file?: File;
  size?: string;
  paper_weight?: string;
};
