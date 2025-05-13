
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { toast } from 'sonner';

const SUPABASE_URL = "https://kgizusgqexmlfcqfjopk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTQwNzAsImV4cCI6MjA2MDEzMDA3MH0.NA2wRme-L8Z15my7n8u-BCQtO4Nw2opfsX0KSLYcs-I";

// Import from central service to avoid circular dependencies
import { isPreviewMode } from '../PreviewService';

// Standard supabase client with improved error handling
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  global: {
    // Use fetch with timeout to prevent hanging requests
    fetch: function(url, options) {
      // Create a fetch request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      return fetch(url, { 
        ...options, 
        signal: controller.signal 
      }).then(response => {
        clearTimeout(timeoutId);
        return response;
      }).catch(error => {
        clearTimeout(timeoutId);
        // Improved error logging for network issues
        if (error.name === 'AbortError') {
          console.error('Request timed out:', url);
          if (!isPreviewMode()) {
            toast.error('Request timed out. Please check your network connection.');
          }
        } else {
          console.error('Network error in supabase client:', error);
        }
        throw error;
      });
    }
  },
  realtime: {
    // Disable realtime features in preview mode
    params: {
      eventsPerSecond: isPreviewMode() ? 0 : 10
    }
  }
});

// Simple admin client without realtime for reduced complexity
export const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  realtime: {
    // Disable realtime connections completely
    params: {
      eventsPerSecond: 0
    }
  }
});

// Track failed requests to implement circuit breaker pattern
let consecutiveFailures = 0;
const MAX_FAILURES = 3;
const RESET_AFTER_MS = 30000; // 30 seconds

// Reset the failure counter after time period
setInterval(() => {
  if (consecutiveFailures > 0) {
    consecutiveFailures = 0;
  }
}, RESET_AFTER_MS);

// Helper to track API failures and implement circuit breaker
export const trackApiRequest = (success: boolean) => {
  if (!success) {
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_FAILURES) {
      console.warn('Circuit breaker activated: too many consecutive failures');
      // Only show toast in non-preview mode
      if (!isPreviewMode()) {
        toast.error('Having trouble connecting to the server. Please try again later.');
      }
      return false;
    }
  } else {
    // Reset on success
    consecutiveFailures = 0;
  }
  return true;
};
