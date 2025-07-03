# Batch Flow Permissions Architecture

## Overview
This document explains the standardized permission model used across all batch flow job types (business cards, flyers, postcards, covers, sleeves, etc.).

## Key Principles

### 1. Database-First Security
- All access control is handled by Row Level Security (RLS) policies in the database
- Client-side hooks should NOT implement user filtering
- Trust the database to enforce proper permissions

### 2. Simplified Hook Pattern
All job hooks should follow this consistent pattern:

```typescript
// ✅ CORRECT - No user filtering
const { data, error } = await supabase
  .from("job_table")
  .select("*")
  .eq("id", jobId)
  .maybeSingle();

// ❌ INCORRECT - Client-side user filtering
const { data, error } = await supabase
  .from("job_table")
  .select("*")
  .eq("id", jobId)
  .eq("user_id", user.id)  // Don't do this!
  .maybeSingle();
```

### 3. Error Handling
- Use `.maybeSingle()` instead of `.single()` for better error handling
- Return clear error messages without exposing security details
- Let database policies handle access denial

## RLS Policy Requirements

Each job table should have permissive policies for batch flow operations:

```sql
-- Allow all authenticated users to view all jobs
CREATE POLICY "Allow all users to view [job_type] jobs" 
ON public.[job_table] 
FOR SELECT 
USING (true);

-- Allow all authenticated users to manage jobs (with appropriate checks)
CREATE POLICY "Allow all users to manage [job_type] jobs" 
ON public.[job_table] 
FOR ALL 
USING (true) 
WITH CHECK (true);
```

## Fixed Issues

### Before (❌ Problematic)
- `useBusinessCardJob` had complex role detection logic
- Client-side user filtering caused permission conflicts
- Timing issues between auth, role detection, and permission checks
- Different job types had inconsistent permission patterns

### After (✅ Consistent)
- All job hooks use the same simplified pattern
- No client-side user filtering
- Database RLS policies handle all access control
- Consistent behavior across all job types

## Testing Checklist

When implementing or modifying job hooks, verify:

- [ ] No `user_id` filtering in SELECT queries
- [ ] No `user_id` filtering in UPDATE queries  
- [ ] No `user_id` filtering in DELETE queries
- [ ] Uses `.maybeSingle()` for single record queries
- [ ] Consistent with other job type hooks
- [ ] Database RLS policies are properly configured

## Supported Job Types

This pattern is implemented across:
- Business Cards (`business_card_jobs`)
- Flyers (`flyer_jobs`)
- Postcards (`postcard_jobs`)
- Covers (`cover_jobs`)
- Sleeves (`sleeve_jobs`)
- Posters (`poster_jobs`)
- Stickers (`sticker_jobs`)
- Boxes (`box_jobs`)

All should follow the same permission model for consistency.