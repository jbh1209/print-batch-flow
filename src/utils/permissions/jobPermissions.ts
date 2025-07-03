/**
 * Job Permission Utilities
 * 
 * Defines who can perform various operations on jobs in the batch flow system.
 * This prevents regression of permissions that restrict access unnecessarily.
 */

import { UserRole } from "@/hooks/tracker/useUserRole";

/**
 * Determines if a user can edit all jobs (not just their own)
 * @param userRole The user's role in the system
 * @returns true if user can edit any job, false if restricted to own jobs
 */
export const canEditAllJobs = (userRole: UserRole): boolean => {
  return userRole === 'admin' || userRole === 'manager' || userRole === 'dtp_operator';
};

/**
 * Determines if a user can delete jobs
 * @param userRole The user's role in the system
 * @returns true if user can delete jobs
 */
export const canDeleteJobs = (userRole: UserRole): boolean => {
  return userRole === 'admin' || userRole === 'manager';
};

/**
 * Determines if a user can create batches
 * @param userRole The user's role in the system
 * @returns true if user can create batches
 */
export const canCreateBatches = (userRole: UserRole): boolean => {
  return userRole === 'admin' || userRole === 'manager' || userRole === 'dtp_operator';
};

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