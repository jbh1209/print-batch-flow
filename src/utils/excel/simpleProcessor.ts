import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { generateQRCodeData, generateQRCodeImage } from "@/utils/qrCodeGenerator";
import type { ExcelImportDebugger } from './debugger';

export interface SimpleJobData {
  wo_no: string;
  customer: string;
  reference?: string;
  qty: number;
  due_date?: string;
  status: string;
  category?: string;
  rep?: string;
  date?: string;
  location?: string;
  specifications?: string;
  user_id: string;
  qr_code_data?: string;
  qr_code_url?: string;
}

export interface ProcessingResult {
  successful: number;
  failed: number;
  errors: string[];
  jobsCreated: string[];
}

export interface ExcelJobPreview {
  headers: string[];
  sampleRows: any[][];
  totalRows: number;
  detectedColumns: {
    wo_no?: number;
    customer?: number;
    reference?: number;
    qty?: number;
    due_date?: number;
    status?: number;
    category?: number;
  };
}

const safeGetCellValue = (row: any[], index: number): any => {
  if (index === -1 || !row || index >= row.length) return '';
  const value = row[index];
  return value === null || value === undefined ? '' : value;
};

const findColumnIndex = (headers: string[], possibleNames: string[]): number => {
  for (const name of possibleNames) {
    const index = headers.findIndex(header => 
      header && header.toLowerCase().trim().includes(name.toLowerCase())
    );
    if (index !== -1) return index;
  }
  return -1;
};

const formatWONumber = (value: any): string => {
  if (!value) return '';
  return String(value).trim().toUpperCase();
};

