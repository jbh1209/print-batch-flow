
import React from 'react';
import { BusinessCardPrintSpecificationSelector } from '@/components/business-cards/BusinessCardPrintSpecificationSelector';

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

  // Add other category handlers as needed
  return null;
};
