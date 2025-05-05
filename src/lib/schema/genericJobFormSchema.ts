
import { z } from "zod";
import { ProductConfig } from "@/config/productTypes";

// Basic validation
const MAX_FILE_SIZE = 10000000; // 10MB
const ACCEPTED_FILE_TYPES = ["application/pdf"];

// Create the form schema based on product configuration
export const createJobFormSchema = (config: ProductConfig) => {
  // Start with the base schema
  let baseSchema = {
    name: z.string().min(1, "Job name is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    due_date: z.date(),
    file: z.instanceof(File)
      .refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
      .refine(
        (file) => ACCEPTED_FILE_TYPES.includes(file.type),
        "Only PDF files are accepted."
      ).optional()
  };

  // Add conditional fields based on product config
  let schemaObj: any = { ...baseSchema };

  // Add paper type if applicable
  if (config.hasPaperType) {
    schemaObj.paper_type = z.string().min(1, "Paper type is required");
  }

  // Add paper weight if applicable
  if (config.hasPaperWeight) {
    schemaObj.paper_weight = z.string().min(1, "Paper weight is required");
  }

  // Add size if applicable
  if (config.hasSize) {
    schemaObj.size = z.string().min(1, "Size is required");
  }

  // Add lamination type
  if (config.hasLamination) {
    schemaObj.lamination_type = z.string();
  }

  // Add sides if applicable
  if (config.hasSides) {
    schemaObj.sides = z.string();
  }

  // Add UV varnish if applicable
  if (config.hasUVVarnish) {
    schemaObj.uv_varnish = z.string();
  }

  return z.object(schemaObj);
};

// Get default form values based on product configuration
export const getDefaultFormValues = (config: ProductConfig) => {
  const today = new Date();
  const defaultDueDate = new Date();
  defaultDueDate.setDate(today.getDate() + (config.slaTargetDays || 3));

  // Start with base default values
  const defaults: any = {
    name: "",
    quantity: 100,
    due_date: defaultDueDate
  };

  // Add conditional defaults based on product config
  if (config.hasPaperType && config.availablePaperTypes && config.availablePaperTypes.length > 0) {
    defaults.paper_type = config.availablePaperTypes[0];
  }

  if (config.hasPaperWeight && config.availablePaperWeights && config.availablePaperWeights.length > 0) {
    defaults.paper_weight = config.availablePaperWeights[0];
  }

  if (config.hasSize && config.availableSizes && config.availableSizes.length > 0) {
    defaults.size = config.availableSizes[0];
  }

  if (config.hasLamination) {
    defaults.lamination_type = "none";
  }

  if (config.hasSides && config.availableSidesTypes && config.availableSidesTypes.length > 0) {
    defaults.sides = config.availableSidesTypes[0];
  }

  if (config.hasUVVarnish && config.availableUVVarnishTypes && config.availableUVVarnishTypes.length > 0) {
    defaults.uv_varnish = config.availableUVVarnishTypes[0];
  }

  return defaults;
};

// Define the generic form values type
export type GenericJobFormValues = {
  name: string;
  quantity: number;
  due_date: Date;
  file?: File;
  paper_type?: string;
  paper_weight?: string;
  size?: string;
  lamination_type?: string;
  sides?: string;
  uv_varnish?: string;
};
