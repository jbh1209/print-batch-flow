
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';

interface FileUploadSectionRHFProps {
  selectedFile: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  fileInfo: {
    name: string;
    sizeInKB: number;
  } | null;
}

export const FileUploadSectionRHF: React.FC<FileUploadSectionRHFProps> = ({
  selectedFile,
  onFileChange,
  onClearFile,
  fileInfo
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="pdfFile">PDF File *</Label>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
        {!selectedFile ? (
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-2">
              <Label htmlFor="pdfFile" className="cursor-pointer">
                <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  Click to upload PDF
                </span>
                <Input
                  id="pdfFile"
                  type="file"
                  accept="application/pdf"
                  onChange={onFileChange}
                  className="hidden"
                />
              </Label>
            </div>
            <p className="text-xs text-gray-500 mt-1">PDF files only, max 10MB</p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <Upload className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {fileInfo?.name}
                </p>
                <p className="text-xs text-gray-500">
                  {fileInfo?.sizeInKB}KB
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearFile}
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
