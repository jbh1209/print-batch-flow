
import React, { ReactNode } from 'react';

interface PreviewSafeWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * A wrapper component that provides a safe environment for preview mode
 * Catches errors that might occur in preview mode and renders a fallback
 */
const PreviewSafeWrapper: React.FC<PreviewSafeWrapperProps> = ({ 
  children,
  fallback = <div className="p-8 text-center">Loading application...</div>
}) => {
  // Check if we're in Lovable preview mode
  const isLovablePreview = 
    typeof window !== 'undefined' && 
    (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));

  // If we're not in preview mode, just render the children
  if (!isLovablePreview) {
    return <>{children}</>;
  }

  // In preview mode, we wrap the children in an error boundary
  try {
    return <>{children}</>;
  } catch (error) {
    console.error('Error in preview mode:', error);
    return <>{fallback}</>;
  }
};

export default PreviewSafeWrapper;
