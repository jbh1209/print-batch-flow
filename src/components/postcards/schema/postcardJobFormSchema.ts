
import * as z from "zod";

export const postCardJobFormSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  job_number: z.string().min(1, "Job number is required"),
  size: z.literal("A6"),
  paper_type: z.enum(["350gsm Matt", "350gsm Gloss"]),
  sides: z.enum(["single", "double"]),
  lamination_type: z.enum(["gloss", "matt", "none"]),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  due_date: z.date(),
  file: z.instanceof(File, { message: "PDF file is required" }).optional()
});

export type PostcardJobFormValues = z.infer<typeof postCardJobFormSchema>;

export const paperTypeOptions = ["350gsm Matt", "350gsm Gloss"];
export const sideOptions = ["single", "double"];
export const laminationOptions = ["gloss", "matt", "none"];
export const laminationLabels = {
  "gloss": "Front Gloss Laminate",
  "matt": "Front Matt Laminate",
  "none": "None",
};
