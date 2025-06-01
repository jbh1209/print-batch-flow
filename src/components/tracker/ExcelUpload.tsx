
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Check, X, QrCode, Download, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateQRCodeData, generateQRCodeImage } from "@/utils/qrCodeGenerator";
import { 
  parseExcelFile, 
  ExcelImportDebugger, 
  ParsedJob, 
  ImportStats,
  validateAllJobs 
} from "@/utils/excel";

interface JobDataWithQR extends ParsedJob {
  user_id: string;
  qr_code_data?: string;
  qr_code_url?: string;
}

export const ExcelUpload = () => {
  const { user } = useAuth();
  const [parsedJobs, setParsedJobs] = useState<ParsedJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [generateQRCodes, setGenerateQRCodes] = useState(true);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [debugLogger] = useState(() => new ExcelImportDebugger());

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadError(null);
    debugLogger.clear();
    
    try {
      const { jobs, stats } = await parseExcelFile(file, debugLogger);
      
      setParsedJobs(jobs);
      setImportStats(stats);
      
      let message = `Parsed ${jobs.length} jobs from ${file.name}.`;
      if (stats.skippedRows > 0) {
        message += ` ${stats.skippedRows} rows skipped (missing WO numbers).`;
      }
      if (stats.invalidDates > 0) {
        message += ` ${stats.invalidDates} invalid dates found (rows with blank dates are allowed).`;
      }
      
      toast.success(message);
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      debugLogger.addDebugInfo(`Error: ${error}`);
      setUploadError(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Failed to parse Excel file. Please check the format.");
    }
  };

  const downloadDebugInfo = () => {
    const debugText = debugLogger.getDebugInfo().join('\n');
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
    setUploadError(null);
    
    try {
      debugLogger.addDebugInfo(`Starting upload of ${parsedJobs.length} jobs for user ${user.id}`);
    
      // Validate jobs before upload using the updated validator
      const validationErrors = validateAllJobs(parsedJobs);
    
      if (validationErrors.length > 0) {
        setUploadError(`Validation errors:\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? '\n...' : ''}`);
        debugLogger.addDebugInfo(`Validation failed: ${validationErrors.join('; ')}`);
        return;
      }
      
      const jobsWithUserId: JobDataWithQR[] = [];
      
      for (const job of parsedJobs) {
        const jobData: JobDataWithQR = {
          ...job,
          user_id: user.id,
          // Convert null dates to undefined for database insertion
          date: job.date || undefined,
          due_date: job.due_date || undefined
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
            debugLogger.addDebugInfo(`Failed to generate QR code for ${job.wo_no}: ${qrError}`);
          }
        }

        jobsWithUserId.push(jobData);
      }

      debugLogger.addDebugInfo(`Attempting to insert ${jobsWithUserId.length} jobs into database`);
      debugLogger.addDebugInfo(`Sample job data: ${JSON.stringify(jobsWithUserId[0], null, 2)}`);

      const { data, error } = await supabase
        .from('production_jobs')
        .upsert(jobsWithUserId, { 
          onConflict: 'wo_no,user_id',
          ignoreDuplicates: true 
        })
        .select();

      if (error) {
        debugLogger.addDebugInfo(`Database error: ${JSON.stringify(error)}`);
        setUploadError(`Database error: ${error.message}`);
        toast.error("Failed to upload jobs to database");
        return;
      }

      debugLogger.addDebugInfo(`Successfully inserted ${data?.length || 0} jobs (duplicates were ignored)`);

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
              debugLogger.addDebugInfo(`Failed to update QR code for job ${insertedJob.id}: ${qrError}`);
            }
          }
        }
      }

      const duplicatesSkipped = jobsWithUserId.length - (data?.length || 0);
      const qrMessage = generateQRCodes ? " with QR codes" : "";
      
      if (duplicatesSkipped > 0) {
        toast.success(`Successfully uploaded ${data?.length || 0} new jobs${qrMessage}. ${duplicatesSkipped} duplicate work orders were skipped.`);
      } else {
        toast.success(`Successfully uploaded ${data?.length || 0} jobs${qrMessage}`);
      }
      
      setParsedJobs([]);
      setFileName("");
      setImportStats(null);
      debugLogger.clear();
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
    } catch (error) {
      debugLogger.addDebugInfo(`Upload error: ${error}`);
      setUploadError(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Failed to upload jobs");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearPreview = () => {
    setParsedJobs([]);
    setFileName("");
    setImportStats(null);
    setUploadError(null);
    debugLogger.clear();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Excel File
          </CardTitle>
          <CardDescription>
            Upload an Excel file (.xlsx, .xls) containing production jobs. 
            Expected columns: WO No., Status, Date, Rep, Category, Customer, Reference, Qty, Due Date, Location.
            <br />
            <span className="text-blue-600 font-medium">Note: Blank cells are allowed for all fields except WO Number and Customer. Duplicate work orders will be ignored.</span>
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

            {uploadError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-800">Upload Error</h4>
                    <pre className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{uploadError}</pre>
                  </div>
                </div>
              </div>
            )}

            {importStats && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Import Statistics
                </h4>
                <div className="text-sm space-y-1">
                  <div>Total rows processed: {importStats.totalRows}</div>
                  <div>Successfully imported: {importStats.processedRows}</div>
                  <div>Skipped rows: {importStats.skippedRows}</div>
                  <div>Invalid WO Numbers: {importStats.invalidWONumbers}</div>
                  <div>Invalid dates: {importStats.invalidDates}</div>
                  {importStats.invalidDates > 0 && (
                    <div className="text-blue-600 text-xs mt-2">
                      * Invalid dates were converted to blank fields and jobs were still imported
                    </div>
                  )}
                </div>
              </div>
            )}

            {debugLogger.getDebugInfo().length > 0 && (
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
                <span className="text-sm text-gray-500">({debugLogger.getDebugInfo().length} debug messages)</span>
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
              <br />
              <span className="text-sm text-gray-600">Blank cells are shown as "-" and are acceptable. Duplicate work orders will be ignored during upload.</span>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedJobs.slice(0, 100).map((job, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{job.wo_no}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          job.status === 'Pre-Press' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status}
                        </span>
                      </TableCell>
                      <TableCell>{job.date || '-'}</TableCell>
                      <TableCell>{job.rep || '-'}</TableCell>
                      <TableCell>{job.category || '-'}</TableCell>
                      <TableCell className={!job.customer ? 'text-red-500 font-medium' : ''}>
                        {job.customer || 'MISSING'}
                      </TableCell>
                      <TableCell>{job.reference || '-'}</TableCell>
                      <TableCell>{job.qty}</TableCell>
                      <TableCell>{job.due_date || '-'}</TableCell>
                      <TableCell>{job.location || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedJobs.length > 100 && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Showing first 100 jobs. {parsedJobs.length - 100} more will be uploaded.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
