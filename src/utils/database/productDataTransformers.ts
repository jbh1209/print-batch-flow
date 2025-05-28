
import { GenericJobFormValues } from "@/lib/schema/genericJobFormSchema";
import { SleeveJobFormValues } from "@/lib/schema/sleeveJobFormSchema";
import { ProductConfig } from "@/config/productTypes";

// Base job data that all products need
interface BaseJobData {
  name: string;
  job_number: string;
  quantity: number;
  due_date: string;
  pdf_url: string;
  file_name: string;
  user_id: string;
  status: string;
}

// Product-specific transformers that know exactly what fields each table expects
export const productDataTransformers = {
  postcard_jobs: (data: GenericJobFormValues, baseData: BaseJobData) => ({
    ...baseData,
    size: data.size,
    paper_type: data.paper_type,
    paper_weight: data.paper_weight,
    lamination_type: data.lamination_type || 'none',
    sides: data.sides || 'single'
  }),

  poster_jobs: (data: GenericJobFormValues, baseData: BaseJobData) => ({
    ...baseData,
    size: data.size,
    paper_type: data.paper_type,
    paper_weight: data.paper_weight,
    lamination_type: data.lamination_type || 'none',
    sides: data.sides || 'single'
  }),

  cover_jobs: (data: GenericJobFormValues, baseData: BaseJobData) => ({
    ...baseData,
    paper_type: data.paper_type,
    paper_weight: data.paper_weight,
    lamination_type: data.lamination_type || 'none',
    sides: data.sides || 'single',
    uv_varnish: data.uv_varnish || 'none'
  }),

  sticker_jobs: (data: GenericJobFormValues, baseData: BaseJobData) => ({
    ...baseData,
    paper_type: data.paper_type,
    lamination_type: data.lamination_type || 'none'
  }),

  box_jobs: (data: GenericJobFormValues, baseData: BaseJobData) => ({
    ...baseData,
    paper_type: data.paper_type,
    lamination_type: data.lamination_type || 'none'
  }),

  sleeve_jobs: (data: SleeveJobFormValues, baseData: BaseJobData) => ({
    ...baseData,
    stock_type: data.stock_type,
    single_sided: data.single_sided
  }),

  flyer_jobs: (data: GenericJobFormValues, baseData: BaseJobData) => ({
    ...baseData,
    size: data.size,
    paper_type: data.paper_type,
    paper_weight: data.paper_weight
  })
};

export const transformJobDataForTable = (
  tableName: string,
  formData: GenericJobFormValues | SleeveJobFormValues,
  baseData: BaseJobData
) => {
  const transformer = productDataTransformers[tableName as keyof typeof productDataTransformers];
  
  if (!transformer) {
    console.error(`No transformer found for table: ${tableName}`);
    return baseData;
  }
  
  try {
    return transformer(formData as any, baseData);
  } catch (error) {
    console.error(`Error transforming data for ${tableName}:`, error);
    return baseData;
  }
};
