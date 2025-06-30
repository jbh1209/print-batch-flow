
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { BusinessCardPrintSpecificationSelector } from '@/components/business-cards/BusinessCardPrintSpecificationSelector';
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
    // Map the specification display name to the form field
    const fieldMapping: Record<string, string> = {
      'paper_type': 'paper_type',
      'lamination_type': 'lamination_type',
      'paper_weight': 'paper_weight',
      'size': 'size',
      'sides': 'sides',
      'uv_varnish': 'uv_varnish',
      'single_sided': 'single_sided',
      'double_sided': 'double_sided'
    };

    const fieldName = fieldMapping[category] || category;
    const value = specification.display_name || specification;
    
    setValue(fieldName, value);
  };

  // Convert form values back to specification selections for the selector
  const selectedSpecifications: Record<string, string> = {
    paperType: formValues.paper_type || '',
    laminationType: formValues.lamination_type || '',
    paperWeight: formValues.paper_weight || '',
    size: formValues.size || '',
    sides: formValues.sides || '',
    uvVarnish: formValues.uv_varnish || '',
    singleSided: formValues.single_sided || false,
    doubleSided: formValues.double_sided || false
  };

  if (batchCategory === 'business_cards') {
    return (
      <BusinessCardPrintSpecificationSelector
        onSpecificationChange={handleSpecificationChange}
        selectedSpecifications={selectedSpecifications}
        disabled={disabled}
      />
    );
  }

  // For other categories, use the generic print specification selector
  return (
    <PrintSpecificationSelector
      productType={batchCategory}
      onSpecificationChange={handleSpecificationChange}
      selectedSpecifications={selectedSpecifications}
      disabled={disabled}
    />
  );
};
