
import { BaseJob, ProductConfig, LaminationType, ExistingTableName } from "@/config/productTypes";
import { isAfter } from "date-fns";

export const calculateSheetsRequired = (selectedJobs: BaseJob[]): number => {
  return selectedJobs.reduce((total, job) => {
    const jobSheets = Math.ceil(job.quantity / 4); // Assuming 4 per sheet
    return total + jobSheets;
  }, 0);
};

export const findEarliestDueDate = (selectedJobs: BaseJob[]): Date => {
  let earliestDueDate = new Date();
  let earliestDueDateFound = false;
  
  selectedJobs.forEach(job => {
    const dueDate = new Date(job.due_date);
    
    if (!earliestDueDateFound || isAfter(earliestDueDate, dueDate)) {
      earliestDueDate = dueDate;
      earliestDueDateFound = true;
    }
  });
  
  return earliestDueDate;
};

export const extractCommonJobProperties = (
  firstJob: BaseJob, 
  config: ProductConfig
): {
  paperType: string,
  paperWeight: string,
  sides: string
} => {
  return {
    paperType: firstJob.paper_type || config.availablePaperTypes?.[0] || "Paper",
    paperWeight: firstJob.paper_weight || "standard",
    sides: firstJob.sides || "single" // Default to single if not specified
  };
};

export const createBatchDataObject = (
  batchName: string,
  sheetsRequired: number,
  dueDate: Date,
  laminationType: LaminationType,
  paperType: string,
  userId: string,
  slaTarget: number
) => {
  return {
    name: batchName,
    sheets_required: sheetsRequired,
    due_date: dueDate.toISOString(),
    lamination_type: laminationType,
    paper_type: paperType,
    status: "pending" as "pending" | "processing" | "completed" | "cancelled" | "sent_to_print",
    created_by: userId,
    sla_target_days: slaTarget
  };
};
