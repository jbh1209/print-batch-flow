import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ExcelImportDebugger } from "@/utils/excel/debugger";
import { 
  parseExcelFileForPreview, 
  parseExcelFileWithMapping, 
  getAutoDetectedMapping,
  parseMatrixExcelFileForPreview,
  parseMatrixExcelFileWithMapping 
} from "@/utils/excel/enhancedParser";
import { usePrintSpecifications } from "@/hooks/usePrintSpecifications";
import type { MatrixExcelData } from "@/utils/excel/types";
import type { MatrixColumnMapping } from "@/components/tracker/MatrixMappingDialog";

interface UseExcelUploadProps {
  onDataUploaded: (data: any) => void;
}

export const useExcelUpload = ({ onDataUploaded }: UseExcelUploadProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMatrixDialog, setShowMatrixDialog] = useState(false);
  const [matrixData, setMatrixData] = useState<MatrixExcelData | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { specifications } = usePrintSpecifications();

  const validateFile = (file: File): boolean => {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const processMatrixFile = async (file: File, logger: ExcelImportDebugger) => {
    try {
      const matrixPreview = await parseMatrixExcelFileForPreview(file, logger);
      
      if (matrixPreview.detectedGroups.length > 0 && matrixPreview.groupColumn !== -1) {
        logger.addDebugInfo(`Matrix structure detected with ${matrixPreview.detectedGroups.length} groups`);
        setMatrixData(matrixPreview);
        setShowMatrixDialog(true);
        setUploadProgress(100);
        
        toast({
          title: "Matrix Excel Detected",
          description: `Found ${matrixPreview.detectedGroups.length} groups. Please configure the mapping.`,
        });
        return true;
      }
    } catch (matrixError) {
      logger.addDebugInfo(`Matrix parsing failed, falling back to standard parsing: ${matrixError}`);
    }
    return false;
  };

  const processStandardFile = async (file: File, logger: ExcelImportDebugger) => {
    logger.addDebugInfo("Using standard Excel parsing mode");
    setUploadProgress(40);
    const previewData = await parseExcelFileForPreview(file);
    
    setUploadProgress(60);
    const mapping = getAutoDetectedMapping(previewData.headers, logger);
    
    setUploadProgress(80);
    const parsedData = await parseExcelFileWithMapping(file, mapping, logger, specifications);
    
    const analysisData = {
      fileName: file.name,
      headers: previewData.headers,
      totalRows: previewData.totalRows,
      jobs: parsedData.jobs,
      stats: parsedData.stats,
      mapping: mapping,
      debugLog: logger.getDebugInfo(),
      isMatrixMode: false
    };
    
    setUploadProgress(100);
    onDataUploaded(analysisData);
    
    toast({
      title: "Standard Excel Processed",
      description: `Processed ${parsedData.jobs.length} records from ${file.name}`,
    });
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!validateFile(file)) return;

    setCurrentFile(file);
    setIsProcessing(true);
    setUploadProgress(0);
    
    const logger = new ExcelImportDebugger();
    
    try {
      setUploadProgress(20);
      logger.addDebugInfo("Attempting to detect Excel structure type...");
      
      const isMatrixFile = await processMatrixFile(file, logger);
      if (!isMatrixFile) {
        await processStandardFile(file, logger);
      }
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

  const handleMatrixMappingConfirmed = async (mapping: MatrixColumnMapping) => {
    if (!currentFile || !matrixData) return;
    
    setIsProcessing(true);
    setUploadProgress(0);
    
    const logger = new ExcelImportDebugger();
    
    try {
      setUploadProgress(50);
      const parsedData = await parseMatrixExcelFileWithMapping(currentFile, matrixData, mapping, logger, specifications);
      
      const analysisData = {
        fileName: currentFile.name,
        headers: matrixData.headers,
        totalRows: matrixData.rows.length,
        jobs: parsedData.jobs,
        stats: parsedData.stats,
        mapping: mapping,
        debugLog: logger.getDebugInfo(),
        isMatrixMode: true,
        matrixData: matrixData
      };
      
      setUploadProgress(100);
      onDataUploaded(analysisData);
      
      toast({
        title: "Matrix Excel Processed",
        description: `Processed ${parsedData.jobs.length} jobs with ${matrixData.detectedGroups.length} groups`,
      });
      
    } catch (error: any) {
      console.error("Matrix processing error:", error);
      toast({
        title: "Matrix Processing Failed", 
        description: error.message || "Failed to process matrix Excel file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
      setShowMatrixDialog(false);
    }
  };

  return {
    isProcessing,
    uploadProgress,
    showMatrixDialog,
    setShowMatrixDialog,
    matrixData,
    handleFileUpload,
    handleMatrixMappingConfirmed,
  };
};