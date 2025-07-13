import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Download, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ExcelImportDebugger } from "@/utils/excel";
import { parseExcelToJobs, processJobsToDatabase, type ExcelJobPreview, type ProcessingResult } from "@/utils/excel/simpleProcessor";
import { SimpleExcelDialog } from "./SimpleExcelDialog";

export const ExcelUpload = () => {
  const { user } = useAuth();
  const [fileName, setFileName] = useState("");
  const [generateQRCodes, setGenerateQRCodes] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [debugLogger] = useState(() => new ExcelImportDebugger());
  
  // Simple processing state
  const [preview, setPreview] = useState<ExcelJobPreview | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadError(null);
    setCurrentFile(file);
    setResult(null);
    debugLogger.clear();
    
    try {
      debugLogger.addDebugInfo(`📊 Processing file: ${file.name}`);
      
      const jobPreview = await parseExcelToJobs(file, debugLogger);
      setPreview(jobPreview);
      setShowDialog(true);
      
      toast.success(`File loaded! Found ${jobPreview.totalRows} rows to process.`);
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      debugLogger.addDebugInfo(`❌ Error: ${error}`);
      setUploadError(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Failed to parse Excel file. Please check the format.");
    }
  };

  const handleProcessJobs = async (customColumnMap?: Record<string, number>) => {
    if (!currentFile || !user?.id) return;
    
    setIsProcessing(true);
    setResult(null);
    
    try {
      debugLogger.addDebugInfo("🚀 Starting job processing...");
      
      const processingResult = await processJobsToDatabase(
        currentFile,
        user.id,
        generateQRCodes,
        debugLogger,
        customColumnMap
      );
      
      setResult(processingResult);
      
      if (processingResult.successful > 0) {
        toast.success(`Successfully created ${processingResult.successful} jobs!`);
      }
      
      if (processingResult.failed > 0) {
        toast.warning(`${processingResult.failed} jobs failed to create. Check error details.`);
      }
      
    } catch (error) {
      console.error("Error processing jobs:", error);
      debugLogger.addDebugInfo(`❌ Processing failed: ${error}`);
      toast.error("Failed to process jobs: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsProcessing(false);
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

  const handleCloseDialog = () => {
    setShowDialog(false);
    setPreview(null);
    setResult(null);
    setCurrentFile(null);
    setFileName("");
    setUploadError(null);
    debugLogger.clear();
    
    // Reset file input
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
            Upload an Excel file (.xlsx, .xls) to create production jobs with workflows.
            <br />
            <span className="text-blue-600 font-medium mt-2 block">
              ✨ Simplified Import: Excel → Jobs → Stages → Ready!
            </span>
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
                  <div>
                    <h4 className="font-semibold text-red-800">Upload Error</h4>
                    <pre className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{uploadError}</pre>
                  </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Simple Excel Dialog */}
      <SimpleExcelDialog
        isOpen={showDialog}
        onClose={handleCloseDialog}
        preview={preview}
        onConfirm={handleProcessJobs}
        isProcessing={isProcessing}
        result={result}
      />
    </div>
  );
};