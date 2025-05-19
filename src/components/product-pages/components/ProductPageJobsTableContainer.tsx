
import React from 'react';

interface ProductPageJobsTableContainerProps {
  children: React.ReactNode;
}

export function ProductPageJobsTableContainer({ children }: ProductPageJobsTableContainerProps) {
  return <div className="relative overflow-x-auto">{children}</div>;
}
