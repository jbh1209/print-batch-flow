/**
 * Job Permission Utilities
 * 
 * Standardized permissions for all batch flow job types.
 * Ensures consistent access patterns across business cards, flyers, postcards, etc.
 * 
 * IMPORTANT: All batch flow job types should use the same permission model:
 * - Authenticated users can view all jobs
 * - All operations are handled by RLS policies in the database
 * - No client-side user filtering should be applied in hooks
 */

import { UserRole } from "@/hooks/tracker/useUserRole";

/**
 * Determines if a user can edit all jobs (not just their own)
 * @param userRole The user's role in the system
 * @returns true if user can edit any job, false if restricted to own jobs
 */
export const canEditAllJobs = (userRole: UserRole): boolean => {
  return userRole === 'admin' || userRole === 'sys_dev' || userRole === 'manager' || userRole === 'dtp_operator';
};

/**
 * Determines if a user can delete jobs
 * @param userRole The user's role in the system
 * @returns true if user can delete jobs
 */
export const canDeleteJobs = (userRole: UserRole): boolean => {
  return userRole === 'admin' || userRole === 'sys_dev' || userRole === 'manager';
};

/**
 * Determines if a user can create batches
 * @param userRole The user's role in the system
 * @returns true if user can create batches
 */
export const canCreateBatches = (userRole: UserRole): boolean => {
  return userRole === 'admin' || userRole === 'sys_dev' || userRole === 'manager' || userRole === 'dtp_operator';
};

/**
 * SIMPLIFIED APPROACH FOR BATCH FLOW:
 * All job hooks should follow this pattern for consistency:
 * 
 * 1. Remove user_id filtering from SELECT queries (let users see all jobs)
 * 2. Remove user_id filtering from UPDATE queries (rely on RLS policies)
 * 3. Remove user_id filtering from DELETE queries (rely on RLS policies)
 * 4. Use .maybeSingle() instead of .single() for better error handling
 * 5. Trust the database RLS policies to handle access control
 * 
 * This ensures all job types work consistently and avoids client-side permission conflicts.
 */

/**
 * Batch Flow Permissions Matrix:
 * 
 * | Role         | View All Jobs | Edit All Jobs | Delete Jobs | Create Batches |
 * |--------------|---------------|---------------|-------------|----------------|
 * | admin        | ✓             | ✓             | ✓           | ✓              |
 * | manager      | ✓             | ✓             | ✓           | ✓              |
 * | dtp_operator | ✓             | ✓             | ✗           | ✓              |
 * | operator     | ✓             | ✗             | ✗           | ✗              |
 * | user         | Own Only      | Own Only      | ✗           | ✗              |
 * 
 * This matrix ensures that the batch flow system works correctly for production
 * users while maintaining security for regular customers.
 */