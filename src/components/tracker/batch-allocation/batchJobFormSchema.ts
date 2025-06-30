
import { z } from 'zod';

export const batchJobFormSchema = z.object({
  jobNumber: z.string().min(1, 'Job number is required'),
  clientName: z.string().min(1, 'Client name is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  dueDate: z.string(),
  // Specification fields - these will be dynamically populated based on category
  size: z.string().optional(),
  paper_type: z.string().optional(),
  paper_weight: z.string().optional(),
  lamination_type: z.string().optional(),
  sides: z.string().optional(),
  uv_varnish: z.string().optional(),
  single_sided: z.boolean().optional(),
  double_sided: z.boolean().optional(),
  stock_type: z.string().optional(),
});

export type BatchJobFormData = z.infer<typeof batchJobFormSchema>;
