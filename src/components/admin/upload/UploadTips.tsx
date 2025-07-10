import React from "react";
import { AlertCircle } from "lucide-react";

export const UploadTips: React.FC = () => {
  return (
    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
      <div className="text-sm">
        <p className="font-medium text-blue-900 dark:text-blue-100">Upload Tips:</p>
        <ul className="text-blue-800 dark:text-blue-200 mt-1 space-y-1 text-xs">
          <li>• Upload files with 18+ months of historical work order data</li>
          <li>• Larger datasets provide better mapping accuracy</li>
          <li>• Matrix/pivot table formats are automatically detected</li>
          <li>• Files up to 50MB are supported</li>
        </ul>
      </div>
    </div>
  );
};