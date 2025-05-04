
import React from 'react';

interface BatchListHeaderProps {
  title: string;
  productType: string;
}

export const BatchListHeader: React.FC<BatchListHeaderProps> = ({ title, productType }) => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{title} Batches</h1>
    </div>
  );
};
