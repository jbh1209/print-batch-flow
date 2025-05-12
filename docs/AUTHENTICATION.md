
# Authentication Security Guide

## Overview
This document outlines the authentication and authorization implementation in our application, including important security practices and troubleshooting steps.

## Important Security Updates
Recent updates to Supabase (v2.49.x) and PostgreSQL (15.8) have introduced stricter Row Level Security (RLS) policy enforcement. Our app implements multiple strategies to ensure authentication and authorization remain robust.

## Authentication Flow

### Sign Up
1. User enters email, password, and optional profile details
2. We call `supabase.auth.signUp()` with proper error handling
3. If email confirmation is enabled, user must verify email
4. Upon verification, user profile is automatically created via database trigger

### Sign In
1. User enters email and password
2. Auth state is cleaned up to prevent conflicts
3. We call `supabase.auth.signInWithPassword()`
4. Auth state listener is triggered, updating application state
5. User profile and role information is loaded

### Sign Out
1. Auth state is cleaned up from local storage
2. `supabase.auth.signOut()` is called with `scope: 'global'`
3. Application state is cleared
4. User is redirected to login page

## Security Best Practices

### Auth State Cleanup
We implement thorough auth state cleanup to prevent "limbo" states:
```typescript
cleanupAuthState = () => {
  // Remove standard auth tokens
  localStorage.removeItem('supabase.auth.token');
  
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  
  // Clean sessionStorage if used
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
};
```

### Supabase Client Configuration
Our Supabase client is configured with recommended security settings:
```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Disabled for security
    flowType: 'implicit' // More reliable flow type
  }
});
```

### Preventing Auth Deadlocks
We use `setTimeout` to defer additional Supabase calls after auth state changes:
```typescript
supabase.auth.onAuthStateChange((event, currentSession) => {
  // Update state immediately
  setSession(currentSession);
  
  if (currentSession?.user) {
    // Defer profile fetching to avoid recursive RLS issues
    setTimeout(async () => {
      // Load profile and check admin status
    }, 100);
  }
});
```

### Robust Role Checking
We implement multiple strategies for checking admin status:
1. RPC function call (primary method)
2. Direct database query (fallback)
3. Known admin emails list (emergency fallback)

## Security Considerations

### Row Level Security (RLS)
All tables must have proper RLS policies to ensure data is only accessible to authorized users.

### Circular References
Avoid circular references in RLS policies that can cause deadlocks:
- Use security definer functions for role checks
- Avoid referencing the same table within its own RLS policy

### Multiple Authentication Checks
For critical operations, implement multiple ways to verify authentication:
- Session checks
- Token validation
- Role verification

## Troubleshooting

### Authentication Issues
1. Check browser console for errors
2. Verify localStorage/sessionStorage for conflicting auth tokens
3. Check if session token is expired
4. Try refreshing session or clearing auth state

### Authorization Issues
1. Verify user role in database
2. Check RLS policies for correctness
3. Test admin role checking function directly
4. Verify known admin emails list is up to date

### Emergency Admin Access
If admin access is lost:
1. Use direct database access to set admin role
2. Add user email to known admin emails list
3. Create a new admin user

## References
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/auth-helpers/nextjs#securing-api-routes)
