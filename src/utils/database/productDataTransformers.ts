
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

// Type for form data with optional product-specific fields
type ProductFormData = GenericJobFormValues | SleeveJobFormValues | Record<string, any>;

// Product-specific transformers that know exactly what fields each table expects
export const productDataTransformers = {
  postcard_jobs: (data: ProductFormData, baseData: BaseJobData) => ({
    ...baseData,
    size: (data as any).size || 'A6',
    paper_type: (data as any).paper_type || 'Gloss',
    paper_weight: (data as any).paper_weight || '300gsm',
    lamination_type: (data as any).lamination_type || 'none',
    sides: (data as any).sides || 'single'
  }),

  poster_jobs: (data: ProductFormData, baseData: BaseJobData) => ({
    ...baseData,
    size: (data as any).size || 'A4',
    paper_type: (data as any).paper_type || 'Matt',
    paper_weight: (data as any).paper_weight || '170gsm',
    lamination_type: (data as any).lamination_type || 'none',
    sides: (data as any).sides || 'single'
  }),

  cover_jobs: (data: ProductFormData, baseData: BaseJobData) => ({
    ...baseData,
    paper_type: (data as any).paper_type || '250gsm Matt',
    paper_weight: (data as any).paper_weight || '250gsm',
    lamination_type: (data as any).lamination_type || 'none',
    sides: (data as any).sides || 'single',
    uv_varnish: (data as any).uv_varnish || 'none'
  }),

  sticker_jobs: (data: ProductFormData, baseData: BaseJobData) => ({
    ...baseData,
    paper_type: (data as any).paper_type || 'Paper',
    lamination_type: (data as any).lamination_type || 'none'
  }),

  box_jobs: (data: ProductFormData, baseData: BaseJobData) => ({
    ...baseData,
    paper_type: (data as any).paper_type || 'FBB 230gsm',
    lamination_type: (data as any).lamination_type || 'none'
  }),

  sleeve_jobs: (data: ProductFormData, baseData: BaseJobData) => ({
    ...baseData,
    stock_type: (data as any).stock_type || 'Kraft',
    single_sided: (data as any).single_sided || true
  }),

  flyer_jobs: (data: ProductFormData, baseData: BaseJobData) => ({
    ...baseData,
    size: (data as any).size || 'A5',
    paper_type: (data as any).paper_type || 'Matt',
    paper_weight: (data as any).paper_weight || '170gsm'
  })
};

export const transformJobDataForTable = (
  tableName: string,
  formData: ProductFormData,
  baseData: BaseJobData
) => {
  const transformer = productDataTransformers[tableName as keyof typeof productDataTransformers];
  
  if (!transformer) {
    console.error(`No transformer found for table: ${tableName}`);
    return baseData;
  }
  
  try {
    return transformer(formData, baseData);
  } catch (error) {
    console.error(`Error transforming data for ${tableName}:`, error);
    return baseData;
  }
};
