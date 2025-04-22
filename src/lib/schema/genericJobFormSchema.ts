
import { z } from "zod";
import { ProductConfig } from "@/config/productTypes";

// Create a generic job form schema based on product configuration
export const createJobFormSchema = (config: ProductConfig) => {
  // Start with common fields that all jobs have
  const baseSchema = {
    name: z.string().min(1, "Client name is required"),
    job_number: z.string().min(1, "Job number is required"),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    due_date: z.date(),
    file: z.instanceof(File, { message: "PDF file is required" }).optional()
  };

  // Add optional fields based on product configuration
  let schemaFields: any = { ...baseSchema };

  // Add size field if product has size options
  if (config.hasSize) {
    schemaFields.size = z.enum(config.availableSizes as [string, ...string[]]);
  }

  // Add paper type field if product has paper type options
  if (config.hasPaperType) {
    schemaFields.paper_type = z.enum(config.availablePaperTypes as [string, ...string[]]);
  }

  // Add paper weight field if product has paper weight options
  if (config.hasPaperWeight) {
    schemaFields.paper_weight = z.string().min(1, "Paper weight is required");
  }

  // Return the complete schema
  return z.object(schemaFields);
};

// Helper function to get default values for a product type
export const getDefaultFormValues = (config: ProductConfig) => {
  const defaultValues: any = {
    name: "",
    job_number: "",
    quantity: 0,
    due_date: new Date()
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

  return defaultValues;
};

// Type for the form values
export type GenericJobFormValues = {
  name: string;
  job_number: string;
  quantity: number;
  due_date: Date;
  file?: File;
  size?: string;
  paper_type?: string;
  paper_weight?: string;
};

// Helper function to convert form values to database format
export const formValuesToDbFormat = (values: GenericJobFormValues, userId: string): any => {
  return {
    name: values.name,
    job_number: values.job_number,
    quantity: values.quantity,
    due_date: values.due_date.toISOString(),
    size: values.size,
    paper_type: values.paper_type,
    paper_weight: values.paper_weight,
    user_id: userId,
    status: 'queued' as const
  };
};
