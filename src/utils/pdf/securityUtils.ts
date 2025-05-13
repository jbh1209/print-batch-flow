
/**
 * Security utilities for PDF operations
 */

import { isPreviewMode } from '@/services/previewService';

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
