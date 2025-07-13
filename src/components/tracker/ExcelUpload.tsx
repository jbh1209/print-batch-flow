import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Check, X, QrCode, Download, AlertTriangle, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { 
  ExcelImportDebugger, 
  ImportStats,
} from "@/utils/excel";
import { 
  parseExcelFileForPreview, 
  getAutoDetectedMapping
} from "@/utils/excel/enhancedParser";
import { ExcelJobProcessor, type ProcessingResult } from "@/utils/excel/ExcelJobProcessor";
import { ColumnMappingDialog, type ExcelPreviewData, type ColumnMapping } from "./ColumnMappingDialog";

export const ExcelUpload = () => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [generateQRCodes, setGenerateQRCodes] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [debugLogger] = useState(() => new ExcelImportDebugger());
  const [result, setResult] = useState<ProcessingResult | null>(null);
  
  // Column mapping state
  const [previewData, setPreviewData] = useState<ExcelPreviewData | null>(null);
  const [autoDetectedMapping, setAutoDetectedMapping] = useState<ColumnMapping>({});
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadError(null);
    setCurrentFile(file);
    debugLogger.clear();
    
    try {
      debugLogger.addDebugInfo("Parsing Excel file for preview...");
      
      const preview = await parseExcelFileForPreview(file);
      const autoMapping = getAutoDetectedMapping(preview.headers, debugLogger);
      
      setPreviewData(preview);
      setAutoDetectedMapping(autoMapping);
      setShowMappingDialog(true);
      
      toast.success(`File loaded successfully. ${preview.totalRows} rows detected.`);
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      debugLogger.addDebugInfo(`Error: ${error}`);
      setUploadError(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Failed to parse Excel file. Please check the format.");
    }
  };

  const handleMappingConfirmed = async (mapping: ColumnMapping) => {
    if (!currentFile || !user?.id) return;
    
    try {
      setIsUploading(true);
      setShowMappingDialog(false);
      
      debugLogger.addDebugInfo("Starting unified Excel processing...");
      
      // Create and initialize the unified processor
      const processor = new ExcelJobProcessor(debugLogger, user.id, generateQRCodes);
      await processor.initialize();
      
      // Process the entire Excel file in one operation
      const processingResult = await processor.processExcelFile(currentFile, mapping);
      
      setResult(processingResult);
      
      if (processingResult.success) {
        const userStageCount = Object.keys(mapping).filter(k => k.startsWith('stage_')).length;
        toast.success(
          `Success! ${processingResult.stats.successful}/${processingResult.stats.total} jobs created with ${userStageCount} user-approved stages each!`
        );
      } else {
        toast.error(`Processing completed with errors. ${processingResult.stats.failed} jobs failed.`);
      }
      
    } catch (error) {
      console.error("Error in Excel processing:", error);
      debugLogger.addDebugInfo(`Processing error: ${error}`);
      setUploadError(`Failed to process Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Failed to process Excel file.");
    } finally {
      setIsUploading(false);
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

  const handleClearPreview = () => {
    setFileName("");
    setUploadError(null);
    setPreviewData(null);
    setAutoDetectedMapping({});
    setCurrentFile(null);
    setResult(null);
    setShowMappingDialog(false);
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
            Upload an Excel file (.xlsx, .xls) to create production jobs with custom workflows.
            <br />
            <span className="text-green-600 font-medium flex items-center gap-1 mt-2">
              <Sparkles className="h-4 w-4" />
              Unified Processor: Direct Excel → Database with User-Approved Stage Mappings
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
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-800">Processing Error</h4>
                    <pre className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{uploadError}</pre>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Processing Results
                </h4>
                <div className="text-sm space-y-1">
                  <div>Total jobs: {result.stats.total}</div>
                  <div className="text-green-600">Successfully created: {result.stats.successful}</div>
                  <div className="text-green-600">Workflows initialized: {result.stats.workflowsInitialized}</div>
                  {result.stats.failed > 0 && (
                    <div className="text-red-600">Failed: {result.stats.failed}</div>
                  )}
                </div>
                
                {result.failedJobs.length > 0 && (
                  <div className="mt-3">
                    <h5 className="font-medium text-red-800">Failed Jobs:</h5>
                    <div className="text-xs text-red-700 max-h-32 overflow-y-auto">
                      {result.failedJobs.slice(0, 5).map((failed, idx) => (
                        <div key={idx}>• {failed.job.wo_no}: {failed.error}</div>
                      ))}
                      {result.failedJobs.length > 5 && (
                        <div>... and {result.failedJobs.length - 5} more</div>
                      )}
                    </div>
                  </div>
                )}
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
            
            {result && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleClearPreview}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear & Upload Another
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Column Mapping Dialog */}
      <ColumnMappingDialog
        open={showMappingDialog}
        onOpenChange={setShowMappingDialog}
        previewData={previewData}
        autoDetectedMapping={autoDetectedMapping}
        onMappingConfirmed={handleMappingConfirmed}
      />

      {result?.createdJobs && result.createdJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Created Jobs ({result.createdJobs.length})</CardTitle>
            <CardDescription>
              Successfully created production jobs with custom workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WO No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Workflow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.createdJobs.slice(0, 50).map((job, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{job.wo_no}</TableCell>
                      <TableCell>{job.customer || '-'}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          {job.status}
                        </span>
                      </TableCell>
                      <TableCell>{job.qty}</TableCell>
                      <TableCell>{job.due_date || '-'}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          Custom Workflow
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {result.createdJobs.length > 50 && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Showing first 50 jobs. {result.createdJobs.length - 50} more were created.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};