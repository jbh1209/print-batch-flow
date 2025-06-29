
import React from 'react';
import { BusinessCardPrintSpecificationSelector } from '@/components/business-cards/BusinessCardPrintSpecificationSelector';
import { PrintSpecificationSelector } from '@/components/shared/PrintSpecificationSelector';

interface SpecificationSectionProps {
  batchCategory: string;
  specifications: Record<string, any>;
  onSpecificationChange: (category: string, specificationId: string, specification: any) => void;
  disabled: boolean;
}

export const SpecificationSection: React.FC<SpecificationSectionProps> = ({
  batchCategory,
  specifications,
  onSpecificationChange,
  disabled
}) => {
  if (batchCategory === 'business_cards') {
    return (
      <BusinessCardPrintSpecificationSelector
        onSpecificationChange={onSpecificationChange}
        selectedSpecifications={specifications}
        disabled={disabled}
      />
    );
  }

  // For other categories, use the generic print specification selector
  return (
    <PrintSpecificationSelector
      productType={batchCategory}
      onSpecificationChange={onSpecificationChange}
      selectedSpecifications={specifications}
      disabled={disabled}
    />
  );
};
