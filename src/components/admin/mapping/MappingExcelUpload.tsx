import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { FileDropZone } from "@/components/admin/upload/FileDropZone";
import { ExcelDataAnalyzer } from "@/components/admin/ExcelDataAnalyzer";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ParsedExcelData {
  fileName: string;
  headers: string[];
  totalRows: number;
  jobs: any[];
  stats: any;
  mapping: any;
  debugLog: string[];
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
      
      // Parse Excel file
      const fileBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      setUploadProgress(50);

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        throw new Error("Excel file must contain at least a header row and one data row");
      }

      // Extract headers and data
      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1);
      
      setUploadProgress(75);
      
      // Process each row to extract patterns
      const patterns = new Set<string>();
      const jobs = dataRows.map((row: any[], index: number) => {
        const job: any = { row_index: index + 2 };
        
        headers.forEach((header, colIndex) => {
          if (row[colIndex] !== undefined && row[colIndex] !== null) {
            const value = String(row[colIndex]).trim();
            if (value) {
              job[header] = value;
              
              // Extract patterns for mapping, including group patterns
              patterns.add(value);
              
              // Look for group:description patterns (e.g., "Packaging: Boxed")
              if (value.includes(':')) {
                const [group, description] = value.split(':').map(s => s.trim());
                if (group && description) {
                  patterns.add(value); // Full pattern
                  patterns.add(group); // Group name
                  patterns.add(description); // Description only
                  
                  // Store group information for ExcelDataAnalyzer
                  if (group.toLowerCase() === 'packaging') {
                    job.packaging_specifications = [{ name: description, display_name: description }];
                  } else if (group.toLowerCase() === 'paper') {
                    job.paper_specifications = [{ name: description, display_name: description }];
                  } else if (group.toLowerCase() === 'printing') {
                    job.printing_specifications = [{ name: description, display_name: description }];
                  } else if (group.toLowerCase() === 'finishing') {
                    job.finishing_specifications = [{ name: description, display_name: description }];
                  } else if (group.toLowerCase() === 'delivery') {
                    job.delivery_specifications = [{ name: description, display_name: description }];
                  }
                }
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
          totalPatterns: patterns.size,
          packagingPatterns: jobs.filter(j => j.packaging_specifications).length,
          paperPatterns: jobs.filter(j => j.paper_specifications).length,
          printingPatterns: jobs.filter(j => j.printing_specifications).length,
          finishingPatterns: jobs.filter(j => j.finishing_specifications).length,
          deliveryPatterns: jobs.filter(j => j.delivery_specifications).length,
        },
        mapping: {},
        debugLog: [
          `Parsed Excel file: ${file.name}`,
          `Headers found: ${headers.join(', ')}`,
          `Total rows processed: ${jobs.length}`,
          `Total patterns extracted: ${patterns.size}`,
          `Packaging patterns found: ${jobs.filter(j => j.packaging_specifications).length}`,
          `Processing complete for mapping extraction`
        ]
      };

      setParsedData(parsedExcelData);

      toast({
        title: "File processed successfully",
        description: `Extracted ${jobs.length} rows with ${patterns.size} patterns for analysis`,
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