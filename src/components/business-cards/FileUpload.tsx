
import { Controller } from "react-hook-form";
import { Control } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileCheck, X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFileUpload } from "@/hooks/useFileUpload";

interface FileUploadProps {
  control: Control<any>;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isRequired?: boolean;
  helpText?: string;
}

const FileUpload = ({ 
  control, 
  selectedFile, 
  setSelectedFile, 
  handleFileChange,
  isRequired = true,
  helpText = "Upload a PDF file with your design",
}: FileUploadProps) => {
  const fileInputHandler = handleFileChange || useFileUpload().handleFileChange;
  
  const fileSize = selectedFile ? `${(selectedFile.size / 1024).toFixed(2)} KB` : '';

  return (
    <FormField
      control={control}
      name="file"
      render={({ field: { onChange, value, ...field }, fieldState }) => (
        <FormItem>
          <FormLabel>PDF File {isRequired && <span className="text-red-500">*</span>}</FormLabel>
          <FormControl>
            <div className="space-y-4">
              {!selectedFile ? (
                <>
                  <div className="relative">
                    <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="p-6 flex flex-col items-center justify-center gap-4">
                        <UploadCloud className="h-10 w-10 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-sm font-medium mb-1">
                            Drag and drop your PDF file here,<br /> or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Only PDF files are accepted. Max file size: 10MB
                          </p>
                        </div>
                        <input 
                          id="file-upload"
                          type="file" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          accept="application/pdf"
                          onChange={(e) => {
                            fileInputHandler(e);
                            // This triggers react-hook-form validation
                            if (e.target.files?.[0]) {
                              onChange(e.target.files[0]);
                            }
                          }}
                          {...field}
                        />
                      </CardContent>
                    </Card>
                  </div>
                  
                  {fieldState.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{fieldState.error.message}</AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="flex items-stretch overflow-hidden border rounded-md">
                  <div className="bg-muted p-2 flex items-center justify-center">
                    <FileCheck className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-grow p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium truncate max-w-xs">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{fileSize}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        onChange(null);
                      }}
                    >
                      <X size={18} />
                      <span className="sr-only">Remove file</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </FormControl>
          <FormDescription>
            {helpText}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default FileUpload;
