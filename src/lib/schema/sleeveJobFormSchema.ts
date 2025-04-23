
import * as z from "zod";

export const sleeveJobFormSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  job_number: z.string().min(1, "Job number is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  stock_type: z.enum(["White", "Kraft"]),
  single_sided: z.boolean().default(true),
  due_date: z.date({
    required_error: "Due date is required",
  }),
  file: z.instanceof(File, { message: "PDF file is required" })
});

export type SleeveJobFormValues = z.infer<typeof sleeveJobFormSchema>;
