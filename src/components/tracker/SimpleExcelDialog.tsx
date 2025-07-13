import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, AlertTriangle, FileSpreadsheet } from "lucide-react";
import type { ExcelJobPreview, ProcessingResult } from "@/utils/excel/simpleProcessor";

// Simple Badge component for status display
const Badge: React.FC<{ 
  children: React.ReactNode; 
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}> = ({ children, variant = "default", className = "" }) => {
  const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
  const variantClasses = {
    default: "bg-blue-100 text-blue-800",
    secondary: "bg-gray-100 text-gray-800", 
    destructive: "bg-red-100 text-red-800",
    outline: "border border-gray-300 text-gray-700"
  };
  
  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

// Simple Progress component
const Progress: React.FC<{ value: number; className?: string }> = ({ value, className = "" }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
    <div 
      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

interface SimpleExcelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  preview: ExcelJobPreview | null;
  onConfirm: () => Promise<void>;
  isProcessing: boolean;
  result: ProcessingResult | null;
}

export const SimpleExcelDialog: React.FC<SimpleExcelDialogProps> = ({
  isOpen,
  onClose,
  preview,
  onConfirm,
  isProcessing,
  result
}) => {
  const [showErrors, setShowErrors] = useState(false);

  if (!preview) return null;

  const getColumnHeader = (colIndex: number | undefined): string => {
    if (colIndex === undefined || colIndex === -1) return "Not Found";
    return preview.headers[colIndex] || "Unknown";
  };

  const getColumnStatus = (colIndex: number | undefined): "success" | "warning" | "error" => {
    if (colIndex === undefined || colIndex === -1) return "error";
    return "success";
  };

  const renderPreviewPhase = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Excel Import Preview
        </DialogTitle>
        <DialogDescription>
          Review the detected data before importing {preview.totalRows} jobs
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        {/* Column Detection Status */}
        <div>
          <h3 className="font-medium mb-3">Column Detection</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { key: 'wo_no', label: 'Work Order', required: true },
              { key: 'customer', label: 'Customer', required: true },
              { key: 'reference', label: 'Reference', required: false },
              { key: 'qty', label: 'Quantity', required: false },
              { key: 'due_date', label: 'Due Date', required: false },
              { key: 'status', label: 'Status', required: false },
              { key: 'category', label: 'Category', required: false }
            ].map(({ key, label, required }) => {
              const colIndex = preview.detectedColumns[key as keyof typeof preview.detectedColumns];
              const status = getColumnStatus(colIndex);
              
              return (
                <div key={key} className="flex items-center justify-between p-2 border rounded">
                  <span className={required && status === "error" ? "text-red-600 font-medium" : ""}>
                    {label} {required && "*"}
                  </span>
                  <Badge variant={status === "success" ? "default" : status === "error" ? "destructive" : "secondary"}>
                    {getColumnHeader(colIndex)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sample Data Preview */}
        <div>
          <h3 className="font-medium mb-3">Sample Data (First 5 Rows)</h3>
          <div className="border rounded overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>WO Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.sampleRows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 2}</TableCell>
                    <TableCell className="font-mono">
                      {row[preview.detectedColumns.wo_no || -1] || <span className="text-red-500">Missing</span>}
                    </TableCell>
                    <TableCell>
                      {row[preview.detectedColumns.customer || -1] || <span className="text-red-500">Missing</span>}
                    </TableCell>
                    <TableCell>
                      {row[preview.detectedColumns.reference || -1] || "-"}
                    </TableCell>
                    <TableCell>
                      {row[preview.detectedColumns.qty || -1] || "0"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={isProcessing}>
          {isProcessing ? "Processing..." : `Import ${preview.totalRows} Jobs`}
        </Button>
      </DialogFooter>
    </>
  );

  const renderProcessingPhase = () => (
    <>
      <DialogHeader>
        <DialogTitle>Processing Jobs...</DialogTitle>
        <DialogDescription>
          Creating jobs and setting up production workflows
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Progress value={50} className="w-full" />
        <p className="text-sm text-center text-muted-foreground">
          Processing {preview.totalRows} jobs...
        </p>
      </div>
    </>
  );

  const renderResultPhase = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {result!.failed === 0 ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          )}
          Import Complete
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 border rounded">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Successful</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{result!.successful}</div>
          </div>
          <div className="text-center p-4 border rounded">
            <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Failed</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{result!.failed}</div>
          </div>
        </div>

        {result!.errors.length > 0 && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowErrors(!showErrors)}
              className="mb-2"
            >
              {showErrors ? "Hide" : "Show"} Error Details ({result!.errors.length})
            </Button>
            
            {showErrors && (
              <div className="max-h-40 overflow-y-auto border rounded p-3 bg-red-50">
                {result!.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-700 mb-1">
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result!.jobsCreated.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Jobs Created:</h4>
            <div className="flex flex-wrap gap-1">
              {result!.jobsCreated.slice(0, 10).map((woNo) => (
                <Badge key={woNo} variant="secondary" className="text-xs">
                  {woNo}
                </Badge>
              ))}
              {result!.jobsCreated.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{result!.jobsCreated.length - 10} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        {result ? renderResultPhase() : isProcessing ? renderProcessingPhase() : renderPreviewPhase()}
      </DialogContent>
    </Dialog>
  );
};