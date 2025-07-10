import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet } from "lucide-react";

interface FileDropZoneProps {
  isProcessing: boolean;
  uploadProgress: number;
  onFileUpload: (files: FileList | null) => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  isProcessing,
  uploadProgress,
  onFileUpload,
}) => {
  const [isDragging, setIsDragging] = useState(false);

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
    onFileUpload(e.dataTransfer.files);
  };

  return (
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
                onChange={(e) => onFileUpload(e.target.files)}
                className="hidden"
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};