
import React from 'react';

interface StickyProductionLayoutProps {
  stickyHeader: React.ReactNode;
  scrollableContent: React.ReactNode;
}

export const StickyProductionLayout: React.FC<StickyProductionLayoutProps> = ({
  stickyHeader,
  scrollableContent,
}) => {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        {stickyHeader}
      </div>
      
      {/* Scrollable Content Section */}
      <div className="flex-1 overflow-y-auto">
        {scrollableContent}
      </div>
    </div>
  );
};
