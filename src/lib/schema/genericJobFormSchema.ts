
import { z } from "zod";
import { ProductConfig } from "@/config/productTypes";

// Create a base schema with common fields
const baseJobFormSchema = z.object({
  name: z.string({ required_error: "Client name is required" }).min(1, "Client name is required"),
  job_number: z.string({ required_error: "Job number is required" }).min(1, "Job number is required"),
  quantity: z.coerce.number({ required_error: "Quantity is required" }).int().positive("Quantity must be greater than 0"),
  due_date: z.date({ required_error: "Due date is required" }),
  file: z.instanceof(File, { message: "PDF file is required" }).optional(),
});

// Function to create a product-specific schema based on config
export const createJobFormSchema = (config: ProductConfig) => {
  let schema = baseJobFormSchema;

  // Add size field if the product has sizes
  if (config.hasSize) {
    schema = schema.extend({
      size: z.string({ required_error: "Size is required" }),
    });
  }

  // Add paper type field if the product has paper types
  if (config.hasPaperType) {
    schema = schema.extend({
      paper_type: z.string({ required_error: "Paper type is required" }),
    });
  }

  // Add paper weight field if the product has paper weights
  if (config.hasPaperWeight) {
    schema = schema.extend({
      paper_weight: z.string({ required_error: "Paper weight is required" }),
    });
  }

  // Add lamination type field if the product has lamination options
  if (config.hasLamination) {
    schema = schema.extend({
      lamination_type: z.string().default("none"),
    });
  }

  // Add sides field if the product has sides options
  if (config.hasSides) {
    schema = schema.extend({
      sides: z.string({ required_error: "Sides is required" }).default("single"),
    });
  }

  // Add UV varnish field if the product has UV varnish options
  if (config.hasUVVarnish) {
    schema = schema.extend({
      uv_varnish: z.string().default("none"),
    });
  }

  return schema;
};

// Default values function
export const getDefaultFormValues = (config: ProductConfig) => {
  const baseValues = {
    name: "",
    job_number: "",
    quantity: 100,
    due_date: new Date(),
  };

  const productValues: any = {};

  if (config.hasSize && config.availableSizes && config.availableSizes.length > 0) {
    productValues.size = config.availableSizes[0];
  }

  if (config.hasPaperType && config.availablePaperTypes && config.availablePaperTypes.length > 0) {
    productValues.paper_type = config.availablePaperTypes[0];
  }

  if (config.hasPaperWeight && config.availablePaperWeights && config.availablePaperWeights.length > 0) {
    productValues.paper_weight = config.availablePaperWeights[0];
  }

  if (config.hasLamination) {
    productValues.lamination_type = "none";
  }

  if (config.hasSides) {
    productValues.sides = "single";
  }

  if (config.hasUVVarnish) {
    productValues.uv_varnish = "none";
  }

  return { ...baseValues, ...productValues };
};

// Export the type of the form values
export type GenericJobFormValues = z.infer<ReturnType<typeof createJobFormSchema>>;
