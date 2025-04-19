
import * as z from "zod";
import { PostcardSize, PaperType, LaminationType } from "@/components/batches/types/PostcardTypes";

export const postCardJobFormSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  job_number: z.string().min(1, "Job number is required"),
  size: z.literal("A6"),
  paper_type: z.enum(["350gsm Matt", "350gsm Gloss"]),
  lamination_type: z.enum(["matt", "gloss", "soft_touch", "none"]),
  double_sided: z.boolean().default(true),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  due_date: z.date(),
  file: z.instanceof(File, { message: "PDF file is required" }).optional()
});

export type PostcardJobFormValues = z.infer<typeof postCardJobFormSchema>;

export const paperTypeOptions: PaperType[] = ["350gsm Matt", "350gsm Gloss"];
export const laminationOptions: LaminationType[] = ["matt", "gloss", "soft_touch", "none"];
export const laminationLabels = {
  "matt": "Matt Lamination",
  "gloss": "Gloss Lamination",
  "soft_touch": "Soft Touch Lamination",
  "none": "No Lamination"
};
