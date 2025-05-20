
import { useFormContext } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import FileUpload from "@/components/business-cards/FileUpload";

interface FileUploadFieldProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}

export const FileUploadField = ({
  selectedFile,
  setSelectedFile,
  handleFileChange,
  isEdit = false
}: FileUploadFieldProps) => {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="file"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Upload PDF{isEdit ? '' : '*'}</FormLabel>
          <FormControl>
            <FileUpload
              control={control}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              handleFileChange={handleFileChange}
              isRequired={!isEdit}
              helpText={isEdit 
                ? "Upload a new PDF file to replace the current one (Optional)" 
                : "Upload a PDF file of your flyer design (Max: 10MB)"}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
