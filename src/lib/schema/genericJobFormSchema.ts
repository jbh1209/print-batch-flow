
import { z } from "zod";
import { ProductConfig } from "@/config/productTypes";

// Base schema without optional fields
const baseSchema = z.object({
  name: z.string().min(3, {
    message: "Name must be at least 3 characters.",
  }),
  job_number: z.string().optional(),
  quantity: z.number().min(1, {
    message: "Quantity must be at least 1.",
  }),
  due_date: z.date({
    required_error: "Due date is required.",
  }),
  file: z
    .instanceof(File, { message: "PDF file is required" })
    .optional(),
});

export const createGenericJobFormSchema = (config: ProductConfig) => {
  let schema = baseSchema;

  // Add optional fields based on product config
  if (config.hasPaperType) {
    schema = schema.extend({
      paper_type: z.string({
        required_error: "Paper type is required.",
      }),
    });
  }

  if (config.hasPaperWeight) {
    schema = schema.extend({
      paper_weight: z.string({
        required_error: "Paper weight is required.",
      }),
    });
  }

  if (config.hasSize) {
    schema = schema.extend({
      size: z.string({
        required_error: "Size is required.",
      }),
    });
  }

  if (config.hasSides) {
    schema = schema.extend({
      sides: z.string({
        required_error: "Sides is required.",
      }),
    });
  }

  if (config.hasUVVarnish) {
    schema = schema.extend({
      uv_varnish: z.string({
        required_error: "UV varnish is required.",
      }),
    });
  }

  if (config.hasLamination) {
    schema = schema.extend({
      lamination_type: z.string({
        required_error: "Lamination is required.",
      }),
    });
  }

  return schema;
};

export type GenericJobFormValues = z.infer<ReturnType<typeof createGenericJobFormSchema>> & {
  job_number?: string;
};

// For validation function
export const validateGenericJobForm = (config: ProductConfig, data: any) => {
  const schema = createGenericJobFormSchema(config);

  try {
    // For file uploads, only validate if creating a new job
    const fileValidation = !data.id;
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const formattedErrors: Record<string, string> = {};
      
      result.error.issues.forEach((issue) => {
        formattedErrors[issue.path[0]] = issue.message;
      });
      
      return { success: false, errors: formattedErrors };
    }
    
    // Additional validation for new jobs
    if (fileValidation && !data.file) {
      return { success: false, errors: { file: "PDF file is required" } };
    }

    // Special validation for sleeves
    if (config.productType === "Sleeves") {
      if (!data.stock_type) {
        return { success: false, errors: { stock_type: "Stock type is required" } };
      }
    }
    
    return { success: true, errors: {} };
  } catch (error) {
    console.error("Form validation error:", error);
    return { success: false, errors: { _form: "Form validation failed" } };
  }
};
