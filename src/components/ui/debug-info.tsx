
import React from 'react';
import { Card } from './card';

interface DebugInfoProps {
  componentName: string;
  renderCount?: number;
  extraInfo?: Record<string, any>;
  visible?: boolean;
}

export const DebugInfo = ({ 
  componentName, 
  renderCount, 
  extraInfo = {},
  visible = false 
}: DebugInfoProps) => {
  // Only show in development or when explicitly enabled
  if (!visible && process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <Card className="p-2 mt-4 text-xs border-dashed border-gray-300 bg-gray-50">
      <div className="font-mono">
        <div className="font-bold text-gray-600">DEBUG: {componentName}</div>
        {renderCount !== undefined && (
          <div className="text-gray-500">Render count: {renderCount}</div>
        )}
        {Object.entries(extraInfo).map(([key, value]) => (
          <div key={key} className="text-gray-500">
            {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </div>
        ))}
        <div className="text-gray-500">
          Time: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </Card>
  );
};

export default DebugInfo;
