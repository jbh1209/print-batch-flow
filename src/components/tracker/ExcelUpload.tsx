import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Check, X, QrCode, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateQRCodeData, generateQRCodeImage } from "@/utils/qrCodeGenerator";

interface ParsedJob {
  wo_no: string;
  status: string;
  date: string;
  rep: string;
  category: string;
  customer: string;
  reference: string;
  qty: number;
  due_date: string;
  location: string;
  note: string;
}

interface JobDataWithQR extends ParsedJob {
  user_id: string;
  qr_code_data?: string;
  qr_code_url?: string;
}

interface ImportStats {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  invalidWONumbers: number;
}

export const ExcelUpload = () => {
  const { user } = useAuth();
  const [parsedJobs, setParsedJobs] = useState<ParsedJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [generateQRCodes, setGenerateQRCodes] = useState(true);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (message: string) => {
    setDebugInfo(prev => [...prev, message]);
    console.log("[Excel Import]", message);
  };

  const formatExcelDate = (excelDate: any): string => {
    if (!excelDate) return "";
    
    addDebugInfo(`Processing date: ${JSON.stringify(excelDate)} (type: ${typeof excelDate})`);
    
    // If it's already a string
    if (typeof excelDate === 'string') {
      const cleaned = excelDate.trim();
      
      // Handle YYYY/MM/DD format
      if (cleaned.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
        const [year, month, day] = cleaned.split('/');
        const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        addDebugInfo(`Formatted date string ${cleaned} to ${formatted}`);
        return formatted;
      }
      
      // Handle other date formats
      const dateAttempt = new Date(cleaned);
      if (!isNaN(dateAttempt.getTime())) {
        const formatted = dateAttempt.toISOString().split('T')[0];
        addDebugInfo(`Parsed date string ${cleaned} to ${formatted}`);
        return formatted;
      }
      
      addDebugInfo(`Could not parse date string: ${cleaned}`);
      return "";
    }
    
    // If it's an Excel serial number
    if (typeof excelDate === 'number') {
      try {
        // Excel dates are days since 1900-01-01 (with leap year bug correction)
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
        const formatted = date.toISOString().split('T')[0];
        addDebugInfo(`Converted Excel serial ${excelDate} to ${formatted}`);
        return formatted;
      } catch (error) {
        addDebugInfo(`Error converting Excel serial ${excelDate}: ${error}`);
        return "";
      }
    }
    
    // If it's already a Date object
    if (excelDate instanceof Date) {
      const formatted = excelDate.toISOString().split('T')[0];
      addDebugInfo(`Converted Date object to ${formatted}`);
      return formatted;
    }
    
    addDebugInfo(`Unknown date format: ${JSON.stringify(excelDate)}`);
    return "";
  };

  const formatWONumber = (woNo: any): string => {
    if (!woNo) return "";
    
    // Convert to string and clean
    const cleaned = String(woNo).trim();
    addDebugInfo(`Processing WO Number: "${woNo}" -> "${cleaned}"`);
    
    // If it's already 6 digits, keep it as is
    if (/^\d{6}$/.test(cleaned)) {
      addDebugInfo(`WO Number already 6 digits: ${cleaned}`);
      return cleaned;
    }
    
    // Extract only numbers
    const numbersOnly = cleaned.replace(/[^0-9]/g, '');
    
    // If we have numbers, pad to 6 digits
    if (numbersOnly) {
      const padded = numbersOnly.padStart(6, '0');
      addDebugInfo(`WO Number "${cleaned}" -> "${numbersOnly}" -> "${padded}"`);
      return padded;
    }
    
    addDebugInfo(`Could not extract valid WO Number from: "${cleaned}"`);
    return "";
  };

  const findColumnIndex = (headers: string[], possibleNames: string[]): number => {
    const headerLower = headers.map(h => String(h || '').toLowerCase().trim());
    
    for (const name of possibleNames) {
      const index = headerLower.findIndex(h => h.includes(name.toLowerCase()));
      if (index !== -1) {
        addDebugInfo(`Found column "${name}" at index ${index} (header: "${headers[index]}")`);
        return index;
      }
    }
    
    addDebugInfo(`Column not found for: ${possibleNames.join(', ')}`);
    return -1;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setDebugInfo([]);
    
    try {
      addDebugInfo(`Starting to process file: ${file.name}`);
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Get the range to understand the data structure
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      addDebugInfo(`Sheet range: ${range.s.r} to ${range.e.r} rows, ${range.s.c} to ${range.e.c} columns`);
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      addDebugInfo(`Raw data rows: ${jsonData.length}`);
      
      if (jsonData.length < 2) {
        toast.error("Excel file appears to be empty or has no data rows");
        return;
      }

      // Get headers from first row
      const headers = jsonData[0] as string[];
      addDebugInfo(`Headers found: ${JSON.stringify(headers)}`);

      // Find column indices
      const columnMap = {
        woNo: findColumnIndex(headers, ['wo no', 'work order', 'wo number']),
        status: findColumnIndex(headers, ['status']),
        date: findColumnIndex(headers, ['date', 'creation date', 'created']),
        rep: findColumnIndex(headers, ['rep', 'representative']),
        category: findColumnIndex(headers, ['category', 'type']),
        customer: findColumnIndex(headers, ['customer', 'client']),
        reference: findColumnIndex(headers, ['reference', 'ref']),
        qty: findColumnIndex(headers, ['qty', 'quantity']),
        dueDate: findColumnIndex(headers, ['due date', 'due']),
        location: findColumnIndex(headers, ['location', 'dept', 'department']),
        note: findColumnIndex(headers, ['note', 'notes', 'comment', 'comments'])
      };

      addDebugInfo(`Column mapping: ${JSON.stringify(columnMap)}`);

      // Process data rows
      const dataRows = jsonData.slice(1) as any[][];
      const stats: ImportStats = {
        totalRows: dataRows.length,
        processedRows: 0,
        skippedRows: 0,
        invalidWONumbers: 0
      };

      const mapped: ParsedJob[] = [];

      dataRows.forEach((row, index) => {
        addDebugInfo(`Processing row ${index + 2}: ${JSON.stringify(row.slice(0, 12))}`);
        
        const woNo = formatWONumber(row[columnMap.woNo]);
        
        if (!woNo || woNo === "000000") {
          addDebugInfo(`Skipping row ${index + 2}: Invalid WO Number`);
          stats.skippedRows++;
          stats.invalidWONumbers++;
          return;
        }

        const job: ParsedJob = {
          wo_no: woNo,
          status: String(row[columnMap.status] || "").trim() || "Production",
          date: formatExcelDate(row[columnMap.date]),
          rep: String(row[columnMap.rep] || "").trim(),
          category: String(row[columnMap.category] || "").trim(),
          customer: String(row[columnMap.customer] || "").trim(),
          reference: String(row[columnMap.reference] || "").trim(),
          qty: parseInt(String(row[columnMap.qty] || "0").replace(/[^0-9]/g, '')) || 0,
          due_date: formatExcelDate(row[columnMap.dueDate]),
          location: String(row[columnMap.location] || "").trim(),
          note: String(row[columnMap.note] || "").trim()
        };

        addDebugInfo(`Mapped job: ${JSON.stringify(job)}`);
        mapped.push(job);
        stats.processedRows++;
      });

      addDebugInfo(`Import completed: ${stats.processedRows} processed, ${stats.skippedRows} skipped`);

      setParsedJobs(mapped);
      setImportStats(stats);
      toast.success(`Parsed ${mapped.length} jobs from ${file.name}. ${stats.skippedRows} rows skipped.`);
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      addDebugInfo(`Error: ${error}`);
      toast.error("Failed to parse Excel file. Please check the format.");
    }
  };

  const downloadDebugInfo = () => {
    const debugText = debugInfo.join('\n');
    const blob = new Blob([debugText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `excel-import-debug-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmUpload = async () => {
    if (!user?.id || parsedJobs.length === 0) return;

    setIsUploading(true);
    
    try {
      const jobsWithUserId: JobDataWithQR[] = [];
      
      for (const job of parsedJobs) {
        const jobData: JobDataWithQR = {
          ...job,
          user_id: user.id
        };

        // Generate QR code if enabled
        if (generateQRCodes) {
          try {
            const qrData = generateQRCodeData({
              wo_no: job.wo_no,
              job_id: `temp-${job.wo_no}`,
              customer: job.customer,
              due_date: job.due_date
            });
            
            const qrUrl = await generateQRCodeImage(qrData);
            
            jobData.qr_code_data = qrData;
            jobData.qr_code_url = qrUrl;
          } catch (qrError) {
            console.warn(`Failed to generate QR code for ${job.wo_no}:`, qrError);
          }
        }

        jobsWithUserId.push(jobData);
      }

      const { data, error } = await supabase
        .from('production_jobs')
        .upsert(jobsWithUserId, { 
          onConflict: 'wo_no,user_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload jobs to database");
        return;
      }

      // Update QR codes with actual job IDs if QR generation was enabled
      if (generateQRCodes && data) {
        for (const insertedJob of data) {
          if (insertedJob.qr_code_data) {
            try {
              const updatedQrData = generateQRCodeData({
                wo_no: insertedJob.wo_no,
                job_id: insertedJob.id,
                customer: insertedJob.customer,
                due_date: insertedJob.due_date
              });
              
              const updatedQrUrl = await generateQRCodeImage(updatedQrData);
              
              await supabase
                .from('production_jobs')
                .update({
                  qr_code_data: updatedQrData,
                  qr_code_url: updatedQrUrl
                })
                .eq('id', insertedJob.id);
            } catch (qrError) {
              console.warn(`Failed to update QR code for job ${insertedJob.id}:`, qrError);
            }
          }
        }
      }

      const qrMessage = generateQRCodes ? " with QR codes" : "";
      toast.success(`Successfully uploaded ${jobsWithUserId.length} jobs${qrMessage}`);
      setParsedJobs([]);
      setFileName("");
      setImportStats(null);
      setDebugInfo([]);
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload jobs");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearPreview = () => {
    setParsedJobs([]);
    setFileName("");
    setImportStats(null);
    setDebugInfo([]);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="w-full max-w-[95vw] mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Excel File
          </CardTitle>
          <CardDescription>
            Upload an Excel file (.xlsx, .xls) containing production jobs. 
            Expected columns: WO No., Status, Date, Rep, Category, Customer, Reference, Qty, Due Date, Location, Note
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="flex-1"
              />
              {fileName && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <FileSpreadsheet className="h-4 w-4" />
                  {fileName}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="generate-qr"
                checked={generateQRCodes}
                onCheckedChange={setGenerateQRCodes}
              />
              <Label htmlFor="generate-qr" className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Generate QR codes for each job
              </Label>
            </div>

            {importStats && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold mb-2">Import Statistics</h4>
                <div className="text-sm space-y-1">
                  <div>Total rows processed: {importStats.totalRows}</div>
                  <div>Successfully imported: {importStats.processedRows}</div>
                  <div>Skipped rows: {importStats.skippedRows}</div>
                  <div>Invalid WO Numbers: {importStats.invalidWONumbers}</div>
                </div>
              </div>
            )}

            {debugInfo.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadDebugInfo}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Debug Info
                </Button>
                <span className="text-sm text-gray-500">({debugInfo.length} debug messages)</span>
              </div>
            )}
            
            {parsedJobs.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  onClick={handleConfirmUpload} 
                  disabled={isUploading}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  {isUploading ? "Uploading..." : `Upload ${parsedJobs.length} Jobs`}
                  {generateQRCodes && " with QR Codes"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClearPreview}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {parsedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview ({parsedJobs.length} jobs)</CardTitle>
            <CardDescription>
              Review the parsed jobs before uploading to the database
              {generateQRCodes && " (QR codes will be generated automatically)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WO No.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedJobs.slice(0, 50).map((job, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{job.wo_no}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          job.status === 'Production' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status}
                        </span>
                      </TableCell>
                      <TableCell>{job.date || '-'}</TableCell>
                      <TableCell>{job.rep || '-'}</TableCell>
                      <TableCell>{job.category || '-'}</TableCell>
                      <TableCell>{job.customer || '-'}</TableCell>
                      <TableCell>{job.reference || '-'}</TableCell>
                      <TableCell>{job.qty}</TableCell>
                      <TableCell>{job.due_date || '-'}</TableCell>
                      <TableCell>{job.location || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{job.note || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedJobs.length > 50 && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Showing first 50 jobs. {parsedJobs.length - 50} more will be uploaded.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
