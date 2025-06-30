
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { PrintSpecificationSelector } from '@/components/shared/PrintSpecificationSelector';

interface SpecificationSectionRHFProps {
  batchCategory: string;
  disabled: boolean;
}

export const SpecificationSectionRHF: React.FC<SpecificationSectionRHFProps> = ({
  batchCategory,
  disabled
}) => {
  const { setValue, watch } = useFormContext();
  const formValues = watch();

  const handleSpecificationChange = (category: string, specificationId: string, specification: any) => {
    // Update form field with the specification display name
    setValue(category, specification.display_name);
  };

  // Convert form values back to specification selections for the selector
  const selectedSpecifications: Record<string, string> = {};
  // This could be expanded in the future to track specification IDs if needed

  return (
    <PrintSpecificationSelector
      productType={batchCategory}
      onSpecificationChange={handleSpecificationChange}
      selectedSpecifications={selectedSpecifications}
      disabled={disabled}
    />
  );
};