const parseQuantity = (value: any): number => {
  if (!value) return 0;
  const parsed = parseInt(String(value).replace(/[^0-9]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

const formatDate = (value: any): string | undefined => {
  if (!value) return undefined;
  
  try {
    // Handle Excel date numbers
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // Handle string dates
    const str = String(value).trim();
    if (!str) return undefined;
    
    // Try parsing as date
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return undefined;
  } catch {
    return undefined;
  }
};

export const parseExcelToJobs = async (
  file: File, 
  logger: ExcelImportDebugger
): Promise<ExcelJobPreview> => {
  logger.addDebugInfo(`📊 Parsing Excel file: ${file.name}`);
  
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  
  if (jsonData.length < 2) {
    throw new Error("Excel file appears to be empty or has no data rows");
  }

  const headers = jsonData[0] as string[];
  const dataRows = jsonData.slice(1) as any[][];
  
  // Auto-detect column mappings
  const detectedColumns = {
    wo_no: findColumnIndex(headers, ['wo', 'work order', 'job number', 'order']),
    customer: findColumnIndex(headers, ['customer', 'client', 'company']),
    reference: findColumnIndex(headers, ['reference', 'ref', 'description', 'desc']),
    qty: findColumnIndex(headers, ['qty', 'quantity', 'amount']),
    due_date: findColumnIndex(headers, ['due', 'due date', 'delivery', 'deadline']),
    status: findColumnIndex(headers, ['status', 'state', 'stage']),
    category: findColumnIndex(headers, ['category', 'type', 'product'])
  };
  
  logger.addDebugInfo(`🔍 Detected columns: ${JSON.stringify(detectedColumns)}`);
  
  return {
    headers,
    sampleRows: dataRows.slice(0, 5), // Show first 5 rows as preview
    totalRows: dataRows.length,
    detectedColumns
  };
};

export const processJobsToDatabase = async (
  file: File,
  userId: string,
  generateQRCodes: boolean,
  logger: ExcelImportDebugger
): Promise<ProcessingResult> => {
  logger.addDebugInfo(`🚀 Starting job processing for user: ${userId}`);
  
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  const headers = jsonData[0] as string[];
  const dataRows = jsonData.slice(1) as any[][];
  
  // Auto-detect columns
  const columnMap = {
    wo_no: findColumnIndex(headers, ['wo', 'work order', 'job number', 'order']),
    customer: findColumnIndex(headers, ['customer', 'client', 'company']),
    reference: findColumnIndex(headers, ['reference', 'ref', 'description', 'desc']),
    qty: findColumnIndex(headers, ['qty', 'quantity', 'amount']),
    due_date: findColumnIndex(headers, ['due', 'due date', 'delivery', 'deadline']),
    status: findColumnIndex(headers, ['status', 'state', 'stage']),
    category: findColumnIndex(headers, ['category', 'type', 'product']),
    rep: findColumnIndex(headers, ['rep', 'representative', 'sales']),
    date: findColumnIndex(headers, ['date', 'created', 'order date']),
    location: findColumnIndex(headers, ['location', 'address', 'site']),
    specifications: findColumnIndex(headers, ['spec', 'specifications', 'notes'])
  };
  
  const result: ProcessingResult = {
    successful: 0,
    failed: 0,
    errors: [],
    jobsCreated: []
  };
  
  // Process each row
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2; // Excel row number
    
    try {
      // Extract required fields
      const woNo = formatWONumber(safeGetCellValue(row, columnMap.wo_no));
      const customer = String(safeGetCellValue(row, columnMap.customer) || "").trim();
      
      if (!woNo) {
        result.errors.push(`Row ${rowNum}: Missing WO Number`);
        result.failed++;
        continue;
      }
      
      if (!customer) {
        result.errors.push(`Row ${rowNum}: Missing Customer for WO ${woNo}`);
        result.failed++;
        continue;
      }
      
      // Build job data
      const jobData: SimpleJobData = {
        wo_no: woNo,
        customer,
        reference: String(safeGetCellValue(row, columnMap.reference) || "").trim() || undefined,
        qty: parseQuantity(safeGetCellValue(row, columnMap.qty)),
        due_date: formatDate(safeGetCellValue(row, columnMap.due_date)),
        status: String(safeGetCellValue(row, columnMap.status) || "Pre-Press").trim(),
        category: String(safeGetCellValue(row, columnMap.category) || "").trim() || undefined,
        rep: String(safeGetCellValue(row, columnMap.rep) || "").trim() || undefined,
        date: formatDate(safeGetCellValue(row, columnMap.date)),
        location: String(safeGetCellValue(row, columnMap.location) || "").trim() || undefined,
        specifications: String(safeGetCellValue(row, columnMap.specifications) || "").trim() || undefined,
        user_id: userId
      };
      
      // Generate QR code if requested
      if (generateQRCodes) {
        try {
          const qrData = generateQRCodeData({
            wo_no: woNo,
            job_id: `temp-${woNo}`,
            customer,
            due_date: jobData.due_date
          });
          
          const qrUrl = await generateQRCodeImage(qrData);
          jobData.qr_code_data = qrData;
          jobData.qr_code_url = qrUrl;
        } catch (qrError) {
          logger.addDebugInfo(`⚠️ QR code generation failed for ${woNo}: ${qrError}`);
        }
      }
      
      // Insert job into database
      const { data: insertedJob, error: insertError } = await supabase
        .from('production_jobs')
        .upsert(jobData, { 
          onConflict: 'wo_no,user_id',
          ignoreDuplicates: false 
        })
        .select('id, wo_no, category_id')
        .single();
      
      if (insertError) {
        result.errors.push(`Row ${rowNum} (${woNo}): Database error - ${insertError.message}`);
        result.failed++;
        continue;
      }
      
      if (!insertedJob) {
        result.errors.push(`Row ${rowNum} (${woNo}): No job created (possible duplicate)`);
        result.failed++;
        continue;
      }
      
      // Update QR code with actual job ID if needed
      if (generateQRCodes && jobData.qr_code_data) {
        try {
          const updatedQrData = generateQRCodeData({
            wo_no: woNo,
            job_id: insertedJob.id,
            customer,
            due_date: jobData.due_date
          });
          
          const updatedQrUrl = await generateQRCodeImage(updatedQrData);
          
          await supabase
            .from('production_jobs')
            .update({
              qr_code_data: updatedQrData,
              qr_code_url: updatedQrUrl
            })
            .eq('id', insertedJob.id);
        } catch (qrUpdateError) {
          logger.addDebugInfo(`⚠️ QR code update failed for ${woNo}: ${qrUpdateError}`);
        }
      }
      
      // Create stage instances if job has a category
      if (insertedJob.category_id) {
        try {
          const { error: stageError } = await supabase.rpc('initialize_job_stages_auto', {
            p_job_id: insertedJob.id,
            p_job_table_name: 'production_jobs',
            p_category_id: insertedJob.category_id
          });
          
          if (stageError) {
            logger.addDebugInfo(`⚠️ Stage creation failed for ${woNo}: ${stageError.message}`);
          } else {
            logger.addDebugInfo(`✅ Stages created for ${woNo}`);
          }
        } catch (stageCreateError) {
          logger.addDebugInfo(`⚠️ Stage creation error for ${woNo}: ${stageCreateError}`);
        }
      }
      
      result.successful++;
      result.jobsCreated.push(woNo);
      logger.addDebugInfo(`✅ Job created: ${woNo} (ID: ${insertedJob.id})`);
      
    } catch (rowError) {
      result.errors.push(`Row ${rowNum}: ${rowError instanceof Error ? rowError.message : String(rowError)}`);
      result.failed++;
      logger.addDebugInfo(`❌ Row ${rowNum} failed: ${rowError}`);
    }
  }
  
  logger.addDebugInfo(`🎯 Processing complete: ${result.successful} successful, ${result.failed} failed`);
  return result;
};