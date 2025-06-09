
/**
 * Comprehensive UUID validation utilities to prevent database errors
 */

// Type guard for UUID validation
export const isValidUUID = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }
  
  if (!value || value.trim() === '') {
    return false;
  }
  
  // Check for common invalid string values that might be passed
  const invalidValues = [
    'undefined',
    'null',
    '0',
    'false',
    'true',
    'NaN',
    'Infinity',
    '-Infinity',
    ''
  ];
  
  if (invalidValues.includes(value.trim())) {
    return false;
  }
  
  // UUID v4 regex pattern
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

// Safe UUID validation with detailed logging
export const validateUUIDWithLogging = (
  value: unknown, 
  context: string = 'unknown'
): string | null => {
  console.log(`🔍 UUID Validation [${context}]:`, {
    value,
    type: typeof value,
    stringified: JSON.stringify(value)
  });
  
  if (!isValidUUID(value)) {
    console.error(`❌ Invalid UUID [${context}]:`, value);
    return null;
  }
  
  console.log(`✅ Valid UUID [${context}]:`, value);
  return value;
};

// Validate an array of UUIDs
export const validateUUIDArray = (
  values: unknown[], 
  context: string = 'unknown'
): string[] => {
  const validUUIDs: string[] = [];
  
  values.forEach((value, index) => {
    const validatedUUID = validateUUIDWithLogging(value, `${context}[${index}]`);
    if (validatedUUID) {
      validUUIDs.push(validatedUUID);
    }
  });
  
  return validUUIDs;
};

// Safe UUID conversion with fallback
export const safeUUIDConversion = (value: unknown): string => {
  if (isValidUUID(value)) {
    return value;
  }
  
  // Generate a temporary UUID for fallback scenarios
  // This should only be used in non-critical contexts
  console.warn('⚠️ Invalid UUID detected, using fallback');
  return '00000000-0000-0000-0000-000000000000';
};
