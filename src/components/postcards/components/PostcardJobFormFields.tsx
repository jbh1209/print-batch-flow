
import { JobDetailsFields } from "./form-fields/JobDetailsFields";
import { PrintSpecsFields } from "./form-fields/PrintSpecsFields";
import { QuantityAndDateFields } from "./form-fields/QuantityAndDateFields";
import { FileUploadField } from "./form-fields/FileUploadField";

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
  isEdit = false,
}: PostcardJobFormFieldsProps) => {
  return (
    <>
      <JobDetailsFields />
      <PrintSpecsFields />
      <QuantityAndDateFields />
      <FileUploadField
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        handleFileChange={handleFileChange}
        isEdit={isEdit}
      />
    </>
  );
};
