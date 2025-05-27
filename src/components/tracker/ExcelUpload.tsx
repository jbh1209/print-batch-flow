
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Check, X, QrCode } from "lucide-react";
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

export const ExcelUpload = () => {
  const { user } = useAuth();
  const [parsedJobs, setParsedJobs] = useState<ParsedJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [generateQRCodes, setGenerateQRCodes] = useState(true);

  const formatExcelDate = (excelDate: any): string => {
    if (!excelDate) return "";
    
    // If it's already a string in YYYY/MM/DD format
    if (typeof excelDate === 'string') {
      // Handle various date formats
      if (excelDate.includes('/')) {
        const parts = excelDate.split('/');
        if (parts.length === 3) {
          // Assume YYYY/MM/DD format
          const [year, month, day] = parts;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
      return excelDate;
    }
    
    // If it's an Excel serial number
    if (typeof excelDate === 'number') {
      // Excel dates are days since 1900-01-01 (with some adjustments)
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // If it's already a Date object
    if (excelDate instanceof Date) {
      return excelDate.toISOString().split('T')[0];
    }
    
    return "";
  };

  const formatWONumber = (woNo: any): string => {
    if (!woNo) return "";
    const cleaned = String(woNo).replace(/[^0-9]/g, '');
    return cleaned.padStart(6, '0');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log("Raw Excel data:", jsonData.slice(0, 3)); // Debug log

      // Map Excel columns to our database fields based on the screenshot
      const mapped = jsonData.map((row: any) => ({
        wo_no: formatWONumber(row["WO No."] || row["WO No"] || ""),
        status: String(row["Status"] || "").trim() || "Production",
        date: formatExcelDate(row["Date"]),
        rep: String(row["Rep"] || "").trim() || "",
        category: String(row["Category"] || "").trim() || "",
        customer: String(row["Customer"] || "").trim() || "",
        reference: String(row["Reference"] || "").trim() || "",
        qty: parseInt(String(row["Qty"] || row["Quantity"] || "0").replace(/[^0-9]/g, '')) || 0,
        due_date: formatExcelDate(row["Due Date"] || row["DueDate"]),
        location: String(row["Location"] || "").trim() || "",
        note: String(row["Note"] || row["Notes"] || "").trim() || ""
      })).filter(job => job.wo_no && job.wo_no !== "000000"); // Only include rows with valid work order numbers

      console.log("Mapped jobs:", mapped.slice(0, 3)); // Debug log

      setParsedJobs(mapped);
      toast.success(`Parsed ${mapped.length} jobs from ${file.name}`);
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      toast.error("Failed to parse Excel file. Please check the format.");
    }
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
              job_id: `temp-${job.wo_no}`, // Temporary ID, will be replaced after insertion
              customer: job.customer,
              due_date: job.due_date
            });
            
            const qrUrl = await generateQRCodeImage(qrData);
            
            jobData.qr_code_data = qrData;
            jobData.qr_code_url = qrUrl;
          } catch (qrError) {
            console.warn(`Failed to generate QR code for ${job.wo_no}:`, qrError);
            // Continue without QR code
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
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="space-y-6">
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
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WO No.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedJobs.slice(0, 20).map((job, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{job.wo_no}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          job.status === 'Production' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status}
                        </span>
                      </TableCell>
                      <TableCell>{job.customer || '-'}</TableCell>
                      <TableCell>{job.category || '-'}</TableCell>
                      <TableCell>{job.qty}</TableCell>
                      <TableCell>{job.due_date || '-'}</TableCell>
                      <TableCell>{job.rep || '-'}</TableCell>
                      <TableCell>{job.location || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedJobs.length > 20 && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Showing first 20 jobs. {parsedJobs.length - 20} more will be uploaded.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
