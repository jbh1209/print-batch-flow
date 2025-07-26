import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { FileDropZone } from "@/components/admin/upload/FileDropZone";
import { ExcelDataAnalyzer } from "@/components/admin/ExcelDataAnalyzer";
import { useToast } from "@/hooks/use-toast";
import { parseMatrixExcelFile, parseMatrixDataToJobs } from "@/utils/excel/matrixParser";
import { ExcelImportDebugger } from "@/utils/excel/debugger";

interface ParsedExcelData {
  fileName: string;
  headers: string[];
  totalRows: number;
  jobs: any[];
  stats: any;
  mapping: any;
  debugLog: string[];
  isMatrixMode?: boolean;
  matrixData?: any;
}

export const MappingExcelUpload: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedExcelData | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      setUploadProgress(25);

      // Initialize debugger for matrix parsing
      const logger = new ExcelImportDebugger();
      logger.addDebugInfo(`Starting matrix parsing for mapping analysis: ${file.name}`);

      setUploadProgress(50);

      // Parse Excel file using matrix parser
      const matrixData = await parseMatrixExcelFile(file, logger);
      
      setUploadProgress(75);

      // Convert matrix data to jobs using a simplified column mapping
      const defaultColumnMapping = {};
      const parsingResult = parseMatrixDataToJobs(matrixData, defaultColumnMapping, logger);
      const jobs = parsingResult.jobs;
      
      logger.addDebugInfo(`Matrix parsing completed. Generated ${jobs.length} jobs for pattern analysis.`);
      if (parsingResult.duplicatesFound.length > 0) {
        logger.addDebugInfo(`Duplicates handled: ${parsingResult.duplicatesFound.join(', ')}`);
      }

      setUploadProgress(100);

      // Create parsed data structure for ExcelDataAnalyzer
      const parsedExcelData: ParsedExcelData = {
        fileName: file.name,
        headers: matrixData.headers,
        totalRows: jobs.length,
        jobs,
        stats: {
          totalJobs: jobs.length,
          withCustomer: jobs.filter(j => j.customer).length,
          withReference: jobs.filter(j => j.reference).length,
          withCategory: jobs.filter(j => j.category).length,
          withSpecification: jobs.filter(j => j.specification).length,
          withPaperSpecs: jobs.filter(j => j.paper_specifications).length,
          withDeliverySpecs: jobs.filter(j => j.delivery_specifications).length,
          withFinishingSpecs: jobs.filter(j => j.finishing_specifications).length,
          withPackagingSpecs: jobs.filter(j => j.packaging_specifications).length,
          detectedGroups: matrixData.detectedGroups
        },
        mapping: {},
        debugLog: logger.getDebugInfo(),
        isMatrixMode: true,
        matrixData
      };

      setParsedData(parsedExcelData);

      toast({
        title: "File processed successfully",
        description: `Extracted ${jobs.length} rows with ${matrixData.headers.length} columns for pattern analysis`,
      });

    } catch (error: any) {
      console.error('Error processing Excel file:', error);
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process Excel file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleMappingCreated = () => {
    // Callback when a mapping is successfully created
    toast({
      title: "Mapping created",
      description: "Excel text pattern has been mapped successfully",
    });
  };

  const handleClearData = () => {
    setParsedData(null);
  };

  if (parsedData) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Pattern Analysis: {parsedData.fileName}</h3>
            <p className="text-sm text-muted-foreground">
              {parsedData.totalRows} rows processed • {parsedData.headers.length} columns analyzed
            </p>
          </div>
          <button
            onClick={handleClearData}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Upload different file
          </button>
        </div>
        
        <ExcelDataAnalyzer 
          data={parsedData} 
          onMappingCreated={handleMappingCreated}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Excel File for Pattern Analysis</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload Excel files to extract text patterns and create intelligent mappings to production stages and specifications.
          This will not create any jobs - only analyze patterns for mapping creation.
        </p>
      </CardHeader>
      <CardContent>
        <FileDropZone
          isProcessing={isProcessing}
          uploadProgress={uploadProgress}
          onFileUpload={handleFileUpload}
        />
      </CardContent>
    </Card>
  );
};