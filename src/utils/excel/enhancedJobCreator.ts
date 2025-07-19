import { ParsedJob } from "@/types";

// Function to safely extract a number from mixed types
const safeNumber = (value: any): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && !isNaN(Number(value))) return Number(value);
  return undefined;
};

// Function to extract paper specifications safely
const extractPaperSpecs = (job: ParsedJob, stageContext?: string) => {
    if (!stageContext || !job.paper_specifications?.[stageContext]) return undefined;
    const specs = job.paper_specifications[stageContext];
    if (typeof specs === 'object' && 'qty' in specs) {
        return {
            qty: safeNumber(specs.qty),
            paper: specs.paper as string | undefined,
            size: specs.size as string | undefined,
            notes: specs.notes as string | undefined,
        };
    }
    return undefined;
};

export const extractQuantityFromJobSpecs = (job: ParsedJob, stageContext?: string): number => {
  // Original logic for extracting quantities
  if (stageContext && job.paper_specifications?.[stageContext]) {
    const specs = job.paper_specifications[stageContext];
    if (typeof specs === 'object' && 'qty' in specs) {
      return specs.qty;
    }
  }

  // Check group specifications
  if (job.group_specifications) {
    const groupSpecs = Object.values(job.group_specifications);
    if (groupSpecs.length > 0) {
      const firstGroup = groupSpecs[0];
      if (typeof firstGroup === 'object' && 'qty' in firstGroup) {
        return firstGroup.qty;
      }
    }
  }

  // Fallback to main job quantity
  return job.qty || 1;
};

export const EnhancedJobCreator = (job: ParsedJob): any => {
  const customer = job.customer || 'Unknown Customer';
  const jobName = job.job_name || 'Unnamed Job';
  const qty = job.qty || 1;
  const wo_number = job.wo_number || 'No WO Number';
  const notes = job.notes || 'No Notes';
  const category = job.category || 'Uncategorized';
  const dueDate = job.due_date || new Date();
  const paperSpecsCover = extractPaperSpecs(job, 'Cover');
  const paperSpecsText = extractPaperSpecs(job, 'Text');

  return {
    customer,
    jobName,
    qty,
    wo_number,
    notes,
    category,
    dueDate,
    paperSpecsCover,
    paperSpecsText,
    coverTextDetails: job.cover_text_detection,
    groupSpecs: job.group_specifications,
    paper_specifications: job.paper_specifications,
  };
};
