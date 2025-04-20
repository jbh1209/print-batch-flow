
import { JobDetailsFields } from "./form-sections/JobDetailsFields";
import { PrintSpecsFields } from "./form-sections/PrintSpecsFields";
import { QuantityDateFields } from "./form-sections/QuantityDateFields";
import { FileUploadField } from "./form-sections/FileUploadField";

interface PostcardJobFormFieldsProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}

export const PostcardJobFormFields = ({ 
  selectedFile, 
  setSelectedFile, 
  handleFileChange,
  isEdit = false
}: PostcardJobFormFieldsProps) => {
  return (
    <>
      <JobDetailsFields />
      <PrintSpecsFields />
      <QuantityDateFields />
      <FileUploadField 
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        handleFileChange={handleFileChange}
        isEdit={isEdit}
      />
    </>
  );
};
