
import React from 'react';

interface DebugInfoProps {
  componentName: string;
  extraInfo?: Record<string, any>;
  visible?: boolean;
}

/**
 * Simplified component to display debugging information
 */
export const DebugInfo: React.FC<DebugInfoProps> = ({ 
  componentName, 
  extraInfo = {}, 
  visible = true 
}) => {
  // Only show in development environment
  if (!visible || process.env.NODE_ENV === 'production') {
    return null;
  }
  
  return (
    <div className="text-xs bg-gray-100 p-2 rounded border border-dashed border-gray-300 mb-2">
      <div className="font-medium">{componentName}</div>
      <div className="mt-1 text-gray-500">
        {Object.entries(extraInfo).map(([key, value]) => (
          <div key={key} className="flex">
            <span className="font-mono mr-1">{key}:</span>
            <span>{JSON.stringify(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
