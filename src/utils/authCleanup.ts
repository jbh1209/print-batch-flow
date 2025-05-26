
export const cleanupAuthState = () => {
  // Remove standard auth tokens
  try {
    localStorage.removeItem('supabase.auth.token');
    
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Remove from sessionStorage if in use
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
    
    console.log("Auth state cleaned up");
  } catch (error) {
    console.error("Error cleaning up auth state:", error);
  }
};

export const handleAuthError = async () => {
  console.log("Handling auth error - cleaning up and redirecting");
  cleanupAuthState();
  
  // Force page reload to auth
  window.location.href = '/auth';
};
