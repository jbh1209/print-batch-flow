
import { JobDetailsFields } from "./form-fields/JobDetailsFields";
import { QuantityAndDateFields } from "./form-fields/QuantityAndDateFields";
import { FileUploadField } from "./form-fields/FileUploadField";
import { PrintSpecificationSelector } from "@/components/shared/PrintSpecificationSelector";
import { useFormContext } from "react-hook-form";

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
  const { setValue, watch } = useFormContext();
  const formValues = watch();

  const handleSpecificationChange = (category: string, specificationId: string, specification: any) => {
    // Map the specification display name to the form field
    switch (category) {
      case 'size':
        setValue('size', specification.display_name);
        break;
      case 'paper_type':
        setValue('paper_type', specification.display_name);
        break;
      case 'paper_weight':
        setValue('paper_weight', specification.display_name);
        break;
    }
  };

  // Convert form values back to specification selections for the selector
  const selectedSpecifications: Record<string, string> = {};
  // This would need to be populated by looking up specification IDs from display names
  // For now, we'll leave it empty and let the selector handle defaults

  return (
    <div className="space-y-6">
      <JobDetailsFields />
      
      <PrintSpecificationSelector
        productType="flyer"
        onSpecificationChange={handleSpecificationChange}
        selectedSpecifications={selectedSpecifications}
        disabled={false}
      />
      
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
