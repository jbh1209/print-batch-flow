
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { PrintSpecificationSelector } from '@/components/shared/PrintSpecificationSelector';

interface SpecificationSectionRHFProps {
  batchCategory: string;
  disabled: boolean;
  onSpecificationChange?: (category: string, specificationId: string, specification: any) => void;
}

export const SpecificationSectionRHF: React.FC<SpecificationSectionRHFProps> = ({
  batchCategory,
  disabled,
  onSpecificationChange
}) => {
  const { setValue, watch } = useFormContext();
  const formValues = watch();

  const handleSpecificationChange = (category: string, specificationId: string, specification: any) => {
    // Update form field with the specification display name for display purposes
    setValue(category, specification.display_name);
    
    // Notify parent component with full specification data
    onSpecificationChange?.(category, specificationId, specification);
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
