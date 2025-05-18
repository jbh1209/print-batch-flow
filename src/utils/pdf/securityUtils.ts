
/**
 * PDF Security Utilities
 * 
 * Provides enhanced security for PDF operations with robust error handling, 
 * permission validation, and proper audit logging.
 */
import { toast } from "sonner";
import { getSignedUrl } from "./urlUtils";
import { getSecureCurrentUser } from "@/services/security/securityService";
import { isPreviewMode } from "@/services/previewService";

/**
 * Securely validate if user has permission to access the requested PDF
 */
export async function validatePdfAccess(
  pdfUrl: string | null, 
  jobUserId?: string
): Promise<boolean> {
  // In preview mode, always grant access
  if (isPreviewMode()) {
    console.log("Preview mode detected, allowing PDF access");
    return true;
  }
  
  if (!pdfUrl) {
    return false;
  }
  
  try {
    // Get current authenticated user
    const currentUser = await getSecureCurrentUser();
    
    if (!currentUser) {
      console.error("No authenticated user found for PDF access");
      return false;
    }
    
    // Admin users always have access
    if (currentUser.isAdmin) {
      console.log("Admin access granted for PDF");
      return true;
    }
    
    // Check if user is accessing their own PDF
    if (jobUserId && currentUser.id === jobUserId) {
      console.log("User accessing their own PDF");
      return true;
    }
    
    // Use URL pattern matching as additional verification
    // Example: If URLs contain user IDs in the path
    if (pdfUrl.includes(`/${currentUser.id}/`)) {
      return true;
    }
    
    // If we can't verify access, deny by default (principle of least privilege)
    console.warn("User lacks permission to access PDF:", pdfUrl);
    return false;
  } catch (error) {
    console.error("Error validating PDF access:", error);
    return false;
  }
}

/**
 * Securely handle PDF retrieval with permission validation
 */
export async function secureGetPdfUrl(
  url: string | null, 
  jobUserId?: string
): Promise<string | null> {
  if (!url) {
    return null;
  }
  
  try {
    // Validate user access first
    const hasAccess = await validatePdfAccess(url, jobUserId);
    
    if (!hasAccess) {
      toast.error("You don't have permission to access this PDF");
      return null;
    }
    
    // Generate signed URL with short expiration
    const signedUrl = await getSignedUrl(url, 900); // 15 minutes
    
    if (!signedUrl) {
      throw new Error("Failed to generate secure access URL");
    }
    
    return signedUrl;
  } catch (error) {
    console.error("Security error retrieving PDF URL:", error);
    toast.error("Error accessing the document");
    return null;
  }
}

/**
 * Security audit log for PDF operations
 */
export function logPdfAccess(url: string | null, actionType: 'view' | 'download'): void {
  try {
    if (!url) return;
    
    // Extract information about the PDF without exposing the full URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1] || 'unknown';
    
    // Log the access event
    console.log(`PDF ${actionType} access: ${fileName}`);
    
    // In a production environment, you could log this to a security audit table
  } catch (error) {
    console.error("Error logging PDF access:", error);
  }
}
