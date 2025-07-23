import React, { useState } from "react";
import { EnhancedJobCreationDialog } from "./jobs/EnhancedJobCreationDialog";
import JobPartAssignmentManager from "@/components/jobs/JobPartAssignmentManager";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ExcelUpload = () => {
  const [showEnhancedDialog, setShowEnhancedDialog] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [showPartAssignment, setShowPartAssignment] = useState(false);
  const [partAssignmentJobIds, setPartAssignmentJobIds] = useState<string[]>([]);
  const [selectedTableName, setSelectedTableName] = useState<string>('production_jobs');
  const [file, setFile] = useState<File | null>(null);

  const handleEnhancedJobsConfirmed = async (createdJobIds: string[]) => {
    console.log('Jobs created successfully:', createdJobIds);
    setShowEnhancedDialog(false);
    
    // Auto-open part assignment modal after successful job creation
    if (createdJobIds.length > 0) {
      setPartAssignmentJobIds(createdJobIds);
      setShowPartAssignment(true);
    }
  };

  const handleOpenPartAssignment = () => {
    setShowPartAssignment(true);
  };

  const handleClosePartAssignment = () => {
    setShowPartAssignment(false);
    setPartAssignmentJobIds([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleParseExcel = () => {
    if (!file) {
      toast.error("Please upload an Excel file first.");
      return;
    }

    const reader = new FileReader();

    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Extract headers from the first row
      const headers = jsonData[0] as string[];

      // Convert the remaining rows to objects
      const rowObjects = jsonData.slice(1).map(row => {
        const rowObject: { [key: string]: any } = {};
        (row as any[]).forEach((cell, index) => {
          rowObject[headers[index]] = cell;
        });
        return rowObject;
      });

      setExcelData(rowObjects);
      setShowEnhancedDialog(true);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Input
          type="file"
          id="excel-upload"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <label
          htmlFor="excel-upload"
          className="bg-white text-gray-700 hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700 rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center"
        >
          Upload Excel File
        </label>
        <Button onClick={handleParseExcel} disabled={!file}>
          Process Excel Data
        </Button>
      </div>

      {excelData.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableCaption>Preview of uploaded data</TableCaption>
            <TableHeader>
              <TableRow>
                {Object.keys(excelData[0]).map((header, index) => (
                  <TableHead key={index}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {excelData.map((row, index) => (
                <TableRow key={index}>
                  {Object.values(row).map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      <EnhancedJobCreationDialog
        isOpen={showEnhancedDialog}
        onClose={() => setShowEnhancedDialog(false)}
        excelData={excelData}
        onJobsConfirmed={handleEnhancedJobsConfirmed}
        tableName={selectedTableName}
      />

      {/* Part Assignment Modal - shown after successful job creation */}
      {showPartAssignment && partAssignmentJobIds.length > 0 && (
        <JobPartAssignmentManager
          jobId={partAssignmentJobIds[0]} // Use first job ID for now
          jobTableName={selectedTableName}
          open={showPartAssignment}
          onClose={handleClosePartAssignment}
        />
      )}
    </div>
  );
};

export default ExcelUpload;
