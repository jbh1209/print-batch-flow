
import { z } from "zod";
import { ProductConfig } from "@/config/productTypes";

export const createJobFormSchema = (config: ProductConfig) => {
  // Start with the base fields that every job form needs
  const baseSchema = {
    name: z.string().min(1, "Job name is required"),
    job_number: z.string().min(1, "Job number is required"),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    due_date: z.date({
      required_error: "Due date is required",
    }),
    file: z.any().optional(),
  };

  // Add optional fields based on the product config
  if (config.hasSize && config.availableSizes) {
    baseSchema['size'] = z.string().min(1, "Size is required");
  }
  
  if (config.hasPaperType && config.availablePaperTypes) {
    baseSchema['paper_type'] = z.string().min(1, "Paper type is required");
  }
  
  if (config.hasPaperWeight && config.availablePaperWeights) {
    baseSchema['paper_weight'] = z.string().min(1, "Paper weight is required");
  }

  if (config.hasSides && config.availableSidesTypes) {
    baseSchema['sides'] = z.string().min(1, "Sides is required");
  }
  
  // Add product-specific fields
  if (config.productType === "Sleeves") {
    baseSchema['stock_type'] = z.string().min(1, "Stock type is required");
    baseSchema['single_sided'] = z.boolean().default(true);
  }
  
  return z.object(baseSchema);
};

// The general type for all job form values
export interface GenericJobFormValues {
  name: string;
  job_number: string;
  quantity: number;
  due_date: Date;
  file?: File; // Note this is optional for edit mode
  size?: string;
  paper_type?: string;
  paper_weight?: string;
  sides?: string;
  [key: string]: any; // For other product-specific fields
}

// Function to get default form values based on product config
export const getDefaultFormValues = (config: ProductConfig): GenericJobFormValues => {
  const defaultValues: GenericJobFormValues = {
    name: "",
    job_number: "",
    quantity: 0,
    due_date: new Date(),
  };
  
  if (config.hasSize && config.availableSizes && config.availableSizes.length > 0) {
    defaultValues.size = config.availableSizes[0];
  }
  
  if (config.hasPaperType && config.availablePaperTypes && config.availablePaperTypes.length > 0) {
    defaultValues.paper_type = config.availablePaperTypes[0];
  }
  
  if (config.hasPaperWeight && config.availablePaperWeights && config.availablePaperWeights.length > 0) {
    defaultValues.paper_weight = config.availablePaperWeights[0];
  }

  if (config.hasSides && config.availableSidesTypes && config.availableSidesTypes.length > 0) {
    defaultValues.sides = config.availableSidesTypes[0];
  }
  
  // Add product-specific default values
  if (config.productType === "Sleeves") {
    defaultValues['stock_type'] = "White";
    defaultValues['single_sided'] = true;
  }
  
  return defaultValues;
};
