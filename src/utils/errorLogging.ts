export const logError = (context: string, error: any, additionalData?: any) => {
  console.group(`❌ ${context}`);
  console.error('Error:', error);
  if (error?.response) {
    console.error('Response Status:', error.response.status);
    console.error('Response Data:', error.response.data);
  }
  if (error?.message) {
    console.error('Message:', error.message);
  }
  if (additionalData) {
    console.error('Additional Data:', additionalData);
  }
  console.groupEnd();
  
  // Also send to console for debugging
  if (error?.response?.status === 400) {
    console.warn('🔍 400 Bad Request detected - this may be a data validation issue');
  }
};

export const logApiCall = (method: string, url: string, data?: any) => {
  console.group(`🌐 API Call: ${method} ${url}`);
  if (data) {
    console.log('Request Data:', data);
  }
  console.groupEnd();
};

export const enhanceSupabaseError = (error: any, context: string) => {
  console.group(`🔧 Enhanced Supabase Error - ${context}`);
  console.error('Original Error:', error);
  
  if (error?.code) {
    console.error('Error Code:', error.code);
  }
  
  if (error?.details) {
    console.error('Error Details:', error.details);
  }
  
  if (error?.hint) {
    console.error('Error Hint:', error.hint);
  }
  
  if (error?.message) {
    console.error('Error Message:', error.message);
  }
  
  console.groupEnd();
  
  return error;
};