
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileCheck } from "lucide-react";
import { Control } from "react-hook-form";
import { useFileUpload } from "@/hooks/useFileUpload";

interface FileUploadProps {
  control: Control<any>;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
}

const FileUpload = ({ control, selectedFile, setSelectedFile }: FileUploadProps) => {
  const { handleFileChange } = useFileUpload({
    acceptedTypes: ["application/pdf"],
    maxSizeInMB: 10,
    onFileSelected: (file) => setSelectedFile(file)
  });

  return (
    <FormField
      control={control}
      name="file"
      render={({ field: { value, onChange, ...fieldProps } }) => (
        <FormItem>
          <FormLabel>Upload PDF</FormLabel>
          <div className="flex items-center gap-3">
            <Input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange} 
              className="hidden"
              id="pdf-upload"
              {...fieldProps}
            />
            <Button 
              type="button" 
              variant="outline" 
              className="w-full border-dashed border-2 p-6 h-auto flex flex-col items-center gap-2"
              onClick={() => document.getElementById('pdf-upload')?.click()}
            >
              {selectedFile ? (
                <>
                  <FileCheck size={24} className="text-green-600" />
                  <div>
                    <span className="font-medium text-green-600">{selectedFile.name}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    PDF file selected ({Math.round(selectedFile.size / 1024)} KB)
                  </div>
                </>
              ) : (
                <>
                  <Upload size={24} />
                  <div>
                    <span>Click to upload PDF file</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    PDF file only, max 10MB
                  </div>
                </>
              )}
            </Button>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default FileUpload;
