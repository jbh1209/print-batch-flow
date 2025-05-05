
import { z } from "zod";
import { ProductConfig } from "@/config/productTypes";

// Common fields for all job types
const baseFields = {
  name: z.string().min(1, "Name is required"),
  quantity: z.coerce.number().int().positive("Quantity must be a positive number"),
  due_date: z.coerce.date({
    required_error: "Due date is required",
    invalid_type_error: "Invalid date format",
  }).min(new Date(), "Due date must be in the future"),
  file: z
    .instanceof(File, { message: "PDF file is required" })
    .refine((file) => file.type === "application/pdf", "Only PDF files are accepted")
    .optional(),
};

// Create schema based on product configuration
export function createJobFormSchema(config: ProductConfig) {
  let schemaFields = { ...baseFields };

  // Add paper type field if required
  if (config.hasPaperType) {
    schemaFields = {
      ...schemaFields,
      paper_type: z.string({ required_error: "Paper type is required" }),
    };
  }

  // Add paper weight field if required
  if (config.hasPaperWeight) {
    schemaFields = {
      ...schemaFields,
      paper_weight: z.string({ required_error: "Paper weight is required" }),
    };
  }

  // Add size field if required
  if (config.hasSize) {
    schemaFields = {
      ...schemaFields,
      size: z.string({ required_error: "Size is required" }),
    };
  }

  // Add sides field if required
  if (config.hasSides) {
    schemaFields = {
      ...schemaFields,
      sides: z.string({ required_error: "Sides option is required" }),
    };
  }

  // Add UV varnish field if required
  if (config.hasUVVarnish) {
    schemaFields = {
      ...schemaFields,
      uv_varnish: z.string({ required_error: "UV varnish option is required" }),
    };
  }

  // Add lamination field if required
  if (config.hasLamination) {
    schemaFields = {
      ...schemaFields,
      lamination_type: z.string({ required_error: "Lamination type is required" }),
    };
  }

  return z.object(schemaFields);
}

// Default values based on product configuration
export function getDefaultFormValues(config: ProductConfig): GenericJobFormValues {
  const defaults: Partial<GenericJobFormValues> = {
    name: "",
    quantity: 100,
    due_date: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // Default: 7 days from now
  };

  // Add paper type default if required
  if (config.hasPaperType && config.availablePaperTypes && config.availablePaperTypes.length > 0) {
    defaults.paper_type = config.availablePaperTypes[0];
  }

  // Add paper weight default if required
  if (config.hasPaperWeight && config.availablePaperWeights && config.availablePaperWeights.length > 0) {
    defaults.paper_weight = config.availablePaperWeights[0];
  }

  // Add size default if required
  if (config.hasSize && config.availableSizes && config.availableSizes.length > 0) {
    defaults.size = config.availableSizes[0];
  }

  // Add sides default if required
  if (config.hasSides) {
    defaults.sides = "single";
  }

  // Add UV varnish default if required
  if (config.hasUVVarnish) {
    defaults.uv_varnish = "none";
  }

  // Add lamination default if required
  if (config.hasLamination && config.availableLaminationTypes && config.availableLaminationTypes.length > 0) {
    defaults.lamination_type = config.availableLaminationTypes[0];
  }

  return defaults as GenericJobFormValues;
}

export interface GenericJobFormValues {
  name: string;
  quantity: number;
  due_date: Date;
  paper_type?: string;
  paper_weight?: string;
  size?: string;
  sides?: string;
  uv_varnish?: string;
  lamination_type?: string;
  file?: File;
  job_number?: string;
}
