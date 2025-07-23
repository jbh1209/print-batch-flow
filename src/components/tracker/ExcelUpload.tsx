import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/admin/upload/FileDropZone";
import { ExcelDataAnalyzer } from "@/components/admin/ExcelDataAnalyzer";
import { JobPartAssignmentManager } from "@/components/jobs/JobPartAssignmentManager";
import { useToast } from "@/hooks/use-toast";
import { parseMatrixExcelFile, parseMatrixDataToJobs } from "@/utils/excel/matrixParser";
import { ExcelImportDebugger } from "@/utils/excel/debugger";
import { finalizeProductionReadyJobs } from "@/services/tracker/jobCreationService";

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

export const ExcelUpload: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedExcelData | null>(null);
  const [showPartAssignment, setShowPartAssignment] = useState(false);
  const [importedJobIds, setImportedJobIds] = useState<string[]>([]);
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

      // Initialize debugger
      const logger = new ExcelImportDebugger();
      logger.addDebugInfo(`Starting Excel parsing: ${file.name}`);

      setUploadProgress(50);

      // Parse Excel file
      const matrixData = await parseMatrixExcelFile(file, logger);
      
      setUploadProgress(75);

      // Convert matrix data to jobs
      const defaultColumnMapping = {};
      const jobs = parseMatrixDataToJobs(matrixData, defaultColumnMapping, logger);
      
      logger.addDebugInfo(`Excel parsing completed. Generated ${jobs.length} jobs.`);

      setUploadProgress(100);

      // Create parsed data structure
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
        description: `Ready to import ${jobs.length} jobs`,
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

  const handleEnhancedJobsConfirmed = async (processedJobs: any[]) => {
    try {
      console.log('🚀 Creating production jobs...', processedJobs.length);
      
      const result = await finalizeProductionReadyJobs(processedJobs);
      
      if (result.success && result.createdJobs) {
        console.log('✅ Jobs created successfully, opening part assignment modal');
        
        // Extract job IDs from created jobs
        const jobIds = result.createdJobs.map(job => job.id);
        setImportedJobIds(jobIds);
        
        // Clear parsed data and show part assignment modal
        setParsedData(null);
        setShowPartAssignment(true);
        
        toast({
          title: "Jobs imported successfully",
          description: `${result.createdJobs.length} jobs created. Please assign parts to production stages.`,
        });
      } else {
        throw new Error(result.error || 'Failed to create jobs');
      }
    } catch (error: any) {
      console.error('❌ Error creating jobs:', error);
      toast({
        title: "Import failed",
        description: error.message || "Failed to create production jobs",
        variant: "destructive",
      });
    }
  };

  const handlePartAssignmentComplete = () => {
    setShowPartAssignment(false);
    setImportedJobIds([]);
    toast({
      title: "Part assignment completed",
      description: "Jobs are now ready for production",
    });
  };

  const handleClearData = () => {
    setParsedData(null);
  };

  // Show part assignment modal for imported jobs
  if (showPartAssignment && importedJobIds.length > 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Part Assignment Required</CardTitle>
            <p className="text-sm text-muted-foreground">
              {importedJobIds.length} jobs have been imported successfully. 
              Please assign parts (Cover, Text, Both, or None) to each production stage.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button 
                onClick={handlePartAssignmentComplete}
                variant="outline"
              >
                Skip Part Assignment
              </Button>
              <Button 
                onClick={() => {
                  // Keep modal open but show first job
                }}
              >
                Assign Parts to Jobs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Show part assignment modal for each imported job */}
        {importedJobIds.map((jobId, index) => (
          <JobPartAssignmentManager
            key={jobId}
            jobId={jobId}
            jobTableName="production_jobs"
            open={index === 0} // Only show first job initially
            onClose={() => {
              if (index === importedJobIds.length - 1) {
                handlePartAssignmentComplete();
              }
            }}
          />
        ))}
      </div>
    );
  }

  if (parsedData) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Preview: {parsedData.fileName}</h3>
            <p className="text-sm text-muted-foreground">
              {parsedData.totalRows} jobs ready for import
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
          onJobsConfirmed={handleEnhancedJobsConfirmed}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Production Jobs</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload Excel files to import production jobs. After import, you'll be able to assign parts to production stages.
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
