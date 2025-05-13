
/**
 * Security utilities for PDF operations
 */

import { isPreviewMode } from '@/services/previewService';
import { getSignedUrl } from './urlUtils';
import { sanitizeFileName } from './securityUtils';

// Get secure current user
export const getSecureCurrentUser = () => {
  // In preview mode, return a secure mock user id
  if (isPreviewMode()) {
    return 'preview-user-id';
  }
  
  // In production, should be retrieved from secure context
  // For now, falls back to empty string
  return '';
};

// Sanitize file name for security
export const sanitizeFileName = (fileName: string): string => {
  if (!fileName) return 'file';
  
  // Remove path traversal attempts and dangerous characters
  return fileName
    .replace(/\.\./g, '')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .substring(0, 255); // Limit length
};

// Validate if a PDF access is allowed
export const validatePdfAccess = (pdfId: string, userId: string): boolean => {
  if (isPreviewMode()) {
    return true;
  }
  
  // TODO: Implement proper PDF access validation
  return !!userId;
};

/**
 * Securely get a PDF URL with proper validation and signing
 */
export const secureGetPdfUrl = async (
  url: string | null,
  userId?: string
): Promise<string | null> => {
  if (!url) return null;
  
  // Validate access
  if (userId && !validatePdfAccess(url, userId)) {
    console.error('Access denied to PDF');
    return null;
  }
  
  try {
    // Get a signed URL for secure access
    return await getSignedUrl(url);
  } catch (error) {
    console.error('Error securing PDF URL:', error);
    return null;
  }
};

/**
 * Log PDF access for audit purposes
 */
export const logPdfAccess = (url: string, action: 'view' | 'download'): void => {
  // In a production environment, this would log to a secure audit log
  console.log(`PDF ${action} access: ${url.substring(0, 20)}... at ${new Date().toISOString()}`);
};

