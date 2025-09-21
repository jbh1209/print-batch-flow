import React from "react";
import { Badge } from "@/components/ui/badge";
import { FileText, Layers, Monitor } from "lucide-react";

interface PrintSpecsBadgeProps {
  printSpecs?: string;
  paperSpecs?: string;
  sheetSize?: string;
  size?: 'compact' | 'normal';
}

export const PrintSpecsBadge: React.FC<PrintSpecsBadgeProps> = ({
  printSpecs,
  paperSpecs,
  sheetSize,
  size = 'normal'
}) => {
  const isCompact = size === 'compact';
  const badgeSize = isCompact ? 'text-xs px-2 py-0' : 'text-sm px-2 py-1';
  const iconSize = isCompact ? 'h-3 w-3' : 'h-4 w-4';

  if (!printSpecs && !paperSpecs && !sheetSize) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {printSpecs && (
        <Badge 
          variant="outline" 
          className={`${badgeSize} bg-blue-50 text-blue-700 border-blue-200`}
        >
          <FileText className={`${iconSize} mr-1`} />
          {printSpecs}
        </Badge>
      )}
      
      {paperSpecs && (
        <Badge 
          variant="outline" 
          className={`${badgeSize} bg-green-50 text-green-700 border-green-200`}
        >
          <Layers className={`${iconSize} mr-1`} />
          {paperSpecs}
        </Badge>
      )}
      
      {sheetSize && (
        <Badge 
          variant="outline" 
          className={`${badgeSize} bg-purple-50 text-purple-700 border-purple-200`}
        >
          <Monitor className={`${iconSize} mr-1`} />
          {sheetSize}
        </Badge>
      )}
    </div>
  );
};