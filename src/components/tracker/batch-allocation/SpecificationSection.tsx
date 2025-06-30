
import React from 'react';
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
  return (
    <PrintSpecificationSelector
      productType={batchCategory}
      onSpecificationChange={onSpecificationChange}
      selectedSpecifications={specifications}
      disabled={disabled}
    />
  );
};
