
export const handleDatabaseError = (error: any): string => {
  console.error("❌ Database function error:", error);
  
  // Handle specific error types
  if (error.message?.includes('structure of query does not match function result type')) {
    return 'Database function signature mismatch. Please contact support.';
  } else if (error.message?.includes('permission denied')) {
    return 'Access denied. Please check your permissions.';
  } else {
    return `Failed to fetch accessible jobs: ${error.message}`;
  }
};
