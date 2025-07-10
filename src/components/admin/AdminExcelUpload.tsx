import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExcelImportDebugger } from "@/utils/excel/debugger";
import { 
  parseExcelFileForPreview, 
  parseExcelFileWithMapping, 
  getAutoDetectedMapping,
  parseMatrixExcelFileForPreview,
  parseMatrixExcelFileWithMapping 
} from "@/utils/excel/enhancedParser";
import type { MatrixExcelData } from "@/utils/excel/types";

interface AdminExcelUploadProps {
  onDataUploaded: (data: any) => void;
}

export const AdminExcelUpload: React.FC<AdminExcelUploadProps> = ({ onDataUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    
    const logger = new ExcelImportDebugger();
    
    try {
      // Step 1: Try to detect if this is a matrix-structured Excel file
      setUploadProgress(20);
      logger.addDebugInfo("Attempting to detect Excel structure type...");
      
      let analysisData;
      let isMatrixMode = false;
      
      try {
        const matrixPreview = await parseMatrixExcelFileForPreview(file, logger);
        
        // Check if matrix structure was detected
        if (matrixPreview.detectedGroups.length > 0 && matrixPreview.groupColumn !== -1) {
          logger.addDebugInfo(`Matrix structure detected with ${matrixPreview.detectedGroups.length} groups`);
          isMatrixMode = true;
          
          setUploadProgress(50);
          
          // For admin analysis, use a basic mapping for matrix files
          const basicMatrixMapping = {
            woNo: matrixPreview.workOrderColumn,
            groupColumn: matrixPreview.groupColumn,
            descriptionColumn: matrixPreview.descriptionColumn,
            qtyColumn: matrixPreview.qtyColumn,
            woQtyColumn: matrixPreview.woQtyColumn,
            customer: -1,
            reference: -1,
            date: -1,
            dueDate: -1,
            rep: -1,
            category: -1,
            location: -1,
            size: -1,
            specification: -1,
            contact: -1
          };
          
          setUploadProgress(75);
          const parsedData = await parseMatrixExcelFileWithMapping(file, matrixPreview, basicMatrixMapping, logger);
          
          analysisData = {
            fileName: file.name,
            headers: matrixPreview.headers,
            totalRows: matrixPreview.rows.length,
            jobs: parsedData.jobs,
            stats: parsedData.stats,
            mapping: basicMatrixMapping,
            debugLog: logger.getDebugInfo(),
            isMatrixMode: true,
            matrixData: matrixPreview
          };
          
          toast({
            title: "Matrix Excel Detected",
            description: `Found ${matrixPreview.detectedGroups.length} groups in ${parsedData.jobs.length} processed jobs`,
          });
        }
      } catch (matrixError) {
        logger.addDebugInfo(`Matrix parsing failed, falling back to standard parsing: ${matrixError}`);
      }
      
      // Fall back to standard Excel parsing if matrix detection failed
      if (!isMatrixMode) {
        logger.addDebugInfo("Using standard Excel parsing mode");
        setUploadProgress(40);
        const previewData = await parseExcelFileForPreview(file);
        
        setUploadProgress(60);
        const mapping = getAutoDetectedMapping(previewData.headers, logger);
        
        setUploadProgress(80);
        const parsedData = await parseExcelFileWithMapping(file, mapping, logger);
        
        analysisData = {
          fileName: file.name,
          headers: previewData.headers,
          totalRows: previewData.totalRows,
          jobs: parsedData.jobs,
          stats: parsedData.stats,
          mapping: mapping,
          debugLog: logger.getDebugInfo(),
          isMatrixMode: false
        };
        
        toast({
          title: "Standard Excel Processed",
          description: `Processed ${parsedData.jobs.length} records from ${file.name}`,
        });
      }
      
      setUploadProgress(100);
      onDataUploaded(analysisData);
      
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process Excel file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {isProcessing ? (
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
              ) : (
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            
            {isProcessing ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Processing Excel file...</p>
                <Progress value={uploadProgress} className="w-64" />
                <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Upload Historical Excel Data</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Drag and drop your Excel file here, or click to browse.
                    Supports .xlsx and .xls files with work order data.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Browse Files
                  </Button>
                </div>
                
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-blue-900 dark:text-blue-100">Upload Tips:</p>
          <ul className="text-blue-800 dark:text-blue-200 mt-1 space-y-1 text-xs">
            <li>• Upload files with 18+ months of historical work order data</li>
            <li>• Larger datasets provide better mapping accuracy</li>
            <li>• Matrix/pivot table formats are automatically detected</li>
            <li>• Files up to 50MB are supported</li>
          </ul>
        </div>
      </div>
    </div>
  );
};