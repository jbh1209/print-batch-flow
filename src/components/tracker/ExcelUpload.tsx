import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { 
  ExcelImportDebugger, 
  EnhancedExcelParser, 
  EnhancedJobCreator,
  type EnhancedJobCreationResult
} from "@/utils/excel";

const ExcelUpload = () => {
  const { user } = useAuth();
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<EnhancedJobCreationResult | null>(null);
  const [isCreatingJobs, setIsCreatingJobs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logger = useRef<ExcelImportDebugger>({
    addDebugInfo: (msg: string) => {
      console.log("[ExcelUpload Debug]", msg);
    }
  });

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    const file = files[0];
    setFileName(file.name);
    setIsParsing(true);
    setParseResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      logger.current.addDebugInfo(`Loaded sheet: ${sheetName} with ${jsonData.length} rows`);

      // Parse the Excel data using EnhancedExcelParser
      const parser = new EnhancedExcelParser(logger.current);
      await parser.initialize();

      const parsedJobs = parser.parseExcelData(jsonData);

      logger.current.addDebugInfo(`Parsed ${parsedJobs.length} jobs from Excel`);

      // Prepare jobs with EnhancedJobCreator
      const jobCreator = new EnhancedJobCreator(logger.current, user?.id || 'unknown', true);
      await jobCreator.initialize();

      const preparationResult = await jobCreator.prepareEnhancedJobsWithExcelData(
        parsedJobs,
        jsonData[0] as string[],
        jsonData
      );

      setParseResult(preparationResult);
      toast.success(`Successfully parsed ${preparationResult.preparedJobs.length} jobs`);
    } catch (error) {
      logger.current.addDebugInfo(`Error parsing Excel file: ${error}`);
      toast.error("Failed to parse Excel file");
    } finally {
      setIsParsing(false);
    }
  }, [user]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCreateJobs = async () => {
    if (!parseResult) return;

    setIsCreatingJobs(true);
    try {
      const jobCreator = new EnhancedJobCreator(logger.current, user?.id || 'unknown', true);
      await jobCreator.initialize();

      const creationResult = await jobCreator.createEnhancedJobsWithExcelData(
        parseResult.preparedJobs,
        parseResult.headers || [],
        parseResult.excelRows || []
      );

      toast.success(`Created ${creationResult.createdJobs.length} jobs successfully`);
      setParseResult(null);
      setFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      logger.current.addDebugInfo(`Error creating jobs: ${error}`);
      toast.error("Failed to create jobs");
    } finally {
      setIsCreatingJobs(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Excel File</CardTitle>
          <CardDescription>Import production jobs from Excel files</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleUploadClick} disabled={isParsing || isCreatingJobs} variant="outline" size="sm" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {fileName ? `Change File (${fileName})` : "Select Excel File"}
            </Button>
            {isParsing && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <FileSpreadsheet className="w-4 h-4 animate-spin" />
                Parsing...
              </Badge>
            )}
            {parseResult && (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Ready to Create {parseResult.preparedJobs.length} Jobs
              </Badge>
            )}
          </div>

          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {parseResult && (
            <>
              <Separator className="my-4" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Parsed Jobs Summary</h3>
                <ScrollArea className="max-h-64 border rounded p-2">
                  {parseResult.preparedJobs.length === 0 ? (
                    <p>No jobs parsed.</p>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="border p-1 text-left">WO Number</th>
                          <th className="border p-1 text-left">Customer</th>
                          <th className="border p-1 text-left">Reference</th>
                          <th className="border p-1 text-left">Quantity</th>
                          <th className="border p-1 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.preparedJobs.map((job, idx) => (
                          <tr key={idx} className="odd:bg-gray-50">
                            <td className="border p-1">{job.wo_number}</td>
                            <td className="border p-1">{job.customer}</td>
                            <td className="border p-1">{job.reference}</td>
                            <td className="border p-1">{job.quantity}</td>
                            <td className="border p-1">{job.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleCreateJobs}
                  disabled={isCreatingJobs || parseResult.preparedJobs.length === 0}
                >
                  {isCreatingJobs ? "Creating Jobs..." : `Create ${parseResult.preparedJobs.length} Jobs`}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export { ExcelUpload };
export default ExcelUpload;
