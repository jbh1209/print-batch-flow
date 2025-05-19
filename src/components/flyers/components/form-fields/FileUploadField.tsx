import React from 'react';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export interface FileUploadFieldProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean; // Make this optional with a ? mark
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  selectedFile,
  setSelectedFile,
  handleFileChange,
  required
}) => {
  return (
    <FormField
      name="file"
      render={() => (
        <FormItem>
          <FormLabel>
            PDF Upload {required ? '*' : ''}
          </FormLabel>
          <FormControl>
            <Input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
            />
          </FormControl>
          <FormDescription>
            Upload a PDF file.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
