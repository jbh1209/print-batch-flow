
import * as z from "zod";
import { ProductConfig } from "@/config/productTypes";
import { sleeveJobFormSchema } from "./sleeveJobFormSchema";

// Base job form fields
export const baseJobFormSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  job_number: z.string().min(1, "Job number is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  due_date: z.date({
    required_error: "Due date is required",
  }),
  file: z.instanceof(File, { message: "PDF file is required" })
});

// Create job form schema based on product configuration
export const createJobFormSchema = (config: ProductConfig) => {
  // Start with base schema
  let schema = baseJobFormSchema;
  
  // Special handling for sleeve jobs
  if (config.productType === "Sleeves") {
    // Return the sleeve-specific schema directly
    return sleeveJobFormSchema;
  }
  
  // For other product types, add conditional fields
  if (config.hasSize && config.availableSizes) {
    schema = schema.extend({
      size: z.enum([...config.availableSizes] as [string, ...string[]])
    });
  }
  
  if (config.hasPaperType && config.availablePaperTypes) {
    schema = schema.extend({
      paper_type: z.enum([...config.availablePaperTypes] as [string, ...string[]])
    });
  }
  
  if (config.hasPaperWeight && config.availablePaperWeights) {
    schema = schema.extend({
      paper_weight: z.enum([...config.availablePaperWeights] as [string, ...string[]])
    });
  }
  
  return schema;
};

// Get default values based on product configuration
export const getDefaultFormValues = (config: ProductConfig) => {
  const baseValues = {
    name: "",
    job_number: "",
    quantity: 1,
    due_date: new Date(),
  };
  
  if (config.productType === "Sleeves") {
    return {
      ...baseValues,
      stock_type: "White" as const,
      single_sided: true
    };
  }
  
  if (config.hasSize && config.availableSizes && config.availableSizes.length > 0) {
    baseValues["size"] = config.availableSizes[0];
  }
  
  if (config.hasPaperType && config.availablePaperTypes && config.availablePaperTypes.length > 0) {
    baseValues["paper_type"] = config.availablePaperTypes[0];
  }
  
  if (config.hasPaperWeight && config.availablePaperWeights && config.availablePaperWeights.length > 0) {
    baseValues["paper_weight"] = config.availablePaperWeights[0];
  }
  
  return baseValues;
};

export type GenericJobFormValues = z.infer<ReturnType<typeof createJobFormSchema>>;
