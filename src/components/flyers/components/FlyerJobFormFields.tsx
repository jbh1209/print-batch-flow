
import { JobDetailsFields } from "./form-fields/JobDetailsFields";
import { PrintSpecificationsFields } from "./form-fields/PrintSpecificationsFields";
import { QuantityAndDateFields } from "./form-fields/QuantityAndDateFields";
import { FileUploadField } from "./form-fields/FileUploadField";

interface FlyerJobFormFieldsProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}

export const FlyerJobFormFields = ({ 
  selectedFile, 
  setSelectedFile, 
  handleFileChange,
  isEdit = false
}: FlyerJobFormFieldsProps) => {
  return (
    <div className="space-y-6">
      <JobDetailsFields />
      <PrintSpecificationsFields />
      <QuantityAndDateFields />
      <FileUploadField 
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        handleFileChange={handleFileChange}
        isEdit={isEdit}
      />
    </div>
  );
};
