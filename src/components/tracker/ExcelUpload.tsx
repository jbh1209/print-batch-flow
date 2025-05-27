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
  so_no: string;
  qt_no: string;
  date: string;
  rep: string;
  user_name: string;
  category: string;
  customer: string;
  reference: string;
  qty: number;
  due_date: string;
  location: string;
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

      // Map Excel columns to our database fields
      const mapped = jsonData.map((row: any) => ({
        wo_no: row["WO No."] || row["WO No"] || row["wo_no"] || "",
        status: row["Status"] || row["status"] || "Pre-Press",
        so_no: row["SO No."] || row["SO No"] || row["so_no"] || "",
        qt_no: row["QT No."] || row["QT No"] || row["qt_no"] || "",
        date: row["Date"] || row["date"] || "",
        rep: row["Rep"] || row["rep"] || "",
        user_name: row["User"] || row["user"] || row["user_name"] || "",
        category: row["Category"] || row["category"] || "",
        customer: row["Customer"] || row["customer"] || "",
        reference: row["Reference"] || row["reference"] || "",
        qty: parseInt(row["Qty"] || row["qty"] || "0") || 0,
        due_date: row["Due Date"] || row["due_date"] || "",
        location: row["Location"] || row["location"] || ""
      })).filter(job => job.wo_no); // Only include rows with work order numbers

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
          user_id: user.id,
          // Convert date strings to proper dates
          date: job.date ? new Date(job.date).toISOString().split('T')[0] : "",
          due_date: job.due_date ? new Date(job.due_date).toISOString().split('T')[0] : ""
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
            Expected columns: WO No., Status, SO No., QT No., Date, Rep, User, Category, Customer, Reference, Qty, Due Date, Location
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
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedJobs.slice(0, 20).map((job, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{job.wo_no}</TableCell>
                      <TableCell>{job.customer}</TableCell>
                      <TableCell>{job.status}</TableCell>
                      <TableCell>{job.qty}</TableCell>
                      <TableCell>{job.due_date}</TableCell>
                      <TableCell>{job.category}</TableCell>
                      <TableCell>{job.location}</TableCell>
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
