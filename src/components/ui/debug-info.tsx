
import React from 'react';

interface DebugInfoProps {
  componentName: string;
  extraInfo?: Record<string, any>;
  visible?: boolean;
}

/**
 * Debug information component that shows component state and rendering info
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
    <div className="text-xs bg-slate-800 text-white p-2 rounded border border-dashed border-slate-600 mb-2 font-mono">
      <div className="font-medium">{componentName}</div>
      <div className="mt-1 text-slate-300 text-[10px]">
        {Object.entries(extraInfo).map(([key, value]) => (
          <div key={key} className="flex">
            <span className="mr-1 text-slate-400">{key}:</span>
            <span>{typeof value === 'object' ? JSON.stringify(value) : value.toString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
