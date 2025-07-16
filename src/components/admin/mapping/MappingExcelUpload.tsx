import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { FileDropZone } from "@/components/admin/upload/FileDropZone";
import { ExcelDataAnalyzer } from "@/components/admin/ExcelDataAnalyzer";
import { useToast } from "@/hooks/use-toast";
import { parseMatrixExcelFile } from "@/utils/excel/matrixParser";
import { ExcelImportDebugger } from "@/utils/excel/debugger";
import * as XLSX from "xlsx";

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

      // Create debugger for logging
      const logger = new ExcelImportDebugger();
      
      // Try matrix parsing first
      try {
        setUploadProgress(50);
        const matrixData = await parseMatrixExcelFile(file, logger);
        setUploadProgress(75);

        // Convert matrix data to jobs format for pattern analysis
        const jobs = matrixData.rows.map((row: any[], index: number) => {
          const job: any = { row_index: index + 2 }; // +2 because we start from row 2 in Excel
          
          // Extract basic job info from matrix row
          if (matrixData.workOrderColumn !== undefined && matrixData.workOrderColumn !== -1 && row[matrixData.workOrderColumn]) {
            job.wo_no = String(row[matrixData.workOrderColumn]).trim();
          }
          if (matrixData.descriptionColumn !== undefined && matrixData.descriptionColumn !== -1 && row[matrixData.descriptionColumn]) {
            job.description = String(row[matrixData.descriptionColumn]).trim();
          }
          if (matrixData.qtyColumn !== undefined && matrixData.qtyColumn !== -1 && row[matrixData.qtyColumn]) {
            job.qty = parseInt(String(row[matrixData.qtyColumn])) || 1;
          }

          // Store all column data for pattern extraction
          matrixData.headers.forEach((header, colIndex) => {
            if (row[colIndex] !== undefined && row[colIndex] !== null) {
              const value = String(row[colIndex]).trim();
              if (value) {
                job[header] = value;
              }
            }
          });

          return job;
        });

        setUploadProgress(100);

        // Create parsed data structure for ExcelDataAnalyzer with matrix mode
        const parsedExcelData: ParsedExcelData = {
          fileName: file.name,
          headers: matrixData.headers,
          totalRows: matrixData.rows.length,
          jobs,
          stats: {
            totalJobs: jobs.length,
            withGroups: matrixData.detectedGroups.length,
            detectedGroups: matrixData.detectedGroups,
            matrixColumns: {
              groups: matrixData.groupColumn !== undefined && matrixData.groupColumn !== -1,
              workOrder: matrixData.workOrderColumn !== undefined && matrixData.workOrderColumn !== -1,
              description: matrixData.descriptionColumn !== undefined && matrixData.descriptionColumn !== -1,
              quantity: matrixData.qtyColumn !== undefined && matrixData.qtyColumn !== -1
            }
          },
          mapping: {},
          debugLog: logger.getDebugInfo(),
          isMatrixMode: true,
          matrixData
        };

        logger.addDebugInfo(`Matrix parsing complete - Found ${matrixData.detectedGroups.length} groups: ${matrixData.detectedGroups.join(', ')}`);

        setParsedData(parsedExcelData);

        toast({
          title: "Matrix file processed successfully",
          description: `Extracted ${jobs.length} rows with ${matrixData.detectedGroups.length} groups for pattern analysis`,
        });

      } catch (matrixError) {
        // Fallback to simple Excel parsing if matrix parsing fails
        logger.addDebugInfo(`Matrix parsing failed, falling back to simple Excel parsing: ${matrixError}`);
        
        setUploadProgress(50);
        
        // Parse Excel file using simple method
        const fileBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        setUploadProgress(75);

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          throw new Error("Excel file must contain at least a header row and one data row");
        }

        // Extract headers and data
        const headers = jsonData[0] as string[];
        const dataRows = jsonData.slice(1);
        
        // Process each row into job objects for pattern extraction
        const jobs = dataRows.map((row: any[], index: number) => {
          const job: any = { row_index: index + 2 }; // +2 because we start from row 2 in Excel
          
          headers.forEach((header, colIndex) => {
            if (row[colIndex] !== undefined && row[colIndex] !== null) {
              const value = String(row[colIndex]).trim();
              if (value) {
                // Map common Excel columns to our job structure
                const normalizedHeader = header.toLowerCase().trim();
                
                if (normalizedHeader.includes('wo') || normalizedHeader.includes('work order')) {
                  job.wo_no = value;
                } else if (normalizedHeader.includes('customer') || normalizedHeader.includes('client')) {
                  job.customer = value;
                } else if (normalizedHeader.includes('reference') || normalizedHeader.includes('ref')) {
                  job.reference = value;
                } else if (normalizedHeader.includes('category') || normalizedHeader.includes('type')) {
                  job.category = value;
                } else if (normalizedHeader.includes('specification') || normalizedHeader.includes('spec')) {
                  job.specification = value;
                } else if (normalizedHeader.includes('location') || normalizedHeader.includes('address')) {
                  job.location = value;
                } else if (normalizedHeader.includes('quantity') || normalizedHeader.includes('qty')) {
                  job.qty = parseInt(value) || 1;
                } else if (normalizedHeader.includes('paper')) {
                  job.paper_spec = value;
                } else if (normalizedHeader.includes('delivery') || normalizedHeader.includes('shipping')) {
                  job.delivery_spec = value;
                } else {
                  // Store any other data with the original header as key
                  job[header] = value;
                }
              }
            }
          });

          return job;
        });

        setUploadProgress(100);

        // Create parsed data structure for ExcelDataAnalyzer
        const parsedExcelData: ParsedExcelData = {
          fileName: file.name,
          headers,
          totalRows: dataRows.length,
          jobs,
          stats: {
            totalJobs: jobs.length,
            withCustomer: jobs.filter(j => j.customer).length,
            withReference: jobs.filter(j => j.reference).length,
            withCategory: jobs.filter(j => j.category).length,
            withSpecification: jobs.filter(j => j.specification).length,
          },
          mapping: {},
          debugLog: logger.getDebugInfo().concat([
            `Parsed Excel file: ${file.name}`,
            `Headers found: ${headers.join(', ')}`,
            `Total rows processed: ${jobs.length}`,
            `Processing complete for mapping extraction`
          ]),
          isMatrixMode: false
        };

        setParsedData(parsedExcelData);

        toast({
          title: "File processed successfully",
          description: `Extracted ${jobs.length} rows with ${headers.length} columns for pattern analysis`,
        });
      }

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