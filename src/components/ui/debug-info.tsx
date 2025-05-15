
import React from 'react';
import { clearAppCache } from '@/utils/cacheUtils';

interface DebugInfoProps {
  componentName: string;
  extraInfo?: Record<string, any>;
  visible?: boolean;
}

/**
 * Component to display debugging information and provide cache-busting functionality
 */
export const DebugInfo: React.FC<DebugInfoProps> = ({ 
  componentName, 
  extraInfo = {}, 
  visible = true 
}) => {
  if (!visible && process.env.NODE_ENV === 'production') {
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
      <div className="mt-1 flex gap-1">
        <button 
          className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 rounded"
          onClick={() => {
            clearAppCache();
            window.location.reload();
          }}
        >
          Clear Cache & Reload
        </button>
      </div>
    </div>
  );
};
